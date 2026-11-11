import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { Stage1Error, isStage1Error } from '$lib/server/analysis/errors';
import {
	answerQuestion,
	chatProviderConfig,
	ChatError,
	createOpenAIChatProvider,
	normalizeQuestion
} from '$lib/server/chat';
import type { OpenAIProviderConfig } from '$lib/server/analysis/openai-provider';
import type { ChatAnswer } from '$lib/server/chat';
import {
	analysisExists,
	historyBefore,
	readChatContext,
	readChatMessages,
	readChatState
} from '$lib/server/db/chat';
import type { ChatContext, ChatMessage, ChatState } from '$lib/server/db/chat';
import { getSupabaseForUser } from '$lib/server/db/supabase';
import type { RequestHandler } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pause before retrying a failed call that ends an answer.
const END_RETRY_MS = 500;

type AnswerStart = {
	status: 'started' | 'running' | 'nothing_to_retry';
	runId: string | null;
	chatId: string | null;
	questionId: string | null;
};

type AnswerFailure = { code: string; message: string };

// Same shape as the analysis pipeline's errors, so the page handles both the same way.
function errorResponse(stageError: Stage1Error): Response {
	return Response.json(
		{
			error: {
				code: stageError.code,
				message: stageError.message,
				retryable: stageError.retryable
			}
		},
		{ status: stageError.status }
	);
}

function toStage1Error(caught: unknown): Stage1Error {
	return isStage1Error(caught)
		? caught
		: new Stage1Error('internal_error', 500, 'The answer failed unexpectedly.', { cause: caught });
}

// Counts only: no question, answer, or excerpt text.
function logAnswer(fields: Record<string, unknown>): void {
	console.info(JSON.stringify({ event: 'chat_answer', ...fields }));
}

// Returns an analysis's chat messages and any unfinished answer, without starting anything.
export const GET: RequestHandler = async ({ url, locals }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		error(401, 'Unauthorized');
	}
	const analysisId = url.searchParams.get('analysisId');
	if (!analysisId || !UUID.test(analysisId)) {
		error(400, 'analysisId must be a UUID');
	}

	const supabase = getSupabaseForUser(session.access_token);
	let state: ChatState | null = null;
	try {
		if (await analysisExists(supabase, analysisId)) {
			state = await readChatState(supabase, analysisId);
		}
	} catch (readError) {
		console.error((readError as Error).message);
		error(500, 'Unable to load the chat.');
	}
	if (!state) {
		error(404, 'Analysis not found.');
	}
	return Response.json(state);
};

// Answers a question about one of the user's saved analyses, grounded in its source text.
// Body: { "analysisId": "...", "question": "..." } for a new question, or
//       { "analysisId": "...", "retry": true } to answer the chat's failed question again.
// One answer per chat runs at a time: another request while one runs returns 409 and makes no
// provider call. A failed answer is recorded so the page can offer Try again.
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		error(401, 'Unauthorized');
	}

	const parsed: unknown = await request.json().catch(() => error(400, 'Body must be JSON'));
	// JSON null or a bare string or number parses, but has no fields; the analysisId check rejects it.
	const body = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as {
		analysisId?: unknown;
		question?: unknown;
		retry?: unknown;
	};
	if (typeof body.analysisId !== 'string' || !UUID.test(body.analysisId)) {
		error(400, 'Body must be JSON like { "analysisId": "...", "question": "..." }');
	}
	const retry = body.retry === true;

	// Everything that can be checked without the database or the provider is checked first, so a
	// rejected request saves nothing and costs nothing.
	let question: string | null = null;
	let config: OpenAIProviderConfig;
	try {
		if (!retry) question = normalizeQuestion(body.question);
		config = chatProviderConfig(env);
	} catch (caught) {
		return errorResponse(toStage1Error(caught));
	}

	const supabase = getSupabaseForUser(session.access_token);
	let context: ChatContext | null;
	try {
		context = await readChatContext(supabase, body.analysisId);
	} catch (readError) {
		console.error((readError as Error).message);
		error(500, 'Unable to load the analysis.');
	}
	if (!context) {
		error(404, 'Analysis not found.');
	}

	const { data: start, error: startError } = await supabase.rpc('start_chat_answer', {
		p_analysis_id: body.analysisId,
		p_question: question
	});
	if (startError) {
		console.error('Failed to start chat answer:', startError.message);
		error(500, 'Unable to start the answer.');
	}
	const { status, runId, chatId, questionId } = start as AnswerStart;
	if (status !== 'started' || runId === null || chatId === null || questionId === null) {
		return Response.json({ status }, { status: 409 });
	}

	// Any path below that does not save the answer records it as failed, unless it clears this.
	let failure: AnswerFailure | null = {
		code: 'internal_error',
		message: 'The answer stopped unexpectedly.'
	};
	const startedAt = performance.now();
	try {
		let messages: ChatMessage[];
		try {
			messages = await readChatMessages(supabase, chatId);
		} catch (readError) {
			console.error((readError as Error).message);
			error(500, 'Unable to load the chat.');
		}
		const asked = messages.find((message) => message.id === questionId);
		if (!asked) {
			console.error('The question being answered is missing from its chat.');
			error(500, 'Unable to load the chat.');
		}

		let answer: ChatAnswer;
		try {
			answer = await answerQuestion(
				{ ...context, history: historyBefore(messages, questionId), question: asked.content },
				createOpenAIChatProvider(config)
			);
		} catch (caught) {
			const stageError = toStage1Error(caught);
			failure = { code: stageError.code, message: stageError.message };
			logAnswer({
				outcome: 'failed',
				code: stageError.code,
				durationMs: Math.round(performance.now() - startedAt),
				// Present when the model had already responded, so the paid call is still logged.
				...(stageError instanceof ChatError && {
					model: stageError.call.model,
					usage: stageError.call.usage
				})
			});
			return errorResponse(stageError);
		}

		const { data: saved, error: saveError } = await supabase.rpc('save_chat_answer', {
			p_chat_id: chatId,
			p_run_id: runId,
			p_answer: answer.answer,
			p_answer_kind: answer.kind,
			p_supporting_excerpts: answer.excerpts
		});
		if (saveError || !saved) {
			console.error('Failed to save chat answer:', saveError?.message ?? 'the answer expired');
			failure = { code: 'save_failed', message: 'Unable to save the answer.' };
			error(500, 'Unable to save the answer.');
		}

		failure = null;
		logAnswer({
			outcome: 'answered',
			kind: answer.kind,
			excerptCount: answer.excerpts.length,
			durationMs: Math.round(performance.now() - startedAt),
			model: answer.provider.model,
			usage: answer.provider.usage
		});
		const { id, createdAt } = saved as { id: string; createdAt: string };
		const reply: ChatMessage = {
			id,
			role: 'assistant',
			content: answer.answer,
			kind: answer.kind,
			excerpts: answer.excerpts,
			createdAt
		};
		return Response.json({ question: asked, answer: reply });
	} finally {
		if (failure) {
			const { code, message } = failure;
			const end = () =>
				supabase.rpc('fail_chat_answer', {
					p_chat_id: chatId,
					p_run_id: runId,
					p_error_code: code,
					p_error_message: message
				});
			// Until the answer is failed, the chat stays busy and blocks Try again, so a passing error
			// gets one retry. Failing only acts on this run id, so repeating a call that did succeed
			// is harmless. Otherwise the answer expires and shows as failed after its time limit.
			let { error: endError } = await end();
			if (endError) {
				console.error('Failed to record failed chat answer, retrying:', endError.message);
				await new Promise((resolve) => setTimeout(resolve, END_RETRY_MS));
				({ error: endError } = await end());
			}
			if (endError) {
				console.error('Failed to record failed chat answer:', endError.message);
			}
		}
	}
};
