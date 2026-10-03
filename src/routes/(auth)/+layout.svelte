<script lang="ts">
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="h-screen w-screen bg-slate-300">
	<h1 class="font-lg flex justify-center font-bold">
		You've met with a terrible fate, havent you?
	</h1>
	<div class="flex flex-row justify-center">
		<a href="/" rel="external" class="flex text-xs text-blue-800 underline hover:text-blue-500">
			Return Home
		</a>
	</div>
	{@render children()}
</div>
