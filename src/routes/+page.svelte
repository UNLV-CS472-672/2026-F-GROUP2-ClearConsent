<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>ClearConsent | Study entry</title>
	<meta name="description" content="Temporary entry to the ClearConsent policy workspace." />
</svelte:head>

<main class="entry-frame">
	<div class="entry-workspace">
		<header class="masthead">
			<div class="identity">
				<span class="brand-mark" aria-hidden="true">C</span>
				<span><strong>ClearConsent</strong><small>Policy workspace</small></span>
			</div>
			<span class="entry-status">STUDY ACCESS</span>
		</header>

		<section class="entry-content" aria-labelledby="entry-title">
			<div class="intro">
				<p class="eyebrow">CLEARCONSENT / ENTRY</p>
				<h1 id="entry-title">Your policy workspace starts here.</h1>
				<p class="intro-copy">
					Explore the current policy input screens and help us shape how ClearConsent should work.
				</p>
				<div class="progress-line" aria-label="Study flow">
					<span>01 / Enter</span><span>02 / Explore</span><span>03 / Give feedback</span>
				</div>
			</div>

			<div class="access-card">
				<span class="card-label">TEMPORARY ACCESS</span>
				<h2>Continue to the dashboard</h2>
				<p>Sign-in is being connected. For now, enter the workspace directly without an account.</p>
				<a class="continue-link" href={resolve('/dashboard/overview')}
					>Continue with demo access <span aria-hidden="true">→</span></a
				>
				<p class="card-note">
					This button opens the dashboard. It does not sign you in or save data.
				</p>
			</div>
		</section>

		<footer>
			<strong>ClearConsent</strong><span>User study entry · Authentication coming soon</span>
		</footer>
	</div>
</main>

<style>
	.entry-frame {
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
	.entry-workspace {
		display: flex;
		flex-direction: column;
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
		gap: 24px;
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
	.entry-status {
		padding: 8px 10px;
		border: 1px solid #447989;
		border-radius: 3px;
		color: #9de5de;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.13em;
	}
	.entry-content {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
		align-items: center;
		gap: 50px;
		flex: 1;
		padding: 70px;
		background: radial-gradient(circle at 90% 10%, #1c4560, #10233d 55%);
	}
	.intro {
		max-width: 590px;
		color: white;
	}
	.eyebrow,
	.card-label {
		margin: 0 0 18px;
		color: #6ee7de;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.18em;
	}
	.intro h1 {
		margin: 0;
		font-size: clamp(42px, 5vw, 66px);
		font-weight: 690;
		letter-spacing: -0.055em;
		line-height: 1.08;
	}
	.intro-copy {
		max-width: 470px;
		margin: 24px 0 0;
		color: #d1dfeb;
		font-size: 16px;
		line-height: 1.7;
	}
	.progress-line {
		display: flex;
		flex-wrap: wrap;
		gap: 16px 24px;
		margin-top: 62px;
		padding-top: 18px;
		border-top: 1px solid #497084;
		color: #a9cbd2;
		font-size: 11px;
		font-weight: 750;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.access-card {
		padding: 38px;
		border: 1px solid #d7e1ea;
		border-top: 3px solid #2ca6af;
		border-radius: 8px;
		background: white;
		box-shadow: 0 25px 60px #07172b30;
	}
	.card-label {
		color: #137b80;
	}
	.access-card h2 {
		margin: 0 0 12px;
		font-size: 29px;
		font-weight: 690;
		letter-spacing: -0.035em;
	}
	.access-card p {
		margin: 0;
		color: #5a6b80;
		font-size: 14px;
		line-height: 1.6;
	}
	.continue-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		margin-top: 30px;
		padding: 15px 18px;
		border-radius: 5px;
		background: #167f88;
		color: white;
		font-size: 14px;
		font-weight: 750;
		text-decoration: none;
	}
	.continue-link:hover {
		background: #116873;
	}
	.continue-link span {
		font-size: 20px;
		line-height: 1;
	}
	.access-card .card-note {
		margin-top: 18px;
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
	@media (max-width: 900px) {
		.entry-content {
			grid-template-columns: 1fr;
			gap: 42px;
			padding: 60px 46px;
			background: #10233d;
		}
		.access-card {
			max-width: 560px;
		}
		.progress-line {
			margin-top: 36px;
		}
	}
	@media (max-width: 600px) {
		.entry-frame {
			padding: 0;
		}
		.masthead,
		footer {
			padding-right: 20px;
			padding-left: 20px;
		}
		.entry-status {
			display: none;
		}
		.entry-content {
			padding: 50px 20px;
		}
		.intro h1 {
			font-size: 42px;
		}
		.access-card {
			padding: 28px;
		}
		footer {
			flex-direction: column;
		}
	}
</style>
