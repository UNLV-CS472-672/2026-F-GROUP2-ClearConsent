import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { Stage1Error } from '../analysis/errors';
import {
	DEFAULT_OPENAI_MODEL,
	hasRefusal,
	mapProviderError,
	OPENAI_MAX_RETRIES,
	parseUsage,
	ResponseEnvelopeSchema
} from '../analysis/openai-provider';
import type { OpenAIProviderConfig } from '../analysis/openai-provider';
import { ChatError } from './errors';
import type { ChatCallInfo } from './errors';
import { buildChatInput, CHAT_INSTRUCTIONS } from './prompt';
import type { ChatModelInput, ChatProvider, ProviderChatAnswer } from './provider';
import { ModelChatResponseSchema } from './schemas';

// A chat answer is a few sentences about a document that is already in the prompt, so it needs far
// less time and output than an analysis. The user is waiting on it.
export const CHAT_REASONING_EFFORT = 'low';
export const CHAT_TIMEOUT_MS = 60_000;
export const CHAT_MAX_OUTPUT_TOKENS = 8_000;

export type ChatClientFactory = (options: {
	apiKey: string;
	maxRetries: number;
	timeout: number;
	logLevel: 'off';
}) => { responses: { create(body: unknown, options?: unknown): Promise<unknown> } };

const defaultClientFactory: ChatClientFactory = (options) =>
	new OpenAI(options) as unknown as ReturnType<ChatClientFactory>;

function parseChatOutput(output: unknown[]): unknown {
	for (const item of output) {
		if (!item || typeof item !== 'object' || !('type' in item) || item.type !== 'message') {
			continue;
		}
		if (!('content' in item) || !Array.isArray(item.content)) continue;
		for (const content of item.content) {
			if (content?.type === 'output_text' && typeof content.text === 'string') {
				return ModelChatResponseSchema.parse(JSON.parse(content.text));
			}
		}
	}
	return null;
}

// Uses the analysis model and error mapping, with chat's own effort, timeout, and output cap. One
// attempt; no retries, tools, storage, or truncation. The chat history is kept in our database and
// sent with each question, so OpenAI never needs to store it.
export function createOpenAIChatProvider(
	config: OpenAIProviderConfig,
	clientFactory: ChatClientFactory = defaultClientFactory
): ChatProvider {
	const model = config.model ?? DEFAULT_OPENAI_MODEL;
	const reasoningEffort = config.reasoningEffort ?? CHAT_REASONING_EFFORT;
	const timeoutMs = config.timeoutMs ?? CHAT_TIMEOUT_MS;
	const maxOutputTokens = config.maxOutputTokens ?? CHAT_MAX_OUTPUT_TOKENS;
	const client = clientFactory({
		apiKey: config.apiKey,
		maxRetries: OPENAI_MAX_RETRIES,
		timeout: timeoutMs,
		// Keep SDK debug logging from emitting policy text, questions, or raw provider errors.
		logLevel: 'off'
	});

	return {
		async answer(input: ChatModelInput): Promise<ProviderChatAnswer> {
			// Set once a response arrives. A failure after that point was still a paid call, so it
			// carries the model and usage for logging.
			let call: ChatCallInfo | undefined;
			try {
				const rawResponse = await client.responses.create(
					{
						model,
						reasoning: { effort: reasoningEffort },
						instructions: CHAT_INSTRUCTIONS,
						input: buildChatInput(input),
						max_output_tokens: maxOutputTokens,
						store: false,
						truncation: 'disabled',
						text: {
							format: zodTextFormat(ModelChatResponseSchema, 'clearconsent_chat_answer', {
								description:
									'A document-grounded answer, its kind, and exact excerpts from supplied passage IDs.'
							})
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
						'The answer provider returned incomplete output.'
					);
				}
				if (response.status !== 'completed') {
					throw new Stage1Error(
						'provider_unavailable',
						502,
						'The answer provider did not complete the request.'
					);
				}
				if (hasRefusal(response.output)) {
					throw new Stage1Error(
						'provider_refusal',
						422,
						'The answer provider refused to answer this question.'
					);
				}
				const output = parseChatOutput(response.output);
				if (output === null) {
					throw new Stage1Error(
						'provider_malformed',
						502,
						'The answer provider returned no validated structured output.'
					);
				}

				return { output, model: call.model, usage: call.usage };
			} catch (error) {
				const mapped = mapProviderError(error);
				throw call ? new ChatError(mapped, call) : mapped;
			}
		}
	};
}
