import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { Stage1Error, isStage1Error } from './errors';
import { buildStage1Input, STAGE1_INSTRUCTIONS } from './prompt';
import type { ProviderExtraction, Stage1Provider } from './provider';
import { ModelStage1ResponseSchema } from './schemas';
import type { ProviderUsage, SourceSnapshot } from './schemas';

export const DEFAULT_OPENAI_MODEL = 'gpt-6-luna';
export const DEFAULT_REASONING_EFFORT = 'medium';
export const OPENAI_TIMEOUT_MS = 30_000;
export const OPENAI_MAX_RETRIES = 0;
export const OPENAI_MAX_ATTEMPTS = 1;
export const OPENAI_MAX_OUTPUT_TOKENS = 8_000;

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type OpenAIProviderConfig = {
	apiKey: string;
	model?: string;
	reasoningEffort?: ReasoningEffort;
	timeoutMs?: number;
	maxOutputTokens?: number;
};

type ClientOptions = {
	apiKey: string;
	maxRetries: number;
	timeout: number;
	logLevel: 'off';
};

type ResponsesClient = {
	parse(body: unknown, options?: unknown): Promise<unknown>;
};

type OpenAIClientLike = {
	responses: ResponsesClient;
};

export type OpenAIClientFactory = (options: ClientOptions) => OpenAIClientLike;

const ResponseEnvelopeSchema = z
	.object({
		status: z.string(),
		incomplete_details: z
			.object({
				reason: z.string().optional()
			})
			.nullable()
			.optional(),
		output: z.array(z.unknown()).default([]),
		output_parsed: z.unknown().nullable(),
		model: z.string().optional(),
		usage: z
			.object({
				input_tokens: z.number().optional(),
				output_tokens: z.number().optional(),
				total_tokens: z.number().optional(),
				output_tokens_details: z
					.object({ reasoning_tokens: z.number().optional() })
					.nullable()
					.optional()
			})
			.nullable()
			.optional()
	})
	.passthrough();

function defaultClientFactory(options: ClientOptions): OpenAIClientLike {
	return new OpenAI(options) as unknown as OpenAIClientLike;
}

function hasRefusal(output: unknown[]): boolean {
	return output.some((item) => {
		if (!item || typeof item !== 'object' || !('type' in item) || item.type !== 'message') {
			return false;
		}
		if (!('content' in item) || !Array.isArray(item.content)) return false;
		return item.content.some(
			(content) =>
				content !== null &&
				typeof content === 'object' &&
				'type' in content &&
				content.type === 'refusal'
		);
	});
}

function parseUsage(usage: z.infer<typeof ResponseEnvelopeSchema>['usage']): ProviderUsage | null {
	if (!usage) return null;
	return {
		inputTokens: usage.input_tokens ?? 0,
		outputTokens: usage.output_tokens ?? 0,
		reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
		totalTokens: usage.total_tokens ?? 0
	};
}

function mapProviderError(error: unknown): Stage1Error {
	if (isStage1Error(error)) return error;
	if (error instanceof z.ZodError || error instanceof SyntaxError) {
		return new Stage1Error(
			'provider_malformed',
			502,
			'The analysis provider returned malformed structured output.',
			{ cause: error }
		);
	}
	if (
		error instanceof OpenAI.AuthenticationError ||
		error instanceof OpenAI.PermissionDeniedError
	) {
		return new Stage1Error(
			'provider_authentication',
			502,
			'The analysis provider rejected its server credentials.',
			{ cause: error }
		);
	}
	if (error instanceof OpenAI.RateLimitError) {
		const quotaCodes = new Set(['insufficient_quota', 'billing_hard_limit_reached']);
		if (error.code && quotaCodes.has(error.code)) {
			return new Stage1Error(
				'provider_quota',
				503,
				'The analysis provider quota or billing limit was reached.',
				{ cause: error }
			);
		}
		return new Stage1Error(
			'provider_rate_limit',
			429,
			'The analysis provider rate limit was reached.',
			{ retryable: true, cause: error }
		);
	}
	if (error instanceof OpenAI.APIConnectionTimeoutError) {
		return new Stage1Error('provider_timeout', 504, 'The analysis provider timed out.', {
			retryable: true,
			cause: error
		});
	}
	// Input is bounded before the call, so these usually mean OPENAI_MODEL or
	// another request setting is wrong rather than the provider being down.
	if (error instanceof OpenAI.BadRequestError || error instanceof OpenAI.NotFoundError) {
		return new Stage1Error(
			'provider_rejected_request',
			502,
			'The analysis provider rejected the configured model or request settings.',
			{ cause: error }
		);
	}
	if (error instanceof OpenAI.APIError && error.status !== undefined && error.status >= 500) {
		return new Stage1Error(
			'provider_unavailable',
			502,
			'The analysis provider is temporarily unavailable.',
			{ retryable: true, cause: error }
		);
	}
	return new Stage1Error('provider_unavailable', 502, 'The analysis provider request failed.', {
		cause: error
	});
}

export function createOpenAIStage1Provider(
	config: OpenAIProviderConfig,
	clientFactory: OpenAIClientFactory = defaultClientFactory
): Stage1Provider {
	const model = config.model ?? DEFAULT_OPENAI_MODEL;
	const reasoningEffort = config.reasoningEffort ?? DEFAULT_REASONING_EFFORT;
	const timeoutMs = config.timeoutMs ?? OPENAI_TIMEOUT_MS;
	const maxOutputTokens = config.maxOutputTokens ?? OPENAI_MAX_OUTPUT_TOKENS;
	const client = clientFactory({
		apiKey: config.apiKey,
		maxRetries: OPENAI_MAX_RETRIES,
		timeout: timeoutMs,
		// Keep SDK debug logging from emitting policy text or raw provider errors.
		logLevel: 'off'
	});

	return {
		async extract(snapshot: SourceSnapshot): Promise<ProviderExtraction> {
			try {
				const rawResponse = await client.responses.parse(
					{
						model,
						reasoning: { effort: reasoningEffort },
						instructions: STAGE1_INSTRUCTIONS,
						input: buildStage1Input(snapshot),
						max_output_tokens: maxOutputTokens,
						store: false,
						truncation: 'disabled',
						text: {
							format: zodTextFormat(ModelStage1ResponseSchema, 'clearconsent_stage1_candidates', {
								description:
									'Internal evidence candidates with exact references to supplied passage IDs.'
							})
						}
					},
					{ maxRetries: OPENAI_MAX_RETRIES, timeout: timeoutMs }
				);

				const response = ResponseEnvelopeSchema.parse(rawResponse);
				if (response.status === 'incomplete') {
					throw new Stage1Error(
						'provider_truncated',
						502,
						'The analysis provider returned incomplete output.'
					);
				}
				if (response.status !== 'completed') {
					throw new Stage1Error(
						'provider_unavailable',
						502,
						'The analysis provider did not complete the request.'
					);
				}
				if (hasRefusal(response.output)) {
					throw new Stage1Error(
						'provider_refusal',
						422,
						'The analysis provider refused to process the supplied text.'
					);
				}
				if (response.output_parsed === null) {
					throw new Stage1Error(
						'provider_malformed',
						502,
						'The analysis provider returned no validated structured output.'
					);
				}

				return {
					output: ModelStage1ResponseSchema.parse(response.output_parsed),
					model: response.model ?? model,
					reasoningEffort,
					attempts: OPENAI_MAX_ATTEMPTS,
					usage: parseUsage(response.usage)
				};
			} catch (error) {
				throw mapProviderError(error);
			}
		}
	};
}
