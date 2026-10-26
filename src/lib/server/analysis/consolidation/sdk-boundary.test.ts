// @vitest-environment node
import OpenAI from 'openai';
import { describe, expect, it, vi } from 'vitest';
import type { OpenAIClientFactory } from '../openai-provider';
import { createOpenAIConsolidationProvider } from './openai-provider';
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
	const factory: OpenAIClientFactory = (options) => {
		const client = new OpenAI({ ...options, fetch, baseURL: 'https://provider.invalid/v1' });
		return {
			responses: {
				parse: (body, requestOptions) =>
					client.responses.parse(
						body as Parameters<typeof client.responses.parse>[0],
						requestOptions as Parameters<typeof client.responses.parse>[1]
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
});
