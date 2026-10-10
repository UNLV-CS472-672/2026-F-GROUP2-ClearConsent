import type { Stage1Provider } from './provider';
import { Stage1Error, isStage1Error } from './errors';
import {
	createOpenAIStage1Provider,
	DEFAULT_OPENAI_MODEL,
	DEFAULT_REASONING_EFFORT,
	OPENAI_OUTPUT_TOKENS_CEILING,
	OPENAI_TIMEOUT_CEILING_MS
} from './openai-provider';
import type { OpenAIProviderConfig, ReasoningEffort } from './openai-provider';
import {
	MAX_PREFERENCES_JSON_CHARACTERS,
	MAX_SOURCE_CHARACTERS,
	MAX_TITLE_CHARACTERS,
	MAX_URL_CHARACTERS,
	runStage1Analysis
} from './pipeline';

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

// A JSON escape such as \u0000 is the widest encoding of one UTF-16 code unit
// (six bytes), so no request within the field limits can exceed this size.
export const MAX_REQUEST_BODY_BYTES =
	6 *
		(MAX_SOURCE_CHARACTERS +
			MAX_TITLE_CHARACTERS +
			MAX_URL_CHARACTERS +
			MAX_PREFERENCES_JSON_CHARACTERS) +
	1_024;

// Compare fixed-length digests so response timing does not reveal how much of
// the supplied token matched.
async function tokensMatch(supplied: string, expected: string): Promise<boolean> {
	const encoder = new TextEncoder();
	const [suppliedDigest, expectedDigest] = await Promise.all(
		[supplied, expected].map(
			async (value) => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
		)
	);
	let difference = 0;
	for (let index = 0; index < expectedDigest.length; index += 1) {
		difference |= suppliedDigest[index] ^ expectedDigest[index];
	}
	return difference === 0;
}

async function requireAccess(request: Request, environment: Stage1Environment): Promise<void> {
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

	const authorization = request.headers.get('authorization') ?? '';
	if (!(await tokensMatch(authorization, `Bearer ${accessToken}`))) {
		throw new Stage1Error('unauthorized', 401, 'A valid analysis access token is required.');
	}
}

function bodyTooLarge(): Stage1Error {
	return new Stage1Error(
		'input_too_large',
		413,
		`Request body exceeds the Stage 1 limit of ${MAX_REQUEST_BODY_BYTES} bytes.`
	);
}

// Stop reading once the limit is passed instead of buffering an arbitrarily
// large body, including when Content-Length is absent or understated.
async function readBoundedBody(request: Request): Promise<string> {
	if (Number(request.headers.get('content-length')) > MAX_REQUEST_BODY_BYTES) {
		throw bodyTooLarge();
	}
	if (!request.body) return '';

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_REQUEST_BODY_BYTES) {
			await reader.cancel();
			throw bodyTooLarge();
		}
		chunks.push(value);
	}

	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}

// Returns undefined when unset so the provider default applies.
function boundedInteger(
	environment: Stage1Environment,
	name: string,
	ceiling: number
): number | undefined {
	const raw = environment[name]?.trim();
	if (!raw) return undefined;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 1 || value > ceiling) {
		throw new Stage1Error(
			'configuration_error',
			503,
			`${name} must be a whole number from 1 to ${ceiling}.`
		);
	}
	return value;
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

	const timeoutMs = boundedInteger(environment, 'OPENAI_TIMEOUT_MS', OPENAI_TIMEOUT_CEILING_MS);
	const maxOutputTokens = boundedInteger(
		environment,
		'OPENAI_MAX_OUTPUT_TOKENS',
		OPENAI_OUTPUT_TOKENS_CEILING
	);

	return {
		apiKey,
		model,
		reasoningEffort: requestedEffort as ReasoningEffort,
		...(timeoutMs !== undefined && { timeoutMs }),
		...(maxOutputTokens !== undefined && { maxOutputTokens })
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
		await requireAccess(request, environment);
		const config = providerConfig(environment);
		const rawBody = await readBoundedBody(request);
		let body: unknown;
		try {
			body = JSON.parse(rawBody);
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
				rejectedCount: result.rejectedCandidates.length,
				model: result.provider.model,
				attempts: result.provider.attempts,
				usage: result.provider.usage
			})
		);
		return Response.json(result);
	} catch (error) {
		const stageError = isStage1Error(error)
			? error
			: new Stage1Error('internal_error', 500, 'Stage 1 failed unexpectedly.', {
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
