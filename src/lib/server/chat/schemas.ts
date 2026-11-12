import { z } from 'zod';
import type { FindingEvidenceJson } from '../analysis/consolidation/rows';
import type { ProviderUsage } from '../analysis/schemas';

// How the model classified a question (FR-11):
// - answered: the policy addresses it, and the answer cites the policy.
// - not_in_policy: the policy does not say; the answer states that instead of guessing.
// - out_of_scope: not about this document; the answer points back to document questions.
// - legal_advice: asks for legal advice or a legal conclusion; the answer states the limit and
//   may still describe what the document says.
export const ANSWER_KINDS = ['answered', 'not_in_policy', 'out_of_scope', 'legal_advice'] as const;
export type AnswerKind = (typeof ANSWER_KINDS)[number];

export const ModelChatExcerptSchema = z.strictObject({
	passageId: z.string(),
	excerpt: z.string()
});

// The model-facing schema has no offsets or IDs. The server adds them after locating each quote.
export const ModelChatResponseSchema = z.strictObject({
	kind: z.enum(ANSWER_KINDS),
	answer: z.string(),
	excerpts: z.array(ModelChatExcerptSchema)
});

export type ModelChatResponse = z.infer<typeof ModelChatResponseSchema>;

// A saved finding, reduced to what helps the model find its way around the policy. Its evidence
// is left out: the policy text is already in the prompt, and every quote is cited from it.
export type ChatFinding = {
	category: string;
	description: string;
	conditionNote: string | null;
	uncertaintyNote: string | null;
};

// An earlier message in the same chat. Only completed messages belong here, never a failed or
// pending answer.
export type ChatTurn = {
	role: 'user' | 'assistant';
	text: string;
};

export type ChatQuestionInput = {
	// The saved analysis's source text, exactly as stored, so excerpt offsets match it.
	sourceText: string;
	title: string | null;
	findings: ChatFinding[];
	// The chat's earlier messages, oldest first. Only the most recent ones are sent.
	history: ChatTurn[];
	question: string;
};

// The same evidence shape as a saved finding: offsets are UTF-16, start-inclusive, end-exclusive
// into the source text, and the excerpt is sliced from that text, never copied from the model.
export type ChatExcerpt = FindingEvidenceJson;

export type ChatAnswer = {
	kind: AnswerKind;
	answer: string;
	excerpts: ChatExcerpt[];
	provider: {
		model: string;
		usage: ProviderUsage | null;
	};
};
