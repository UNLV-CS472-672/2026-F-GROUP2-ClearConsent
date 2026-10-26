<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { detailLevel, isSamplePolicyUrl } from '$lib/study/sample';
	import { page } from '$app/state';

	let url = $state('');
	let loading = $state(false);
	let error = $state('');

	async function submit(event: Event) {
		event.preventDefault();
		if (isSamplePolicyUrl(url, new URL(resolve('/study-sample'), page.url.origin))) {
			await goto(
				resolve(
					`/dashboard/overview/result?detail=${detailLevel(page.url.searchParams.get('detail'))}`
				)
			);
			return;
		}
		loading = true;
		error = '';

		const res = await fetch('/api/extract', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ url })
		});
		const body = (await res.json()) as any;
		if (res.ok) {
			console.log('Saved source:', body);
			await goto(
				resolve(
					`/dashboard/overview/analyze/${body.id}?detail=${detailLevel(page.url.searchParams.get('detail'))}`
				)
			);
		} else {
			error = body.message;
		}

		loading = false;
	}
</script>

<div class="mb-4">
	<button
		type="button"
		class="rounded border px-3 py-2"
		onclick={() => {
			url = new URL(resolve('/study-sample'), page.url.origin).href;
		}}>Use study sample</button
	>
	<p class="mt-2">Prepared study results are available only for the fixed sample policy.</p>
</div>
<div class="flex max-w-xl flex-col items-center justify-center px-4 py-12">
	<h1 class="mb-6 text-2xl font-semibold">Extract text from a URL</h1>

	<form onsubmit={submit} class="flex w-150 gap-2">
		<input
			type="url"
			bind:value={url}
			placeholder="https://example.com/terms"
			required
			class="flex-1 border border-gray-300 px-3 py-2"
		/>
		<button
			type="submit"
			disabled={loading}
			class="bg-black px-4 py-2 text-white disabled:opacity-50"
		>
			{loading ? 'Extracting…' : 'Extract'}
		</button>
	</form>

	{#if error}
		<p class="mt-4 bg-red-50 p-3 text-red-700">{error}</p>
	{/if}
</div>
