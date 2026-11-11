import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnswerKind, ChatExcerpt, ChatFinding, ChatTurn } from '$lib/server/chat';

// A saved message as the chat API returns it. Questions have no kind and no excerpts.
export type ChatMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	kind: AnswerKind | null;
	excerpts: ChatExcerpt[];
	createdAt: string;
};

// The chat's unfinished answer, if any. A failed answer can be retried; an answer whose server
// stopped before finishing is reported as failed once its time limit passes.
export type PendingAnswer =
	| { status: 'running'; questionId: string }
	| { status: 'failed'; questionId: string; error: { code: string; message: string } };

export type ChatState = {
	messages: ChatMessage[];
	pending: PendingAnswer | null;
};

// What the model needs from a saved analysis, read with the user's client so RLS hides other
// users' analyses.
export type ChatContext = {
	sourceText: string;
	title: string | null;
	findings: ChatFinding[];
};

type MessageRow = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	answer_kind: AnswerKind | null;
	supporting_excerpts: ChatExcerpt[];
	created_at: string;
};

type RunRow = {
	status: 'running' | 'failed';
	question_id: string;
	error_code: string | null;
	error_message: string | null;
	expires_at: string;
};

type FindingRow = {
	category: string;
	plain_language_description: string;
	condition_note: string | null;
	uncertainty_note: string | null;
};

function toMessage(row: MessageRow): ChatMessage {
	return {
		id: row.id,
		role: row.role,
		content: row.content,
		kind: row.answer_kind,
		excerpts: row.supporting_excerpts,
		createdAt: row.created_at
	};
}

/** Returns null when the analysis does not exist or belongs to another user. Throws on a failed read. */
export async function readChatContext(
	supabase: SupabaseClient,
	analysisId: string
): Promise<ChatContext | null> {
	const { data: analysis, error: analysisError } = await supabase
		.from('analyses')
		.select('source_text, source_title')
		.eq('id', analysisId)
		.maybeSingle();
	if (analysisError) throw new Error(`Failed to load analysis: ${analysisError.message}`);
	if (!analysis) return null;

	const { data: findings, error: findingsError } = await supabase
		.from('findings')
		.select('category, plain_language_description, condition_note, uncertainty_note')
		.eq('analysis_id', analysisId)
		.order('display_order', { ascending: true });
	if (findingsError) throw new Error(`Failed to load findings: ${findingsError.message}`);

	return {
		sourceText: analysis.source_text,
		title: analysis.source_title,
		findings: ((findings ?? []) as FindingRow[]).map((finding) => ({
			category: finding.category,
			description: finding.plain_language_description,
			conditionNote: finding.condition_note,
			uncertaintyNote: finding.uncertainty_note
		}))
	};
}

/** True when the analysis exists and belongs to the user. Throws on a failed read. */
export async function analysisExists(
	supabase: SupabaseClient,
	analysisId: string
): Promise<boolean> {
	const { data, error } = await supabase
		.from('analyses')
		.select('id')
		.eq('id', analysisId)
		.maybeSingle();
	if (error) throw new Error(`Failed to load analysis: ${error.message}`);
	return data !== null;
}

/** A chat's messages, oldest first. Throws on a failed read. */
export async function readChatMessages(
	supabase: SupabaseClient,
	chatId: string
): Promise<ChatMessage[]> {
	const { data, error } = await supabase
		.from('chat_messages')
		.select('id, role, content, answer_kind, supporting_excerpts, created_at')
		.eq('chat_id', chatId)
		.order('created_at', { ascending: true })
		.order('id', { ascending: true });
	if (error) throw new Error(`Failed to load chat messages: ${error.message}`);
	return ((data ?? []) as MessageRow[]).map(toMessage);
}

/**
 * Reads an analysis's chat without starting anything, so it is safe to call from a load or a poll.
 * An analysis with no chat yet has no messages.
 *
 * Saving an answer removes its run and adds its message in one transaction, so the run is read
 * first: an answer that finishes between the reads shows up in the messages, and its stale run is
 * dropped below.
 */
export async function readChatState(
	supabase: SupabaseClient,
	analysisId: string
): Promise<ChatState> {
	const { data: chat, error: chatError } = await supabase
		.from('chats')
		.select('id')
		.eq('analysis_id', analysisId)
		.maybeSingle();
	if (chatError) throw new Error(`Failed to load chat: ${chatError.message}`);
	if (!chat) return { messages: [], pending: null };

	const { data: runData, error: runError } = await supabase
		.from('chat_answer_runs')
		.select('status, question_id, error_code, error_message, expires_at')
		.eq('chat_id', chat.id)
		.maybeSingle();
	if (runError) throw new Error(`Failed to load chat answer: ${runError.message}`);

	const messages = await readChatMessages(supabase, chat.id);
	const run = runData as RunRow | null;
	if (!run) return { messages, pending: null };

	const questionIndex = messages.findIndex((message) => message.id === run.question_id);
	if (messages[questionIndex + 1]?.role === 'assistant') return { messages, pending: null };

	if (run.status === 'failed') {
		return {
			messages,
			pending: {
				status: 'failed',
				questionId: run.question_id,
				error: {
					code: run.error_code ?? 'answer_failed',
					message: run.error_message ?? 'Unable to answer this question.'
				}
			}
		};
	}
	if (new Date(run.expires_at) <= new Date()) {
		return {
			messages,
			pending: {
				status: 'failed',
				questionId: run.question_id,
				error: { code: 'answer_interrupted', message: 'The answer stopped before it finished.' }
			}
		};
	}
	return { messages, pending: { status: 'running', questionId: run.question_id } };
}

/**
 * The finished exchanges before a question, for the model's history: each question that got an
 * answer, followed by that answer. Questions that failed or were never answered are left out.
 */
export function historyBefore(messages: ChatMessage[], questionId: string): ChatTurn[] {
	const end = messages.findIndex((message) => message.id === questionId);
	const earlier = end === -1 ? messages : messages.slice(0, end);
	const history: ChatTurn[] = [];
	for (let index = 1; index < earlier.length; index += 1) {
		const [question, answer] = [earlier[index - 1], earlier[index]];
		if (question.role === 'user' && answer.role === 'assistant') {
			history.push(
				{ role: 'user', text: question.content },
				{ role: 'assistant', text: answer.content }
			);
		}
	}
	return history;
}
