<script lang="ts">
	import { page } from '$app/state';
	import Sample from '$lib/components/Sample.svelte';
</script>

<div class="flex h-dvh w-full flex-col items-center justify-center pt-10">
	<div class="tab-container items-center justify-center">
		<ul class="flex flex-row justify-center border-b-2 border-black/35">
			<!-- Maybe make these into routes (./url ./upload ./paste ./search)
			 and point upload in layout to ./url -->
			<Sample href="#url">URL</Sample>
			<Sample href="/dashboard/upload" activepage={page.url.pathname + page.url.hash}>Upload File</Sample>
			<Sample href="#paste">Paste Text</Sample>
			<!-- Just throwing things at the wall -->
			<Sample href="#search">Search</Sample>
		</ul>
		<!-- Separate these into the url, upload, paste, search pages -->
		<br>
		<fieldset>
			<legend class="text-xl font-bold">Upload</legend>
			<input
				type="file"
				class="flex w-full rounded-lg bg-white text-gray-800 shadow-sm transition duration-100 file:bg-slate-400 file:px-2 file:py-1.5 file:text-sm file:font-bold hover:shadow-md hover:shadow-black/20"
			/>
		</fieldset>
		<br>
		<div class="inline-block flex-col items-center justify-center">
			<fieldset>
				<legend class="inline-block text-xl font-bold">Paste Plaintext</legend>
				<textarea
					name="pastebox"
					id="pastebox"
					class="h-50 w-150 overflow-hidden border border-black/50 wrap-break-word"></textarea>
			</fieldset>
		</div>
	</div>
</div>
