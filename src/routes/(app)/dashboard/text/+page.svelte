<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	let { form } = $props();
	let loading: boolean = $state(false);
	let error: string = $state('');
	let input = $state('');
	let result: any = $state(null);
	async function submit() {
		loading = true;
		error = '';
		result = null;

		return async ({ update }) => {
			await update();
			const res = page.form;
			if (res.success) {
				result = res;
			} else error = res.error;
			loading = false;
		};
	}
</script>

<div class="flex flex-col pb-10">
	<form method="POST" class="m-auto flex flex-col items-end gap-2" use:enhance={submit}>
		<textarea
			name="text_submission"
			bind:value={input}
			placeholder="Paste policy..."
			onsubmit={submit}
			required
			class="h-50 w-200 resize-none overflow-scroll border border-gray-300 px-2 py-2 text-base"
			disabled={loading}></textarea>
		<button
			type="submit"
			class="w-fit bg-black px-3 py-1 font-bold text-floral-white"
			disabled={loading}>{loading ? 'Validating...' : 'Submit'}</button
		>
	</form>
	<div class="w-200 justify-center items-center">
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
