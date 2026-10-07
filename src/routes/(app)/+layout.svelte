<script lang="ts">
	import NavBarLink from '$lib/components/NavBarLink.svelte';
	import type { LayoutProps } from './$types';
	let { data, children }: LayoutProps = $props();
</script>

<div class="relative flex min-h-screen flex-1 flex-col">
	<header>
		<div class="navbar fixed flex w-screen flex-row border-b-2 bg-slate-600 p-1 shadow-xs shadow-black/50">
			<div class="nav-left flex flex-1">
				<a
					href="/"
					rel="external"
					class="btn btn-ghost min-w-20 rounded-lg border border-slate-800 text-center text-xl font-bold transition-colors duration-200 hover:bg-slate-500"
				>
					CC
				</a>
			</div>

			<div class="nav-center flex flex-1 items-center justify-center gap-2">
				<NavBarLink href="/about">About</NavBarLink>
			</div>

			<div class="nav-right flex flex-1 items-center justify-end gap-5 pr-2">
				<NavBarLink href="/login">Sign In</NavBarLink>
				<NavBarLink href="/signup" button={true}>Sign Up</NavBarLink>
			</div>
		</div>
	</header>

	<main class=" bg-slate-400">
		{@render children()}
	</main>

	<footer class="absolute bottom-0 w-screen bg-slate-500 px-10 text-black/80">
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
