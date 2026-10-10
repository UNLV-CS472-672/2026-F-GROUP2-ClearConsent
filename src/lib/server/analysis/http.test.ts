import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleStage1HttpRequest, MAX_REQUEST_BODY_BYTES } from './http';
import type { Stage1Provider } from './provider';

const policy = 'We do not sell personal data.';

const environment = {
	ENABLE_PAID_ANALYSIS: '1',
	ANALYSIS_ACCESS_TOKEN: 'local-secret',
	OPENAI_API_KEY: 'test-key',
	OPENAI_MODEL: 'gpt-6-luna',
	OPENAI_REASONING_EFFORT: 'medium'
};

function request(body: unknown, token = 'local-secret'): Request {
	return new Request('http://localhost/api/analyze', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${token}`
		},
		body: JSON.stringify(body)
	});
}

async function errorBody(response: Response): Promise<{ error: { code: string } }> {
	return (await response.json()) as { error: { code: string } };
}

const noCandidatesProvider: Stage1Provider = {
	extract: vi.fn().mockResolvedValue({
		output: { candidates: [] },
		model: 'mock-model',
		reasoningEffort: 'medium',
		attempts: 1,
		usage: null
	})
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe('Stage 1 HTTP boundary', () => {
	it('runs a synthetic server request through an injected provider', async () => {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		const factory = vi.fn(() => noCandidatesProvider);
		const response = await handleStage1HttpRequest(request({ text: policy }), environment, factory);
		const body = (await response.json()) as {
			stage: string;
			stageStatus: string;
			analysisStatus: string;
		};

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			stage: 'evidence_extraction',
			stageStatus: 'no_candidates',
			analysisStatus: 'in_progress'
		});
		expect(factory).toHaveBeenCalledWith({
			apiKey: 'test-key',
			model: 'gpt-6-luna',
			reasoningEffort: 'medium'
		});
	});

	it('passes bounded timeout and output-token overrides to the provider', async () => {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		const factory = vi.fn(() => noCandidatesProvider);
		await handleStage1HttpRequest(
			request({ text: policy }),
			{ ...environment, OPENAI_TIMEOUT_MS: '60000', OPENAI_MAX_OUTPUT_TOKENS: '12000' },
			factory
		);

		expect(factory).toHaveBeenCalledWith(
			expect.objectContaining({ timeoutMs: 60_000, maxOutputTokens: 12_000 })
		);
	});

	it.each([
		['OPENAI_TIMEOUT_MS', '120001'],
		['OPENAI_TIMEOUT_MS', 'soon'],
		['OPENAI_MAX_OUTPUT_TOKENS', '0'],
		['OPENAI_MAX_OUTPUT_TOKENS', '32001'],
		['OPENAI_MAX_OUTPUT_TOKENS', '1.5']
	])('rejects %s=%s before constructing a provider', async (name, value) => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const factory = vi.fn(() => noCandidatesProvider);
		const response = await handleStage1HttpRequest(
			request({ text: policy }),
			{ ...environment, [name]: value },
			factory
		);
		const body = await errorBody(response);

		expect(response.status).toBe(503);
		expect(body.error.code).toBe('configuration_error');
		expect(factory).not.toHaveBeenCalled();
	});

	it('does not construct a provider while paid analysis is disabled', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const factory = vi.fn(() => noCandidatesProvider);
		const response = await handleStage1HttpRequest(
			request({ text: policy }),
			{ ...environment, ENABLE_PAID_ANALYSIS: '0' },
			factory
		);
		const body = await errorBody(response);

		expect(response.status).toBe(503);
		expect(body.error.code).toBe('analysis_disabled');
		expect(factory).not.toHaveBeenCalled();
	});

	it('rejects an invalid access token before constructing a provider', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const factory = vi.fn(() => noCandidatesProvider);
		const response = await handleStage1HttpRequest(
			request({ text: policy }, 'wrong-token'),
			environment,
			factory
		);
		const body = await errorBody(response);

		expect(response.status).toBe(401);
		expect(body.error.code).toBe('unauthorized');
		expect(factory).not.toHaveBeenCalled();
	});

	it('reports malformed JSON distinctly', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const malformed = new Request('http://localhost/api/analyze', {
			method: 'POST',
			headers: { authorization: 'Bearer local-secret' },
			body: '{not-json'
		});
		const response = await handleStage1HttpRequest(
			malformed,
			environment,
			() => noCandidatesProvider
		);
		const body = await errorBody(response);

		expect(response.status).toBe(400);
		expect(body.error.code).toBe('invalid_json');
	});

	it('rejects an oversized declared body before reading it', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const extract = vi.fn();
		const oversized = new Request('http://localhost/api/analyze', {
			method: 'POST',
			headers: {
				authorization: 'Bearer local-secret',
				'content-length': String(MAX_REQUEST_BODY_BYTES + 1)
			},
			body: JSON.stringify({ text: policy })
		});
		const response = await handleStage1HttpRequest(oversized, environment, () => ({ extract }));
		const body = await errorBody(response);

		expect(response.status).toBe(413);
		expect(body.error.code).toBe('input_too_large');
		expect(extract).not.toHaveBeenCalled();
	});

	it('stops reading a streamed body without Content-Length once it exceeds the limit', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const extract = vi.fn();
		const chunk = new Uint8Array(64 * 1024).fill(0x20);
		let sent = 0;
		const stream = new ReadableStream<Uint8Array>({
			pull(controller) {
				sent += chunk.byteLength;
				controller.enqueue(chunk);
			}
		});
		const streamed = new Request('http://localhost/api/analyze', {
			method: 'POST',
			headers: { authorization: 'Bearer local-secret' },
			body: stream,
			duplex: 'half'
		} as RequestInit);
		const response = await handleStage1HttpRequest(streamed, environment, () => ({ extract }));
		const body = await errorBody(response);

		expect(response.status).toBe(413);
		expect(body.error.code).toBe('input_too_large');
		expect(sent).toBeLessThan(MAX_REQUEST_BODY_BYTES + 2 * chunk.byteLength);
		expect(extract).not.toHaveBeenCalled();
	});

	it('reports unexpected server failures as internal rather than provider errors', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const response = await handleStage1HttpRequest(request({ text: policy }), environment, () => {
			throw new TypeError('bug in server code');
		});
		const body = await errorBody(response);

		expect(response.status).toBe(500);
		expect(body.error.code).toBe('internal_error');
	});
});
