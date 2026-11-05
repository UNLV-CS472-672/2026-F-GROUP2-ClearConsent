<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import type { features } from '$lib/components/DataTable';
	import { createColumnHelper } from '@tanstack/svelte-table';
	import type { ColumnDef } from '@tanstack/svelte-table';
	import type { SourceAndResult } from '$lib/components/DataTable';
	import type { PageData } from './$types';
	import { successFixture } from '$lib/contracts/fixtures';
	let { data }: { data: PageData } = $props();
	import { resolve } from '$app/paths';

	const getRecentSources = () => data.recentSources;
	const displaySnytheticData = false;

	function getSourcesAndResults(): SourceAndResult[] {
		const res: SourceAndResult[] = (getRecentSources() ?? []).map((src, index) => {
			return { source: src, result: data.results[index] };
		});
		return res;
	}
	const columnHelper = createColumnHelper<typeof features, SourceAndResult>();

	const columns: ColumnDef<typeof features, SourceAndResult>[] = columnHelper.columns([
		columnHelper.accessor((row) => row?.source.title, {
			id: 'name',
			header: 'Name',
			size: 40,
			enableSorting: true
		}),

		columnHelper.accessor((row) => row.source?.created_at, {
			id: 'created_at',
			header: 'Date Created',
			cell: (info: any) =>
				new Date(info.getValue()).toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				}),
			minSize: 50,
			maxSize: 75
		})
	]);
	const sourcesFromData = getSourcesAndResults();
	const syntheticSourcesandResults = (num: number) => {
		return Array.from({ length: num }, (_, i) => {
			const source = {
				id: String(i),
				title: `Company-${i + 1}`,
				url: `https://www.company${i + 1}.url`,
				created_at: new Date(Date.now() - i * 86400000).toISOString()
			};
			return { source: source, result: successFixture };
		});
	};
	let genNum = $state('10');
	const opts = ['0', '1', '10', '20', '30'];
</script>

<div class="dashboard-frame">
	<div class="workspace">
		<header class="masthead">
			<div class="identity">
				<span class="brand-mark" aria-hidden="true">C</span>
				<span><strong>ClearConsent</strong><small>Policy workspace</small></span>
			</div>
			<nav aria-label="Dashboard links" class="dashboard-links">
				<a href={resolve('/preferences')}>Preferences</a>
				<form action={resolve('/logout')} method="POST">
					<button type="submit">Sign out</button>
				</form>
			</nav>
		</header>

		<div class="history-content">
			<section class="history-panel" aria-labelledby="history-title">
				<div class="section-heading history-heading">
					<div>
						<p class="section-label">02 / HISTORY</p>
						<h2 id="history-title">Analyses</h2>
					</div>
				</div>
				<div class="flex w-full flex-col items-center justify-center pb-5">
					<!-- <h1 class="font-lg mb-5 font-bold">User Data</h1> -->
					<DataTable data={sourcesFromData} {columns}></DataTable>
				</div>

				{#if displaySnytheticData}
					<div class="flex w-full flex-col items-center justify-center pb-5">
						<h1 class="font-lg mb-5 font-bold">Synthetic Data</h1>
						<div class="inline-flex gap-5">
							<span> # of synthetic items</span>
							<select bind:value={genNum} class="border border-gray-500">
								{#each opts as opt (opt)}
									<option value={opt}>{opt}</option>
								{/each}
							</select>
						</div>
						<DataTable data={syntheticSourcesandResults(Number(genNum))} {columns}></DataTable>
					</div>
				{/if}
			</section>
		</div>
	</div>
	<footer>
		<strong>ClearConsent</strong><span>Privacy policy workspace</span>
	</footer>
</div>

<style>
	.dashboard-frame {
		width: 100%;
		min-height: 100vh;
		padding: 0 28px;
		background: #0b1220;
		color: #17263a;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}
	.workspace {
		max-width: 1240px;
		min-height: 100vh;
		margin: 0 auto;
		background: #f3f6fa;
		box-shadow: 0 24px 70px #0005;
	}
	.masthead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 19px 46px;
		border-bottom: 1px solid #2c4058;
		background: #0e1a2e;
		color: white;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 13px;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1px solid #62d7d0;
		border-radius: 8px;
		color: #62d7d0;
		font-size: 21px;
		font-weight: 750;
		transform: rotate(-6deg);
	}
	.identity span:last-child {
		display: grid;
		gap: 3px;
	}
	.identity strong {
		font-size: 14px;
		font-weight: 750;
		letter-spacing: 0.08em;
	}
	.identity small {
		color: #a9c0d1;
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.dashboard-links {
		display: flex;
		align-items: center;
		gap: 25px;
		font-size: 12px;
		font-weight: 700;
	}
	.dashboard-links a {
		color: #d9e8f1;
		text-decoration: none;
	}
	.dashboard-links a:hover {
		color: #70ebe0;
	}
	.dashboard-links form {
		margin: 0;
	}
	.dashboard-links button {
		padding: 8px 12px;
		border: 1px solid #5a8095;
		border-radius: 5px;
		background: transparent;
		color: #d9e8f1;
		font: inherit;
		cursor: pointer;
	}
	.dashboard-links button:hover {
		border-color: #70ebe0;
		color: #70ebe0;
	}
	.dashboard-links button:focus-visible {
		outline: 3px solid #42cabc;
		outline-offset: 3px;
	}
	.section-label {
		margin: 0 0 12px;
		color: #137b80;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.18em;
	}
	.history-content {
		display: grid;
		gap: 26px;
		padding: 38px 46px 54px;
	}
	.history-panel {
		min-width: 0;
		padding: 27px;
		border: 1px solid #d7e1ea;
		border-radius: 8px;
		background: white;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
	}
	.section-heading h2 {
		margin: 0 0 7px;
		font-size: 28px;
		font-weight: 690;
		letter-spacing: -0.035em;
	}
	.section-heading p:last-child {
		margin: 0;
		color: #5a6b80;
		font-size: 13px;
		line-height: 1.55;
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 20px 46px;
		border-top: 1px solid #d7e1ea;
		color: #66798d;
		font-size: 11px;
	}
	footer strong {
		color: #17263a;
	}
	a:focus-visible {
		outline: 3px solid #42cabc;
		outline-offset: 3px;
	}
	@media (max-width: 720px) {
		.dashboard-frame {
			padding: 0;
		}
		.masthead,
		footer {
			padding-right: 20px;
			padding-left: 20px;
		}
		.history-content {
			padding: 24px 16px 40px;
		}
	}
	@media (max-width: 480px) {
		.masthead {
			align-items: start;
			flex-direction: column;
			gap: 15px;
		}
		.section-heading {
			align-items: start;
			flex-direction: column;
		}
		footer {
			flex-direction: column;
		}
	}
</style>
