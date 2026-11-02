<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import type { features } from '$lib/components/DataTable';
	import { createColumnHelper } from '@tanstack/svelte-table';
	import type { ColumnDef } from '@tanstack/svelte-table';
	import type { SourceAndResult } from '$lib/components/DataTable';
	import type { PageData } from './$types';
	import { successFixture } from '$lib/contracts/fixtures';
	let { data }: { data: PageData } = $props();
	// Temporary page for display purposes


	const getRecentSources = () => data.recentSources;

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
		return Array.from({length: num}, (_,i) => {
			const source = {
				id: String(i),
				title: `Company-${i+1}`,
				url: `https://www.company${i+1}.url`,
				created_at: new Date(Date.now() - i * 86400000).toISOString()
			}
			return { source: source, result: successFixture };
		})
	};
	let genNum = $state('10');
	const opts = ['0', '1', '10', '20', '30'];
</script>

<div class="flex w-full flex-col">
	<div class="flex w-full flex-col items-center justify-center pb-5">
		<h1 class="font-lg mb-5 font-bold">User Data</h1>
		<DataTable data={sourcesFromData} {columns}></DataTable>
	</div>

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
</div>
