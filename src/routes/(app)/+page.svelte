<script lang="ts">
	let buttonstyle: string =
		'flex justify-center font-bold border-2 border-black hover:border-black bg-fuchsia-950 hover:bg-fuchsia-300 hover:shadow-md hover:shadow-black/50 transition duration-250 border-blue-500 rounded-xl mt-1 mb-1 mr-20 ml-20';
	import Card from '$lib/components/Card.svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
</script>

<div class="tempelements flex h-screen w-screen justify-center">
	<main class="pagecontent flex flex-1 flex-col items-center justify-center gap-15">
		<Card center={true} href="/about" cardtitle="Learn More">Sample Text</Card>
		<div
			class="flex flex-col justify-center rounded-xl border border-black/50 bg-slate-200 py-5 shadow-sm shadow-black/35"
		>
			<button class="{buttonstyle} p-2 text-white" onclick={() => goto(resolve('/dashboard'))}>
				Log In
			</button>
			<a href="/signup" rel="external" class="{buttonstyle} p-2 text-white">Sign Up</a>
		</div>
	</main>
</div>
