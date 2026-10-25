<script lang="ts">
	import AnalysisResultView from '$lib/components/AnalysisResultView.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { studyResult, detailLevel } from '$lib/study/sample';
	const detail = $derived(detailLevel(page.url.searchParams.get('detail')));
</script>

<svelte:head><title>Study example results | ClearConsent</title></svelte:head>
<section aria-labelledby="result-title">
	<h1 id="result-title" class="text-2xl font-bold">Study example results</h1>
	<p class="my-4" role="note">
		These results were prepared for the fixed study sample policy. They were not generated from your
		submission. No live AI analysis or history saving takes place.
	</p>
	<a class="underline" href={resolve('/study-sample')}>Read the sample policy</a>
	<p class="mt-4">Level of detail: {detail}</p>
	<AnalysisResultView result={studyResult} {detail} />
	<nav aria-label="Result navigation" class="mt-6 flex flex-wrap gap-4">
		<a class="underline" href={resolve(`/dashboard/overview/extract?detail=${detail}`)}
			>Back to dashboard</a
		>
		<a class="underline" href={resolve(`/dashboard/overview/extract?detail=${detail}`)}>Try URL</a>
		<a class="underline" href={resolve(`/dashboard/overview/text?detail=${detail}`)}
			>Try Paste Text</a
		>
		<a class="underline" href={resolve('/preferences')}>Change detail preference</a>
	</nav>
</section>
