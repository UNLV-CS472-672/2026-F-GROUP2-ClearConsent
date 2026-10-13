<script lang="ts">
	import { page } from '$app/state';
	let { children, href, button = false } = $props();
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
