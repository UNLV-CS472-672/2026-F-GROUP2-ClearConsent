<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	interface historyitem {
		name: string;
		hash: string;
		timestamp: string;
	}
	let sampledata: historyitem[] = $state(
		[
			{
				name: 'da9ba6d0-535f-4b2d-91e7-963a11b2be80',
				hash: '54248a1050215c844265b0cd7c8195550b078da89b3020f9e08c39adbca5d61e',
				timestamp: '2026-05-21T20:58:15.036527'
			},
			{
				name: '64e62b78-2301-4885-8abe-a055a52baea9',
				hash: '51be3220bb1ff77823a593f3d1feff521e3ce64fc4c5f6eefbc4bd6b0e8a83c2',
				timestamp: '2023-06-02T19:01:09.048173'
			},
			{
				name: '3009af3f-9887-4b2e-a8f6-86034b8a05ee',
				hash: '94332a41dfb863a1783c56599272044af4619ee3cf3cafd70abf91b0f9a800c3',
				timestamp: '2023-05-17T15:52:20.032869'
			},
			{
				name: 'b2477fa4-e287-47de-a6bd-9d3f7fd0e85e',
				hash: 'b8c365a93890fb1e26847a44ce313bf3a8ad8a492b2c2b141541b2de03b8e1a9',
				timestamp: '2024-05-24T12:34:06.031373'
			},
			{
				name: '67a6f38f-f984-482b-b850-6b0ab37385b7',
				hash: '0885decab358e032855611289e5a88dff0b9d3fdab5dff3854455b6aeeca42b0',
				timestamp: '2021-03-27T17:46:40.077959'
			}
		].toSorted((a, b) => {
			return new Date(b.timestamp) - new Date(a.timestamp);
		})
	);
	let sortedState: number = $state(-1); //-1 descending 1 ascending
	let sortedTimestamp: boolean = $state(true);
</script>

<div class="flex h-screen w-full items-center justify-center">
	<div class="flex h-7/8 w-7/8 flex-col items-center justify-center border border-black/40 inset-shadow-xs inset-shadow-black">
		<h1 class="font-lg font-bold">Nothing substantial here yet. Come back later.</h1>
		<table class="inline-table w-19/20 table-fixed">
			<colgroup>
				<col style="width:3%" />
				<col style="width:5%" />
				<col style="width:3%" />
			</colgroup>

			<thead >
				<tr class="border">
					<td
						class="border-r text-center text-xl font-bold hover:cursor-pointer hover:bg-slate-400"
						onclick={() => {
							if (sortedTimestamp) {
								sampledata.sort((a, b) => a.name.localeCompare(b.name)).reverse();
								sortedTimestamp = false;
							} else sampledata.reverse();
						}}>Name</td
					>
					<td class="border-r text-center text-xl font-bold">Hash</td>
					<td
						class="text-center text-xl font-bold hover:cursor-pointer hover:bg-slate-400"
						onclick={() => {
							if (!sortedTimestamp) {
								sortedState = -1;
								sampledata.sort((a, b) => {
									return new Date(b.timestamp) - new Date(a.timestamp);
								});
							} else {
								sampledata.reverse();
								sortedState *= -1;
							}
							sortedTimestamp = true;
						}}>Timestamp</td
					>
				</tr>
				{#each sampledata as item (item.name)}
					<tr class="border">
						<td class="truncate border-r pr-1 pl-1" title={item.name}>{item.name}</td>
						<td class="truncate border-r pr-1 pl-1" title={item.hash}>{item.hash}</td>
						<td class="pr-1 pl-1" title={item.timestamp}>{item.timestamp}</td>
					</tr>
				{/each}
			</thead>
		</table>
	</div>
</div>
