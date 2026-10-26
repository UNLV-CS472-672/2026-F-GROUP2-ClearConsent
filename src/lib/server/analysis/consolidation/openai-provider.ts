import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { Stage1Error } from '../errors';
import {
	DEFAULT_OPENAI_MODEL,
	DEFAULT_REASONING_EFFORT,
	hasRefusal,
	mapProviderError,
	OPENAI_MAX_ATTEMPTS,
	OPENAI_MAX_OUTPUT_TOKENS,
	OPENAI_MAX_RETRIES,
	OPENAI_TIMEOUT_MS,
	parseUsage,
	ResponseEnvelopeSchema
} from '../openai-provider';
import type { OpenAIProviderConfig } from '../openai-provider';
import { ConsolidationError } from './errors';
import type { ConsolidationCallInfo } from './errors';
import { buildConsolidationInput, CONSOLIDATION_INSTRUCTIONS } from './prompt';
import type { ProviderConsolidation, ConsolidationProvider } from './provider';
import { ModelConsolidationResponseSchema } from './schemas';
import type { ConsolidationModelInput } from './schemas';

export type ConsolidationClientFactory = (options: {
	apiKey: string;
	maxRetries: number;
	timeout: number;
	logLevel: 'off';
}) => { responses: { create(body: unknown, options?: unknown): Promise<unknown> } };

const defaultClientFactory: ConsolidationClientFactory = (options) =>
	new OpenAI(options) as unknown as ReturnType<ConsolidationClientFactory>;

function parseConsolidationOutput(output: unknown[]): ProviderConsolidation['output'] | null {
	for (const item of output) {
		if (!item || typeof item !== 'object' || !('type' in item) || item.type !== 'message') {
			continue;
		}
		if (!('content' in item) || !Array.isArray(item.content)) continue;
		for (const content of item.content) {
			if (content?.type === 'output_text' && typeof content.text === 'string') {
				return ModelConsolidationResponseSchema.parse(JSON.parse(content.text));
			}
		}
	}
	return null;
}

// Mirrors the extraction call: same model, reasoning effort, timeout, and output cap; one
// attempt; no retries, tools, storage, or truncation. Responses are checked and errors are mapped
// by the extraction helpers, so both steps report failures with the same codes.
export function createOpenAIConsolidationProvider(
	config: OpenAIProviderConfig,
	clientFactory: ConsolidationClientFactory = defaultClientFactory
): ConsolidationProvider {
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
		async consolidate(input: ConsolidationModelInput): Promise<ProviderConsolidation> {
			// Set once a response arrives. A failure after that point was still a paid call, so it
			// carries the model and usage for logging.
			let call: ConsolidationCallInfo | undefined;
			try {
				const rawResponse = await client.responses.create(
					{
						model,
						reasoning: { effort: reasoningEffort },
						instructions: CONSOLIDATION_INSTRUCTIONS,
						input: buildConsolidationInput(input),
						max_output_tokens: maxOutputTokens,
						store: false,
						truncation: 'disabled',
						text: {
							format: zodTextFormat(
								ModelConsolidationResponseSchema,
								'clearconsent_stage2_findings',
								{
									description:
										'Consolidated findings that cite extraction candidate IDs, with candidate exclusions and a summary.'
								}
							)
						}
					},
					{ maxRetries: OPENAI_MAX_RETRIES, timeout: timeoutMs }
				);

				const response = ResponseEnvelopeSchema.parse({
					...(rawResponse as object),
					output_parsed: null
				});
				call = { model: response.model ?? model, usage: parseUsage(response.usage) };
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
				const output = parseConsolidationOutput(response.output);
				if (output === null) {
					throw new Stage1Error(
						'provider_malformed',
						502,
						'The analysis provider returned no validated structured output.'
					);
				}

				return {
					output,
					model: call.model,
					reasoningEffort,
					attempts: OPENAI_MAX_ATTEMPTS,
					usage: call.usage
				};
			} catch (error) {
				const mapped = mapProviderError(error);
				throw call ? new ConsolidationError(mapped, call) : mapped;
			}
		}
	};
}
