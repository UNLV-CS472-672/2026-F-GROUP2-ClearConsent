import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Stage1Error } from '$lib/server/analysis/errors';
import { historyBefore } from '$lib/server/db/chat';
import type { ChatMessage } from '$lib/server/db/chat';
import { POLICY_TEXT, SHARING_SENTENCE } from '$lib/server/chat/test-fixtures';

// The provider boundary: every call here would be a paid answer.
const mocks = vi.hoisted(() => ({
	answer: vi.fn(),
	supabase: null as unknown,
	env: {} as Record<string, string | undefined>
}));
vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/db/supabase', () => ({ getSupabaseForUser: () => mocks.supabase }));
vi.mock('$lib/server/chat', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/chat')>()),
	createOpenAIChatProvider: () => ({ answer: mocks.answer })
}));

const ANALYSIS_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CHAT_ID = 'c0000000-0000-4000-8000-000000000001';
const RUN_ID = '91000000-0000-4000-8000-000000000001';
const QUESTION_ID = 'd0000000-0000-4000-8000-000000000003';
const ANSWER_ID = 'd0000000-0000-4000-8000-000000000004';

const ANALYSIS = { source_text: POLICY_TEXT, source_title: 'Example Maps Privacy Policy' };
const FINDING = {
	category: 'third_party_sharing',
	plain_language_description: 'Location history is shared with mapping partners.',
	condition_note: null,
	uncertainty_note: null
};

function messageRow(id: string, role: 'user' | 'assistant', content: string, minute: number) {
	return {
		id,
		role,
		content,
		answer_kind: role === 'assistant' ? 'answered' : null,
		supporting_excerpts: [],
		created_at: `2026-11-09T10:0${minute}:00.000Z`
	};
}

// An earlier answered exchange, then the question being answered now.
const EARLIER = [
	messageRow('d0000000-0000-4000-8000-000000000001', 'user', 'Do they track me?', 1),
	messageRow('d0000000-0000-4000-8000-000000000002', 'assistant', 'Only with sharing on.', 2)
];
const QUESTION = messageRow(QUESTION_ID, 'user', 'Who gets my location?', 3);

const ANSWERED = {
	kind: 'answered',
	answer: 'Location history is shared with mapping partners.',
	excerpts: [{ passageId: 'P001', excerpt: SHARING_SENTENCE }]
};

type Tables = Partial<
	Record<'analyses' | 'findings' | 'chats' | 'chat_messages' | 'chat_answer_runs', unknown>
>;
type Rpc = (name: string, args: Record<string, unknown>) => { data?: unknown; error?: unknown };

// Answers every query on a table with the same rows, however the query is chained.
function fakeSupabase(tables: Tables, rpc: Rpc) {
	const query = (result: { data: unknown; error: unknown }) => {
		const chain: Record<string, unknown> = {
			maybeSingle: async () => result,
			then: (resolve: (value: unknown) => unknown) => resolve(result)
		};
		for (const method of ['select', 'eq', 'order', 'limit']) chain[method] = () => chain;
		return chain;
	};
	const client = {
		from: vi.fn((table: keyof Tables) => {
			const rows = tables[table];
			return query(
				rows instanceof Error
					? { data: null, error: { message: rows.message } }
					: { data: rows ?? null, error: null }
			);
		}),
		rpc: vi.fn(async (name: string, args: Record<string, unknown>) => ({
			data: null,
			error: null,
			...rpc(name, args)
		}))
	};
	mocks.supabase = client;
	return client;
}

function started(questionId = QUESTION_ID): Rpc {
	return (name) => {
		if (name === 'start_chat_answer') {
			return { data: { status: 'started', runId: RUN_ID, chatId: CHAT_ID, questionId } };
		}
		if (name === 'save_chat_answer') {
			return { data: { id: ANSWER_ID, createdAt: '2026-11-09T10:04:00.000Z' } };
		}
		return { data: true };
	};
}

function postTables(overrides: Tables = {}): Tables {
	return {
		analyses: ANALYSIS,
		findings: [FINDING],
		chat_messages: [...EARLIER, QUESTION],
		...overrides
	};
}

const signedIn = {
	safeGetSession: async () => ({ session: { access_token: 'token' }, user: { id: 'user' } })
};

async function post(body: unknown, locals: unknown = signedIn) {
	const { POST } = await import('./routes/api/chat/+server');
	return POST({
		request: new Request('https://example.test/api/chat', {
			method: 'POST',
			body: JSON.stringify(body)
		}),
		locals
	} as unknown as Parameters<typeof POST>[0]);
}

async function get(analysisId: string) {
	const { GET } = await import('./routes/api/chat/+server');
	return GET({
		url: new URL(`https://example.test/api/chat?analysisId=${analysisId}`),
		locals: signedIn
	} as unknown as Parameters<typeof GET>[0]);
}

function rpcNames(client: ReturnType<typeof fakeSupabase>) {
	return client.rpc.mock.calls.map(([name]) => name);
}

function providerReturns(output: unknown) {
	mocks.answer.mockResolvedValue({ output, model: 'gpt-test', usage: null });
}

// The fields these tests read from a response body.
type Body = {
	error: { code: string };
	question: unknown;
	answer: unknown;
	messages: unknown[];
	pending: unknown;
};

async function bodyOf(response: Response): Promise<Body> {
	return (await response.json()) as Body;
}

// SvelteKit's error() throws an HttpError carrying the status.
async function statusOf(promise: Promise<Response>): Promise<number> {
	try {
		return (await promise).status;
	} catch (thrown) {
		return (thrown as { status: number }).status;
	}
}

beforeEach(() => {
	mocks.answer.mockReset();
	for (const key of Object.keys(mocks.env)) delete mocks.env[key];
	Object.assign(mocks.env, { ENABLE_PAID_ANALYSIS: '1', OPENAI_API_KEY: 'test-key' });
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'info').mockImplementation(() => {});
});

describe('POST /api/chat', () => {
	it('answers a new question once and saves the answer with its kind and excerpts', async () => {
		const client = fakeSupabase(postTables(), started());
		providerReturns(ANSWERED);

		const response = await post({ analysisId: ANALYSIS_ID, question: '  Who gets my location? ' });

		expect(response.status).toBe(200);
		expect(mocks.answer).toHaveBeenCalledTimes(1);
		expect(rpcNames(client)).toEqual(['start_chat_answer', 'save_chat_answer']);
		expect(client.rpc).toHaveBeenCalledWith('start_chat_answer', {
			p_analysis_id: ANALYSIS_ID,
			p_question: 'Who gets my location?'
		});
		const save = client.rpc.mock.calls[1][1];
		expect(save).toMatchObject({
			p_chat_id: CHAT_ID,
			p_run_id: RUN_ID,
			p_answer: ANSWERED.answer,
			p_answer_kind: 'answered'
		});
		const [excerpt] = save.p_supporting_excerpts as { startOffset: number; endOffset: number }[];
		expect(POLICY_TEXT.slice(excerpt.startOffset, excerpt.endOffset)).toBe(SHARING_SENTENCE);

		const body = await bodyOf(response);
		expect(body.question).toMatchObject({ id: QUESTION_ID, content: 'Who gets my location?' });
		expect(body.answer).toMatchObject({
			id: ANSWER_ID,
			role: 'assistant',
			kind: 'answered',
			content: ANSWERED.answer,
			createdAt: '2026-11-09T10:04:00.000Z'
		});
	});

	it('sends the policy, findings, and earlier exchanges to the model', async () => {
		fakeSupabase(postTables(), started());
		providerReturns(ANSWERED);

		await post({ analysisId: ANALYSIS_ID, question: 'Who gets my location?' });

		const [input] = mocks.answer.mock.calls[0];
		expect(input.question).toBe('Who gets my location?');
		expect(input.snapshot.title).toBe('Example Maps Privacy Policy');
		expect(input.findings).toEqual([
			{
				category: 'third_party_sharing',
				description: 'Location history is shared with mapping partners.',
				conditionNote: null,
				uncertaintyNote: null
			}
		]);
		expect(input.history).toEqual([
			{ role: 'user', text: 'Do they track me?' },
			{ role: 'assistant', text: 'Only with sharing on.' }
		]);
	});

	it.each(['running', 'nothing_to_retry', 'question_limit'])(
		'returns 409 without a provider call when the chat is %s',
		async (status) => {
			const client = fakeSupabase(postTables(), () => ({
				data: { status, runId: null, chatId: null, questionId: null }
			}));

			const response = await post({ analysisId: ANALYSIS_ID, question: 'Who gets my location?' });

			expect(response.status).toBe(409);
			expect(await bodyOf(response)).toEqual({ status });
			expect(mocks.answer).not.toHaveBeenCalled();
			expect(rpcNames(client)).toEqual(['start_chat_answer']);
		}
	);

	it.each([null, 'hello', 42, []])(
		'returns 400 for a body that is not an object: %j',
		async (body) => {
			const client = fakeSupabase(postTables(), started());

			expect(await statusOf(post(body))).toBe(400);
			expect(client.rpc).not.toHaveBeenCalled();
		}
	);

	it.each([
		['an empty question', '', 400, 'input_empty'],
		['a whitespace-only question', ' \n ', 400, 'input_empty'],
		['a missing question', undefined, 400, 'invalid_request'],
		['an oversized question', 'a'.repeat(2_001), 413, 'input_too_large']
	])('rejects %s before saving anything', async (_name, question, status, code) => {
		const client = fakeSupabase(postTables(), started());

		const response = await post({ analysisId: ANALYSIS_ID, question });

		expect(response.status).toBe(status);
		expect((await bodyOf(response)).error.code).toBe(code);
		expect(client.rpc).not.toHaveBeenCalled();
		expect(mocks.answer).not.toHaveBeenCalled();
	});

	it('saves nothing and makes no call while paid calls are disabled', async () => {
		delete mocks.env.ENABLE_PAID_ANALYSIS;
		const client = fakeSupabase(postTables(), started());

		const response = await post({ analysisId: ANALYSIS_ID, question: 'Who gets my location?' });

		expect(response.status).toBe(503);
		expect((await bodyOf(response)).error.code).toBe('analysis_disabled');
		expect(client.rpc).not.toHaveBeenCalled();
		expect(client.from).not.toHaveBeenCalled();
	});

	it('returns 404 for an analysis the user cannot read', async () => {
		const client = fakeSupabase(postTables({ analyses: null }), started());

		expect(await statusOf(post({ analysisId: ANALYSIS_ID, question: 'Hi?' }))).toBe(404);
		expect(client.rpc).not.toHaveBeenCalled();
	});

	it.each([
		['a missing analysis ID', { question: 'Hi?' }, 400],
		['a malformed analysis ID', { analysisId: 'nope', question: 'Hi?' }, 400]
	])('rejects %s', async (_name, body, status) => {
		fakeSupabase(postTables(), started());
		expect(await statusOf(post(body))).toBe(status);
	});

	it('requires a session', async () => {
		fakeSupabase(postTables(), started());
		const signedOut = { safeGetSession: async () => ({ session: null, user: null }) };
		expect(await statusOf(post({ analysisId: ANALYSIS_ID, question: 'Hi?' }, signedOut))).toBe(401);
	});

	it('records a provider failure so the page can offer Try again', async () => {
		const client = fakeSupabase(postTables(), started());
		mocks.answer.mockRejectedValue(
			new Stage1Error('provider_timeout', 504, 'The analysis provider timed out.', {
				retryable: true
			})
		);

		const response = await post({ analysisId: ANALYSIS_ID, question: 'Who gets my location?' });

		expect(response.status).toBe(504);
		expect(await bodyOf(response)).toEqual({
			error: {
				code: 'provider_timeout',
				message: 'The analysis provider timed out.',
				retryable: true
			}
		});
		expect(rpcNames(client)).toEqual(['start_chat_answer', 'fail_chat_answer']);
		expect(client.rpc).toHaveBeenLastCalledWith('fail_chat_answer', {
			p_chat_id: CHAT_ID,
			p_run_id: RUN_ID,
			p_error_code: 'provider_timeout',
			p_error_message: 'The analysis provider timed out.'
		});
	});

	it('never saves an answer whose excerpts are not in the policy', async () => {
		const client = fakeSupabase(postTables(), started());
		providerReturns({
			kind: 'answered',
			answer: 'Location is sold to advertisers.',
			excerpts: [{ passageId: 'P001', excerpt: 'We sell location history to advertisers.' }]
		});

		const response = await post({ analysisId: ANALYSIS_ID, question: 'Do they sell it?' });

		expect(response.status).toBe(502);
		expect((await bodyOf(response)).error.code).toBe('reference_validation_failed');
		expect(rpcNames(client)).toEqual(['start_chat_answer', 'fail_chat_answer']);
	});

	it('records a failure when the answer cannot be saved', async () => {
		const client = fakeSupabase(postTables(), (name, args) =>
			name === 'save_chat_answer'
				? { error: { message: 'connection reset' } }
				: started()(name, args)
		);
		providerReturns(ANSWERED);

		expect(await statusOf(post({ analysisId: ANALYSIS_ID, question: 'Who gets it?' }))).toBe(500);
		expect(rpcNames(client)).toEqual(['start_chat_answer', 'save_chat_answer', 'fail_chat_answer']);
		expect(client.rpc).toHaveBeenLastCalledWith(
			'fail_chat_answer',
			expect.objectContaining({ p_error_code: 'save_failed' })
		);
	});

	it('retries recording a failure once after a passing error', async () => {
		let failCalls = 0;
		const client = fakeSupabase(postTables(), (name, args) =>
			name === 'fail_chat_answer' && failCalls++ === 0
				? { error: { message: 'connection reset' } }
				: started()(name, args)
		);
		mocks.answer.mockRejectedValue(new Stage1Error('provider_timeout', 504, 'Timed out.'));

		const response = await post({ analysisId: ANALYSIS_ID, question: 'Who gets it?' });

		expect(response.status).toBe(504);
		expect(rpcNames(client)).toEqual(['start_chat_answer', 'fail_chat_answer', 'fail_chat_answer']);
	});

	it('retries the failed question without saving it again', async () => {
		const client = fakeSupabase(postTables(), started());
		providerReturns(ANSWERED);

		const response = await post({ analysisId: ANALYSIS_ID, retry: true });

		expect(response.status).toBe(200);
		expect(client.rpc).toHaveBeenCalledWith('start_chat_answer', {
			p_analysis_id: ANALYSIS_ID,
			p_question: null
		});
		expect(mocks.answer.mock.calls[0][0].question).toBe('Who gets my location?');
	});
});

describe('GET /api/chat', () => {
	const future = () => new Date(Date.now() + 60_000).toISOString();
	const run = (fields: Record<string, unknown>) => ({
		status: 'running',
		question_id: QUESTION_ID,
		error_code: null,
		error_message: null,
		expires_at: future(),
		...fields
	});

	function readTables(overrides: Tables = {}): Tables {
		return {
			analyses: { id: ANALYSIS_ID },
			chats: { id: CHAT_ID },
			chat_messages: [...EARLIER, QUESTION],
			chat_answer_runs: null,
			...overrides
		};
	}

	it('returns the messages with their kinds and excerpts', async () => {
		fakeSupabase(readTables(), started());
		const body = await bodyOf(await get(ANALYSIS_ID));

		expect(body.pending).toBeNull();
		expect(body.messages).toHaveLength(3);
		expect(body.messages[1]).toEqual({
			id: EARLIER[1].id,
			role: 'assistant',
			content: 'Only with sharing on.',
			kind: 'answered',
			excerpts: [],
			createdAt: EARLIER[1].created_at
		});
	});

	it('returns no messages before the first question', async () => {
		fakeSupabase(readTables({ chats: null }), started());
		expect(await bodyOf(await get(ANALYSIS_ID))).toEqual({ messages: [], pending: null });
	});

	it('reports an answer in progress', async () => {
		fakeSupabase(readTables({ chat_answer_runs: run({}) }), started());
		expect((await bodyOf(await get(ANALYSIS_ID))).pending).toEqual({
			status: 'running',
			questionId: QUESTION_ID
		});
	});

	it('reports a failed answer with its error', async () => {
		fakeSupabase(
			readTables({
				chat_answer_runs: run({
					status: 'failed',
					error_code: 'provider_timeout',
					error_message: 'Timed out.'
				})
			}),
			started()
		);
		expect((await bodyOf(await get(ANALYSIS_ID))).pending).toEqual({
			status: 'failed',
			questionId: QUESTION_ID,
			error: { code: 'provider_timeout', message: 'Timed out.' }
		});
	});

	it('reports an expired answer as interrupted', async () => {
		fakeSupabase(
			readTables({ chat_answer_runs: run({ expires_at: new Date(0).toISOString() }) }),
			started()
		);
		expect((await bodyOf(await get(ANALYSIS_ID))).pending).toMatchObject({
			status: 'failed',
			error: { code: 'answer_interrupted' }
		});
	});

	it('ignores a run whose answer was saved between the reads', async () => {
		fakeSupabase(
			readTables({
				chat_answer_runs: run({}),
				chat_messages: [...EARLIER, QUESTION, messageRow(ANSWER_ID, 'assistant', 'Answered.', 4)]
			}),
			started()
		);
		expect((await bodyOf(await get(ANALYSIS_ID))).pending).toBeNull();
	});

	it('returns 404 for an analysis the user cannot read', async () => {
		fakeSupabase(readTables({ analyses: null }), started());
		expect(await statusOf(get(ANALYSIS_ID))).toBe(404);
	});

	it('returns 500 rather than an empty chat when a read fails', async () => {
		fakeSupabase(readTables({ chat_messages: new Error('timeout') }), started());
		expect(await statusOf(get(ANALYSIS_ID))).toBe(500);
	});
});

describe('historyBefore', () => {
	const message = (id: string, role: 'user' | 'assistant'): ChatMessage => ({
		id,
		role,
		content: id,
		kind: null,
		excerpts: [],
		createdAt: ''
	});

	it('keeps answered exchanges before the question and drops unanswered questions', () => {
		const messages = [
			message('q1', 'user'),
			message('a1', 'assistant'),
			message('q2-failed', 'user'),
			message('q3', 'user'),
			message('a3', 'assistant'),
			message('q4-current', 'user')
		];
		expect(historyBefore(messages, 'q4-current').map((turn) => turn.text)).toEqual([
			'q1',
			'a1',
			'q3',
			'a3'
		]);
	});
});
