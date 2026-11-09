import { Stage1Error, isStage1Error } from '../analysis/errors';
import { indexSource, resolveEvidence } from '../analysis/references';
import type { SourceSnapshot, VerifiedEvidence } from '../analysis/schemas';
import { createSourceSnapshot } from '../analysis/source';
import { ChatError } from './errors';
import { CHAT_HISTORY_MESSAGES } from './prompt';
import type { ChatProvider } from './provider';
import { ModelChatResponseSchema } from './schemas';
import type { ChatAnswer, ChatExcerpt, ChatQuestionInput } from './schemas';

export const MAX_QUESTION_CHARACTERS = 2_000;

// Returns the trimmed question. Runs before any provider call, so an empty or oversized question
// never costs anything.
export function normalizeQuestion(question: unknown): string {
	if (typeof question !== 'string') {
		throw new Stage1Error('invalid_request', 400, 'question must be a string.');
	}
	const trimmed = question.trim();
	if (!trimmed) {
		throw new Stage1Error('input_empty', 400, 'Enter a question about this document.');
	}
	if (trimmed.length > MAX_QUESTION_CHARACTERS) {
		throw new Stage1Error(
			'input_too_large',
			413,
			`Questions can be at most ${MAX_QUESTION_CHARACTERS} characters.`
		);
	}
	return trimmed;
}

function toExcerpt(evidence: VerifiedEvidence): ChatExcerpt {
	return {
		excerpt: evidence.excerpt,
		startOffset: evidence.startOffset,
		endOffset: evidence.endOffset,
		passageId: evidence.passageId,
		match: evidence.match
	};
}

// Checks the model's answer against the source. Only located excerpts are kept, each sliced from
// the source text. An answer, or any other reply that cited the document, must keep at least one,
// so an unsupported claim about the document is never shown.
export function resolveChatAnswer(
	rawOutput: unknown,
	snapshot: SourceSnapshot
): Omit<ChatAnswer, 'provider'> {
	const parsed = ModelChatResponseSchema.safeParse(rawOutput);
	if (!parsed.success) {
		throw new Stage1Error(
			'provider_malformed',
			502,
			'The answer provider response did not match the chat schema.',
			{ cause: parsed.error }
		);
	}
	const { kind, excerpts: references } = parsed.data;
	const answer = parsed.data.answer.trim();
	if (!answer) {
		throw new Stage1Error(
			'provider_malformed',
			502,
			'The answer provider returned a blank answer.'
		);
	}
	// An off-topic question has nothing in the document to cite.
	if (kind === 'out_of_scope') return { kind, answer, excerpts: [] };

	const source = indexSource(snapshot);
	const seen = new Set<string>();
	const excerpts: ChatExcerpt[] = [];
	for (const reference of references) {
		if (!reference.passageId.trim()) continue;
		for (const evidence of resolveEvidence(source, reference.passageId, reference.excerpt)) {
			if (evidence.status !== 'verified') continue;
			// The same sentence cited twice is shown once.
			const key = `${evidence.startOffset}:${evidence.endOffset}`;
			if (seen.has(key)) continue;
			seen.add(key);
			excerpts.push(toExcerpt(evidence));
		}
	}

	// An answer must keep a quote. Any other kind that cited quotes was describing the document
	// (such as a legal-advice limit that says what the policy states), so it must keep one too:
	// otherwise a misquoted claim would be shown, and relabeling an answer would skip this check.
	if (excerpts.length === 0 && (kind === 'answered' || references.length > 0)) {
		throw new Stage1Error(
			'reference_validation_failed',
			502,
			'None of the excerpts cited for this answer could be found in the document.'
		);
	}
	return { kind, answer, excerpts };
}

// Answers one question about a saved analysis. The caller has already checked that the user owns
// the analysis and that paid calls are enabled; this validates the question first, then makes at
// most one provider call.
export async function answerQuestion(
	input: ChatQuestionInput,
	provider: ChatProvider
): Promise<ChatAnswer> {
	const question = normalizeQuestion(input.question);
	if (!input.sourceText) {
		throw new Stage1Error(
			'invalid_request',
			422,
			'This analysis has no source text, so it cannot answer questions.'
		);
	}
	const snapshot = await createSourceSnapshot(input.sourceText, {
		title: input.title ?? undefined
	});

	const response = await provider.answer({
		snapshot,
		findings: input.findings,
		history: input.history.slice(-CHAT_HISTORY_MESSAGES),
		question
	});
	const call = { model: response.model, usage: response.usage };
	try {
		return { ...resolveChatAnswer(response.output, snapshot), provider: call };
	} catch (error) {
		if (!isStage1Error(error)) throw error;
		throw new ChatError(error, call);
	}
}
