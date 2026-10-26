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
import type { OpenAIClientFactory, OpenAIProviderConfig } from '../openai-provider';
import { ConsolidationError } from './errors';
import type { ConsolidationCallInfo } from './errors';
import { buildConsolidationInput, CONSOLIDATION_INSTRUCTIONS } from './prompt';
import type { ProviderConsolidation, ConsolidationProvider } from './provider';
import { ModelConsolidationResponseSchema } from './schemas';
import type { ConsolidationModelInput } from './schemas';

const defaultClientFactory: OpenAIClientFactory = (options) =>
	new OpenAI(options) as unknown as ReturnType<OpenAIClientFactory>;

// Mirrors the extraction call: same model, reasoning effort, timeout, and output cap; one
// attempt; no retries, tools, storage, or truncation. Responses are checked and errors are mapped
// by the extraction helpers, so both steps report failures with the same codes.
export function createOpenAIConsolidationProvider(
	config: OpenAIProviderConfig,
	clientFactory: OpenAIClientFactory = defaultClientFactory
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
				const rawResponse = await client.responses.parse(
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

				const response = ResponseEnvelopeSchema.parse(rawResponse);
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
				if (response.output_parsed === null) {
					throw new Stage1Error(
						'provider_malformed',
						502,
						'The analysis provider returned no validated structured output.'
					);
				}

				return {
					output: ModelConsolidationResponseSchema.parse(response.output_parsed),
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
