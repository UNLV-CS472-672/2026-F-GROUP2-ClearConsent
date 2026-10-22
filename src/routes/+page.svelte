<script lang="ts">
	import type { PageData } from './$types';
    import { resolve } from '$app/paths';
	let { data }: { data: PageData } = $props();
</script>

<main>
	{#if data?.session?.user?.email}
		<p>Welcome, {data.session.user.email}</p>
		<form action="/logout" method="POST">
			<button type="submit" class="btn btn-primary">Logout</button>
		</form>
	{:else}
		<p>Welcome to Clear Consent!</p>
		<div class="auth-buttons">
			<a href={resolve('/login')} class="btn btn-primary">Login</a>
			<a href={resolve('/register')} class="btn btn-secondary">Register</a>
		</div>
	{/if}
</main>

<style>
	.btn-primary {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: #e2e8f0;
		color: #1e293b;
		text-decoration: none;
		border-radius: 4px;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn-secondary {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background-color: #e2e8f0;
		color: #1e293b;
		text-decoration: none;
		border-radius: 4px;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn-secondary:hover {
		background-color: #cbd5e1;
	}
</style>
