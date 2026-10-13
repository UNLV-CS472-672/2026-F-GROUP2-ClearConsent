<script lang="ts">
	let { children } = $props();
</script>

<main class="flex min-h-screen min-w-screen">
	{@render children()}
</main>
