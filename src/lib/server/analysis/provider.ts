import type { ProviderUsage, SourceSnapshot } from './schemas';

export type ProviderExtraction = {
	output: unknown;
	model: string;
	reasoningEffort: string;
	attempts: 1;
	usage: ProviderUsage | null;
};

export interface Stage1Provider {
	extract(snapshot: SourceSnapshot): Promise<ProviderExtraction>;
}
