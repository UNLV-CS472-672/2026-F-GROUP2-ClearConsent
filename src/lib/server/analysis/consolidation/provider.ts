import type { ProviderUsage } from '../schemas';
import type { ConsolidationModelInput } from './schemas';

export type ProviderConsolidation = {
	output: unknown;
	model: string;
	reasoningEffort: string;
	attempts: 1;
	usage: ProviderUsage | null;
};

export interface ConsolidationProvider {
	consolidate(input: ConsolidationModelInput): Promise<ProviderConsolidation>;
}
