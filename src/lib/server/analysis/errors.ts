export type Stage1ErrorCode =
	| 'invalid_json'
	| 'invalid_request'
	| 'input_empty'
	| 'input_too_large'
	| 'analysis_disabled'
	| 'unauthorized'
	| 'configuration_error'
	| 'provider_authentication'
	| 'provider_quota'
	| 'provider_rate_limit'
	| 'provider_timeout'
	| 'provider_refusal'
	| 'provider_truncated'
	| 'provider_malformed'
	| 'provider_unavailable'
	| 'reference_validation_failed';

export class Stage1Error extends Error {
	readonly code: Stage1ErrorCode;
	readonly status: number;
	readonly retryable: boolean;

	constructor(
		code: Stage1ErrorCode,
		status: number,
		message: string,
		options?: { retryable?: boolean; cause?: unknown }
	) {
		super(message, options?.cause === undefined ? undefined : { cause: options.cause });
		this.name = 'Stage1Error';
		this.code = code;
		this.status = status;
		this.retryable = options?.retryable ?? false;
	}
}

export function isStage1Error(error: unknown): error is Stage1Error {
	return error instanceof Stage1Error;
}
