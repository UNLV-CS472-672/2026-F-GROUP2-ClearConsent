import { Stage1Error, isStage1Error } from '../errors';
import { handleStage1HttpRequest } from '../http';
import type { Stage1Environment, Stage1ProviderFactory } from '../http';
import { createOpenAIStage1Provider } from '../openai-provider';
import type { OpenAIProviderConfig } from '../openai-provider';
import type { Stage1Result } from '../schemas';
import { ConsolidationError } from './errors';
import { createOpenAIConsolidationProvider } from './openai-provider';
import { runConsolidation } from './pipeline';
import type { ConsolidationProvider } from './provider';
import type { ConsolidationResult } from './schemas';

export type ConsolidationProviderFactory = (config: OpenAIProviderConfig) => ConsolidationProvider;

export type ConsolidatedAnalysisOptions = {
	// Both default to the real OpenAI providers. Tests pass fakes here.
	createExtractionProvider?: Stage1ProviderFactory;
	createConsolidationProvider?: ConsolidationProviderFactory;
};

// Counts only: no summary, finding text, excerpts, or preferences.
function logConsolidation(result: ConsolidationResult, durationMs: number): void {
	const excluded = (code: string) =>
		result.excludedCandidates.filter((item) => item.code === code).length;
	console.info(
		JSON.stringify({
			event: 'consolidation',
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

// A consolidation failure keeps the validated extraction visible, but never as a complete analysis.
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

// Runs the unchanged extraction handler (access check, body limits, config, extraction, logging),
// then consolidation on its result. An extraction failure is returned exactly as it was produced.
//
// Usage: handleConsolidatedAnalysisHttpRequest(request, env)
//    or: handleConsolidatedAnalysisHttpRequest(request, env, { createConsolidationProvider: fake })
export async function handleConsolidatedAnalysisHttpRequest(
	request: Request,
	environment: Stage1Environment,
	{
		createExtractionProvider = createOpenAIStage1Provider,
		createConsolidationProvider = createOpenAIConsolidationProvider
	}: ConsolidatedAnalysisOptions = {}
): Promise<Response> {
	// Extraction validates the environment before building its provider, so consolidation reuses
	// exactly the same checked settings.
	let config: OpenAIProviderConfig | undefined;
	const extractionResponse = await handleStage1HttpRequest(request, environment, (checked) => {
		config = checked;
		return createExtractionProvider(checked);
	});
	if (!extractionResponse.ok || config === undefined) return extractionResponse;

	const startedAt = performance.now();
	const extraction = (await extractionResponse.json()) as Stage1Result;
	try {
		const result = await runConsolidation(extraction, createConsolidationProvider(config));
		logConsolidation(result, Math.round(performance.now() - startedAt));
		return Response.json(result);
	} catch (error) {
		const stageError = isStage1Error(error)
			? error
			: new Stage1Error('internal_error', 500, 'Consolidation failed unexpectedly.', {
					cause: error
				});
		console.warn(
			JSON.stringify({
				event: 'consolidation',
				outcome: 'failed',
				code: stageError.code,
				durationMs: Math.round(performance.now() - startedAt),
				// Present when the model had already responded, so the paid call is still logged.
				...(stageError instanceof ConsolidationError && {
					model: stageError.call.model,
					usage: stageError.call.usage
				})
			})
		);
		return failureResponse(stageError, extraction);
	}
}
