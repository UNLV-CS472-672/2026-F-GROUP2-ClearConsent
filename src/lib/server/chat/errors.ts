import { Stage1Error } from '../analysis/errors';
import type { ProviderUsage } from '../analysis/schemas';

export type ChatCallInfo = {
	model: string;
	usage: ProviderUsage | null;
};

// A chat failure that happened after the model responded, so the call was already paid for. It
// keeps the original error code and status, and carries the model and token usage for logging.
export class ChatError extends Stage1Error {
	readonly call: ChatCallInfo;

	constructor(error: Stage1Error, call: ChatCallInfo) {
		super(error.code, error.status, error.message, {
			retryable: error.retryable,
			cause: error.cause
		});
		this.name = 'ChatError';
		this.call = call;
	}
}
