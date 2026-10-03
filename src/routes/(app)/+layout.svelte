<script lang="ts">
	import type { LayoutProps } from './$types';
	import { getloggedin, toggleloggedin } from '../tempstate.svelte';
	let { data, children }: LayoutProps = $props();
	let tempclass: string = 'p-1 rounded-lg text-md font-semibold border-2 border-black h-9 text-white/75 bg-black/75 hover:bg-black/50 transition-colors';
</script>

<header class="hidden border-b-2 bg-slate-600 md:flex">
	<div class="navbar flex flex-1 flex-row p-1 shadow-md shadow-black/50">
		<div class="flex flex-1">
			<a href="/" rel="external" class="btn btn-ghost text-xl">CC</a>
		</div>

		<div class="flex flex-1 items-center justify-center gap-2">
			<a href="/about" rel="external" class={tempclass}>About</a>
		{#if getloggedin()}
			<a href="/dashboard" rel="external" class={tempclass}>Dashboard</a>
		{/if}
		</div>
		<div class="flex flex-1 justify-end gap-2">
			{#if !getloggedin()}
				<a href="/login" rel="external" class={tempclass}>Login</a>
				<a href="/signup" rel="external" class={tempclass}>Sign Up</a>
				<!-- <a href="/dashboard/settings" rel="external" class={tempclass}>Settings</a> -->
			{:else}
				<a href="/dashboard/settings" rel="external" class={tempclass}>Settings</a>
			{/if}
		</div>
	</div>
</header>

<div class="bg-slate-300">
	{@render children()}
</div>
