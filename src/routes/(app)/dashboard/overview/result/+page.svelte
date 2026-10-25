<script lang="ts">
	import AnalysisResultView from '$lib/components/AnalysisResultView.svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { studyResult, detailLevel } from '$lib/study/sample';

	const detail = $derived(detailLevel(page.url.searchParams.get('detail')));
	const detailName = $derived(
		detail === 'quick' ? 'Quick scan' : detail === 'detailed' ? 'Detailed' : 'Balanced'
	);
</script>

<svelte:head><title>Study example results | ClearConsent</title></svelte:head>

<section class="result-page" aria-labelledby="result-title">
	<div class="result-topline">
		<p class="eyebrow">USER STUDY / PREPARED RESULT</p>
		<a class="back-link" href={resolve(`/dashboard/overview/extract?detail=${detail}`)}
			><span aria-hidden="true">←</span> Back to dashboard</a
		>
	</div>
	<div class="result-intro">
		<div>
			<h1 id="result-title">Study example results</h1>
			<p>Explore the explanation prepared for the fictional sample policy.</p>
		</div>
		<span class="detail-tag">{detailName}</span>
	</div>
	<p class="study-note" role="note">
		This is a prepared study example. ClearConsent did not analyze your submission or save it to
		history.
	</p>

	<AnalysisResultView result={studyResult} {detail} />

	<nav aria-label="Result navigation" class="result-actions">
		<a href={resolve('/study-sample')}>Read sample policy</a>
		<a href={resolve(`/dashboard/overview/extract?detail=${detail}`)}>Try URL input</a>
		<a href={resolve(`/dashboard/overview/text?detail=${detail}`)}>Try Paste Text</a>
		<a href={resolve('/preferences')}>Change detail preference</a>
	</nav>
</section>

<style>
	.result-page {
		color: #17263a;
	}
	.result-topline,
	.result-intro {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 20px;
	}
	.result-topline {
		align-items: center;
		margin-bottom: 20px;
	}
	.eyebrow {
		margin: 0;
		color: #0d737b;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.back-link {
		color: #0e6871;
		font-size: 12px;
		font-weight: 750;
		text-decoration: none;
	}
	.back-link:hover,
	.result-actions a:hover {
		text-decoration: underline;
	}
	.result-intro h1 {
		margin: 0;
		font-size: clamp(30px, 4vw, 42px);
		letter-spacing: -0.045em;
		line-height: 1.1;
	}
	.result-intro p {
		margin: 11px 0 0;
		color: #5a6b80;
		font-size: 14px;
		line-height: 1.55;
	}
	.detail-tag {
		flex: 0 0 auto;
		padding: 7px 10px;
		border: 1px solid #b7d9dc;
		border-radius: 4px;
		background: #eaf7f6;
		color: #0e6871;
		font-size: 11px;
		font-weight: 800;
	}
	.study-note {
		margin: 24px 0;
		padding: 13px 16px;
		border-left: 3px solid #3aa5a8;
		border-radius: 0 5px 5px 0;
		background: #f2f8f9;
		color: #3b5968;
		font-size: 12px;
		line-height: 1.55;
	}
	.result-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 30px;
		padding-top: 22px;
		border-top: 1px solid #dce6ea;
	}
	.result-actions a {
		padding: 8px 11px;
		border: 1px solid #cadce4;
		border-radius: 5px;
		color: #0d6771;
		font-size: 12px;
		font-weight: 750;
		text-decoration: none;
	}
	@media (max-width: 600px) {
		.result-topline,
		.result-intro {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
