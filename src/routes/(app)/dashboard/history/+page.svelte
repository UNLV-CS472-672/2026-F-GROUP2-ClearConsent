<script lang="ts">
	import DataTable from '$lib/components/DataTable.svelte';
	import type { features } from '$lib/components/DataTable';
	import { createColumnHelper } from '@tanstack/svelte-table';
	import type { ColumnDef } from '@tanstack/svelte-table';
	import type { RecentSource } from '$lib/components/DataTable';
	let { data } = $props();
	// Temporary for display purposes

	const getRecentSources = () => data.recentSources;

	// ---
	const columnHelper = createColumnHelper<typeof features, RecentSource>();

	const columns: ColumnDef<typeof features, RecentSource>[] = columnHelper.columns([
		columnHelper.accessor('title', {
			id: 'name',
			header: 'Name',
			size: 40,
			enableSorting: true
		}),

		columnHelper.accessor('created_at', {
			id: 'created_at',
			header: 'Date Created',
			cell: (info: any) =>
				new Date(info.getValue()).toLocaleDateString(undefined, {
					month: 'short',
					day: 'numeric',
					year: 'numeric',
				}),
			minSize: 50,
			maxSize: 75,
			enableSorting: false
		}),

		columnHelper.accessor('url', {
			id: 'url',
			header: ' ',
			enableSorting: false
		})
	]);
</script>

<div class="flex w-full flex-col items-center justify-center pb-5">
	<h1 class="font-lg mb-5 font-bold">Nothing substantial here yet.</h1>
	<DataTable data={getRecentSources()} {columns}></DataTable>
</div>
