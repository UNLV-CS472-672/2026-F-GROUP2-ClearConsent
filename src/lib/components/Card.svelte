<script lang="ts">
	let { children, cardtitle = '', mono = false, center = false } = $props();
</script>

<!--  Extremely basic card -->
<div class="max-w-md min-w-50 rounded-xl bg-white/85 shadow-xs shadow-black/25 hover:bg-white hover:shadow-md hover:shadow-black/50">
	<div>
		{#if !mono}
			<div class="flex h-15 items-center justify-center rounded-t-xl bg-black/85">
				<h1 class="text-xl font-bold text-white/85">{cardtitle}</h1>
			</div>
		{/if}

		<div class="flex {center ? 'justify-center' : ''}">
			<p class="m-2 inline-block font-medium">
				{@render children()}
			</p>
		</div>
	</div>
</div>
