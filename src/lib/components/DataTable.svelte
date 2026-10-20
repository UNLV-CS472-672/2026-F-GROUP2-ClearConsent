<script lang="ts" generics="TData extends Record<string, unknown>">
	// Todo: Add Filtering/Search. Likely replaces pagination...
	//
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
		timestamp: number | string | Date;
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
		columnHelper.accessor('timestamp', {
			id: 'timestamp',
			header: 'Timestamp',
			cell: (info) => new Date(info.getValue()).toLocaleString(),
			minSize: 50,
			maxSize: 75
		}),
		columnHelper.accessor('url', {
			id: 'url',
			header: '',
			minSize: 0,
			maxSize: 35,
			cell: (info) => {
				return info.getValue();
			},
			enableSorting: false
		})
	]);

	// let data = $state<temp_data[]>([
	// 	{
	// 		name: 'Dan',
	// 		hash: '8b4c57f73b6269f0d1b7f656fb616bd966e30815610fba2cbcc9604d0cc4f1a6',
	// 		timestamp: Date.now() - 210173173481,
	// 		url: '#Dan'
	// 	},
	// 	{
	// 		name: 'Jan',
	// 		hash: '1afe303edda1996d6a5a985c280a9d415a200a04e6a15823ec7db0a287caea35',
	// 		timestamp: Date.now(),
	// 		get url() {
	// 			return '#' + this.name;
	// 		}
	// 	}
	// ]);

	let data = $state<temp_data[]>([
		{
			name: 'f9f20415-abd2-4668-a1ca-8843bb4a36c5',
			hash: 'fe8c5ae5dabc7b5a3f7b89640df56c6070a870763f955e83a6dbf9d18c4ffbbe',
			timestamp: '2024-04-21T13:41:03.032568',
			url: '#stub'
		},
		{
			name: '62ee0bc5-e25b-4157-8324-71b43ea25238',
			hash: 'ddb8a2b4a28c33d166f82ebf7b05ac13a7a49a58fbc80694dd6b4d5458bf2253',
			timestamp: '2025-04-05T10:47:38.037697',
			url: '#stub'
		},
		{
			name: '0d12db08-bd25-4c17-b1c5-9a579225ca3c',
			hash: '53884ec73e78b393da355dc2b6d8a48bcccae74d6ccf09e05bfb4238f8888a40',
			timestamp: '2022-03-14T23:49:00.055526',
			url: '#stub'
		},
		{
			name: '8c14502e-d92a-4cce-8144-ecfb42a0edac',
			hash: 'cd37ff8c36927ba5255dd6a492fc28828c7c8f84c9cda96a5a8d606eeaea266d',
			timestamp: '2026-02-17T06:43:34.037083',
			url: '#stub'
		},
		{
			name: 'f77a7d64-bbfe-4a0a-80a4-2a4c46f9453b',
			hash: 'c5a987049171646145b96dd4ef376f4f8ee31938886547dc175ec7bbf114a7c6',
			timestamp: '2025-10-25T10:22:29.007646',
			url: '#stub'
		},
		{
			name: '0d7604cd-0c34-45a3-842a-203a1b83c7b7',
			hash: 'e2ff13b99b50f50f19d713fec4f60782b90088e27393159801a6e9fc3bac7ebe',
			timestamp: '2023-06-16T16:45:44.025251',
			url: '#stub'
		},
		{
			name: 'f4c4e63b-cc0f-4fb2-af41-e210030fabca',
			hash: 'ac9d0adcdc8be430b3e24292268d013ca0a3dcc02254544f05adbcc4f82935b7',
			timestamp: '2025-11-11T07:42:53.037239',
			url: '#stub'
		},
		{
			name: '812c7e86-377d-44cc-beec-e76f732be4e7',
			hash: '564955789ae37fc53fd787ece9031e65053fe789c5d6e276cbba7484b33bdad2',
			timestamp: '2022-07-26T23:34:11.035636',
			url: '#stub'
		},
		{
			name: '39a5bb12-211d-41c7-813d-32709c040b7a',
			hash: 'c2aa41f450e06e7c1d9236d0c45c2f8c8a3d6d3a023639d6eb996b092c0f5719',
			timestamp: '2026-03-20T12:13:29.070487',
			url: '#stub'
		},
		{
			name: 'a4f03c4c-0929-4249-83fb-3f0b77ac7f49',
			hash: '1b3d07f39f6e4551a609d723878c2bd11e8961a02244a6bdf2820a8c2f0bf1fd',
			timestamp: '2025-08-30T00:35:53.058695',
			url: '#stub'
		},
		{
			name: '7f2c5e24-d242-457b-bf83-f94f2282e393',
			hash: '2c433b1fe82817be464d594e1e72dcd7d81007a943e1637d92971c5b0f6dc11f',
			timestamp: '2026-01-06T21:45:51.045310',
			url: '#stub'
		},
		{
			name: '9c5246c1-2aeb-4502-a865-c2fa3190c938',
			hash: 'c9f704f71f55717f952af2b622dbc14ff330543b03da86430abf3d908a3aaba2',
			timestamp: '2023-11-05T18:42:40.050919',
			url: '#stub'
		},
		{
			name: '7ec8690d-03a4-43ec-b0d0-242dbb2c04ae',
			hash: '3cf157f3d1f67b987539a4206a71980f5619a425a9b2c05f6de2d622a9f8c617',
			timestamp: '2023-06-24T15:44:41.007898',
			url: '#stub'
		},
		{
			name: '2e601ddd-1a31-44c5-828b-34e70e9b3936',
			hash: '3e849170f1a0a4cdfa0c4de763414640d8f8b1cfaf0a6a7d0237330236ffeb39',
			timestamp: '2025-10-17T01:23:42.008460',
			url: '#stub'
		},
		{
			name: 'cc83a889-a0b2-479c-83c5-02140402792b',
			hash: 'acddcf55b5c91a84c1ce8855a80473eda46fc756629d7a302584305dc066648b',
			timestamp: '2023-12-13T15:38:47.001568',
			url: '#stub'
		},
		{
			name: '47e94bbd-fa72-4cc1-8eb5-e36efd9fecee',
			hash: '13484df5ebf9ee08f25ef952592ec65e9a0a255de7211c31c2f7f4b4d52317f0',
			timestamp: '2023-02-02T21:15:08.033475',
			url: '#stub'
		},
		{
			name: '2d06edf1-9b1f-4e20-b16c-38f94bc8317b',
			hash: '65fe04a196f0ad78f0da546cf57e21c3f1aca151495f5d2250f40c68db99ee56',
			timestamp: '2023-08-04T08:35:48.055769',
			url: '#stub'
		},
		{
			name: '600cfd67-a95e-4b80-8734-b44dc07b376f',
			hash: 'c2840402471655d26a81d9e7fd83b09f89044f613405d04952746761095a5247',
			timestamp: '2023-02-13T15:02:06.058950',
			url: '#stub'
		},
		{
			name: '14d4a965-8ff5-4b85-9f82-7bb2ff992d17',
			hash: 'a0359358f7da78feddad369a5efc914ef642d88cce925497cc0fc138379a4d5a',
			timestamp: '2025-05-31T17:51:38.000909',
			url: '#stub'
		},
		{
			name: 'ee84d65e-467b-403d-9a12-ff3c81600abe',
			hash: '4d577bb27a4f28607f60bb17b7825d0bdd37162fc6f4e2251350f7e1ef1f87a2',
			timestamp: '2024-05-30T06:20:39.027096',
			url: '#stub'
		},
		{
			name: 'ce88931e-f64f-428d-b62e-ac68cf3542ba',
			hash: '210aa59f9aff0568877128ca83e4f4321d8f3af14ee8cfb23ffd5d56a0671a82',
			timestamp: '2021-03-16T01:43:44.073957',
			url: '#stub'
		},
		{
			name: 'fce7fbca-7189-47cc-b7c1-e001ef9bab2e',
			hash: 'b04a8816f93690c41fb809a7b6affb881475d100d4fec0fefdd8d22afaefb61d',
			timestamp: '2021-09-09T19:58:28.006394',
			url: '#stub'
		},
		{
			name: '48abbcc4-61b2-4b70-b36b-3012769af2a9',
			hash: '7422060532d5d7960e9f4968c4585ecaca20b910f4b6f22346669b95ef36c754',
			timestamp: '2025-08-06T17:02:32.050566',
			url: '#stub'
		},
		{
			name: '1bdb7efe-0801-49a8-85de-c7f8ce215376',
			hash: '0d86a6b4403b27dbd22a5b8411576d5c64691cd1e3e6ea52eacb81e7292f5115',
			timestamp: '2026-12-02T00:48:51.052551',
			url: '#stub'
		},
		{
			name: '3cd238d2-4943-460e-a8e1-35e2647e51d4',
			hash: 'ffd37f09ecaf3c06159b3cb776d86cbd8ff65eced07eed9aa0e822ee5074b0ec',
			timestamp: '2026-04-14T14:49:31.073851',
			url: '#stub'
		},
		{
			name: 'a3a9876d-4b28-432b-9edc-1234e83b8f5a',
			hash: 'eddb2f0ab2acd5adf38d03dcf0aa0105fb48d248842a99646a62ab8b07441e71',
			timestamp: '2021-09-09T23:55:50.049883',
			url: '#stub'
		},
		{
			name: '1b1248d1-14e1-46fe-a1de-986744bb00ef',
			hash: '6e07fe8558f904919bb3187b98d20f9a0fbe7114142d5978044f9fc675e3159a',
			timestamp: '2026-12-21T21:44:29.073772',
			url: '#stub'
		},
		{
			name: '0fb0c71d-8bea-4c12-8963-edfe716260de',
			hash: '7a9b4345c9b154c2b7e0a8080004318eb22a251c3907ca9af13de77619706040',
			timestamp: '2025-03-05T04:56:28.079928',
			url: '#stub'
		},
		{
			name: '696f5533-6fef-4c90-b488-bd68679eb26f',
			hash: '72a9b2285707a91ec7b804eafea3d6d2f8c7db1e7da53b66e589d97e9437ada4',
			timestamp: '2022-10-01T16:49:17.082715',
			url: '#stub'
		},
		{
			name: '3e5d71ea-9d04-4e8d-a6ec-32f6cf82cfeb',
			hash: 'b342bc88f984e910dcc4cc6221cc0ec8bed70c8efbe1ea9d11f6d403303543d1',
			timestamp: '2027-02-16T14:10:53.041841',
			url: '#stub'
		},
		{
			name: '2192f7b8-a03e-4dd4-98c0-43de9cd2e5cd',
			hash: 'd16e6cea15a793bec448963a70344a55557b18dffc39070e4189b260dea8c3c4',
			timestamp: '2021-08-10T09:16:23.011092',
			url: '#stub'
		},
		{
			name: 'b6a6a889-1b70-4dfd-a1e3-7c9679556bc9',
			hash: '0e18d578468417ee688a53eb8a35c2bd93f7423dc328df25fe28f107baeef968',
			timestamp: '2020-12-18T06:08:25.016965',
			url: '#stub'
		},
		{
			name: '2f694244-38a2-4b45-bbca-d8d0274096bf',
			hash: '20db0d8fabb1f15fe364fe92f34b6a124504788a59906b5ff92399038399d110',
			timestamp: '2025-09-12T11:26:02.063060',
			url: '#stub'
		},
		{
			name: '63afde84-dfb6-49cc-ae74-3e642e8b7688',
			hash: '36276afba3bb429ceb31ede900d7e13df68d2eb0b053f07a16ce7ffe96d260c0',
			timestamp: '2026-09-02T14:14:13.021111',
			url: '#stub'
		},
		{
			name: 'b41e866b-d693-45ec-9cc8-0910bed8336e',
			hash: 'd92efd35d6069a9e7a47266c71e2ed6e2e2e1ea03a2ab485e57f29c7ae04eecc',
			timestamp: '2025-07-09T10:26:46.009936',
			url: '#stub'
		},
		{
			name: '1e515ff6-dea3-41e2-8d52-431a3f6cf185',
			hash: '71df8d4450f12edaec45544091519cc729ddccdbfc84c5f96f76df71ceae9069',
			timestamp: '2026-04-19T03:40:19.022595',
			url: '#stub'
		},
		{
			name: '982618f7-f911-4c42-81ab-c74f51b62c6f',
			hash: '3dc8508b9403042c8efee45314a104454515635b5e62ae781ce5a215914ef416',
			timestamp: '2024-01-12T20:38:21.038526',
			url: '#stub'
		},
		{
			name: '551bda43-6507-4422-88ea-a5d2f4807a9d',
			hash: 'baf0e2b308c7ec405d8f964d604245f750b39604026ded20c106ac8535144942',
			timestamp: '2022-03-15T23:24:55.049485',
			url: '#stub'
		},
		{
			name: '933ab623-1012-4362-b815-65e40bf1b6a5',
			hash: '39e4f9a5dca5c6be5229868b447e32b5b964f5bf846529dfa9d3effe77df1b1b',
			timestamp: '2027-03-16T21:42:58.036381',
			url: '#stub'
		},
		{
			name: '2d130e38-6586-489a-938c-5fc4df1659c8',
			hash: 'bcb1d8c6ffe5270ee248f52b50cf707b98d777da71408b03a1cb8da7f2866d40',
			timestamp: '2023-01-03T22:20:49.038450',
			url: '#stub'
		},
		{
			name: '7d108617-28f9-4923-8fc5-ebc399b48ff0',
			hash: '956e491ab825dfa433bbf7081cc1e1577b419c35fe94d34a92fec2306ce158bd',
			timestamp: '2022-08-18T20:23:21.093187',
			url: '#stub'
		},
		{
			name: '28e1ab13-5947-46ad-9999-ca7cdae635ab',
			hash: '43362e586c2bfe2653b87a309b6c8beac5f34bf4a745a97f2157205edcf05d30',
			timestamp: '2026-04-23T19:38:00.056279',
			url: '#stub'
		},
		{
			name: '20db7bc4-f9ee-42c9-b155-573d778b95e4',
			hash: '59407d373f6014b136a07582c26a8567125223c1c00037fa4faf55aa6b6ac1bc',
			timestamp: '2025-05-16T08:29:47.099152',
			url: '#stub'
		},
		{
			name: 'b07b1f97-606b-4f78-beea-48332473fb8a',
			hash: '5ace9bf55436dcf4d8a3446e02c12385dfc2f2cc0e688a6d6743708868e37d4e',
			timestamp: '2022-03-30T14:18:56.043956',
			url: '#stub'
		},
		{
			name: 'e025841e-57dd-4cbd-bcd4-7d5d488d2199',
			hash: '30ae40af5ddb61c0d24dad2042d5e2cc978532ced8fabb84debac6203e9e05d1',
			timestamp: '2025-09-03T00:56:25.058412',
			url: '#stub'
		},
		{
			name: 'fa9962c2-c849-4c0a-bc80-207cd572467a',
			hash: 'f91e85df8dc43f8fce94b69f1f584e8dd5ac6e03508246609e220d2a34bc0450',
			timestamp: '2022-06-01T17:13:06.066165',
			url: '#stub'
		},
		{
			name: '2b17b5b7-33f3-40e3-8ccf-320c9cebf008',
			hash: '0833261fb530aa070d8186cb3fbcb53b343e0c32b6119b94741c2239532d5c54',
			timestamp: '2020-12-19T04:39:51.031032',
			url: '#stub'
		},
		{
			name: '55ba43a6-c11d-474a-a4d8-9db56431e312',
			hash: '9ea3756fe38d3d12245887abd8f898161c6eb85b2bb053fad5ae23a4c665ae43',
			timestamp: '2024-05-27T07:57:58.002399',
			url: '#stub'
		},
		{
			name: 'c34ee3ec-dc52-48b4-a917-33f08e33e6a9',
			hash: '72b5eb79a3c556217179ad008fb75c09159ace05a3847f7971566bea1f7a719b',
			timestamp: '2024-03-29T08:52:14.095254',
			url: '#stub'
		},
		{
			name: '8eb46305-24ad-460d-8dab-fcc84c874715',
			hash: 'f343d347bebe5a76135c3c526402c236cb7e46be4093568dc5060b322c8149d8',
			timestamp: '2026-02-18T17:29:17.054674',
			url: '#stub'
		},
		{
			name: '5d59fce2-2778-4ea8-8606-12769ccd8d3e',
			hash: '32d56576f29c15349f11aeeffb0cde3bf1de138f0d2e818612442941332267d4',
			timestamp: '2021-05-14T12:24:41.013310',
			url: '#stub'
		},
		{
			name: '44a27fb0-4ccf-43a3-9524-c9f1982f7d9a',
			hash: '1fcdf6453c108332839ad09cf167a0b0cdc0e786d0a754d0335a882c8dc92b1f',
			timestamp: '2025-09-25T10:10:18.083121',
			url: '#stub'
		}
	]);

	let pageSize = $state<string>('10');
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
			],
			pagination: {
				pageIndex: 0,
				pageSize: 10
			}
		}
	});

	// function capitalizeHeaderId(header: string) {
	// 	return header.replace(/(^\w|\s\w)/g, (match) => match.toLocaleUpperCase());
	// }
</script>

<div class="flex h-9/10 w-9/10 flex-col justify-center">
	<div
		class="flex w-full flex-col overflow-auto rounded-md border-r border-l border-dark/40 shadow-md"
	>
		<table class="w-full table-auto">
			<!-- Headers -->
			<thead class=" table-header-group bg-dark text-lg font-bold text-floral-white">
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
				{#each table.getRowModel().rows as row (row.id)}
					<tr class="table-row text-floral-white">
						{#each row.getAllCells() as cell (cell.id)}
							<!-- If column is 'url' render a button... -->
							{#if cell.column.id === 'url'}
								<td
									class="min-w-20 border-b pt-0.5 pr-2 pb-1 pl-3 text-justify odd:bg-dark even:bg-dark-fg"
									style:width="{cell.column.getSize()}px"
									title={cell.getValue() as string}
								>
									<a
										href={cell.getValue() as string}
										class="mt-1 mb-1 flex justify-center rounded-xl border border-gray-500 bg-darkest pt-0.5 pb-0.5 hover:bg-dark-fg"
										>View</a
									>
								</td>
							{:else}
								<td
									class="border-b pt-0.5 pr-2 pb-1 pl-3 text-justify odd:bg-dark even:bg-dark-fg"
									style:width="{cell.column.getSize()}px"
									title={cell.getValue() as string}
								>
									<div class="max-w-100 truncate">
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

	<div class="mt-2 grid w-full grid-cols-3 items-center gap-5 text-sm">
		<div class="col-start-2 inline-flex justify-center gap-5">
			<button
				class="cursor-pointer rounded-xl border bg-floral-white pr-2 pl-2 font-semibold hover:bg-dark
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
				class="cursor-pointer rounded-xl border bg-floral-white pr-2 pl-2 font-semibold
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
					// value={table.atoms.pagination.get().pageSize}
					name="pageSizeSelector"
					id="pageSizeSelector"
					title="Results per Page"
					class="rounded-md border border-gray-300 pr-1 pl-1 shadow-xs hover:bg-gray-100 focus:border-gray-400"
					onchange={() => table.setPageSize(Number(pageSize))}
				>
					<option value="10">10</option>
					<option value="25">25</option>
					<option value="50">50</option>
					<option value="100">100</option>
				</select>
			</span>
		</div>
	</div>
</div>
