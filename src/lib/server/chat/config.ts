import { Stage1Error } from '../analysis/errors';
import { DEFAULT_OPENAI_MODEL } from '../analysis/openai-provider';
import type { OpenAIProviderConfig } from '../analysis/openai-provider';

export type ChatEnvironment = Record<string, string | undefined>;

// Checked before anything that could lead to a paid call. Chat shares the analysis switch and
// model, but not its reasoning effort, timeout, or output settings, which are sized for a full
// analysis rather than a short answer.
export function chatProviderConfig(environment: ChatEnvironment): OpenAIProviderConfig {
	if (environment.ENABLE_PAID_ANALYSIS !== '1') {
		throw new Stage1Error(
			'analysis_disabled',
			503,
			'AI answers are disabled. Set ENABLE_PAID_ANALYSIS=1 only for an approved local smoke test.'
		);
	}
	const apiKey = environment.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Stage1Error(
			'configuration_error',
			503,
			'OPENAI_API_KEY is not configured on the server.'
		);
	}
	return { apiKey, model: environment.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL };
}
