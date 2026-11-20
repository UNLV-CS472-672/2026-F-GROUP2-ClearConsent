<script lang="ts">
	import AnalysisResultView from '$lib/components/AnalysisResultView.svelte';
	import { resolve } from '$app/paths';
	import { samplePreparedResult } from '$lib/sample/prepared';
</script>

<svelte:head>
	<title>Sample policy results | ClearConsent</title>
	<meta
		name="description"
		content="A prepared ClearConsent result for a fictional privacy policy. It is a demonstration, not a live analysis."
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
		<p class="eyebrow">FICTIONAL SAMPLE / PREPARED RESULT</p>
		<div class="result-intro">
			<h1>Sample policy results</h1>
			<p>The explanation below was prepared for the fictional sample policy.</p>
		</div>

		<p class="boundary" role="note">
			<strong>Prepared demonstration.</strong> ClearConsent did not analyze this text with a live model,
			save a result, store preferences, or add an entry to History. Each point quotes the sample wording.
		</p>

		<AnalysisResultView result={samplePreparedResult} />

		<nav class="result-actions" aria-label="Sample navigation">
			<a href={resolve('/sample')}>Read the sample policy</a>
			<a href={resolve('/')}>Back to home</a>
		</nav>

		<section class="account" aria-labelledby="account-title">
			<h2 id="account-title">Analyze your own policy</h2>
			<p>
				Sign in or create an account to run analysis on your own policy, keep preferences, and find
				saved results in History.
			</p>
			<div class="account-actions">
				<a class="primary" href={resolve('/login')}>Sign in</a>
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
		margin: 0;
		color: #0d737b;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.result-intro h1 {
		margin: 12px 0 0;
		font-size: clamp(30px, 4vw, 42px);
		letter-spacing: -0.045em;
		line-height: 1.1;
	}
	.result-intro p {
		margin: 11px 0 0;
		color: #5a6b80;
		font-size: 14px;
		line-height: 1.55;
	}
	.boundary {
		margin: 24px 0;
		padding: 13px 16px;
		border-left: 3px solid #3aa5a8;
		border-radius: 0 5px 5px 0;
		background: #eaf7f6;
		color: #2f5260;
		font-size: 13px;
		line-height: 1.55;
	}
	.result-actions,
	.account-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 28px;
		padding-top: 22px;
		border-top: 1px solid #dce6ea;
	}
	.result-actions a,
	.secondary {
		padding: 8px 11px;
		border: 1px solid #cadce4;
		border-radius: 5px;
		background: white;
		color: #0d6771;
		font-size: 12px;
		font-weight: 750;
		text-decoration: none;
	}
	.primary {
		padding: 10px 16px;
		border-radius: 5px;
		background: #147f88;
		color: white;
		font-size: 13px;
		font-weight: 750;
		text-decoration: none;
	}
	.primary:hover {
		background: #0d6570;
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
