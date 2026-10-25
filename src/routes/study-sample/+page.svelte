<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { samplePolicy, detailLevel } from '$lib/study/sample';

	const detail = $derived(detailLevel(page.url.searchParams.get('detail')));
	const policyLines = samplePolicy.split('\n').filter(Boolean);
</script>

<svelte:head><title>Study sample privacy policy | ClearConsent</title></svelte:head>

<div class="sample-frame">
	<div class="workspace">
		<header class="masthead">
			<div class="identity">
				<span class="brand-mark" aria-hidden="true">C</span>
				<span><strong>ClearConsent</strong><small>Policy workspace</small></span>
			</div>
			<a href={resolve(`/dashboard/overview/extract?detail=${detail}`)}>Back to dashboard</a>
		</header>

		<main class="sample-content">
			<p class="eyebrow">USER STUDY / FIXED SAMPLE</p>
			<h1>Study sample privacy policy</h1>
			<p class="intro">
				This is a fictional policy used by every participant. Read it before opening the prepared
				study result.
			</p>

			<section class="policy-card" aria-labelledby="policy-title">
				<div class="policy-topline"><span>SAMPLE SOURCE</span><span>01 / 01</span></div>
				<h2 id="policy-title">{policyLines[0]}</h2>
				<div class="policy-lines">
					{#each policyLines.slice(1) as line, index (line)}
						<div class="policy-line">
							<span aria-hidden="true">0{index + 1}</span>
							<p>{line}</p>
						</div>
					{/each}
				</div>
			</section>

			<div class="sample-actions">
				<a class="submit" href={resolve(`/dashboard/overview/result?detail=${detail}`)}
					>Submit study sample <span aria-hidden="true">→</span></a
				>
				<a class="back" href={resolve(`/dashboard/overview/extract?detail=${detail}`)}
					>Back to dashboard</a
				>
			</div>
			<p class="disclaimer">This opens prepared example results. It does not run live analysis.</p>
		</main>
		<footer><strong>ClearConsent</strong><span>Study sample policy</span></footer>
	</div>
</div>

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
	.workspace {
		max-width: 1240px;
		min-height: 100vh;
		margin: 0 auto;
		background: #f3f6fa;
		box-shadow: 0 24px 70px #0005;
	}
	.masthead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 19px 46px;
		border-bottom: 1px solid #2c4058;
		background: #0e1a2e;
		color: white;
	}
	.identity {
		display: flex;
		align-items: center;
		gap: 13px;
	}
	.brand-mark {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1px solid #62d7d0;
		border-radius: 8px;
		color: #62d7d0;
		font-size: 21px;
		font-weight: 750;
		transform: rotate(-6deg);
	}
	.identity span:last-child {
		display: grid;
		gap: 3px;
	}
	.identity strong {
		font-size: 14px;
		font-weight: 750;
		letter-spacing: 0.08em;
	}
	.identity small {
		color: #a9c0d1;
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.masthead > a {
		color: #d9e8f1;
		font-size: 12px;
		font-weight: 750;
		text-decoration: none;
	}
	.masthead > a:hover {
		color: #70ebe0;
	}
	.sample-content {
		max-width: 960px;
		margin: 0 auto;
		padding: 55px 46px 70px;
	}
	.eyebrow,
	.policy-topline {
		color: #0e737b;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.eyebrow {
		margin: 0 0 12px;
	}
	h1 {
		margin: 0;
		font-size: clamp(32px, 4vw, 44px);
		letter-spacing: -0.045em;
		line-height: 1.12;
	}
	.intro {
		max-width: 65ch;
		margin: 15px 0 28px;
		color: #526b7c;
		font-size: 14px;
		line-height: 1.6;
	}
	.policy-card {
		padding: 28px 32px;
		border: 1px solid #d7e1ea;
		border-top: 3px solid #2ca6af;
		border-radius: 8px;
		background: white;
	}
	.policy-topline {
		display: flex;
		justify-content: space-between;
		gap: 12px;
	}
	.policy-card h2 {
		margin: 22px 0 8px;
		font-size: 21px;
		letter-spacing: -0.025em;
	}
	.policy-lines {
		display: grid;
	}
	.policy-line {
		display: flex;
		gap: 18px;
		padding: 17px 0;
		border-bottom: 1px solid #e1e9ed;
	}
	.policy-line:last-child {
		border-bottom: 0;
	}
	.policy-line span {
		color: #19848b;
		font-size: 11px;
		font-weight: 800;
	}
	.policy-line p {
		margin: 0;
		font-size: 14px;
		line-height: 1.65;
	}
	.sample-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 18px;
		margin-top: 25px;
	}
	.sample-actions a {
		font-size: 12px;
		font-weight: 750;
		text-decoration: none;
	}
	.sample-actions .submit {
		display: inline-flex;
		align-items: center;
		gap: 17px;
		padding: 12px 16px;
		border-radius: 5px;
		background: #147f88;
		color: white;
	}
	.sample-actions .submit:hover {
		background: #0d6570;
	}
	.sample-actions .back {
		color: #0e6871;
	}
	.sample-actions .back:hover {
		text-decoration: underline;
	}
	.disclaimer {
		margin: 14px 0 0;
		color: #66798d;
		font-size: 11px;
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 20px 46px;
		border-top: 1px solid #d7e1ea;
		color: #66798d;
		font-size: 11px;
	}
	footer strong {
		color: #17263a;
	}
	a:focus-visible {
		outline: 3px solid #42cabc;
		outline-offset: 3px;
	}
	@media (max-width: 720px) {
		.sample-frame {
			padding: 0;
		}
		.masthead,
		footer {
			padding-right: 20px;
			padding-left: 20px;
		}
		.sample-content {
			padding: 34px 20px 48px;
		}
		.policy-card {
			padding: 22px 18px;
		}
	}
</style>
