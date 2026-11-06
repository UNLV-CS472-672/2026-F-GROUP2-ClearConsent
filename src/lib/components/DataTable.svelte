<script lang="ts" generics="TData extends RowData">
	import { createTable, FlexRender, type ColumnDef, type RowData } from '@tanstack/svelte-table';
	import { features, type SourceAndResult } from '$lib/components/DataTable';
	import { detailLevel } from '$lib/study/sample';
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AnalysisResultView from './AnalysisResultView.svelte';
	const detail = $derived('?detail=' + detailLevel(page.url.searchParams.get('detail')));

	type Props = {
		data: TData[];
		columns: ColumnDef<typeof features, TData>[];
	};
	let { data, columns }: Props = $props();

	let pageSize = $state('10');

	type SortOption = {
		id: string;
		label: string;
	};
	// id-sortOrder
	const sortOptions = $state<SortOption[]>([
		{ id: 'name-asc', label: 'Name (A-Z)' },
		{ id: 'name-desc', label: 'Name (Z-A)' },
		{ id: 'created_at-asc', label: 'Date (oldest)' },
		{ id: 'created_at-desc', label: 'Date (newest)' }
	]);
	let sort = $state<SortOption['id']>('created_at-desc');
	let sortingState = $derived.by(() => {
		const [sortID, sortOrder] = sort.split('-');
		return [{ id: sortID, desc: sortOrder === 'desc' }];
	});

	let isModalOpen = $state(false);
	let dialogRef = $state<HTMLDialogElement | undefined>();
	let currentSourceAndResult = $state<SourceAndResult>();

	const table = createTable({
		features,
		get columns() {
			return columns;
		},

		get data() {
			return data;
		},

		initialState: {
			pagination: {
				pageIndex: 0,
				get pageSize() {
					return Number(pageSize);
				}
			}
		},
		state: {
			get sorting() {
				return sortingState;
			}
		}
	});
	function nextPage() {
		if (table.getCanNextPage()) table.nextPage();
	}
	function prevPage() {
		if (table.getCanPreviousPage()) table.previousPage();
	}
</script>

<div class="mt-2 flex w-full flex-col gap-5">
	<div class="table-controls inline-flex w-full justify-between self-start text-sm font-semibold">
		<input
			type="search"
			placeholder="Search by name..."
			oninput={(event) => {
				table.getColumn('name')?.setFilterValue(event.currentTarget.value);
			}}
			class="search-input flex field-sizing-content w-50 flex-col items-center border border-gray-400 p-1 pr-2 pl-2"
		/>
		<!-- Pagination if necesssary -->
		{#if table.getCanNextPage() || table.getCanPreviousPage()}
			{@const pageIndex = table.atoms.pagination.get().pageIndex + 1}
			{@const pageCount = table.getPageCount()}
			<div class="flex items-center justify-center gap-5 text-lg">
				<button onclick={prevPage} class="cursor-pointer">&#8592;</button>
				<span class="text-sm">{pageIndex}/{pageCount}</span>
				<button onclick={nextPage} class="cursor-pointer">&#8594;</button>
			</div>
		{/if}
		<!-- Sorting dropdown -->
		<div>
			<span class="m-auto">Sort By:</span>
			<select
				bind:value={sort}
				class="rounded-lg border border-gray-300 px-2 py-0.5"
				onchange={() => table.setSorting(sortingState)}
			>
				{#each sortOptions as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if data.length !== 0}
		<div class="table-body flex flex-col gap-2">
			{#each table.getRowModel().rows as row (row.id)}
				<div
					class="table-line flex w-full justify-between rounded-lg border border-[#cad8e3]
						bg-[#f8fafc] hover:border-[#2ca6af] hover:shadow-lg hover:shadow-[#11788322]"
				>
					{#each row.getAllCells() as cell (cell.id)}
						<button
							onclick={async () => {
								currentSourceAndResult = cell.row.original as SourceAndResult;
								isModalOpen = !isModalOpen;
								await tick();
								dialogRef?.showModal();
							}}
							class="show-modal-button w-full"
						>
							<div class="history-item {cell.column.id === 'name' ? 'text-left' : 'text-right'}">
								<span class="history-text">
									<strong
										class={cell.column.id === 'name'
											? 'text-[14px] font-[750] whitespace-nowrap'
											: 'text-[11px] text-[#137b80]'}
									>
										<FlexRender {cell} />
									</strong>
								</span>
								{#if cell.column.id === 'name'}
									{@const url = (cell.row.original as SourceAndResult).source.url}
									<span class="source-url">
										<small class="text-[11px] text-[#5a6b80]">{url}</small>
									</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{/each}
			{#if isModalOpen}
				<dialog
					bind:this={dialogRef}
					onclose={() => (isModalOpen = !isModalOpen)}
					onclick={(event) => {
						if (event.target === dialogRef) dialogRef?.close();
					}}
					class="modal m-auto flex max-h-4/5 min-h-9/10 w-3/4 flex-col rounded-lg"
				>
					<div class="modal-content flex h-full w-full flex-col p-5">
						<!-- div so clicking/tapping the dialog "margins" doesn't close it -->
						<div class="modal-header grid items-center pb-10">
							<div class="inline-flex items-center justify-between">
								<h1 class="flex-1 text-center text-lg font-bold">
									{currentSourceAndResult?.source.title}
								</h1>
								<button
									class="cursor-pointer p-2"
									onclick={() => dialogRef?.close()}
									aria-label="close"
								>
									<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										/>
									</svg>
								</button>
							</div>
							<small class="justify-self-center">
								{currentSourceAndResult?.source.url}
							</small>
						</div>
						<div>
							<!-- Analysis Result -->
							<div class="inset-0 z-10 flex w-full flex-col gap-5">
								{#if currentSourceAndResult}
									{@const sourceID = currentSourceAndResult.source.id}
									<AnalysisResultView result={currentSourceAndResult.result} detail="quick"
									></AnalysisResultView>
									<a
										href={resolve(`/dashboard/overview/analyze/${sourceID}${detail}`)}
										class="hover rounded-lg border border-gray-300 p-2 text-center text-sm
										 hover:border-[#2ca6af] hover:shadow-lg hover:shadow-[#11788322]"
									>
										View more details
									</a>
								{:else}
									<span>Could not find source and result.</span>
								{/if}
							</div>
						</div>
					</div>
				</dialog>
			{/if}
		</div>
	{:else}
		<div class="history-empty">
			<span
				class="history-empty-mark grid h-10 w-10 items-center justify-center rounded-lg bg-[#e1f3f0] text-2xl text-[#167f88]"
				aria-hidden="true">◫</span
			>
			<div>
				<h3>No saved analyses yet</h3>
				<p>Your completed policies will appear here.</p>
			</div>
		</div>
	{/if}
</div>

<style>
	* {
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}
	.history-item {
		padding: 14px 16px;
		border-radius: 7px;
		background: #f8fafc;
		color: #243b4d;
		text-decoration: none;
	}
	.history-text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.history-empty {
		display: flex;
		align-items: flex-start;
		gap: 18px;
		padding: 27px;
		border: 1px dashed #b9d0dd;
		border-radius: 7px;
		background: #f5fafb;
	}
	.history-empty-mark {
		display: grid;
		flex: 0 0 42px;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 8px;
		background: #e1f3f0;
		color: #167f88;
		font-size: 24px;
	}
	.history-empty h3 {
		margin: 0 0 6px;
		color: #243b4d;
		font-size: 16px;
	}
	.history-empty p {
		max-width: 540px;
		margin: 0 0 13px;
		color: #5a6b80;
		font-size: 13px;
		line-height: 1.55;
	}
</style>
