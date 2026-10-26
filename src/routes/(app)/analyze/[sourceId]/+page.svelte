<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head><title>Analyze source | ClearConsent</title></svelte:head>

<div class="flex flex-col items-center gap-2 px-4 py-12">
	<h1 class="text-2xl font-semibold">Analyze source</h1>
	<p class="font-mono text-sm text-gray-500">{page.params.sourceId}</p>
</div>
