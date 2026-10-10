<script lang="ts">
	let url = $state('');
	let loading = $state(false);
	let result: any = $state(null);
	let error = $state('');

	async function submit(event: Event) {
		event.preventDefault();
		loading = true;
		result = null;
		error = '';

		const res = await fetch('/api/extract', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ url })
		});
		const body = (await res.json()) as any;
		if (res.ok) result = body;
		else error = body.message;

		loading = false;
	}
</script>

<main class="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-12">
	<h1 class="mb-6 text-2xl font-semibold">Extract text from a URL</h1>

	<form onsubmit={submit} class="flex w-full gap-2">
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

	{#if result}
		<h2 class="mt-8 text-lg font-semibold">{result.title}</h2>
		<p class="mt-1 font-mono text-sm text-gray-500">{result.url}</p>
		<pre
			class="mt-4 border border-gray-200 bg-gray-50 p-4 text-sm whitespace-pre-wrap">{result.text}</pre>
	{/if}
</main>
