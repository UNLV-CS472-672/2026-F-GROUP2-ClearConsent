<script lang="ts">
	import { page } from '$app/state';
	let {
		activepage = page.url.hash ? page.url.hash : page.url.pathname,
		href = '',
		children
	} = $props();
</script>

<!-- Basic "tab" component for unordered lists. -->
<li
	class="tab {activepage === href
		? 'border-b-2 text-blue-500'
		: 'text-black'} relative w-full justify-center text-xl hover:text-blue-500"
>
	<span class="relative flex h-full w-full items-center justify-center">
		<a class="flex h-full w-full justify-center" {href}>{@render children()}</a>
	</span>
</li>
