<script lang="ts">
	let {
		children,
		cardtitle = '', // "Header" of card
		mono = false, // Single color, only main text
		titleonly = false,
		center = false, // Center text
		href = '', // Optional URL
		rise = false // Rising animation on hover
	} = $props();
	import '../../routes/layout.css';
</script>

<!--  Extremely basic card -->
<div
	class="max-w-md min-w-50 rounded-xl bg-white/85 shadow-xs shadow-black/10 hover:bg-white hover:shadow-md hover:shadow-black/10
	{!rise ? '' : 'transition-transform duration-200 hover:-translate-y-2'} border border-border-dark/50 hover:border-border-dark"
>
	<a
		href={!href ? '#' : href}
		class={!href ? 'pointer-events-none cursor-default' : 'cursor-pointer'}
	>
		<div>
			{#if !mono}
				<div class="flex min-h-12 items-center justify-center rounded-t-xl bg-dark-fg">
					<h1 class="text-xl font-bold text-darktext">{cardtitle}</h1>
				</div>
				{:else}
					<div class="flex {!cardtitle ? 'hidden' : 'min-h-12'} items-center justify-center">
						<h1 class="text-xl font-bold text-darktext">{cardtitle}</h1>
					</div>
			{/if}

			<div class="flex {center ? 'justify-center' : ''}">
				<span class="font-medium inline-block p-3">
						{@render children()}
				</span>
			</div>
		</div>
	</a>
</div>
