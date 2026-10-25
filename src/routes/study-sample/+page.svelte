<script lang="ts">
	import { samplePolicy } from '$lib/study/sample';
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Study sample privacy policy | ClearConsent</title></svelte:head>
<main class="mx-auto max-w-3xl p-6">
	<h1 class="text-2xl font-bold">Study sample privacy policy</h1>
	<p class="my-4">This fictional policy is used by all participants in the ClearConsent study.</p>
	<pre class="whitespace-pre-wrap">{samplePolicy}</pre>
	<a class="mt-6 inline-block underline" href={resolve('/dashboard/overview')}>Back to dashboard</a>
</main>
