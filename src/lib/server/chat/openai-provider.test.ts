import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_OPENAI_MODEL, OPENAI_MAX_RETRIES } from '../analysis/openai-provider';
import { createSourceSnapshot } from '../analysis/source';
import { ChatError } from './errors';
import {
	CHAT_MAX_OUTPUT_TOKENS,
	CHAT_REASONING_EFFORT,
	CHAT_TIMEOUT_MS,
	createOpenAIChatProvider
} from './openai-provider';
import type { ChatClientFactory } from './openai-provider';
import { CHAT_INSTRUCTIONS } from './prompt';
import { POLICY_TEXT, SHARING_SENTENCE } from './test-fixtures';

type Capture = { options?: unknown; body?: unknown; requestOptions?: unknown; calls: number };

const ANSWER = {
	kind: 'answered',
	answer: 'Location history is shared with mapping partners.',
	excerpts: [{ passageId: 'P001', excerpt: SHARING_SENTENCE }]
};

function messageWithText(text: string) {
	return [{ type: 'message', content: [{ type: 'output_text', text }] }];
}

function factoryReturning(responseOrError: unknown, capture: Capture): ChatClientFactory {
	return (options) => {
		capture.options = options;
		return {
			responses: {
				create: vi.fn(async (body, requestOptions) => {
					capture.calls += 1;
					capture.body = body;
					capture.requestOptions = requestOptions;
					if (responseOrError instanceof Error) throw responseOrError;
					return responseOrError;
				})
			}
		};
	};
}

async function modelInput() {
	return {
		snapshot: await createSourceSnapshot(POLICY_TEXT, { title: 'Example Maps Privacy Policy' }),
		findings: [],
		history: [{ role: 'user' as const, text: 'Do they track me?' }],
		question: 'Who gets my location?'
	};
}

describe('OpenAI chat provider', () => {
	it('makes one bounded, unstored call with the chat prompt and schema', async () => {
		const capture: Capture = { calls: 0 };
		const provider = createOpenAIChatProvider(
			{ apiKey: 'test-key' },
			factoryReturning(
				{
					status: 'completed',
					output: messageWithText(JSON.stringify(ANSWER)),
					model: DEFAULT_OPENAI_MODEL,
					usage: { input_tokens: 50, output_tokens: 10, total_tokens: 60 }
				},
				capture
			)
		);
		const result = await provider.answer(await modelInput());

		expect(capture.calls).toBe(1);
		expect(capture.options).toMatchObject({
			maxRetries: OPENAI_MAX_RETRIES,
			timeout: CHAT_TIMEOUT_MS,
			logLevel: 'off'
		});
		expect(capture.requestOptions).toMatchObject({ maxRetries: OPENAI_MAX_RETRIES });
		expect(capture.body).toMatchObject({
			model: DEFAULT_OPENAI_MODEL,
			reasoning: { effort: CHAT_REASONING_EFFORT },
			instructions: CHAT_INSTRUCTIONS,
			max_output_tokens: CHAT_MAX_OUTPUT_TOKENS,
			store: false,
			truncation: 'disabled',
			text: { format: { name: 'clearconsent_chat_answer', strict: true } }
		});
		expect(capture.body).not.toHaveProperty('tools');
		expect(capture.body).not.toHaveProperty('previous_response_id');
		const input = JSON.parse((capture.body as { input: string }).input);
		expect(input.question).toBe('Who gets my location?');
		expect(input.history).toEqual([{ role: 'user', text: 'Do they track me?' }]);
		expect(result).toEqual({
			output: ANSWER,
			model: DEFAULT_OPENAI_MODEL,
			usage: { inputTokens: 50, outputTokens: 10, reasoningTokens: 0, totalTokens: 60 }
		});
	});

	it('uses the configured model', async () => {
		const capture: Capture = { calls: 0 };
		const provider = createOpenAIChatProvider(
			{ apiKey: 'test-key', model: 'gpt-other' },
			factoryReturning(
				{ status: 'completed', output: messageWithText(JSON.stringify(ANSWER)) },
				capture
			)
		);
		const result = await provider.answer(await modelInput());
		expect(capture.body).toMatchObject({ model: 'gpt-other' });
		expect(result.model).toBe('gpt-other');
	});

	it.each([
		[
			'truncation',
			{ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] },
			'provider_truncated'
		],
		['a failed response', { status: 'failed', output: [] }, 'provider_unavailable'],
		[
			'refusal',
			{
				status: 'completed',
				output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Cannot help.' }] }]
			},
			'provider_refusal'
		],
		['no output text', { status: 'completed', output: [] }, 'provider_malformed'],
		[
			'invalid JSON',
			{ status: 'completed', output: messageWithText('{"kind":') },
			'provider_malformed'
		],
		[
			'rate limit',
			new OpenAI.RateLimitError(429, { code: 'rate_limit_exceeded' }, 'slow down', new Headers()),
			'provider_rate_limit'
		],
		['timeout', new OpenAI.APIConnectionTimeoutError({ message: 'timed out' }), 'provider_timeout']
	])('maps %s to the same error code as analysis', async (_name, response, code) => {
		const capture: Capture = { calls: 0 };
		const provider = createOpenAIChatProvider(
			{ apiKey: 'test-key' },
			factoryReturning(response, capture)
		);
		await expect(provider.answer(await modelInput())).rejects.toMatchObject({ code });
		expect(capture.calls).toBe(1);
	});

	it('attaches model and usage to failures that happen after the model responded', async () => {
		const provider = createOpenAIChatProvider(
			{ apiKey: 'test-key' },
			factoryReturning(
				{
					status: 'completed',
					model: DEFAULT_OPENAI_MODEL,
					output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Cannot help.' }] }],
					usage: { input_tokens: 40, output_tokens: 12, total_tokens: 52 }
				},
				{ calls: 0 }
			)
		);
		const error = await provider.answer(await modelInput()).catch((caught) => caught);

		expect(error).toBeInstanceOf(ChatError);
		expect(error).toMatchObject({
			code: 'provider_refusal',
			call: { model: DEFAULT_OPENAI_MODEL, usage: { totalTokens: 52 } }
		});
	});

	it('does not attach usage when no response arrived', async () => {
		const provider = createOpenAIChatProvider(
			{ apiKey: 'test-key' },
			factoryReturning(new OpenAI.APIConnectionTimeoutError({ message: 'timed out' }), {
				calls: 0
			})
		);
		const error = await provider.answer(await modelInput()).catch((caught) => caught);

		expect(error).not.toBeInstanceOf(ChatError);
		expect(error).toMatchObject({ code: 'provider_timeout' });
	});
});
