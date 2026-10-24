<script lang="ts">
	import type { ActionData } from './$types';
	import { resolve } from '$app/paths';
	import '$lib/styles/auth-page.css';
	let { form }: { form: ActionData & { message?: string; success?: boolean } } = $props();
</script>

<svelte:head><title>Sign in | ClearConsent</title></svelte:head>

<main class="auth-page">
	<div class="auth-shell">
		<header class="auth-header">
			<a class="auth-identity" href={resolve('/')} aria-label="ClearConsent home">
				<span class="auth-brand-mark" aria-hidden="true">C</span>
				<span class="auth-brand-name"
					><strong>ClearConsent</strong><small>POLICY WORKSPACE</small></span
				>
			</a>
			<a class="auth-back" href={resolve('/')}>← Back to home</a>
		</header>
		<div class="auth-layout">
			<section class="auth-story" aria-label="About ClearConsent">
				<p class="auth-eyebrow">CLEARCONSENT / STUDY PREVIEW</p>
				<h2>See privacy policies with a little more clarity.</h2>
				<p>
					Start with a policy URL or pasted text, then explore how the workspace should help people
					understand it.
				</p>
			</section>
			<section class="auth-panel" aria-labelledby="login-title">
				<p class="auth-kicker">01 / SIGN IN</p>
				<h1 id="login-title">Welcome back.</h1>
				<p class="auth-intro">Use your confirmed account to open the study workspace.</p>
				{#if form?.message}
					<div
						class="auth-alert"
						class:success={form?.success}
						role={form?.success ? 'status' : 'alert'}
					>
						{form.message}
					</div>
				{/if}
				<form class="auth-form" method="POST">
					<div class="auth-field">
						<label for="email">Email Address</label>
						<input
							type="email"
							id="email"
							name="email"
							autocomplete="email"
							required
							placeholder="name@example.com"
						/>
					</div>
					<div class="auth-field">
						<label for="password">Password</label>
						<input
							type="password"
							id="password"
							name="password"
							autocomplete="current-password"
							required
							minlength="6"
							placeholder="••••••••"
						/>
					</div>
					<button class="auth-submit" type="submit">Log In</button>
				</form>
				<p class="auth-switch">
					New to ClearConsent? <a href={resolve('/register')}>Create an account</a>
				</p>
			</section>
		</div>
		<footer class="auth-footer">
			<span>ClearConsent / study preview</span><span>Policy analysis is still being connected.</span
			>
		</footer>
	</div>
</main>
