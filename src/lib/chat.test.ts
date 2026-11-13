import { describe, expect, it } from 'vitest';
import {
	CONFLICT_MESSAGES,
	UNKNOWN_KIND_LABEL,
	checkQuestion,
	kindLabel,
	readAskResponse,
	readStateResponse,
	type AnswerKind,
	type ChatMessage
} from './chat';
import { MAX_QUESTION_CHARACTERS } from './constants';

const question: ChatMessage = {
	id: 'q1',
	role: 'user',
	content: 'Who gets my location?',
	kind: null,
	excerpts: [],
	createdAt: '2026-11-12T20:00:00Z'
};

const answer: ChatMessage = {
	id: 'a1',
	role: 'assistant',
	content: 'Advertising partners, if you turn on personalized ads.',
	kind: 'answered',
	excerpts: [
		{
			excerpt: 'we share your location with our advertising partners',
			startOffset: 120,
			endOffset: 172,
			passageId: 'P2',
			match: 'exact'
		}
	],
	createdAt: '2026-11-12T20:00:05Z'
};

function errorBody(code: string) {
	return { error: { code, message: 'Server wording.', retryable: false } };
}

describe('checkQuestion', () => {
	it('rejects an empty question', () => {
		expect(checkQuestion('')).toEqual({ ok: false, reason: 'empty' });
	});

	it('rejects a question that is only whitespace', () => {
		expect(checkQuestion('  \n\t ')).toEqual({ ok: false, reason: 'empty' });
	});

	it('trims the question it returns', () => {
		expect(checkQuestion('  Who gets my data?  ')).toEqual({
			ok: true,
			question: 'Who gets my data?'
		});
	});

	it('accepts exactly the limit', () => {
		expect(checkQuestion('a'.repeat(MAX_QUESTION_CHARACTERS)).ok).toBe(true);
	});

	it('rejects one character over the limit', () => {
		expect(checkQuestion('a'.repeat(MAX_QUESTION_CHARACTERS + 1))).toEqual({
			ok: false,
			reason: 'too_long'
		});
	});

	it('does not count surrounding spaces toward the limit, like the server', () => {
		expect(checkQuestion(`  ${'a'.repeat(MAX_QUESTION_CHARACTERS)}  `).ok).toBe(true);
	});
});

describe('kindLabel', () => {
	it('has no label for a question', () => {
		expect(kindLabel(null)).toBeNull();
	});

	it('labels each answer kind differently', () => {
		const kinds: AnswerKind[] = ['answered', 'not_in_policy', 'out_of_scope', 'legal_advice'];
		const labels = kinds.map(kindLabel);
		expect(new Set(labels).size).toBe(kinds.length);
		expect(labels).not.toContain(null);
	});

	it('falls back for a kind the UI does not know yet', () => {
		expect(kindLabel('new_kind' as AnswerKind)).toBe(UNKNOWN_KIND_LABEL);
	});
});

describe('readAskResponse', () => {
	it('returns both messages on success', async () => {
		const outcome = await readAskResponse(Response.json({ question, answer }));
		expect(outcome).toEqual({ type: 'answered', question, answer });
	});

	it('treats a 200 without both messages as a failure, not an answer', async () => {
		const outcome = await readAskResponse(Response.json({ question }));
		expect(outcome.type).toBe('error');
	});

	it.each(['running', 'nothing_to_retry', 'question_limit'] as const)(
		'reports a 409 %s as a conflict',
		async (status) => {
			const outcome = await readAskResponse(Response.json({ status }, { status: 409 }));
			expect(outcome).toEqual({ type: 'conflict', status, message: CONFLICT_MESSAGES[status] });
		}
	);

	it('treats an unknown 409 status as a failure', async () => {
		const outcome = await readAskResponse(Response.json({ status: 'surprise' }, { status: 409 }));
		expect(outcome.type).toBe('error');
	});

	it('explains that chat is turned off when paid calls are disabled', async () => {
		const outcome = await readAskResponse(
			Response.json(errorBody('analysis_disabled'), { status: 503 })
		);
		expect(outcome).toMatchObject({ type: 'error', status: 503, code: 'analysis_disabled' });
		expect(outcome.type === 'error' && outcome.message).toMatch(/turned off/);
	});

	it('explains a reply that cited text not in the policy', async () => {
		const outcome = await readAskResponse(
			Response.json(errorBody('reference_validation_failed'), { status: 502 })
		);
		expect(outcome.type === 'error' && outcome.message).toMatch(/isn't in the policy/);
	});

	it('uses one message for every provider_* code', async () => {
		const timeout = await readAskResponse(
			Response.json(errorBody('provider_timeout'), { status: 504 })
		);
		const refused = await readAskResponse(
			Response.json(errorBody('provider_refused'), { status: 502 })
		);
		expect(timeout.type === 'error' && timeout.message).toBe(
			refused.type === 'error' && refused.message
		);
	});

	it('does not show the server wording directly', async () => {
		const outcome = await readAskResponse(Response.json(errorBody('input_empty'), { status: 400 }));
		expect(outcome.type === 'error' && outcome.message).not.toBe('Server wording.');
	});

	it('handles a plain 401 with no error body', async () => {
		const outcome = await readAskResponse(new Response(null, { status: 401 }));
		expect(outcome).toMatchObject({ type: 'error', status: 401, code: null });
		expect(outcome.type === 'error' && outcome.message).toMatch(/Sign in/);
	});

	it('does not throw on a body that is not JSON', async () => {
		const outcome = await readAskResponse(new Response('<h1>Error</h1>', { status: 500 }));
		expect(outcome).toMatchObject({ type: 'error', status: 500, code: null });
	});
});

describe('readStateResponse', () => {
	it('returns the chat state', async () => {
		const state = { messages: [question, answer], pending: null };
		const outcome = await readStateResponse(Response.json(state));
		expect(outcome).toEqual({ type: 'loaded', state });
	});

	it('keeps a failed pending answer for Try again', async () => {
		const state = {
			messages: [question],
			pending: {
				status: 'failed',
				questionId: 'q1',
				error: { code: 'answer_interrupted', message: 'Stopped.' }
			}
		};
		const outcome = await readStateResponse(Response.json(state));
		expect(outcome).toEqual({ type: 'loaded', state });
	});

	it('reports a missing analysis', async () => {
		const outcome = await readStateResponse(new Response(null, { status: 404 }));
		expect(outcome).toMatchObject({ type: 'error', status: 404 });
		expect(outcome.type === 'error' && outcome.message).toMatch(/couldn't be found/);
	});

	it('treats a failed read as a failure, not an empty chat', async () => {
		const outcome = await readStateResponse(new Response(null, { status: 500 }));
		expect(outcome.type).toBe('error');
	});

	it('treats a malformed 200 as a failure', async () => {
		const outcome = await readStateResponse(Response.json({ messages: 'nope' }));
		expect(outcome.type).toBe('error');
	});
});
