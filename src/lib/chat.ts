// Types, constants, and helpers for the chat panel (#76), matching docs/chat-api.md (#85).
import type { ChatMessage, ChatState, PendingAnswer } from '$lib/server/db/chat';
import { MAX_QUESTION_CHARACTERS, CHAT_QUESTION_LIMIT } from './constants';

export type { ChatMessage, ChatState, PendingAnswer };

// 'answered' | 'not_in_policy' | 'out_of_scope' | 'legal_advice'
export type AnswerKind = NonNullable<ChatMessage['kind']>;

// POST /api/chat success: both messages, so the panel can show them without reloading.
export type AskResponse = { question: ChatMessage; answer: ChatMessage };

// POST /api/chat 409 bodies: an answer is already running, nothing failed to retry,
// or the chat already has 100 questions.
export type ChatConflict = { status: 'running' | 'nothing_to_retry' | 'question_limit' };

// Other POST failures that carry a code, such as input_empty or analysis_disabled.
export type ChatErrorBody = { error: { code: string; message: string; retryable: boolean } };

// Helper functions:

// Checking a question before sending

// The label shown with each answer
export const KIND_LABELS: Record<AnswerKind, string> = {
	answered: 'From the policy',
	not_in_policy: "The policy doesn't say",
	out_of_scope: 'Not about this policy',
	legal_advice: 'Not legal advice'
};

// Used only if the server sends a kind the UI doesn't know yet
export const UNKNOWN_KIND_LABEL = 'Answer';

export type QuestionCheck =
	{ ok: true; question: string } | { ok: false; reason: 'empty' | 'too_long' };

// Mirrors the server's normalizeQuestion: trim first, then check
export function checkQuestion(text: string): QuestionCheck {
	const question = text.trim();
	if (!question) return { ok: false, reason: 'empty' };
	if (question.length > MAX_QUESTION_CHARACTERS) return { ok: false, reason: 'too_long' };
	return { ok: true, question };
}

// The label for a message, or null for a question
export function kindLabel(kind: ChatMessage['kind']): string | null {
	if (kind === null) return null;
	return KIND_LABELS[kind] ?? UNKNOWN_KIND_LABEL;
}

// Turning API responses into outcomes the panel can show

// A failure the panel shows as a message, and doesn't give an answer
// code is null for plain errors that come without an { error } body (e.g. 401, 404)
export type ChatFailure = { type: 'error'; status: number; code: string | null; message: string };

export type AskOutcome =
	| { type: 'answered'; question: ChatMessage; answer: ChatMessage }
	| { type: 'conflict'; status: ChatConflict['status']; message: string }
	| ChatFailure;

export type StateOutcome = { type: 'loaded'; state: ChatState } | ChatFailure;

export const CONFLICT_MESSAGES: Record<ChatConflict['status'], string> = {
	running: 'An answer is already being written.',
	nothing_to_retry: 'There is no failed answer to retry.',
	question_limit: `This chat has reached its ${CHAT_QUESTION_LIMIT}-question limit. You can still read it and retry a failed answer.`
};

// Messages written for users, keyed by API's error codes
const ERROR_MESSAGES: Record<string, string> = {
	input_empty: 'Enter a question about this policy.',
	invalid_request: "That question couldn't be sent.",
	input_too_large: `Questions can be at most ${MAX_QUESTION_CHARACTERS} characters.`,
	analysis_disabled: 'Chat is turned off right now. Your question was not sent.',
	configuration_error: 'Chat is not set up on this server. Your question was not sent.',
	reference_validation_failed:
		"The answer quoted text that isn't in the policy, so it wasn't shown. Try again.",
	answer_interrupted: 'The answer stopped before it finished. Try again.',
	save_failed: "The answer couldn't be saved. Try again.",
	internal_error: 'Something went wrong while answering. Try again.'
};

const PROVIDER_MESSAGE = "The assistant couldn't answer right now. Try again.";

// For plain errors with no code, chosen by HTTP status.
const STATUS_MESSAGES: Record<number, string> = {
	400: "That request couldn't be sent.",
	401: 'Your session has ended. Sign in again to use chat.',
	404: "This analysis couldn't be found."
};

const GENERIC_MESSAGE = 'Something went wrong. Try again.';

export function chatErrorMessage(code: string | null, status: number): string {
	if (code !== null) {
		if (code in ERROR_MESSAGES) return ERROR_MESSAGES[code];
		if (code.startsWith('provider_')) return PROVIDER_MESSAGE;
	}
	return STATUS_MESSAGES[status] ?? GENERIC_MESSAGE;
}

const CONFLICT_STATUSES: readonly string[] = ['running', 'nothing_to_retry', 'question_limit'];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isConflictStatus(value: unknown): value is ChatConflict['status'] {
	return typeof value === 'string' && CONFLICT_STATUSES.includes(value);
}

// Never throw: a body that isn't JSON becomes null.
async function readJson(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

function toFailure(status: number, body: unknown): ChatFailure {
	const error = isRecord(body) && isRecord(body.error) ? body.error : null;
	const code = error && typeof error.code === 'string' ? error.code : null;
	return { type: 'error', status, code, message: chatErrorMessage(code, status) };
}

// POST /api/chat. A 200 without both messages counts as a failure
export async function readAskResponse(response: Response): Promise<AskOutcome> {
	const body = await readJson(response);
	if (response.ok && isRecord(body) && isRecord(body.question) && isRecord(body.answer)) {
		return {
			type: 'answered',
			question: body.question as ChatMessage,
			answer: body.answer as ChatMessage
		};
	}
	if (response.status === 409 && isRecord(body) && isConflictStatus(body.status)) {
		return { type: 'conflict', status: body.status, message: CONFLICT_MESSAGES[body.status] };
	}
	return toFailure(response.status, body);
}

// GET /api/chat. A failed read is a failure not an empty chat
export async function readStateResponse(response: Response): Promise<StateOutcome> {
	const body = await readJson(response);
	if (response.ok && isRecord(body) && Array.isArray(body.messages) && 'pending' in body) {
		return { type: 'loaded', state: body as ChatState };
	}
	return toFailure(response.status, body);
}
