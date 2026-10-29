<script lang="ts">
	import AnalysisResultView from '$lib/components/AnalysisResultView.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { ANALYSIS_DEPENDENCY } from '$lib/analysis-run';
	import { detailLevel } from '$lib/study/sample';
	import type { PageData } from './$types';

	const POLL_MS = 3000;

	let { data }: { data: PageData } = $props();

	const detail = $derived(detailLevel(page.url.searchParams.get('detail')));
	const detailName = $derived(
		detail === 'quick' ? 'Quick scan' : detail === 'detailed' ? 'Detailed' : 'Balanced'
	);

	// Sources this page has already asked to analyze on its own. The load re-runs on auth events
	// and while polling, so without this a new source could be requested more than once.
	const requested = new SvelteSet<string>();
	// The source with a run request in flight from this page.
	let pending = $state<string | null>(null);
	// A source whose request ended without starting a run (for example, a network error).
	let unstarted = $state<string | null>(null);

	const loading = $derived(
		pending === data.source.id ||
			data.analysis.status === 'running' ||
			(data.analysis.status === 'not_started' && unstarted !== data.source.id)
	);

	// The server allows one run per source, so a request while another tab is running, or for a
	// failed source without retry, starts nothing. The stored state is re-read either way.
	async function start(sourceId: string, retry: boolean) {
		pending = sourceId;
		try {
			await fetch('/api/analyze', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ sourceId, retry })
			});
		} catch {
			// The reloaded state below shows what happened.
		} finally {
			await invalidate(ANALYSIS_DEPENDENCY);
			pending = null;
			if (data.source.id === sourceId && data.analysis.status === 'not_started') {
				unstarted = sourceId;
			}
		}
	}

	// Only a source that has never been run starts automatically. A failed one waits for Try again.
	$effect(() => {
		const sourceId = data.source.id;
		if (data.analysis.status === 'not_started' && !requested.has(sourceId)) {
			requested.add(sourceId);
			start(sourceId, false);
		}
	});

	// Another tab or an earlier visit started this run, so check back until it finishes.
	$effect(() => {
		if (data.analysis.status !== 'running') return;
		const timer = setInterval(() => invalidate(ANALYSIS_DEPENDENCY), POLL_MS);
		return () => clearInterval(timer);
	});
</script>

<svelte:head><title>Analysis results | ClearConsent</title></svelte:head>

<section class="result-page" aria-labelledby="result-title">
	<div class="result-topline">
		<p class="eyebrow">POLICY ANALYSIS / SAVED RESULT</p>
		<a class="back-link" href={resolve(`/dashboard/overview/extract?detail=${detail}`)}
			><span aria-hidden="true">←</span> Back to dashboard</a
		>
	</div>
	<div class="result-intro">
		<div>
			<h1 id="result-title">{data.source.title ?? 'Policy analysis'}</h1>
			<p>{data.source.url ?? 'Pasted policy text'}</p>
		</div>
		<span class="detail-tag">{detailName}</span>
	</div>

	{#if loading}
		<div class="loading" role="status" aria-live="polite">
			<div class="loading-header">
				<span class="spinner" aria-hidden="true"></span>
				<div>
					<p class="loading-title">Analyzing this policy</p>
					<p class="loading-text">
						Reading the wording and checking each practice against its source. This can take a
						minute.
					</p>
				</div>
			</div>
			<div class="skeleton skeleton-summary"></div>
			<div class="skeleton skeleton-card"></div>
			<div class="skeleton skeleton-card"></div>
		</div>
	{:else if data.analysis.status === 'complete'}
		<p class="study-note" role="note">
			ClearConsent analyzed this policy and saved the result to your account.
		</p>

		<AnalysisResultView result={data.analysis.result} {detail} />
	{:else}
		<div class="failed-state">
			<AnalysisResultView
				result={data.analysis.status === 'failed'
					? data.analysis.result
					: {
							status: 'failed',
							analysisId: data.source.id,
							schemaVersion: 1,
							errorCode: 'analysis_not_started',
							message: 'The analysis did not start.'
						}}
				{detail}
			/>
			<button type="button" class="retry" onclick={() => start(data.source.id, true)}>
				Try again
			</button>
		</div>
	{/if}

	<nav aria-label="Result navigation" class="result-actions">
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
		overflow-wrap: anywhere;
	}
	.result-intro p {
		margin: 11px 0 0;
		color: #5a6b80;
		font-size: 14px;
		line-height: 1.55;
		overflow-wrap: anywhere;
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
	.failed-state {
		margin: 24px 0 0;
	}
	.retry {
		margin-top: 16px;
		padding: 9px 14px;
		border: 0;
		border-radius: 5px;
		background: #0e6871;
		color: #fff;
		font: inherit;
		font-size: 13px;
		font-weight: 750;
		cursor: pointer;
	}
	.retry:hover {
		background: #0b5960;
	}
	.retry:focus-visible {
		outline: 2px solid #168a92;
		outline-offset: 2px;
	}
	.loading {
		display: grid;
		gap: 16px;
		margin: 24px 0 0;
	}
	.loading-header {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 13px 16px;
		border-left: 3px solid #3aa5a8;
		border-radius: 0 5px 5px 0;
		background: #f2f8f9;
	}
	.loading-title {
		margin: 0;
		color: #17263a;
		font-size: 14px;
		font-weight: 750;
	}
	.loading-text {
		margin: 3px 0 0;
		color: #3b5968;
		font-size: 12px;
		line-height: 1.55;
	}
	.spinner {
		flex: 0 0 auto;
		width: 20px;
		height: 20px;
		border: 3px solid #cde9e7;
		border-top-color: #168a92;
		border-radius: 50%;
		animation: spin 0.9s linear infinite;
	}
	.skeleton {
		border-radius: 8px;
		background: linear-gradient(90deg, #f4fafb 25%, #e4eff2 50%, #f4fafb 75%);
		background-size: 200% 100%;
		animation: shimmer 1.4s ease-in-out infinite;
	}
	.skeleton-summary {
		height: 132px;
		border: 1px solid #c9e0e4;
		border-left: 4px solid #168a92;
	}
	.skeleton-card {
		height: 120px;
		border: 1px solid #d6e2e9;
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
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spinner,
		.skeleton {
			animation: none;
		}
	}
	@media (max-width: 600px) {
		.result-topline,
		.result-intro {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
