<script lang="ts">
	import type { LayoutProps } from './$types';
	import { getloggedin, toggleloggedin } from '../tempstate.svelte';
	let { data, children }: LayoutProps = $props();
	let tempclass: string =
		'p-1 rounded-lg text-md font-semibold border-2 border-black h-9 text-white/75 bg-black/75 hover:bg-black/50 transition-colors';
</script>

<div class="relative flex min-h-screen flex-1 flex-col">
	<header class="flex border-b-2 bg-slate-600">
		<div class="navbar flex flex-1 flex-row p-1 shadow-md shadow-black/50">
			<div class="flex flex-1">
				<a
					href="/"
					rel="external"
					class="btn btn-ghost min-w-20 rounded-lg border border-slate-800 text-center text-xl font-bold transition-colors duration-200 hover:bg-slate-500"
				>
					CC
				</a>
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

	<main class=" bg-slate-400">
		{@render children()}
	</main>

	<footer class=" bg-slate-500 px-10 text-black/80">
		<div class="footer-container">
			<div class="grid grid-cols-3 gap-8 md:grid-cols-4">
				<div>
					<h2 class="text-md font-semibold">Item 1</h2>
					<p class="text-xs">Item</p>
				</div>
				<div>
					<h2 class="text-md font-semibold">Contact</h2>
					<p class="text-xs">Contact URL</p>
					<p class="text-xs">mailto:something@something</p>
				</div>
			</div>
		</div>
		<div class="mt-5 flex flex-col items-start justify-between border-t pt-2 pb-1 md:flex-row">
			<p class="text-xs">Bottom Text</p>
		</div>
	</footer>
</div>
