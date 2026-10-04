<script lang="ts">
	import type { PageProps } from './$types';

	let chckbx: string =
		'h-5 w-5 cursor-pointer transition-all appearance-none border rounded-md shadow hover:shadow-md shadow-black/50 checked:bg-slate-700 checked:border-blue-800';
	let { data }: PageProps = $props();
	// Arbitrary categories
	let ex_categories = $state([
		{ name: 'PII', enabled: false },
		{ name: 'Tracking', enabled: false },
		{ name: 'Privacy', enabled: false }
	]);
</script>

<div class="mx-auto ml-1 flex h-dvh w-full flex-col border-l pt-10 pl-2">
	<h1 class="flex text-2xl font-bold">Settings</h1>
	<hr class="w-1/8 border border-black/30" />
	<div class="flex flex-col">
		{#each ex_categories as item (item.name)}
			<div>
				<h4 class="text-lg font-bold">
					{item.name}
				</h4>
				<input type="checkbox" class="checkbox peer border-black {chckbx}" name={item.name} />
			</div>
		{/each}
	</div>
</div>
