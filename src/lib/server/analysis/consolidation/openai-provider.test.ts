import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import type { OpenAIClientFactory } from '../openai-provider';
import {
	OPENAI_MAX_OUTPUT_TOKENS,
	OPENAI_MAX_RETRIES,
	OPENAI_TIMEOUT_MS
} from '../openai-provider';
import { createOpenAIStage2Provider } from './openai-provider';
import { STAGE2_INSTRUCTIONS } from './prompt';
import { fitnessCandidates, stage1Result, SUMMARY } from './test-fixtures';

type Capture = { options?: unknown; body?: unknown; requestOptions?: unknown; calls: number };

function factoryReturning(responseOrError: unknown, capture: Capture): OpenAIClientFactory {
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

async function modelInput() {
	const stage1 = await stage1Result(fitnessCandidates(), { sharing: 'major' });
	return {
		source: stage1.source,
		candidates: stage1.candidates,
		preferences: { sharing: 'major' }
	};
}

describe('OpenAI Stage 2 provider', () => {
	it('makes one bounded, unstored call with the Stage 2 prompt and schema', async () => {
		const capture: Capture = { calls: 0 };
		const parsed = { summary: SUMMARY, findings: [], exclusions: [] };
		const provider = createOpenAIStage2Provider(
			{ apiKey: 'test-key' },
			factoryReturning(
				{
					status: 'completed',
					output: [],
					output_parsed: parsed,
					model: 'gpt-6-luna',
					usage: { input_tokens: 50, output_tokens: 10, total_tokens: 60 }
				},
				capture
			)
		);
		const result = await provider.consolidate(await modelInput());

		expect(capture.calls).toBe(1);
		expect(capture.options).toMatchObject({
			maxRetries: OPENAI_MAX_RETRIES,
			timeout: OPENAI_TIMEOUT_MS
		});
		expect(capture.requestOptions).toMatchObject({ maxRetries: OPENAI_MAX_RETRIES });
		expect(capture.body).toMatchObject({
			model: 'gpt-6-luna',
			instructions: STAGE2_INSTRUCTIONS,
			max_output_tokens: OPENAI_MAX_OUTPUT_TOKENS,
			store: false,
			truncation: 'disabled',
			text: { format: { name: 'clearconsent_stage2_findings', strict: true } }
		});
		expect(capture.body).not.toHaveProperty('tools');
		const input = JSON.parse((capture.body as { input: string }).input);
		expect(input.preferences).toEqual({ sharing: 'major' });
		expect(input.candidates).toHaveLength(7);
		expect(result).toMatchObject({ output: parsed, attempts: 1, usage: { totalTokens: 60 } });
	});

	it.each([
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
			'rate limit',
			new OpenAI.RateLimitError(429, { code: 'rate_limit_exceeded' }, 'slow down', new Headers()),
			'provider_rate_limit'
		],
		['timeout', new OpenAI.APIConnectionTimeoutError({ message: 'timed out' }), 'provider_timeout']
	])('maps %s to the same error code as Stage 1', async (_name, response, code) => {
		const capture: Capture = { calls: 0 };
		const provider = createOpenAIStage2Provider(
			{ apiKey: 'test-key' },
			factoryReturning(response, capture)
		);
		await expect(provider.consolidate(await modelInput())).rejects.toMatchObject({ code });
		expect(capture.calls).toBe(1);
	});
});
