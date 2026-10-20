<script lang="ts" generics="TData extends Record<string, unknown>">
	import {
		createTable,
		createColumnHelper,
		// createFilteredRowModel,
		createSortedRowModel,
		createPaginatedRowModel,
		// columnFilteringFeature,
		rowSortingFeature,
		rowPaginationFeature,
		sortFn_alphanumeric,
		sortFn_datetime,
		columnSizingFeature,
		tableFeatures,
		FlexRender,
		type ColumnDef
	} from '@tanstack/svelte-table';

	const { overview = true } = $props();

	// Setup tableFeatures
	// Including: Sorting, Pagination, Column Sizing
	const features = tableFeatures({
		rowSortingFeature,
		rowPaginationFeature,
		columnSizingFeature,
		sortedRowModel: createSortedRowModel(),
		paginatedRowModel: createPaginatedRowModel(),
		sortFns: {
			alphanumeric: sortFn_alphanumeric,
			datetime: sortFn_datetime
		}
	});

	interface temp_data {
		name: string;
		hash: string;
		timestamp: number;
		url: string | any;
	}

	// Setup Column Helper with features and datatype
	const columnHelper = createColumnHelper<typeof features, temp_data>();

	// Define Table Columns using columnHelper
	// cell: (info) => info.getValue() is implicit
	// note: if using function for accessor id: must be set explicitly if you wish to reference
	const columns: ColumnDef<typeof features, temp_data>[] = columnHelper.columns([
		columnHelper.accessor('name', {
			header: 'Name',
			size: 40
		}),
		columnHelper.accessor('hash', {
			header: 'Hash',
			minSize: 50,
			maxSize: 300 /*enableSorting: false*/
		}),
		columnHelper.accessor((row) => new Date(row.timestamp), {
			id: 'timestamp', // explicitly set id
			header: 'Timestamp',
			cell: (info) => info.getValue().toLocaleString(), // format Date(row.timestamp)
			minSize: 50,
			maxSize: 75
		}),
		columnHelper.accessor('url', {
			header: '',
			minSize: 0,
			maxSize: 35,
			cell: (info) => {
				return info.getValue();
			},
			enableSorting: false
		})
	]);

	let data = $state<temp_data[]>([
		{
			name: 'Dan',
			hash: '8b4c57f73b6269f0d1b7f656fb616bd966e30815610fba2cbcc9604d0cc4f1a6',
			timestamp: Date.now() - 210173173481,
			url: '#Dan'
		},
		{
			name: 'Jan',
			hash: '1afe303edda1996d6a5a985c280a9d415a200a04e6a15823ec7db0a287caea35',
			timestamp: Date.now(),
			get url() {
				return '#' + this.name;
			}
		}
	]);

	const table = createTable({
		features,
		columns,
		data,
		initialState: {
			sorting: [
				{
					id: 'timestamp',
					desc: true
				}
			]
		}
	});

	// function capitalizeHeaderId(header: string) {
	// 	return header.replace(/(^\w|\s\w)/g, (match) => match.toLocaleUpperCase());
	// }
</script>

<div class="flex w-3/5 overflow-hidden rounded-md shadow-md">
	<table class="w-full table-fixed">
		<!-- Headers -->
		<thead class=" table-header-group bg-dark font-bold text-floral-white">
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
								<!-- Sort Buttons... -->
								{#if header.column.getCanSort()}
									<svg
										width="100%"
										height="100%"
										viewBox="0 0 500 400"
										class="ms-3 size-4"
										fill={header.column.getIsSorted() === 'asc' ? '#8f8f8f' : '#5f5f5f'}
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
										fill={header.column.getIsSorted() === 'desc' ? '#8f8f8f' : '#5f5f5f'}
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
			{#if overview}
				{#each table.getRowModel().rows.slice(0, 10) as row (row.id)}
					<tr class="table-row text-floral-white">
						{#each row.getAllCells() as cell (cell.id)}
							<td
								class="truncate border-b pt-0.5 pr-2 pb-1 pl-3 text-justify odd:bg-dark even:bg-dark-fg"
								style:width="{cell.column.getSize()}px"
								title={cell.getValue() as string}
							>
								<FlexRender {cell} />
							</td>
						{/each}
					</tr>
				{/each}
			{:else}
				{#each table.getRowModel().rows as row (row.id)}
					<tr class="table-row text-floral-white">
						{#each row.getAllCells() as cell (cell.id)}
							<td
								class="truncate border-b pt-0.5 pr-2 pb-1 pl-3 text-justify odd:bg-dark even:bg-dark-fg"
								style:width="{cell.column.getSize()}px"
								title={cell.getValue() as string}
							>
								<FlexRender {cell} />
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>
