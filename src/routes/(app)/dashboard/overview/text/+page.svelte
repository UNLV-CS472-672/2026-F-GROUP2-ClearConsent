<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { samplePolicy, isSamplePolicy, detailLevel } from '$lib/study/sample';

	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import type { SubmitFunction } from './$types';
	let loading: boolean = $state(false);
	let error: string = $state('');
	let input = $state('');
	let result: any = $state(null);

	const submit: SubmitFunction = async ({ cancel }) => {
		if (isSamplePolicy(input)) {
			cancel();
			await goto(
				resolve(
					`/dashboard/overview/result?detail=${detailLevel(page.url.searchParams.get('detail'))}`
				)
			);
			return;
		}
		loading = true;
		error = '';
		result = null;

		return async ({ update }) => {
			await update();
			const res = page.form;
			if (res.success) {
				result = res;
				await saveSource(res.data);
			} else error = res.error;
			loading = false;
		};
	};

	const saveSource = async (content: string) => {
		const res = await fetch('/source', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ content })
		});
		const body = (await res.json()) as any;
		if (res.ok) {
			console.log('Saved source:', body);
			await goto(resolve(`/analyze/${body.id}`));
		} else {
			error = body.message;
		}
	};

	const keydown = (e: KeyboardEvent) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
			(e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	};
</script>

<div class="mb-4">
	<button
		type="button"
		class="rounded border px-3 py-2"
		onclick={() => {
			input = samplePolicy;
		}}>Use study sample</button
	>
	<p class="mt-2">Prepared study results are available only for the fixed sample policy.</p>
</div>
<div class="flex flex-col pb-10">
	<form method="POST" class="m-auto flex flex-col items-end gap-2" use:enhance={submit}>
		<textarea
			id="text_submission"
			name="text_submission"
			title="Ctrl+Enter to submit."
			bind:value={input}
			placeholder="Paste policy..."
			onkeypress={keydown}
			required
			class="h-50 w-200 resize-none overflow-scroll border border-gray-300 px-2 py-2 text-base"
			disabled={loading}></textarea>
		<button
			type="submit"
			class="w-fit bg-black px-3 py-1 font-bold text-floral-white"
			disabled={loading}>{loading ? 'Validating...' : 'Submit'}</button
		>
	</form>
	<div class="w-200 items-center justify-center">
		{#if result}
			<h1 class="text-lg font-bold">{result.hash}</h1>
			<h2 class="text-gray-500">{result.timestamp}</h2>
			<pre
				class="mt-4 border border-gray-200 bg-gray-50 p-4 text-sm whitespace-pre-wrap">{result.data}</pre>
		{:else if error}
			<pre class="mt-4 bg-red-50 p-3 text-red-700">{error}</pre>
		{/if}
	</div>
</div>
