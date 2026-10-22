import { afterEach, describe, expect, it, vi } from 'vitest';
import { Stage1Error } from '../errors';
import type { Stage1Provider } from '../provider';
import { handleConsolidatedAnalysisHttpRequest } from './http';
import type { Stage2Provider } from './provider';
import { modelFinding, stage1Candidate, stage2ProviderWith, SUMMARY } from './test-fixtures';

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

function stage1With(candidates: unknown[]): Stage1Provider {
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

const oneCandidate = () => stage1With([stage1Candidate(policy, [policy])]);
const goodStage2 = () =>
	stage2ProviderWith({ summary: SUMMARY, findings: [modelFinding()], exclusions: [] });

afterEach(() => {
	vi.restoreAllMocks();
});

describe('consolidated analysis HTTP boundary', () => {
	it('runs Stage 1 then Stage 2 and returns findings with the extraction', async () => {
		const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
		const stage2 = goodStage2();
		const createStage2 = vi.fn(() => stage2);
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy, preferences: { sharing: 'major' } }),
			environment,
			() => oneCandidate(),
			createStage2
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
		// Stage 2 gets the same checked settings Stage 1 used.
		expect(createStage2).toHaveBeenCalledWith({
			apiKey: 'test-key',
			model: 'gpt-6-luna',
			reasoningEffort: 'medium'
		});
		expect(stage2.consolidate).toHaveBeenCalledWith(
			expect.objectContaining({ preferences: { sharing: 'major' } })
		);
		// Both stages log, with counts only: no policy text, summary, or preferences.
		const logged = info.mock.calls.map((call) => String(call[0])).join('\n');
		expect(logged).toContain('stage1_analysis');
		expect(logged).toContain('stage2_consolidation');
		expect(logged).not.toContain(policy);
		expect(logged).not.toContain(SUMMARY);
		expect(logged).not.toContain('major');
	});

	it.each([
		['paid analysis disabled', { ...environment, ENABLE_PAID_ANALYSIS: '0' }, 'local-secret', 503],
		['wrong access token', environment, 'wrong-token', 401]
	])('returns the Stage 1 response unchanged when %s', async (_name, env, token, status) => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const createStage1 = vi.fn(() => oneCandidate());
		const createStage2 = vi.fn(() => goodStage2());
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }, token),
			env,
			createStage1,
			createStage2
		);
		const body = (await response.json()) as { stage: string };

		expect(response.status).toBe(status);
		expect(body.stage).toBe('evidence_extraction');
		expect(createStage1).not.toHaveBeenCalled();
		expect(createStage2).not.toHaveBeenCalled();
	});

	it('does not run Stage 2 when Stage 1 fails', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const failing: Stage1Provider = {
			extract: vi.fn().mockRejectedValue(new Stage1Error('provider_quota', 503, 'Quota reached.'))
		};
		const createStage2 = vi.fn(() => goodStage2());
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }),
			environment,
			() => failing,
			createStage2
		);
		const body = (await response.json()) as { error: { code: string } };

		expect(response.status).toBe(503);
		expect(body.error.code).toBe('provider_quota');
		expect(createStage2).not.toHaveBeenCalled();
	});

	it('keeps Stage 1 work visible but incomplete when Stage 2 fails', async () => {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const timeout: Stage2Provider = {
			consolidate: vi
				.fn()
				.mockRejectedValue(
					new Stage1Error('provider_timeout', 504, 'The provider timed out.', { retryable: true })
				)
		};
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }),
			environment,
			() => oneCandidate(),
			() => timeout
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

	it('reports an unexpected Stage 2 failure as internal', async () => {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }),
			environment,
			() => oneCandidate(),
			() => {
				throw new TypeError('bug in server code');
			}
		);
		const body = (await response.json()) as { error: { code: string } };

		expect(response.status).toBe(500);
		expect(body.error.code).toBe('internal_error');
	});

	it('skips the Stage 2 call and reports no findings when Stage 1 finds nothing', async () => {
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
		const stage2 = goodStage2();
		const response = await handleConsolidatedAnalysisHttpRequest(
			request({ text: policy }),
			environment,
			() => stage1With([]),
			() => stage2
		);
		const body = (await response.json()) as { analysisStatus: string; outcome: string };

		expect(response.status).toBe(200);
		expect(body).toMatchObject({ analysisStatus: 'complete', outcome: 'no_findings' });
		expect(stage2.consolidate).not.toHaveBeenCalled();
	});
});
