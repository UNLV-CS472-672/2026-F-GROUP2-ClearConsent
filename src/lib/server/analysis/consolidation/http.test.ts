import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stage1Error } from '../errors';
import type { Stage1Provider } from '../provider';
import { handleConsolidatedAnalysisHttpRequest } from './http';
import type { ConsolidationProvider } from './provider';
import { modelFinding, stage1Candidate, consolidationProviderWith, SUMMARY } from './test-fixtures';

const policy = 'We share card numbers with our payment processor to complete purchases.';

const environment = {
	ENABLE_PAID_ANALYSIS: '1',
	ANALYSIS_ACCESS_TOKEN: 'local-secret',
	OPENAI_API_KEY: 'test-key',
	OPENAI_MODEL: 'gpt-6-luna',
	OPENAI_REASONING_EFFORT: 'medium'
};

function request(body: unknown, token = 'local-secret'): Request {
	return new Request('http://localhost/api/analyze/consolidated', {
		method: 'POST',
		headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
		body: JSON.stringify(body)
	});
}

function extractionWith(candidates: unknown[]): Stage1Provider {
	return {
		extract: vi.fn().mockResolvedValue({
			output: { candidates },
			model: 'mock-model',
			reasoningEffort: 'medium',
			attempts: 1,
			usage: null
		})
	};
}

const oneCandidate = () => extractionWith([stage1Candidate(policy, [policy])]);
const goodConsolidation = () =>
	consolidationProviderWith({ summary: SUMMARY, findings: [modelFinding()], exclusions: [] });

afterEach(() => {
	vi.restoreAllMocks();
});

describe('consolidated analysis HTTP boundary', () => {
	it('runs extraction then consolidation and returns findings with the extraction', async () => {
		const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
		const consolidation = goodConsolidation();
		const createConsolidationProvider = vi.fn(() => consolidation);
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy, preferences: { sharing: 'major' } }),
			environment,
			{ createExtractionProvider: () => oneCandidate(), createConsolidationProvider }
		);
		const body = (await response.json()) as {
			stage: string;
			analysisStatus: string;
			outcome: string;
			findings: { evidence: { excerpt: string }[] }[];
			extraction: { stage: string; candidates: unknown[] };
		};

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			stage: 'consolidation',
			analysisStatus: 'complete',
			outcome: 'findings_identified'
		});
		expect(body.findings[0].evidence[0].excerpt).toBe(policy);
		expect(body.extraction).toMatchObject({ stage: 'evidence_extraction' });
		// Consolidation gets the same checked settings extraction used.
		expect(createConsolidationProvider).toHaveBeenCalledWith({
			apiKey: 'test-key',
			model: 'gpt-6-luna',
			reasoningEffort: 'medium'
		});
		expect(consolidation.consolidate).toHaveBeenCalledWith(
			expect.objectContaining({ preferences: { sharing: 'major' } })
		);
		// Both steps log, with counts only: no policy text, summary, or preferences.
		const logged = info.mock.calls.map((call) => String(call[0])).join('\n');
		expect(logged).toContain('stage1_analysis');
		expect(logged).toContain('"event":"consolidation"');
		expect(logged).not.toContain(policy);
		expect(logged).not.toContain(SUMMARY);
		expect(logged).not.toContain('major');
	});

	it('returns a partial result as 200 but keeps the analysis in progress', async () => {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		// The second finding cites a candidate that doesn't exist, so it is rejected.
		const partial = consolidationProviderWith({
			summary: SUMMARY,
			findings: [modelFinding(), modelFinding({ candidateIds: ['C099'] })],
			exclusions: []
		});
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }),
			environment,
			{ createExtractionProvider: () => oneCandidate(), createConsolidationProvider: () => partial }
		);
		const body = (await response.json()) as {
			stageStatus: string;
			analysisStatus: string;
			outcome: string | null;
			rejectedOutput: unknown[];
		};

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			stageStatus: 'partial',
			analysisStatus: 'in_progress',
			outcome: null
		});
		expect(body.rejectedOutput).toHaveLength(1);
	});

	it.each([
		['paid analysis disabled', { ...environment, ENABLE_PAID_ANALYSIS: '0' }, 'local-secret', 503],
		['wrong access token', environment, 'wrong-token', 401]
	])('returns the extraction response unchanged when %s', async (_name, env, token, status) => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const createExtractionProvider = vi.fn(() => oneCandidate());
		const createConsolidationProvider = vi.fn(() => goodConsolidation());
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }, token),
			env,
			{
				createExtractionProvider,
				createConsolidationProvider
			}
		);
		const body = (await response.json()) as { stage: string };

		expect(response.status).toBe(status);
		expect(body.stage).toBe('evidence_extraction');
		expect(createExtractionProvider).not.toHaveBeenCalled();
		expect(createConsolidationProvider).not.toHaveBeenCalled();
	});

	it('does not run consolidation when extraction fails', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const failing: Stage1Provider = {
			extract: vi.fn().mockRejectedValue(new Stage1Error('provider_quota', 503, 'Quota reached.'))
		};
		const createConsolidationProvider = vi.fn(() => goodConsolidation());
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }),
			environment,
			{ createExtractionProvider: () => failing, createConsolidationProvider }
		);
		const body = (await response.json()) as { error: { code: string } };

		expect(response.status).toBe(503);
		expect(body.error.code).toBe('provider_quota');
		expect(createConsolidationProvider).not.toHaveBeenCalled();
	});

	it('keeps extraction work visible but incomplete when consolidation fails', async () => {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const timeout: ConsolidationProvider = {
			consolidate: vi
				.fn()
				.mockRejectedValue(
					new Stage1Error('provider_timeout', 504, 'The provider timed out.', { retryable: true })
				)
		};
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }),
			environment,
			{ createExtractionProvider: () => oneCandidate(), createConsolidationProvider: () => timeout }
		);
		const body = (await response.json()) as {
			stage: string;
			stageStatus: string;
			analysisStatus: string;
			error: { code: string; retryable: boolean };
			extraction: { candidates: unknown[] };
		};

		expect(response.status).toBe(504);
		expect(body).toMatchObject({
			stage: 'consolidation',
			stageStatus: 'failed',
			analysisStatus: 'in_progress',
			error: { code: 'provider_timeout', retryable: true }
		});
		expect(body.extraction.candidates).toHaveLength(1);
	});

	it('logs the usage of a paid call that failed after the model responded', async () => {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		// A blank summary fails validation after the model has already been paid for.
		const blank = consolidationProviderWith({
			summary: '  ',
			findings: [modelFinding()],
			exclusions: []
		});
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }),
			environment,
			{ createExtractionProvider: () => oneCandidate(), createConsolidationProvider: () => blank }
		);
		const body = (await response.json()) as { error: { code: string } };
		const logged = JSON.parse(String(warn.mock.calls.at(-1)![0]));

		expect(response.status).toBe(502);
		expect(body.error.code).toBe('provider_malformed');
		expect(logged).toMatchObject({
			event: 'consolidation',
			outcome: 'failed',
			code: 'provider_malformed',
			model: 'mock-model',
			usage: { totalTokens: 15 }
		});
	});

	it('reports an unexpected consolidation failure as internal', async () => {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }),
			environment,
			{
				createExtractionProvider: () => oneCandidate(),
				createConsolidationProvider: () => {
					throw new TypeError('bug in server code');
				}
			}
		);
		const body = (await response.json()) as { error: { code: string } };

		expect(response.status).toBe(500);
		expect(body.error.code).toBe('internal_error');
	});

	it('skips the consolidation call and reports no findings when extraction finds nothing', async () => {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		const consolidation = goodConsolidation();
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }),
			environment,
			{
				createExtractionProvider: () => extractionWith([]),
				createConsolidationProvider: () => consolidation
			}
		);
		const body = (await response.json()) as { analysisStatus: string; outcome: string };

		expect(response.status).toBe(200);
		expect(body).toMatchObject({ analysisStatus: 'complete', outcome: 'no_findings' });
		expect(consolidation.consolidate).not.toHaveBeenCalled();
	});
});
