import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { Stage1Error } from './errors';
import {
	createOpenAIStage1Provider,
	OPENAI_MAX_ATTEMPTS,
	OPENAI_MAX_OUTPUT_TOKENS,
	OPENAI_MAX_RETRIES,
	OPENAI_TIMEOUT_MS
} from './openai-provider';
import type { OpenAIClientFactory } from './openai-provider';
import { createSourceSnapshot } from './source';

function factoryReturning(
	responseOrError: unknown,
	capture: { options?: unknown; body?: unknown; requestOptions?: unknown; calls: number }
): OpenAIClientFactory {
	return (options) => {
		capture.options = options;
		return {
			responses: {
				parse: vi.fn(async (body, requestOptions) => {
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

describe('OpenAI Stage 1 provider', () => {
	it('uses one bounded attempt, no tools, no storage, and no SDK retries', async () => {
		const capture: { options?: unknown; body?: unknown; requestOptions?: unknown; calls: number } =
			{
				calls: 0
			};
		const provider = createOpenAIStage1Provider(
			{ apiKey: 'test-key' },
			factoryReturning(
				{
					status: 'completed',
					incomplete_details: null,
					output: [],
					output_parsed: { candidates: [] },
					model: 'gpt-6-luna',
					usage: {
						input_tokens: 100,
						output_tokens: 20,
						total_tokens: 120,
						output_tokens_details: { reasoning_tokens: 10 }
					}
				},
				capture
			)
		);
		const snapshot = await createSourceSnapshot('We do not sell personal data.');
		const result = await provider.extract(snapshot);

		expect(capture.calls).toBe(1);
		expect(capture.options).toMatchObject({
			apiKey: 'test-key',
			maxRetries: OPENAI_MAX_RETRIES,
			timeout: OPENAI_TIMEOUT_MS
		});
		expect(capture.requestOptions).toMatchObject({
			maxRetries: OPENAI_MAX_RETRIES,
			timeout: OPENAI_TIMEOUT_MS
		});
		expect(capture.body).toMatchObject({
			model: 'gpt-6-luna',
			reasoning: { effort: 'medium' },
			max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
			store: false,
			truncation: 'disabled'
		});
		expect(capture.body).not.toHaveProperty('tools');
		expect(result.attempts).toBe(OPENAI_MAX_ATTEMPTS);
		expect(result.usage).toEqual({
			inputTokens: 100,
			outputTokens: 20,
			reasoningTokens: 10,
			totalTokens: 120
		});
	});

	it.each([
		[
			'refusal',
			{
				status: 'completed',
				output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Cannot process.' }] }],
				output_parsed: null
			},
			'provider_refusal'
		],
		[
			'truncation',
			{
				status: 'incomplete',
				incomplete_details: { reason: 'max_output_tokens' },
				output: [],
				output_parsed: null
			},
			'provider_truncated'
		],
		[
			'malformed output',
			{ status: 'completed', output: [], output_parsed: { candidates: [{ claim: 42 }] } },
			'provider_malformed'
		]
	])('keeps %s distinct', async (_name, response, expectedCode) => {
		const capture = { calls: 0 };
		const provider = createOpenAIStage1Provider(
			{ apiKey: 'test-key' },
			factoryReturning(response, capture)
		);
		const snapshot = await createSourceSnapshot('We do not sell personal data.');
		await expect(provider.extract(snapshot)).rejects.toMatchObject({ code: expectedCode });
	});

	it.each([
		['timeout', new OpenAI.APIConnectionTimeoutError({ message: 'timed out' }), 'provider_timeout'],
		[
			'credential failure',
			new OpenAI.AuthenticationError(
				401,
				{ code: 'invalid_api_key' },
				'invalid key',
				new Headers()
			),
			'provider_authentication'
		],
		[
			'quota failure',
			new OpenAI.RateLimitError(
				429,
				{ code: 'insufficient_quota' },
				'quota exhausted',
				new Headers()
			),
			'provider_quota'
		],
		[
			'rate limit',
			new OpenAI.RateLimitError(429, { code: 'rate_limit_exceeded' }, 'slow down', new Headers()),
			'provider_rate_limit'
		]
	])('maps %s without retrying', async (_name, providerError, expectedCode) => {
		const capture = { calls: 0 };
		const provider = createOpenAIStage1Provider(
			{ apiKey: 'test-key' },
			factoryReturning(providerError, capture)
		);
		const snapshot = await createSourceSnapshot('We do not sell personal data.');

		await expect(provider.extract(snapshot)).rejects.toMatchObject({
			code: expectedCode
		});
		expect(capture.calls).toBe(1);
	});

	it('surfaces controlled Stage1 errors unchanged', async () => {
		const expected = new Stage1Error('provider_timeout', 504, 'timed out');
		const capture = { calls: 0 };
		const provider = createOpenAIStage1Provider(
			{ apiKey: 'test-key' },
			factoryReturning(expected, capture)
		);
		const snapshot = await createSourceSnapshot('We do not sell personal data.');
		await expect(provider.extract(snapshot)).rejects.toBe(expected);
	});
});
