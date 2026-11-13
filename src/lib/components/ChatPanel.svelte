<script lang="ts">
	import { untrack } from 'svelte';
	import {
		chatErrorMessage,
		checkQuestion,
		kindLabel,
		readAskResponse,
		readStateResponse,
		type AskOutcome,
		type ChatMessage,
		type PendingAnswer
	} from '$lib/chat';
	import { MAX_QUESTION_CHARACTERS, CHAT_QUESTION_LIMIT, POLL_MS } from '$lib/constants';

	// Document chat for a saved analysis (FR-11, #76). API reference: docs/chat-api.md.

	const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";
	const EXAMPLE_QUESTIONS = [
		'Who does this policy share my data with?',
		'How long is my data kept?',
		'Can I delete my data?'
	];

	let { analysisId }: { analysisId: string } = $props();

	let messages = $state<ChatMessage[]>([]);
	let pending = $state<PendingAnswer | null>(null);
	let status = $state<'loading' | 'ready' | 'error'>('loading');
	let loadError = $state('');
	let draft = $state('');
	// The question being sent, shown until the server returns the saved messages.
	let sendingText = $state<string | null>(null);
	let retrying = $state(false);
	let notice = $state('');
	let limitReached = $state(false);
	let pollTick = $state(0);
	let input = $state<HTMLTextAreaElement>();

	const chatUrl = $derived(`/api/chat?analysisId=${encodeURIComponent(analysisId)}`);
	const check = $derived(checkQuestion(draft));
	const runningId = $derived(pending?.status === 'running' ? pending.questionId : null);
	const failed = $derived(pending?.status === 'failed' ? pending : null);
	const busy = $derived(sendingText !== null || retrying || runningId !== null);
	const questionCount = $derived(messages.filter((message) => message.role === 'user').length);
	const atLimit = $derived(limitReached || questionCount >= CHAT_QUESTION_LIMIT);
	const canSend = $derived(status === 'ready' && !busy && !atLimit && check.ok);
	// Questions followed by an answer
	const answeredIds = $derived(
		new Set(
			messages.flatMap((message, index) =>
				message.role === 'user' && messages[index + 1]?.role === 'assistant' ? [message.id] : []
			)
		)
	);

	// Load the chat when the panel opens, and again if the page shows a different analysis
	$effect(() => {
		const url = chatUrl;
		untrack(() => {
			messages = [];
			pending = null;
			notice = '';
			limitReached = false;
			void refresh(url);
		});
	});

	// Check while an answer is being written
	$effect(() => {
		void pollTick;
		if (runningId === null || sendingText !== null || retrying) return;
		const timer = setTimeout(async () => {
			await refresh(chatUrl, true);
			pollTick += 1;
		}, POLL_MS);
		return () => clearTimeout(timer);
	});

	// Reads the saved chat
	// A quiet refresh keeps what is on screen if it fails
	async function refresh(url: string, quiet = false) {
		if (!quiet) status = 'loading';
		try {
			const outcome = await readStateResponse(await fetch(url));
			if (outcome.type === 'loaded') {
				messages = outcome.state.messages;
				pending = outcome.state.pending;
				status = 'ready';
				return;
			}
			if (!quiet) loadError = outcome.message;
		} catch {
			if (!quiet) loadError = NETWORK_MESSAGE;
		}
		if (!quiet) status = 'error';
	}

	// Adds messages, replacing any with the same ID
	// a retry returns its question again
	function upsert(list: ChatMessage[], ...added: ChatMessage[]): ChatMessage[] {
		const next = [...list];
		for (const message of added) {
			const index = next.findIndex((existing) => existing.id === message.id);
			if (index === -1) next.push(message);
			else next[index] = message;
		}
		return next;
	}

	// Sends a question or a retry: returns true when an answer comes back
	async function submit(body: { analysisId: string; question?: string; retry?: boolean }) {
		let outcome: AskOutcome;
		try {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			outcome = await readAskResponse(response);
		} catch {
			outcome = { type: 'error', status: 0, code: null, message: NETWORK_MESSAGE };
		}

		if (outcome.type === 'answered') {
			messages = upsert(messages, outcome.question, outcome.answer);
			pending = null;
			return true;
		}

		if (outcome.type === 'conflict' && outcome.status === 'question_limit') limitReached = true;
		notice = outcome.message;
		// The question may have been saved before the failure; the saved state says what to show.
		await refresh(chatUrl, true);
		// A saved, failed question shows its own error with Try again, so the notice would repeat it.
		if (failed) notice = '';
		return false;
	}

	async function send() {
		if (!canSend || !check.ok) return;
		const question = check.question;
		sendingText = question;
		notice = '';
		draft = '';
		const answered = await submit({ analysisId, question });
		sendingText = null;
		// Keep the text if the server never saved it, nothing typed is lost
		if (!answered && !failed) draft = question;
		input?.focus();
	}

	async function retry() {
		if (busy) return;
		retrying = true;
		notice = '';
		await submit({ analysisId, retry: true });
		retrying = false;
	}

	function useExample(example: string) {
		draft = example;
		input?.focus();
	}

	// Enter sends; Shift+Enter adds a line. isComposing avoids sending mid-word in IME input.
	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			void send();
		}
	}
</script>

<section class="chat" aria-labelledby="chat-title">
	<h2 id="chat-title">Ask about this policy</h2>
	<p class="intro">Answers come only from this policy's text. They aren't legal advice.</p>

	{#if status === 'loading'}
		<p class="state" role="status">Loading the chat…</p>
	{:else if status === 'error'}
		<div class="state" role="alert">
			<p>{loadError}</p>
			<button type="button" onclick={() => refresh(chatUrl)}>Try loading again</button>
		</div>
	{:else}
		<div class="log" role="log" aria-label="Questions and answers">
			{#if messages.length === 0 && sendingText === null}
				<div class="empty">
					<p>No questions yet. Try one of these:</p>
					<ul class="examples">
						{#each EXAMPLE_QUESTIONS as example (example)}
							<li>
								<button type="button" onclick={() => useExample(example)}>{example}</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#each messages as message (message.id)}
				{#if message.role === 'user'}
					<div class="message question">
						<p class="who">You asked</p>
						<p>{message.content}</p>
					</div>
					{#if message.id === runningId || (retrying && message.id === failed?.questionId)}
						<p class="message answer loading" role="status">Writing an answer…</p>
					{:else if failed && message.id === failed.questionId}
						<div class="message answer failed" role="alert">
							<p>{chatErrorMessage(failed.error.code, 500)}</p>
							<button type="button" onclick={retry} disabled={busy}>Try again</button>
						</div>
					{:else if !answeredIds.has(message.id)}
						<p class="message answer unanswered">This question wasn't answered.</p>
					{/if}
				{:else}
					{@const label = kindLabel(message.kind)}
					<div class="message answer" class:limited={message.kind !== 'answered'}>
						{#if label}<p class="kind">{label}</p>{/if}
						<p>{message.content}</p>
						{#if message.excerpts.length}
							<div class="excerpts">
								<p class="who">Policy excerpts</p>
								{#each message.excerpts as item, index (index)}
									<blockquote>{item.excerpt}</blockquote>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			{/each}

			{#if sendingText !== null}
				<div class="message question">
					<p class="who">You asked</p>
					<p>{sendingText}</p>
				</div>
				<p class="message answer loading" role="status">Writing an answer…</p>
			{/if}
		</div>

		{#if notice}
			<p class="notice" role="status">{notice}</p>
		{/if}

		<form
			class="ask"
			onsubmit={(event) => {
				event.preventDefault();
				void send();
			}}
		>
			<label for="chat-question">Your question</label>
			<textarea
				id="chat-question"
				bind:this={input}
				bind:value={draft}
				onkeydown={onKeydown}
				rows="2"
				disabled={atLimit}
				aria-describedby="chat-hint"
				placeholder="Ask about this policy"></textarea>
			<div class="ask-footer">
				<p id="chat-hint" class="hint">
					{#if atLimit}
						This chat has reached its {CHAT_QUESTION_LIMIT}-question limit.
					{:else if busy}
						Wait for the answer before asking another question.
					{:else if !check.ok && check.reason === 'too_long'}
						Questions can be at most {MAX_QUESTION_CHARACTERS} characters ({draft.trim().length} now).
					{:else}
						Enter to send, Shift+Enter for a new line.
					{/if}
				</p>
				<button type="submit" disabled={!canSend}>Send</button>
			</div>
		</form>
	{/if}
</section>

<style>
	.chat {
		display: grid;
		gap: 16px;
		padding: 24px;
		border: 1px solid #c9e0e4;
		border-radius: 8px;
		background: #fff;
		color: #17263a;
	}
	h2 {
		margin: 0;
		font-size: 1.25rem;
	}
	.intro,
	.hint,
	.who {
		margin: 0;
		color: #4a5b6e;
		font-size: 0.875rem;
	}
	.log {
		display: grid;
		gap: 12px;
	}
	.message {
		max-width: 85%;
		margin: 0;
		padding: 12px 14px;
		border-radius: 8px;
	}
	.message p {
		margin: 0;
	}
	.message .who {
		margin-bottom: 4px;
	}
	.question {
		justify-self: end;
		background: #e8f3f5;
	}
	.answer {
		justify-self: start;
		border: 1px solid #c9e0e4;
		background: #f4fafb;
	}
	.answer.limited {
		border-left: 4px solid #8a9aab;
	}
	.answer.failed {
		border-left: 4px solid #b3261e;
		background: #fdf3f2;
	}
	.answer.loading,
	.answer.unanswered {
		color: #4a5b6e;
		font-style: italic;
	}
	.kind {
		margin-bottom: 6px;
		color: #0c737b;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.excerpts {
		display: grid;
		gap: 6px;
		margin-top: 10px;
	}
	blockquote {
		margin: 0;
		padding: 6px 10px;
		border-left: 3px solid #168a92;
		background: #fff;
	}
	.examples {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 0;
		margin: 8px 0 0;
		list-style: none;
	}
	.notice {
		margin: 0;
		color: #7a4b00;
	}
	.ask {
		display: grid;
		gap: 8px;
	}
	label {
		font-weight: 600;
	}
	textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 10px;
		border: 1px solid #8a9aab;
		border-radius: 6px;
		font: inherit;
		resize: vertical;
	}
	.ask-footer {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		justify-content: space-between;
	}
	button {
		min-height: 44px;
		padding: 8px 16px;
		border: 1px solid #168a92;
		border-radius: 6px;
		background: #168a92;
		color: #fff;
		font: inherit;
		cursor: pointer;
	}
	.examples button,
	.state button,
	.failed button {
		background: #fff;
		color: #0c737b;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	button:focus-visible,
	textarea:focus-visible {
		outline: 3px solid #0c737b;
		outline-offset: 2px;
	}
	@media (max-width: 600px) {
		.chat {
			padding: 16px;
		}
		.message {
			max-width: 100%;
		}
	}
</style>
