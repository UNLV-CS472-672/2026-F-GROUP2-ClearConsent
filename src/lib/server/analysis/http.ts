import type { Stage1Provider } from './provider';
import { Stage1Error, isStage1Error } from './errors';
import {
	createOpenAIStage1Provider,
	DEFAULT_OPENAI_MODEL,
	DEFAULT_REASONING_EFFORT
} from './openai-provider';
import type { OpenAIProviderConfig, ReasoningEffort } from './openai-provider';
import { runStage1Analysis } from './pipeline';

export type Stage1Environment = Record<string, string | undefined>;
export type Stage1ProviderFactory = (config: OpenAIProviderConfig) => Stage1Provider;

const REASONING_EFFORTS = new Set<ReasoningEffort>([
	'none',
	'low',
	'medium',
	'high',
	'xhigh',
	'max'
]);

function failureResponse(error: Stage1Error): Response {
	return Response.json(
		{
			stage: 'evidence_extraction',
			stageStatus: 'failed',
			analysisStatus: 'in_progress',
			error: {
				code: error.code,
				message: error.message,
				retryable: error.retryable
			}
		},
		{ status: error.status }
	);
}

function requireAccess(request: Request, environment: Stage1Environment): void {
	if (environment.ENABLE_PAID_ANALYSIS !== '1') {
		throw new Stage1Error(
			'analysis_disabled',
			503,
			'Stage 1 provider calls are disabled. Set ENABLE_PAID_ANALYSIS=1 only for an approved local smoke test.'
		);
	}

	const accessToken = environment.ANALYSIS_ACCESS_TOKEN;
	if (!accessToken) {
		throw new Stage1Error(
			'configuration_error',
			503,
			'ANALYSIS_ACCESS_TOKEN is not configured on the server.'
		);
	}

	const authorization = request.headers.get('authorization');
	if (authorization !== `Bearer ${accessToken}`) {
		throw new Stage1Error('unauthorized', 401, 'A valid analysis access token is required.');
	}
}

function providerConfig(environment: Stage1Environment): OpenAIProviderConfig {
	const apiKey = environment.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Stage1Error(
			'configuration_error',
			503,
			'OPENAI_API_KEY is not configured on the server.'
		);
	}

	const model = environment.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
	const requestedEffort = environment.OPENAI_REASONING_EFFORT?.trim() || DEFAULT_REASONING_EFFORT;
	if (!REASONING_EFFORTS.has(requestedEffort as ReasoningEffort)) {
		throw new Stage1Error(
			'configuration_error',
			503,
			'OPENAI_REASONING_EFFORT must be none, low, medium, high, xhigh, or max.'
		);
	}

	return {
		apiKey,
		model,
		reasoningEffort: requestedEffort as ReasoningEffort
	};
}

export async function handleStage1HttpRequest(
	request: Request,
	environment: Stage1Environment,
	createProvider: Stage1ProviderFactory = createOpenAIStage1Provider
): Promise<Response> {
	const startedAt = performance.now();
	let sourceLength: number | undefined;

	try {
		requireAccess(request, environment);
		const config = providerConfig(environment);
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			throw new Stage1Error('invalid_json', 400, 'Body must be valid JSON.');
		}
		if (body && typeof body === 'object' && 'text' in body && typeof body.text === 'string') {
			sourceLength = body.text.length;
		}

		const result = await runStage1Analysis(body, createProvider(config));
		console.info(
			JSON.stringify({
				event: 'stage1_analysis',
				outcome: result.stageStatus,
				durationMs: Math.round(performance.now() - startedAt),
				sourceLength: result.source.textLength,
				candidateCount: result.candidates.length,
				model: result.provider.model,
				attempts: result.provider.attempts,
				usage: result.provider.usage
			})
		);
		return Response.json(result);
	} catch (error) {
		const stageError = isStage1Error(error)
			? error
			: new Stage1Error('provider_unavailable', 502, 'Stage 1 failed unexpectedly.', {
					cause: error
				});
		console.warn(
			JSON.stringify({
				event: 'stage1_analysis',
				outcome: 'failed',
				code: stageError.code,
				durationMs: Math.round(performance.now() - startedAt),
				sourceLength
			})
		);
		return failureResponse(stageError);
	}
}
