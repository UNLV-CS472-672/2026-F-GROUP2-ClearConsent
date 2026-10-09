<script lang="ts">
	import { page } from '$app/state';
	import Tab from '$lib/components/Tab.svelte';
	import TabBox from '$lib/components/TabBox.svelte';
</script>

<div class="flex h-dvh w-full flex-col items-center justify-center pt-10 gap-5">
	<TabBox>
		<!-- Maybe make these into routes (./url ./upload ./paste ./search)
			 and point upload in layout to ./url -->
		<Tab href="#url">URL</Tab>
		<Tab href="/dashboard/upload" activepage={page.url.pathname + page.url.hash}
			>Upload File</Tab
		>
		<Tab href="#paste">Paste Text</Tab>
		<!-- Just throwing things at the wall -->
		<Tab href="#search">Search</Tab>
		<!-- Separate these into the url, upload, paste, search pages -->
	</TabBox>
	<fieldset>
		<legend class="text-xl font-bold">Upload</legend>
		<input
			type="file"
			class="flex w-full rounded-lg bg-white text-gray-800 shadow-sm transition duration-100 file:bg-slate-400 file:px-2 file:py-1.5 file:text-sm file:font-bold hover:shadow-md hover:shadow-black/20"
		/>
	</fieldset>
</div>
