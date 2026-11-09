import { vi } from 'vitest';
import type { ChatModelInput, ChatProvider, ProviderChatAnswer } from './provider';
import type { ChatQuestionInput } from './schemas';

// An invented policy, not from any real company.
export const POLICY_TEXT = `Location data

We collect your precise location only while the app is open and location sharing is turned on.

We share location history with mapping partners to improve route suggestions. You can turn off location sharing at any time in Settings > Privacy.

We keep location history for as long as needed to provide the service.`;

export const SHARING_SENTENCE =
	'We share location history with mapping partners to improve route suggestions.';
export const SETTINGS_SENTENCE =
	'You can turn off location sharing at any time in Settings > Privacy.';

export function questionInput(overrides: Partial<ChatQuestionInput> = {}): ChatQuestionInput {
	return {
		sourceText: POLICY_TEXT,
		title: 'Example Maps Privacy Policy',
		findings: [
			{
				category: 'third_party_sharing',
				description: 'Location history is shared with mapping partners.',
				conditionNote: null,
				uncertaintyNote: null
			}
		],
		history: [],
		question: 'Who gets my location?',
		...overrides
	};
}

// A provider that returns the given model output and records what it was asked.
export function fakeProvider(output: unknown) {
	const calls: ChatModelInput[] = [];
	const provider: ChatProvider = {
		answer: vi.fn(async (input: ChatModelInput): Promise<ProviderChatAnswer> => {
			calls.push(input);
			return {
				output,
				model: 'gpt-test',
				usage: { inputTokens: 100, outputTokens: 20, reasoningTokens: 0, totalTokens: 120 }
			};
		})
	};
	return { provider, calls };
}
