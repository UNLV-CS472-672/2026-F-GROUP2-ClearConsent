<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import type { features } from '$lib/components/DataTable';
	import { createColumnHelper } from '@tanstack/svelte-table';
	import type { ColumnDef } from '@tanstack/svelte-table';
	import type { RecentSource } from '$lib/components/DataTable';
	import type { AnalysisResult } from '$lib/contracts/analysis.js';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	// Temporary page for display purposes

	type sourceAndResult = {
		source: RecentSource;
		result: AnalysisResult;
	};

	const getRecentSources = () => data.recentSources;

	function getSourcesAndResults(): sourceAndResult[] {
		const res: sourceAndResult[] = getRecentSources().map((src, index) => {
			return { source: src, result: data.results[index] };
		});
		return res;
	}
	const columnHelper = createColumnHelper<typeof features, sourceAndResult>();

	const columns: ColumnDef<typeof features, sourceAndResult>[] = columnHelper.columns([
		columnHelper.accessor((row) => row.source.title, {
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
			maxSize: 75,
			enableSorting: false
		}),
	]);
</script>

<div class="flex w-full flex-col items-center justify-center pb-5">
	<h1 class="font-lg mb-5 font-bold">Nothing substantial here yet.</h1>
	<DataTable data={getSourcesAndResults()} {columns}></DataTable>
</div>
