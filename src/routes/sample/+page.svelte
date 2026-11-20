<script lang="ts">
	import { resolve } from '$app/paths';
	import { samplePolicy, samplePolicyTitle } from '$lib/sample/prepared';
</script>

<svelte:head>
	<title>Fictional sample policy | ClearConsent</title>
	<meta
		name="description"
		content="A fictional privacy policy with a prepared ClearConsent demonstration. No account is needed."
	/>
</svelte:head>

<main class="sample-frame">
	<header class="sample-header">
		<a class="identity" href={resolve('/')} aria-label="ClearConsent home">
			<span class="brand-mark" aria-hidden="true">C</span>
			<strong>ClearConsent</strong>
		</a>
		<a class="header-link" href={resolve('/')}>← Back to home</a>
	</header>

	<div class="sample-content">
		<p class="eyebrow">FICTIONAL SAMPLE / PREPARED DEMONSTRATION</p>
		<h1>Sample privacy policy</h1>
		<p class="intro">
			This policy is invented for demonstration. Every visitor sees the same text, and the prepared
			result describes only this text.
		</p>

		<section class="policy-card" aria-labelledby="policy-title">
			<div class="policy-topline"><span>FICTIONAL SAMPLE</span><span>Not a real service</span></div>
			<h2 id="policy-title">{samplePolicyTitle}</h2>
			<ol class="policy-lines">
				{#each samplePolicy as line, index (index)}
					<li>
						<span class="line-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
						<span>{line}</span>
					</li>
				{/each}
			</ol>
		</section>

		<div class="actions">
			<a class="primary" href={resolve('/sample/result')}
				>View the prepared result <span aria-hidden="true">→</span></a
			>
		</div>

		<p class="boundary" role="note">
			This is a prepared demonstration. Viewing it does not run live model analysis, save a result,
			store preferences, or add anything to History.
		</p>

		<section class="account" aria-labelledby="account-title">
			<h2 id="account-title">Want to analyze your own policy?</h2>
			<p>
				Sign in or create an account to analyze your own policies, keep preferences, and use
				History.
			</p>
			<div class="account-actions">
				<a class="secondary" href={resolve('/login')}>Sign in</a>
				<a class="secondary" href={resolve('/register')}>Create an account</a>
			</div>
		</section>
	</div>
</main>

<style>
	.sample-frame {
		min-height: 100vh;
		padding: 0 28px;
		background: #0b1220;
		color: #17263a;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}
	.sample-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		max-width: 1240px;
		margin: 0 auto;
		padding: 19px 0;
		color: white;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 12px;
		color: white;
		text-decoration: none;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 1px solid #62d7d0;
		border-radius: 8px;
		color: #62d7d0;
		font-size: 19px;
		font-weight: 750;
	}
	.header-link {
		color: #d9e8f1;
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
	}
	.header-link:hover,
	.identity:hover {
		color: #70ebe0;
	}
	.sample-content {
		max-width: 960px;
		margin: 0 auto;
		padding: 40px 46px 64px;
		border-radius: 8px;
		background: #f3f6fa;
	}
	.eyebrow {
		margin: 0 0 12px;
		color: #0e737b;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	h1 {
		margin: 0;
		font-size: clamp(32px, 4vw, 44px);
		letter-spacing: -0.045em;
		line-height: 1.12;
	}
	.intro {
		max-width: 620px;
		margin: 14px 0 0;
		color: #4d6574;
		font-size: 15px;
		line-height: 1.6;
	}
	.policy-card {
		margin-top: 28px;
		padding: 24px;
		border: 1px solid #d7e1ea;
		border-top: 3px solid #2ca6af;
		border-radius: 8px;
		background: white;
	}
	.policy-topline {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		color: #0e737b;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.policy-card h2 {
		margin: 14px 0 16px;
		font-size: 20px;
		letter-spacing: -0.02em;
	}
	.policy-lines {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.policy-lines li {
		display: flex;
		gap: 14px;
		color: #294456;
		font-size: 15px;
		line-height: 1.55;
	}
	.line-number {
		flex: 0 0 auto;
		color: #137b80;
		font-size: 11px;
		font-weight: 800;
	}
	.actions,
	.account-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 24px;
	}
	.primary,
	.secondary {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-height: 42px;
		padding: 10px 16px;
		border-radius: 5px;
		font-size: 13px;
		font-weight: 750;
		text-decoration: none;
	}
	.primary {
		background: #147f88;
		color: white;
	}
	.primary:hover {
		background: #0d6570;
	}
	.secondary {
		border: 1px solid #b9ceda;
		background: white;
		color: #173f57;
	}
	.secondary:hover {
		border-color: #167f88;
		color: #0d6771;
	}
	.boundary {
		margin: 24px 0 0;
		padding: 13px 16px;
		border-left: 3px solid #3aa5a8;
		border-radius: 0 5px 5px 0;
		background: #eaf7f6;
		color: #2f5260;
		font-size: 13px;
		line-height: 1.55;
	}
	.account {
		margin-top: 32px;
		padding-top: 24px;
		border-top: 1px solid #d7e1ea;
	}
	.account h2 {
		margin: 0 0 8px;
		font-size: 18px;
	}
	.account p {
		margin: 0;
		color: #4d6574;
		font-size: 14px;
		line-height: 1.55;
	}
	a:focus-visible {
		outline: 3px solid #42cabc;
		outline-offset: 3px;
	}
	@media (max-width: 600px) {
		.sample-frame {
			padding: 0 12px;
		}
		.sample-content {
			padding: 28px 20px 48px;
		}
	}
</style>
