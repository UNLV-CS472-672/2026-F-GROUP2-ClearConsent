<script lang="ts">
	let buttonstyle: string =
		'flex justify-center font-bold border-2 border-black hover:border-black bg-fuchsia-950 hover:bg-fuchsia-300 hover:shadow-md hover:shadow-black/50 transition duration-250 border-blue-500 rounded-xl mt-1 mb-1 mr-20 ml-20';
	import Card from "$lib/components/Card.svelte";
	let loggedin: boolean = $state(false);
</script>

<div class="tempelements flex h-screen w-screen justify-center">
	<main class="pagecontent flex flex-1 flex-col items-center justify-center gap-2">
		<Card mono=true center=true>
			Learn more
		</Card>
		<div
			class="urls flex flex-col justify-center rounded-xl border border-black/50 bg-slate-200 shadow-sm shadow-black/35"
		>
			{#if !loggedin}
				<a href="/login" rel="external" class="{buttonstyle} mt-2 p-2 text-white hover:text-black"
					>Login</a
				>
				<a href="/signup" rel="external" class="{buttonstyle} p-2 text-white">Sign Up</a>
				<button class="{buttonstyle} p-2 text-white" onclick={() => (loggedin = !loggedin)}
					>Log In</button
				>
			{:else if loggedin}
				<p class="flex justify-center">[redacted]</p>
				<a href="/dashboard" rel="external" class="{buttonstyle} mb-2 p-2 text-white">
					Dashboard
				</a>
				<button class="{buttonstyle} p-2 text-white" onclick={() => (loggedin = !loggedin)}
					>Logout</button
				>
			{/if}
		</div>
		{#if loggedin}
			<div class="urls justify-center rounded-xl border bg-slate-200 p-1">
				<p class="text-center font-bold text-slate-500">
					"Logged" in state will not persist for now.
				</p>
				<p class="text-center font-bold text-slate-500">
					- Remove login/signup from navbar and replace with dashboard
				</p>
			</div>
		{/if}
	</main>
</div>
