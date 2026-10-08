// @vitest-environment node
import OpenAI from 'openai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenAIStage1Provider } from './openai-provider';
import type { OpenAIClientFactory } from './openai-provider';
import { runStage1Analysis } from './pipeline';

const policy = 'We do not sell personal data.';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

// Exercise the installed SDK's serialization, parser, and retry behavior. Only
// its HTTP transport is replaced; these tests cannot contact a real provider.
function withTransport(body: unknown, status = 200) {
	const fetch = vi.fn(async () => Response.json(body, { status }));
	const factory: OpenAIClientFactory = (options) => {
		const client = new OpenAI({ ...options, fetch, baseURL: 'https://provider.invalid/v1' });
		return {
			responses: {
				parse: (body, options) =>
					client.responses.parse(
						body as Parameters<typeof client.responses.parse>[0],
						options as Parameters<typeof client.responses.parse>[1]
					)
			}
		};
	};
	return { provider: createOpenAIStage1Provider({ apiKey: 'test-key' }, factory), fetch };
}

function wireResponse(text: string, status = 'completed') {
	return {
		id: 'resp_test',
		object: 'response',
		status,
		model: 'mock-model',
		incomplete_details: status === 'incomplete' ? { reason: 'max_output_tokens' } : null,
		output: [
			{
				id: 'msg_test',
				type: 'message',
				role: 'assistant',
				status,
				content: [{ type: 'output_text', text, annotations: [] }]
			}
		]
	};
}

describe('real SDK with an offline HTTP transport', () => {
	it('does not log source or provider bodies even when SDK debug logging is requested', async () => {
		vi.stubEnv('OPENAI_LOG', 'debug');
		const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
		const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const { provider } = withTransport(wireResponse('{"candidates":[]}'));
		await runStage1Analysis({ text: policy }, provider);
		for (const spy of [debug, info, warn, error]) expect(spy).not.toHaveBeenCalled();
	});

	it('parses and validates a complete candidate through the pipeline', async () => {
		const candidate = {
			category: 'sale',
			practice: 'explicit denial',
			claim: 'The policy states that personal data is not sold.',
			explanation: 'The source expressly denies sale.',
			qualifiers: [],
			uncertainty: null,
			dataCategories: ['personal data'],
			purposes: [],
			recipients: [],
			evidence: [{ passageId: 'P001', excerpt: policy }]
		};
		const { provider, fetch } = withTransport(
			wireResponse(JSON.stringify({ candidates: [candidate] }))
		);
		const result = await runStage1Analysis({ text: policy }, provider);
		expect(result.stageStatus).toBe('complete');
		expect(result.candidates[0].evidence[0]).toEqual({
			passageId: 'P001',
			excerpt: policy,
			startOffset: 0,
			endOffset: policy.length
		});
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it.each([
		['completed', 'provider_malformed'],
		['incomplete', 'provider_truncated']
	])('handles invalid JSON with %s status', async (status, code) => {
		const { provider, fetch } = withTransport(wireResponse('{"candidates":[', status));
		await expect(runStage1Analysis({ text: policy }, provider)).rejects.toMatchObject({ code });
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it.each([429, 500])('does not retry an HTTP %s response', async (status) => {
		const { provider, fetch } = withTransport(
			{ error: { type: 'api_error', code: 'rate_limit_exceeded', message: 'synthetic failure' } },
			status
		);
		await expect(runStage1Analysis({ text: policy }, provider)).rejects.toMatchObject({
			code: status === 429 ? 'provider_rate_limit' : 'provider_unavailable'
		});
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});
