<script lang="ts">
	import type { LayoutProps } from './$types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	let { children }: LayoutProps = $props();

	import Table from '$lib/components/Table.svelte';

	// --- Temporary
	interface historyitem {
		name: string;
		hash: string;
		timestamp: string;
	}
	const TABS = [
		{ name: 'URL', href: '/dashboard/overview/extract' },
		{ name: 'Paste Text', href: '/dashboard/overview/text' },
		{ name: 'Search', href: '#search' }
	];

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
			return new Date(b.timestamp).valueOf() - new Date(a.timestamp).valueOf();
		})
	);
	// ----------------
	let sortedTimestamp: boolean = $state(true);
</script>

<div class="inline-block h-screen pl-15">
	<div class="grid grid-cols-3">
		<div class="col-start-2 flex justify-center py-5">
			<div class="max-w-md min-w-50 rounded-md bg-white/85 shadow-xs shadow-black/40 p-1">
				<p class="text-center text-lg font-bold">Dashboard</p>
			</div>
		</div>

		<div class="col-start-2 mx-auto -mt-5 flex h-fit">
			<a href={resolve('/preferences')} class="text-[.90rem] text-gray-800 hover:text-blue-800"
				>Preferences</a
			>
		</div>
	</div>

	<div class="flex justify-center pt-10 pb-10">
		<div class="tab-container items-center justify-center">
			<ul class="flex w-200 flex-row justify-center border-b-2 border-black/35">
				{#each TABS as tab (tab.name)}
					<li
						class="tab {(page.url.hash ? page.url.hash : page.url.pathname) === tab.href
							? 'border-b-2 text-blue-500'
							: 'text-black'} relative w-full justify-center text-xl hover:text-blue-500"
					>
						<span class="relative flex h-full w-full items-center justify-center">
							<a class="flex h-full w-full justify-center" href={tab.href} rel="external"
								>{tab.name}</a
							>
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>

	<div class="flex justify-center">
		{@render children()}
	</div>

	<div class="grid-row-3 grid gap-10 py-5">
		<div class="history-container relative row-span-1 block">
			<div class="mx-auto flex justify-center">
				<div
					class="max-w-md min-w-50 rounded-md bg-white/85 shadow-xs shadow-black/40 hover:bg-white"
				>
					<div class="flex min-h-12 items-center justify-center rounded-t-md bg-dark-fg">
						<h1 class="text-xl font-bold text-darktext">History</h1>
					</div>
					<div class="flex items-center justify-center">
						<p class="p-3 font-medium">View submitted and added policies</p>
					</div>
				</div>
			</div>
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
								sampledata.sort((a, b) => {
									return new Date(b.timestamp).valueOf() - new Date(a.timestamp).valueOf();
								});
							} else {
								sampledata.reverse();
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
