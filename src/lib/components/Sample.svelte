<script lang="ts">
	import { page } from '$app/state';
	let { activepage = page.url.hash, href = '', children } = $props();
</script>
<!-- Basic "tab" component for unordered lists. -->
<li
	class="tab {activepage === href
		? 'border-b- text-blue-500'
		: 'text-black'} text-xl hover:text-blue-500 w-full justify-center relative"
>
	<span class="flex relative justify-center items-center h-full w-full">
		<a class="flex h-full w-full justify-center" {href}>{@render children()}</a>
	</span>
</li>
