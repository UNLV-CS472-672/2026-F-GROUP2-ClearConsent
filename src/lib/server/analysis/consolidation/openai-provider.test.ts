import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import {
	OPENAI_MAX_OUTPUT_TOKENS,
	OPENAI_MAX_RETRIES,
	OPENAI_TIMEOUT_MS
} from '../openai-provider';
import { ConsolidationError } from './errors';
import { createOpenAIConsolidationProvider } from './openai-provider';
import type { ConsolidationClientFactory } from './openai-provider';
import { CONSOLIDATION_INSTRUCTIONS } from './prompt';
import { fitnessCandidates, extractionResult, SUMMARY } from './test-fixtures';

type Capture = { options?: unknown; body?: unknown; requestOptions?: unknown; calls: number };

function factoryReturning(responseOrError: unknown, capture: Capture): ConsolidationClientFactory {
	return (options) => {
		capture.options = options;
		return {
			responses: {
				create: vi.fn(async (body, requestOptions) => {
					capture.calls += 1;
					capture.body = body;
					capture.requestOptions = requestOptions;
					if (responseOrError instanceof Error) throw responseOrError;
					if (
						responseOrError &&
						typeof responseOrError === 'object' &&
						'output_parsed' in responseOrError &&
						responseOrError.output_parsed
					) {
						return {
							...responseOrError,
							output: [
								{
									type: 'message',
									content: [
										{ type: 'output_text', text: JSON.stringify(responseOrError.output_parsed) }
									]
								}
							]
						};
					}
					return responseOrError;
				})
			}
		};
	};
}

async function modelInput() {
	const stage1 = await extractionResult(fitnessCandidates(), { sharing: 'major' });
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
		const provider = createOpenAIConsolidationProvider(
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
			instructions: CONSOLIDATION_INSTRUCTIONS,
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
			'refusal',
			{
				status: 'completed',
				output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Cannot process.' }] }],
				output_parsed: null
			},
			'provider_refusal'
		],
		[
			'rate limit',
			new OpenAI.RateLimitError(429, { code: 'rate_limit_exceeded' }, 'slow down', new Headers()),
			'provider_rate_limit'
		],
		['timeout', new OpenAI.APIConnectionTimeoutError({ message: 'timed out' }), 'provider_timeout']
	])('maps %s to the same error code as extraction', async (_name, response, code) => {
		const capture: Capture = { calls: 0 };
		const provider = createOpenAIConsolidationProvider(
			{ apiKey: 'test-key' },
			factoryReturning(response, capture)
		);
		await expect(provider.consolidate(await modelInput())).rejects.toMatchObject({ code });
		expect(capture.calls).toBe(1);
	});

	it('attaches model and usage to failures that happen after the model responded', async () => {
		const usage = { input_tokens: 40, output_tokens: 12, total_tokens: 52 };
		const refusal = {
			status: 'completed',
			model: 'gpt-6-luna',
			output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Cannot process.' }] }],
			output_parsed: null,
			usage
		};
		const provider = createOpenAIConsolidationProvider(
			{ apiKey: 'test-key' },
			factoryReturning(refusal, { calls: 0 })
		);
		const error = await provider.consolidate(await modelInput()).catch((caught) => caught);

		expect(error).toBeInstanceOf(ConsolidationError);
		expect(error).toMatchObject({
			code: 'provider_refusal',
			status: 422,
			call: { model: 'gpt-6-luna', usage: { totalTokens: 52 } }
		});
	});

	it('does not attach usage when no response arrived', async () => {
		const provider = createOpenAIConsolidationProvider(
			{ apiKey: 'test-key' },
			factoryReturning(new OpenAI.APIConnectionTimeoutError({ message: 'timed out' }), { calls: 0 })
		);
		const error = await provider.consolidate(await modelInput()).catch((caught) => caught);

		expect(error).not.toBeInstanceOf(ConsolidationError);
		expect(error).toMatchObject({ code: 'provider_timeout' });
	});
});
