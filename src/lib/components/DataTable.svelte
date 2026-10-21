<script lang="ts" generics="TData extends RowData">
	import { createTable, FlexRender, type ColumnDef, type RowData } from '@tanstack/svelte-table';
	import { features } from '$lib/components/datatableFeatures';

	let {
		data,
		columns
	}: {
		data: TData[];
		columns: ColumnDef<typeof features, TData>[];
	} = $props();
	// initial pageSize (amount of rows per page)
	let pageSize = $state<string>('5');

	const table = createTable({
		features,
		get columns() {
			return columns;
		},
		get data() {
			return data;
		},
		initialState: {
			sorting: [
				{
					id: 'timestamp',
					desc: true
				}
			],
			pagination: {
				pageIndex: 0,
				get pageSize () {
					return Number(pageSize);
				}
			}
		}
	});
</script>

<div class="flex w-19/20 flex-col justify-center">
	<div
		class="flex max-h-125 w-full flex-col truncate overflow-scroll rounded-md border-r border-l border-dark/40 shadow-md"
	>
		<table class="w-full table-fixed">
			<!-- Headers -->
			<thead
				class=" sticky top-0 z-10 table-header-group bg-dark text-lg font-bold text-floral-white"
			>
				{#each table.getHeaderGroups() as hGroups (hGroups.id)}
					<tr class="table-row">
						{#each hGroups.headers as header (header.id)}
							<th
								class="{header.column.getCanSort()
									? 'cursor-pointer'
									: 'cursor-default'} pr-2 pl-3 select-none"
								style:width="{header.getSize()}px"
								onclick={() => {
									if (header.column.getCanSort()) header.column.toggleSorting();
								}}
							>
								<span class="inline-flex items-center">
									<FlexRender {header} />
									<!-- Sort Buttons... Tentative-->
									{#if header.column.getCanSort()}
										<svg
											width="100%"
											height="100%"
											viewBox="0 0 500 400"
											class="ms-3 size-4"
											fill={header.column.getIsSorted() === 'asc' ? '#afafaf' : '#5f5f5f'}
										>
											<path
												d="M151.89000381469725 318.1409990463257H466.49400381469724C485.5210038146972 318.1409990463257
											483.9610038146973 286.79399904632567 481.9900038146973 271.1019990463257C481.38500381469726 266.2609990463257
											478.3540038146972 259.1309990463257 475.5520038146972 255.13499904632567L331.96500381469724 72.53299904632568C319.38800381469724
											50.48899904632569 298.9970038146972 50.48899904632569 286.41400381469725 72.53299904632568L142.84500381469726 255.11099904632567C140.04200381469727 259.10699904632565 137.01300381469727 266.23699904632565
											136.40700381469725 271.07799904632566C134.43000381469727 286.7759990463257 132.86300381469727 318.1409990463257 151.89000381469725 318.1409990463257Z "
											/>
										</svg>
										<svg
											width="100%"
											height="100%"
											viewBox="0 250 500 400"
											class="size-4"
											fill={header.column.getIsSorted() === 'desc' ? '#afafaf' : '#5f5f5f'}
										>
											<path
												d="M114.845,363.274l143.569,182.584c12.577,22.044,32.968,22.044,45.551,0l143.587-182.609
											c2.804-3.996,5.826-11.119,6.438-15.967c1.971-15.691,3.531-47.038-15.496-47.038H123.89c-19.027,0-17.46,31.365-15.483,47.062
											C109.019,352.147,112.042,359.277,114.845,363.274z"
											/>
										</svg>
									{/if}
								</span>
							</th>
						{/each}
					</tr>
				{/each}
			</thead>
			<!-- Body and Data Cells -->
			<tbody>
				<!-- Display only 10 elements if page is overview -->
				{#each table.getRowModel().rows as row (row.id)}
					<tr class="table-row h-10 text-floral-white">
						{#each row.getAllCells() as cell (cell.id)}
							<!-- If column is 'url' render a button... -->
							{#if cell.column.id === 'url'}
								<td
									class="min-w-20 border-b pt-0.5 pr-2 pb-1 pl-3 text-justify odd:bg-dark even:bg-dark-fg"
									style:width="{cell.column.getSize()}px"
									title={cell.getValue() as string}
								>
									<!-- Note: Likely need to change to button for fetching AnalysisResults-->
									<a
										href={cell.getValue() as string}
										class="mt-1 mb-1 flex justify-center overflow-hidden rounded-xl border border-gray-500 bg-darkest pt-0.5 pb-0.5 hover:bg-dark-fg"
										>View</a
									>
								</td>
							{:else}
								<td
									class="border-b pt-0.5 pr-2 pb-1 pl-3 text-justify odd:bg-dark even:bg-dark-fg"
									style:width="{cell.column.getSize()}px"
									title={cell.getValue() as string}
								>
									<div class="truncate">
										<FlexRender {cell} />
									</div>
								</td>
							{/if}
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<!-- Controls -->
	<div class="mt-2 grid w-full grid-cols-3 items-center gap-5 text-sm">
			<div class="col-start-1 inline-flex justify-start font-semibold">
				<input
					type="search"
					placeholder="Search for policy by name..."
					oninput={(event) => {
						table.getColumn('name')?.setFilterValue(event.currentTarget.value);
					}}
					class="flex field-sizing-content max-w-xl flex-col items-center justify-center border border-gray-400 pr-2 pl-2"
				/>
			</div>
		<div class="col-start-2 inline-flex justify-center gap-5">
			<button
				class="cursor-pointer rounded-xl border bg-floral-white pr-2 pl-2 font-semibold hover:bg-gray-300
			    disabled:cursor-default disabled:bg-gray-500 disabled:hover:bg-gray-500"
				onclick={() => table.previousPage()}
				disabled={!table.getCanPreviousPage()}
				>Previous
			</button>
			<span class="text-sm text-dark-fg">
				Page {table.atoms.pagination.get().pageIndex + 1} of
				{table.getPageCount()}
			</span>
			<button
				class="cursor-pointer rounded-xl border bg-floral-white pr-2 pl-2 font-semibold hover:bg-gray-300
			    disabled:cursor-default disabled:bg-gray-500 disabled:hover:bg-gray-500"
				onclick={() => table.nextPage()}
				disabled={!table.getCanNextPage()}
				>Next
			</button>
		</div>
		<div class="col-start-3 flex items-center justify-end">
			<span class="inline-flex text-sm text-dark-fg">
				<span class="me-1.5">Results per page:</span>
				<select
					bind:value={pageSize}
					name="pageSizeSelector"
					id="pageSizeSelector"
					title="Results per Page"
					class="rounded-md border border-gray-300 pr-1 pl-1 shadow-xs hover:bg-gray-100 focus:border-gray-400"
					onchange={() => table.setPageSize(Number(pageSize))}
				>
					<option value="5">5</option>
					<option value="10">10</option>
					<option value="25">25</option>
					<option value="50">50</option>
					<option value="100">100</option>
				</select>
			</span>
		</div>
	</div>
</div>
