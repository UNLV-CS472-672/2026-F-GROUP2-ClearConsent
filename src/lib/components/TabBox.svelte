<script lang="ts">
	let { children } = $props();
</script>

<div class="tab-container items-center justify-center">
	<ul class="flex w-200 flex-row justify-center border-b-2 border-black/35">
		{@render children()}
	</ul>
</div>
