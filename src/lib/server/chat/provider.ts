import type { ProviderUsage, SourceSnapshot } from '../analysis/schemas';
import type { ChatFinding, ChatTurn } from './schemas';

export type ChatModelInput = {
	snapshot: SourceSnapshot;
	findings: ChatFinding[];
	history: ChatTurn[];
	question: string;
};

export type ProviderChatAnswer = {
	output: unknown;
	model: string;
	usage: ProviderUsage | null;
};

export interface ChatProvider {
	answer(input: ChatModelInput): Promise<ProviderChatAnswer>;
}
