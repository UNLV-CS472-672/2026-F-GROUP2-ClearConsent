import { Stage1Error, isStage1Error } from '../errors';
import { handleStage1HttpRequest } from '../http';
import type { Stage1Environment, Stage1ProviderFactory } from '../http';
import { createOpenAIStage1Provider } from '../openai-provider';
import type { OpenAIProviderConfig } from '../openai-provider';
import type { Stage1Result } from '../schemas';
import { createOpenAIStage2Provider } from './openai-provider';
import { runStage2Consolidation } from './pipeline';
import type { Stage2Provider } from './provider';
import type { Stage2Result } from './schemas';

export type Stage2ProviderFactory = (config: OpenAIProviderConfig) => Stage2Provider;

// Counts only: no summary, finding text, excerpts, or preferences.
function logStage2(result: Stage2Result, durationMs: number): void {
	const excluded = (code: string) =>
		result.excludedCandidates.filter((item) => item.code === code).length;
	console.info(
		JSON.stringify({
			event: 'stage2_consolidation',
			outcome: result.stageStatus,
			analysisStatus: result.analysisStatus,
			durationMs,
			findingCount: result.findings.length,
			heldBackCount: excluded('unverified_evidence'),
			modelExcludedCount: excluded('model_excluded'),
			unaccountedCount: excluded('unaccounted'),
			rejectedOutputCount: result.rejectedOutput.length,
			model: result.provider?.model ?? null,
			attempts: result.provider?.attempts ?? 0,
			usage: result.provider?.usage ?? null
		})
	);
}

// A Stage 2 failure keeps the validated Stage 1 work visible, but never as a complete analysis.
function failureResponse(error: Stage1Error, extraction: Stage1Result): Response {
	return Response.json(
		{
			stage: 'consolidation',
			stageStatus: 'failed',
			analysisStatus: 'in_progress',
			error: {
				code: error.code,
				message: error.message,
				retryable: error.retryable
			},
			extraction
		},
		{ status: error.status }
	);
}

// Runs the unchanged Stage 1 handler (access check, body limits, config, extraction, logging),
// then Stage 2 on its result. Any Stage 1 failure is returned exactly as Stage 1 produced it.
export async function handleConsolidatedAnalysisHttpRequest(
	request: Request,
	environment: Stage1Environment,
	createStage1Provider: Stage1ProviderFactory = createOpenAIStage1Provider,
	createStage2Provider: Stage2ProviderFactory = createOpenAIStage2Provider
): Promise<Response> {
	// Stage 1 validates the environment before building its provider, so Stage 2 reuses exactly
	// the same checked settings.
	let config: OpenAIProviderConfig | undefined;
	const stage1Response = await handleStage1HttpRequest(request, environment, (checked) => {
		config = checked;
		return createStage1Provider(checked);
	});
	if (!stage1Response.ok || config === undefined) return stage1Response;

	const startedAt = performance.now();
	const extraction = (await stage1Response.json()) as Stage1Result;
	try {
		const result = await runStage2Consolidation(extraction, createStage2Provider(config));
		logStage2(result, Math.round(performance.now() - startedAt));
		return Response.json(result);
	} catch (error) {
		const stageError = isStage1Error(error)
			? error
			: new Stage1Error('internal_error', 500, 'Stage 2 failed unexpectedly.', { cause: error });
		console.warn(
			JSON.stringify({
				event: 'stage2_consolidation',
				outcome: 'failed',
				code: stageError.code,
				durationMs: Math.round(performance.now() - startedAt)
			})
		);
		return failureResponse(stageError, extraction);
	}
}
