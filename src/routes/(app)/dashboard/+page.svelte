<script lang="ts">
	import type { PageProps } from './$types';
	import Card from '$lib/components/Card.svelte';
	let { data }: PageProps = $props();
	import { page } from '$app/state';
	import Table from '$lib/components/Table.svelte';
	import TabBox from '$lib/components/TabBox.svelte';
	import Tab from '$lib/components/Tab.svelte';

	// --- Temporary
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
	// ----------------
	let sortedState: number = $state(-1); //-1 descending 1 ascending
	let sortedTimestamp: boolean = $state(true);
</script>

<div class="inline-block h-screen w-screen pl-5">
	<!-- <p class="flex justify-center text-slate-600">Overview</p> -->
	<div class="m-auto flex py-5">
		<Card cardtitle="" mono={true} center={true}>
			<p class="text-lg font-bold">Dashboard</p>
		</Card>
	</div>

	<div class="flex justify-center pt-10 pb-10">
		<TabBox>
			<!-- Maybe make these into routes (./url ./upload ./paste ./search)
			 and point upload in layout to ./url -->
			 <!-- Currently redirects to extract -->
			 <!-- Add extraction bar below when URL is clicked -->
			<Tab href="/extract">URL</Tab>
			<Tab href="#upload">Upload File</Tab>
			<Tab href="#paste">Paste Text</Tab>
			<!-- Just throwing things at the wall -->
			<Tab href="#search">Search</Tab>
			<!-- Separate these into the url, upload, paste, search pages -->
		</TabBox>


	</div>

	<div class="grid-row-3 grid gap-10 py-5">
		<div class="history-container relative row-span-1 block">
			<Card cardtitle="History" center={true}>View submitted and added policies</Card>
			<br />
			<!-- Table + Table item component -->
			<!-- Todo: -->
			<!-- Import a premade data table instead of creating a component. -->
			<!-- Truncate table to display most recent n submitted/uploaded -->
			<Table>
				<tr class="border border-floral-white bg-darker text-darktext">
					<td
						class="border-r text-center text-xl font-bold hover:cursor-pointer hover:bg-dark"
						onclick={() => {
							if (sortedTimestamp) {
								sampledata.sort((a, b) => a.name.localeCompare(b.name)).reverse();
								sortedTimestamp = false;
							} else sampledata.reverse();
						}}>Name</td
					>
					<td class="border-r text-center text-xl font-bold">Hash</td>
					<td
						class="border-r text-center text-xl font-bold hover:cursor-pointer hover:bg-dark"
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
					<td></td>
					<!--- stub for styling -->
				</tr>
				{#each sampledata as item (item.name)}
					<tr class="border border-floral-white bg-darker text-darktext">
						<td class="truncate border-r pr-1 pl-1" title={item.name}>{item.name}</td>
						<td class="truncate border-r pr-1 pl-1" title={item.hash}>{item.hash}</td>
						<td class="border-r pr-1 pl-1" title={item.timestamp}>{item.timestamp}</td>
						<td class="view pt-2 pb-2 text-center">
							<a
								href="#{item.name}"
								class="rounded-lg bg-dark pt-1 pr-2 pb-1 pl-2 text-center text-darktext hover:bg-dark-fg hover:text-url-hover"
								>View</a
							>
						</td>
					</tr>
				{/each}
			</Table>
		</div>
	</div>
</div>
