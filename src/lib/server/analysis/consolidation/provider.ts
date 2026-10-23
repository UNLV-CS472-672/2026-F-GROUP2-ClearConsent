import type { ProviderUsage } from '../schemas';
import type { Stage2ModelInput } from './schemas';

export type ProviderConsolidation = {
	output: unknown;
	model: string;
	reasoningEffort: string;
	attempts: 1;
	usage: ProviderUsage | null;
};

export interface Stage2Provider {
	consolidate(input: Stage2ModelInput): Promise<ProviderConsolidation>;
}
