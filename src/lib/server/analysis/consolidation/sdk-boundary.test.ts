// @vitest-environment node
import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import { createOpenAIConsolidationProvider } from './openai-provider';
import type { ConsolidationClientFactory } from './openai-provider';
import { ConsolidationError } from './errors';
import { runConsolidation } from './pipeline';
import { fitnessCandidates, fitnessFindings, extractionResult, SUMMARY } from './test-fixtures';

// Exercises the installed SDK's serialization and Structured Outputs parser. Only its HTTP
// transport is replaced; this test cannot contact a real provider.
function withTransport(text: string) {
	const fetch = vi.fn(async () =>
		Response.json({
			id: 'resp_test',
			object: 'response',
			status: 'completed',
			model: 'mock-model',
			usage: { input_tokens: 40, output_tokens: 12, total_tokens: 52 },
			incomplete_details: null,
			output: [
				{
					id: 'msg_test',
					type: 'message',
					role: 'assistant',
					status: 'completed',
					content: [{ type: 'output_text', text, annotations: [] }]
				}
			]
		})
	);
	const factory: ConsolidationClientFactory = (options) => {
		const client = new OpenAI({ ...options, fetch, baseURL: 'https://provider.invalid/v1' });
		return {
			responses: {
				create: (body, requestOptions) =>
					client.responses.create(
						body as Parameters<typeof client.responses.create>[0],
						requestOptions as Parameters<typeof client.responses.create>[1]
					)
			}
		};
	};
	return { provider: createOpenAIConsolidationProvider({ apiKey: 'test-key' }, factory), fetch };
}

describe('Stage 2 through the real SDK with an offline transport', () => {
	it('parses a complete consolidation and makes exactly one HTTP attempt', async () => {
		const { provider, fetch } = withTransport(
			JSON.stringify({ summary: SUMMARY, findings: fitnessFindings(), exclusions: [] })
		);
		const result = await runConsolidation(await extractionResult(fitnessCandidates()), provider);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(result.analysisStatus).toBe('complete');
		expect(result.findings).toHaveLength(6);
	});

	it('reports a category outside the fixed list as malformed output', async () => {
		const findings = fitnessFindings().map((finding) => ({ ...finding, category: 'privacy' }));
		const { provider } = withTransport(
			JSON.stringify({ summary: SUMMARY, findings, exclusions: [] })
		);
		await expect(
			runConsolidation(await extractionResult(fitnessCandidates()), provider)
		).rejects.toMatchObject({ code: 'provider_malformed' });
	});

	it.each([
		['invalid JSON', '{'],
		[
			'invalid schema',
			JSON.stringify({
				summary: SUMMARY,
				findings: fitnessFindings().map((finding) => ({ ...finding, category: 'privacy' })),
				exclusions: []
			})
		]
	])('keeps paid usage on %s from the real SDK', async (_case, text) => {
		const { provider, fetch } = withTransport(text);
		const error = await runConsolidation(
			await extractionResult(fitnessCandidates()),
			provider
		).catch((caught) => caught);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(error).toBeInstanceOf(ConsolidationError);
		expect(error).toMatchObject({
			code: 'provider_malformed',
			call: {
				model: 'mock-model',
				usage: { inputTokens: 40, outputTokens: 12, totalTokens: 52 }
			}
		});
	});
});
