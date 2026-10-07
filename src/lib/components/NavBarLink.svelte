<script lang="ts">
	import { page } from '$app/state';
	let { children, href, fixed = false, button = false } = $props();
	let tempclass: string =
		'p-1 rounded-lg text-md font-semibold border-2 border-black h-9 text-white/75 bg-black/75 hover:bg-black/50 transition-colors';
</script>

<a
	{href}
	class="font-bold hover:text-url-hover
	{page.url.pathname === href ? 'border-b text-url-hover' : 'text-darktext'}
	{button
		? 'rounded-md border border-black bg-dark p-1 text-darktext transition-colors duration-150 hover:bg-dark-fg'
		: ''}"
>
	{@render children()}
</a>
