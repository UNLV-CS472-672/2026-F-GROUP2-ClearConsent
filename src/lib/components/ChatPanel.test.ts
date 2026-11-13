import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFLICT_MESSAGES, KIND_LABELS, type ChatMessage, type ChatState } from '$lib/chat';
import ChatPanel from './ChatPanel.svelte';

const ANALYSIS_ID = '72000000-0000-4000-8000-000000000001';

function question(id: string, content: string): ChatMessage {
	return { id, role: 'user', content, kind: null, excerpts: [], createdAt: '2026-11-12T20:00:00Z' };
}

function answer(id: string, content: string, kind: ChatMessage['kind'] = 'answered'): ChatMessage {
	return {
		id,
		role: 'assistant',
		content,
		kind,
		excerpts:
			kind === 'answered'
				? [
						{
							excerpt: 'we share your location with our advertising partners',
							startOffset: 120,
							endOffset: 172,
							passageId: 'P2',
							match: 'exact'
						}
					]
				: [],
		createdAt: '2026-11-12T20:00:05Z'
	};
}

const q1 = question('q1', 'Who gets my location?');
const a1 = answer('a1', 'Advertising partners, if you turn on personalized ads.');

function errorBody(code: string) {
	return { error: { code, message: 'Server wording.', retryable: true } };
}

// What GET /api/chat returns; tests change it to simulate the saved chat changing.
let chatState: ChatState;
let getChat: () => Promise<Response>;
// What POST /api/chat returns for a given request body.
let postChat: (body: Record<string, unknown>) => Promise<Response>;
let fetch: ReturnType<typeof vi.fn>;

function postBodies() {
	return fetch.mock.calls
		.filter(([, init]) => init?.method === 'POST')
		.map(([, init]) => JSON.parse(init.body));
}

function getCount() {
	return fetch.mock.calls.filter(([, init]) => init?.method !== 'POST').length;
}

function questionBox() {
	return screen.getByLabelText('Your question') as HTMLTextAreaElement;
}

function sendButton() {
	return screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
}

async function renderPanel() {
	render(ChatPanel, { analysisId: ANALYSIS_ID });
	await vi.waitFor(() => expect(screen.getByLabelText('Your question')).toBeTruthy());
}

async function ask(text: string) {
	await fireEvent.input(questionBox(), { target: { value: text } });
	await fireEvent.click(sendButton());
}

beforeEach(() => {
	chatState = { messages: [], pending: null };
	getChat = async () => Response.json(chatState);
	postChat = async () => Response.json({ question: q1, answer: a1 });
	fetch = vi.fn((_url: string, init?: RequestInit) =>
		init?.method === 'POST' ? postChat(JSON.parse(String(init.body))) : getChat()
	);
	vi.stubGlobal('fetch', fetch);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('chat panel: loading', () => {
	it('loads the chat for this analysis', async () => {
		await renderPanel();
		expect(fetch.mock.calls[0][0]).toBe(`/api/chat?analysisId=${ANALYSIS_ID}`);
	});

	it('shows example questions for an empty chat', async () => {
		await renderPanel();
		expect(screen.getByText('No questions yet. Try one of these:')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'How long is my data kept?' })).toBeTruthy();
	});

	it('fills in an example question without sending it', async () => {
		await renderPanel();
		await fireEvent.click(screen.getByRole('button', { name: 'How long is my data kept?' }));
		expect(questionBox().value).toBe('How long is my data kept?');
		expect(postBodies()).toEqual([]);
	});

	it('shows saved history with the answer label and policy excerpts', async () => {
		chatState = { messages: [q1, a1], pending: null };
		await renderPanel();
		expect(screen.getByRole('log')).toBeTruthy();
		expect(screen.getByText(q1.content)).toBeTruthy();
		expect(screen.getByText(a1.content)).toBeTruthy();
		expect(screen.getByText(KIND_LABELS.answered)).toBeTruthy();
		expect(screen.getByText(a1.excerpts[0].excerpt)).toBeTruthy();
	});

	it.each(['not_in_policy', 'out_of_scope', 'legal_advice'] as const)(
		'labels a %s answer',
		async (kind) => {
			chatState = { messages: [q1, answer('a1', 'Limited answer.', kind)], pending: null };
			await renderPanel();
			expect(screen.getByText(KIND_LABELS[kind])).toBeTruthy();
		}
	);

	it('marks an earlier question that was never answered', async () => {
		chatState = {
			messages: [q1, question('q2', 'And my email?'), answer('a2', 'Kept.')],
			pending: null
		};
		await renderPanel();
		expect(screen.getByText("This question wasn't answered.")).toBeTruthy();
	});

	it('shows a failed load as an error, not an empty chat, and can load again', async () => {
		getChat = async () => new Response(null, { status: 500 });
		render(ChatPanel, { analysisId: ANALYSIS_ID });
		await vi.waitFor(() =>
			expect(screen.getByText('Something went wrong. Try again.')).toBeTruthy()
		);
		expect(screen.queryByText('No questions yet. Try one of these:')).toBeNull();

		getChat = async () => Response.json(chatState);
		await fireEvent.click(screen.getByRole('button', { name: 'Try loading again' }));
		await vi.waitFor(() =>
			expect(screen.getByText('No questions yet. Try one of these:')).toBeTruthy()
		);
	});

	it('shows a network failure while loading as an error', async () => {
		getChat = async () => {
			throw new TypeError('Failed to fetch');
		};
		render(ChatPanel, { analysisId: ANALYSIS_ID });
		await vi.waitFor(() => expect(screen.getByText(/Couldn't reach the server/)).toBeTruthy());
		expect(screen.getByRole('button', { name: 'Try loading again' })).toBeTruthy();
	});
});

describe('chat panel: asking', () => {
	it('sends the trimmed question and shows both messages', async () => {
		await renderPanel();
		await ask('  Who gets my location?  ');
		await vi.waitFor(() => expect(screen.getByText(a1.content)).toBeTruthy());

		expect(postBodies()).toEqual([{ analysisId: ANALYSIS_ID, question: 'Who gets my location?' }]);
		expect(questionBox().value).toBe('');
	});

	it('sends on Enter but not on Shift+Enter', async () => {
		await renderPanel();
		await fireEvent.input(questionBox(), { target: { value: 'Who gets my location?' } });

		await fireEvent.keyDown(questionBox(), { key: 'Enter', shiftKey: true });
		expect(postBodies()).toEqual([]);

		await fireEvent.keyDown(questionBox(), { key: 'Enter' });
		await vi.waitFor(() => expect(postBodies()).toHaveLength(1));
	});

	it('keeps Send disabled for an empty or whitespace-only question', async () => {
		await renderPanel();
		expect(sendButton().disabled).toBe(true);
		await fireEvent.input(questionBox(), { target: { value: '   ' } });
		expect(sendButton().disabled).toBe(true);
	});

	it('blocks a question over 2,000 characters and says why', async () => {
		await renderPanel();
		await fireEvent.input(questionBox(), { target: { value: 'a'.repeat(2001) } });
		expect(sendButton().disabled).toBe(true);
		expect(screen.getByText(/at most 2000 characters \(2001 now\)/)).toBeTruthy();
	});

	it('explains that chat is off and keeps the question when nothing was saved', async () => {
		postChat = async () => Response.json(errorBody('analysis_disabled'), { status: 503 });
		await renderPanel();
		await ask('Who gets my location?');

		await vi.waitFor(() => expect(screen.getByText(/Chat is turned off right now/)).toBeTruthy());
		await vi.waitFor(() => expect(questionBox().value).toBe('Who gets my location?'));
		expect(screen.queryByText(KIND_LABELS.answered)).toBeNull();
	});

	it('keeps the question when the server cannot be reached', async () => {
		postChat = async () => {
			throw new TypeError('Failed to fetch');
		};
		await renderPanel();
		await ask('Who gets my location?');

		await vi.waitFor(() => expect(screen.getByText(/Couldn't reach the server/)).toBeTruthy());
		await vi.waitFor(() => expect(questionBox().value).toBe('Who gets my location?'));
	});
});

describe('chat panel: failures and retry', () => {
	it('shows a saved question that failed once, with Try again, and clears the box', async () => {
		postChat = async () => {
			// The server saved the question before the provider failed.
			chatState = {
				messages: [q1],
				pending: {
					status: 'failed',
					questionId: 'q1',
					error: { code: 'provider_timeout', message: 'Timed out.' }
				}
			};
			return Response.json(errorBody('provider_timeout'), { status: 504 });
		};
		await renderPanel();
		await ask('Who gets my location?');

		const message = "The assistant couldn't answer right now. Try again.";
		await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy());
		expect(screen.getAllByText(message)).toHaveLength(1);
		expect(questionBox().value).toBe('');
	});

	it('retries a failed answer without repeating the question', async () => {
		chatState = {
			messages: [q1],
			pending: {
				status: 'failed',
				questionId: 'q1',
				error: { code: 'answer_interrupted', message: 'Stopped.' }
			}
		};
		await renderPanel();
		expect(screen.getByText('The answer stopped before it finished. Try again.')).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		await vi.waitFor(() => expect(screen.getByText(a1.content)).toBeTruthy());

		expect(postBodies()).toEqual([{ analysisId: ANALYSIS_ID, retry: true }]);
		expect(screen.getAllByText(q1.content)).toHaveLength(1);
	});

	it('reports a 409 running conflict and shows the running answer', async () => {
		postChat = async () => {
			// Another tab started an answer for this question first.
			chatState = { messages: [q1], pending: { status: 'running', questionId: 'q1' } };
			return Response.json({ status: 'running' }, { status: 409 });
		};
		await renderPanel();
		await ask('Who gets my location?');

		await vi.waitFor(() => expect(screen.getByText(CONFLICT_MESSAGES.running)).toBeTruthy());
		expect(screen.getByText('Writing an answer…')).toBeTruthy();
		expect(sendButton().disabled).toBe(true);
	});
});

describe('chat panel: running answers and limits', () => {
	it('polls a running answer until it finishes', async () => {
		vi.useFakeTimers();
		chatState = { messages: [q1], pending: { status: 'running', questionId: 'q1' } };
		await renderPanel();
		expect(screen.getByText('Writing an answer…')).toBeTruthy();
		expect(sendButton().disabled).toBe(true);

		chatState = { messages: [q1, a1], pending: null };
		await vi.advanceTimersByTimeAsync(3000);

		await vi.waitFor(() => expect(screen.getByText(a1.content)).toBeTruthy());
		expect(screen.queryByText('Writing an answer…')).toBeNull();
		expect(getCount()).toBeGreaterThanOrEqual(2);
	});

	it('disables new questions after a question_limit conflict', async () => {
		postChat = async () => Response.json({ status: 'question_limit' }, { status: 409 });
		await renderPanel();
		await ask('Who gets my location?');

		await vi.waitFor(() => expect(screen.getByText(CONFLICT_MESSAGES.question_limit)).toBeTruthy());
		expect(questionBox().disabled).toBe(true);
	});

	it('disables new questions when the loaded chat already has 100', async () => {
		chatState = {
			messages: Array.from({ length: 100 }, (_, i) => [
				question(`q${i}`, `Question ${i}`),
				answer(`a${i}`, `Answer ${i}`)
			]).flat(),
			pending: null
		};
		await renderPanel();
		expect(questionBox().disabled).toBe(true);
		expect(screen.getByText(/reached its 100-question limit/)).toBeTruthy();
	});
});
