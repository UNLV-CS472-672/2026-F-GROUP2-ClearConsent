import { describe, expect, it } from 'vitest';
import { Stage1Error } from '../analysis/errors';
import { answerQuestion, MAX_QUESTION_CHARACTERS, normalizeQuestion } from './answer';
import { ChatError } from './errors';
import { CHAT_HISTORY_MESSAGES } from './prompt';
import type { ChatProvider } from './provider';
import {
	fakeProvider,
	POLICY_TEXT,
	questionInput,
	SETTINGS_SENTENCE,
	SHARING_SENTENCE
} from './test-fixtures';

describe('normalizeQuestion', () => {
	it('trims the question', () => {
		expect(normalizeQuestion('  Who gets my location?\n')).toBe('Who gets my location?');
	});

	it.each([
		['an empty question', '', 'input_empty'],
		['a whitespace-only question', ' \n\t ', 'input_empty'],
		['a question that is not a string', 42, 'invalid_request'],
		['a question over the limit', 'a'.repeat(MAX_QUESTION_CHARACTERS + 1), 'input_too_large']
	])('rejects %s', (_name, question, code) => {
		expect(() => normalizeQuestion(question)).toThrow(expect.objectContaining({ code }));
	});

	it('accepts a question at the limit', () => {
		const question = 'a'.repeat(MAX_QUESTION_CHARACTERS);
		expect(normalizeQuestion(question)).toBe(question);
	});
});

describe('answerQuestion', () => {
	it('answers from the document with an excerpt located in the source', async () => {
		const { provider, calls } = fakeProvider({
			kind: 'answered',
			answer: 'Location history is shared with mapping partners to improve route suggestions.',
			excerpts: [{ passageId: 'P001', excerpt: SHARING_SENTENCE }]
		});
		const result = await answerQuestion(
			questionInput({ question: '  Who gets my location?  ' }),
			provider
		);

		expect(result.kind).toBe('answered');
		expect(result.excerpts).toHaveLength(1);
		const [excerpt] = result.excerpts;
		expect(POLICY_TEXT.slice(excerpt.startOffset, excerpt.endOffset)).toBe(SHARING_SENTENCE);
		expect(excerpt).toMatchObject({ passageId: 'P001', match: 'exact' });
		expect(result.provider).toEqual({ model: 'gpt-test', usage: expect.any(Object) });
		expect(calls).toHaveLength(1);
		expect(calls[0].question).toBe('Who gets my location?');
	});

	it('returns quotes sliced from the source when the model changed only quote marks or spacing', async () => {
		const { provider } = fakeProvider({
			kind: 'answered',
			answer: 'You can turn it off in settings.',
			excerpts: [
				{
					passageId: 'P001',
					excerpt: 'You can turn off location  sharing at any time in Settings > Privacy.'
				}
			]
		});
		const result = await answerQuestion(questionInput(), provider);
		expect(result.excerpts[0]).toMatchObject({ excerpt: SETTINGS_SENTENCE, match: 'normalized' });
	});

	it.each(['', '   ', '\n'])(
		'rejects the question %j before any provider call',
		async (question) => {
			const { provider, calls } = fakeProvider(null);
			await expect(answerQuestion(questionInput({ question }), provider)).rejects.toMatchObject({
				code: 'input_empty',
				status: 400
			});
			expect(calls).toHaveLength(0);
		}
	);

	it('rejects an oversized question before any provider call', async () => {
		const { provider, calls } = fakeProvider(null);
		const question = 'a'.repeat(MAX_QUESTION_CHARACTERS + 1);
		await expect(answerQuestion(questionInput({ question }), provider)).rejects.toMatchObject({
			code: 'input_too_large'
		});
		expect(calls).toHaveLength(0);
	});

	it('refuses to answer when the analysis has no source text', async () => {
		const { provider, calls } = fakeProvider(null);
		await expect(answerQuestion(questionInput({ sourceText: '' }), provider)).rejects.toMatchObject(
			{ code: 'invalid_request' }
		);
		expect(calls).toHaveLength(0);
	});

	it('says the document does not answer without needing an excerpt', async () => {
		const answer = 'The policy does not say whether location data is sold.';
		const { provider } = fakeProvider({ kind: 'not_in_policy', answer, excerpts: [] });
		const result = await answerQuestion(
			questionInput({ question: 'Do they sell my location?' }),
			provider
		);
		expect(result).toMatchObject({ kind: 'not_in_policy', answer, excerpts: [] });
	});

	it('cites nothing for an unrelated question, even if the model did', async () => {
		const { provider } = fakeProvider({
			kind: 'out_of_scope',
			answer: 'I can only answer questions about this document.',
			excerpts: [{ passageId: 'P001', excerpt: SHARING_SENTENCE }]
		});
		const result = await answerQuestion(
			questionInput({ question: 'Write me a poem about the ocean.' }),
			provider
		);
		expect(result).toMatchObject({ kind: 'out_of_scope', excerpts: [] });
	});

	it('keeps the excerpts that describe the document in a legal-advice limitation', async () => {
		const { provider } = fakeProvider({
			kind: 'legal_advice',
			answer:
				'I cannot give legal advice. The policy says location history is shared with mapping partners.',
			excerpts: [{ passageId: 'P001', excerpt: SHARING_SENTENCE }]
		});
		const result = await answerQuestion(
			questionInput({ question: 'Is it legal for them to share my location?' }),
			provider
		);
		expect(result.kind).toBe('legal_advice');
		expect(result.excerpts.map((excerpt) => excerpt.excerpt)).toEqual([SHARING_SENTENCE]);
	});

	it('drops excerpts it cannot find and keeps each located one once', async () => {
		const { provider } = fakeProvider({
			kind: 'answered',
			answer: 'Location history is shared with mapping partners.',
			excerpts: [
				{ passageId: 'P001', excerpt: 'We sell location history to advertisers.' },
				{ passageId: 'P001', excerpt: SHARING_SENTENCE },
				{ passageId: 'P001', excerpt: SHARING_SENTENCE },
				{ passageId: 'P999', excerpt: SETTINGS_SENTENCE },
				{ passageId: ' ', excerpt: SETTINGS_SENTENCE }
			]
		});
		const result = await answerQuestion(questionInput(), provider);
		expect(result.excerpts.map((excerpt) => excerpt.excerpt)).toEqual([SHARING_SENTENCE]);
	});

	it('fails instead of showing an answer when none of its excerpts are in the document', async () => {
		const { provider } = fakeProvider({
			kind: 'answered',
			answer: 'Location history is sold to advertisers.',
			excerpts: [{ passageId: 'P001', excerpt: 'We sell location history to advertisers.' }]
		});
		const error = await answerQuestion(questionInput(), provider).catch((caught) => caught);

		expect(error).toBeInstanceOf(ChatError);
		expect(error).toMatchObject({
			code: 'reference_validation_failed',
			call: { model: 'gpt-test', usage: { totalTokens: 120 } }
		});
	});

	it('fails when an answer claims support but cites nothing', async () => {
		const { provider } = fakeProvider({
			kind: 'answered',
			answer: 'Location history is shared.',
			excerpts: []
		});
		await expect(answerQuestion(questionInput(), provider)).rejects.toMatchObject({
			code: 'reference_validation_failed'
		});
	});

	it.each(['legal_advice', 'not_in_policy'])(
		'fails a %s reply whose cited quotes are not in the document',
		async (kind) => {
			const { provider } = fakeProvider({
				kind,
				answer: 'I cannot give legal advice, but the policy says location is sold to brokers.',
				excerpts: [{ passageId: 'P001', excerpt: 'We sell location history to data brokers.' }]
			});
			await expect(answerQuestion(questionInput(), provider)).rejects.toMatchObject({
				code: 'reference_validation_failed'
			});
		}
	);

	it('keeps a legal-advice limit that cites nothing', async () => {
		const answer = 'I cannot give legal advice about whether this is enforceable.';
		const { provider } = fakeProvider({ kind: 'legal_advice', answer, excerpts: [] });
		const result = await answerQuestion(questionInput(), provider);
		expect(result).toMatchObject({ kind: 'legal_advice', answer, excerpts: [] });
	});

	it.each([
		['a blank answer', { kind: 'answered', answer: '  ', excerpts: [] }],
		['an unknown kind', { kind: 'chat', answer: 'Hello!', excerpts: [] }],
		['extra fields', { kind: 'not_in_policy', answer: 'No.', excerpts: [], legal: true }]
	])('rejects %s as malformed', async (_name, output) => {
		const { provider } = fakeProvider(output);
		await expect(answerQuestion(questionInput(), provider)).rejects.toMatchObject({
			code: 'provider_malformed'
		});
	});

	it(`sends only the last ${CHAT_HISTORY_MESSAGES} messages of the history`, async () => {
		const history = Array.from({ length: 10 }, (_, index) => ({
			role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
			text: `message ${index}`
		}));
		const { provider, calls } = fakeProvider({
			kind: 'not_in_policy',
			answer: 'The policy does not say.',
			excerpts: []
		});
		await answerQuestion(questionInput({ history }), provider);
		expect(calls[0].history).toEqual(history.slice(-CHAT_HISTORY_MESSAGES));
	});

	it('uses only the given analysis as context', async () => {
		const other = 'We never collect location data of any kind from anyone.';
		const { provider, calls } = fakeProvider({
			kind: 'not_in_policy',
			answer: 'The policy does not say.',
			excerpts: []
		});
		await answerQuestion(questionInput(), provider);
		await answerQuestion(questionInput({ sourceText: other, findings: [] }), provider);

		const texts = calls.map((call) =>
			call.snapshot.passages.map((passage) => passage.text).join('')
		);
		expect(texts).toEqual([POLICY_TEXT, other]);
		expect(calls[1].findings).toEqual([]);
	});

	it('passes provider failures through unchanged', async () => {
		const timeout = new Stage1Error('provider_timeout', 504, 'The analysis provider timed out.', {
			retryable: true
		});
		const provider: ChatProvider = {
			answer: async () => {
				throw timeout;
			}
		};
		await expect(answerQuestion(questionInput(), provider)).rejects.toBe(timeout);
	});
});
