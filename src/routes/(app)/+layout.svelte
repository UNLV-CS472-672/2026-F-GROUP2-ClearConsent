<script lang="ts">
	let { children } = $props();
</script>

<main class="flex min-h-screen w-full">
	{@render children()}
</main>
