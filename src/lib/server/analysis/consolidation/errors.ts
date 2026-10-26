import { Stage1Error } from '../errors';
import type { ProviderUsage } from '../schemas';

export type ConsolidationCallInfo = {
	model: string;
	usage: ProviderUsage | null;
};

// A consolidation failure that happened after the model responded, so the call was already
// paid for. It keeps the original error code and status, and carries the model and token usage
// so the failure can still be logged with its cost.
export class ConsolidationError extends Stage1Error {
	readonly call: ConsolidationCallInfo;

	constructor(error: Stage1Error, call: ConsolidationCallInfo) {
		super(error.code, error.status, error.message, {
			retryable: error.retryable,
			cause: error.cause
		});
		this.name = 'ConsolidationError';
		this.call = call;
	}
}
