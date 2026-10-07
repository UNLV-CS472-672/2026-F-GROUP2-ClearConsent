<script lang="ts">
	import type { LayoutProps } from './$types';
	let { children }: LayoutProps = $props();
	let sidebarbuttonclass: string =
		'font-bold text-lg text-black w-full text-center border-slate-600 bg-slate-300/10 hover:bg-slate-300 justify-center';
	let expanded = $state(false);
</script>

<!-- Maybe just make the Navbar + Sidebar into components with toggleable elements
 and keep common code in the root layouts instead. -->
<div class="pagecontent flex h-dvh bg-slate-400">
	<aside
		class="{expanded
			? 'w-50 opacity-100'
			: 'w-50 opacity-0'} flex left-0 top-0 bottom-0 transition-all delay-75 duration-750 ease-in-out z-1"
		onmouseenter={() => (expanded = true)}
		onmouseleave={() => (expanded = false)}
	>
		<div class="sidebar_container flex h-screen w-full items-center justify-center">
			<div
				class="{expanded
					? 'opacity-100'
					: 'opacity-0'}  flex m-auto h-full w-full flex-col items-center justify-center gap-1 bg-slate-500 shadow-md shadow-black transition-all duration-750"
			>
				<a href="/dashboard/upload" class={sidebarbuttonclass}>Upload</a>
				<!-- <hr class="mx-auto w-7/8 border-slate-600/70" /> -->
				<a href="/dashboard/history" class={sidebarbuttonclass}>History</a>
				<!-- <hr class="mx-auto w-7/8 border-slate-600/70" /> -->
				<a href="/dashboard/settings" class={sidebarbuttonclass}>Settings</a>
				<!-- <hr class="mx-auto w-full border-slate-600/70 shadow-sm shadow-black/10"> -->
			</div>
		</div>
	</aside>
	{@render children()}
</div>

<style>
	aside {
		margin-left: -100px;
	}
	aside:hover {
		margin-left: 0px;
	}
</style>
