<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>ClearConsent | Study workspace</title>
	<meta name="description" content="Explore the ClearConsent privacy policy study workspace." />
</svelte:head>

<main class="entry-frame">
	<div class="entry-shell">
		<header class="entry-header">
			<a class="identity" href={resolve('/')} aria-label="ClearConsent home">
				<span class="brand-mark" aria-hidden="true">C</span>
				<span class="brand-name"><strong>ClearConsent</strong><small>POLICY WORKSPACE</small></span>
			</a>
			<span class="study-tag"><span aria-hidden="true"></span> STUDY PREVIEW</span>
		</header>

		<div class="entry-grid">
			<section class="intro" aria-labelledby="entry-title">
				<p class="eyebrow">PRIVACY, IN PLAIN SIGHT <span> / 01</span></p>
				<h1 id="entry-title">A clearer way to inspect a privacy policy.</h1>
				<p class="intro-copy">
					Bring a policy by URL or paste its text. Explore a workspace designed to make the details
					easier to find and understand.
				</p>
				<div class="signal" aria-label="Workspace steps">
					<div><span>01</span><strong>Bring a policy</strong></div>
					<div><span>02</span><strong>Explore the layout</strong></div>
					<div><span>03</span><strong>Shape what comes next</strong></div>
				</div>
			</section>

			<section class="access" aria-labelledby="access-title">
				<div class="access-topline"><span>WORKSPACE ACCESS</span><span>● &nbsp; 01 / 01</span></div>
				<div class="access-body">
					<div class="access-icon" aria-hidden="true"><span></span><span></span><span></span></div>
					<p class="access-label">WELCOME TO CLEARCONSENT</p>
					<h2 id="access-title">Your policy workspace starts here.</h2>
					<p>Sign in to explore the current study layout, or create an account to take part.</p>
					<div class="entry-actions">
						<a class="primary-action" href={resolve('/login')}
							>Sign in <span aria-hidden="true">↗</span></a
						>
						<a class="secondary-action" href={resolve('/register')}>Create an account</a>
					</div>
					<p class="email-note">
						Creating an account requires email confirmation. Check junk or spam if it does not
						arrive.
					</p>
				</div>
			</section>
		</div>

		<footer>
			<span>ClearConsent / study preview</span>
			<span>Policy analysis is still being connected.</span>
		</footer>
	</div>
</main>

<style>
	.entry-frame {
		min-height: 100vh;
		padding: 0 28px;
		background: #0b1220;
		color: #f4fafb;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}
	.entry-shell {
		display: flex;
		flex-direction: column;
		max-width: 1240px;
		min-height: 100vh;
		margin: 0 auto;
		background: #102039;
		box-shadow: 0 24px 70px #0005;
	}
	.entry-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 20px 46px;
		border-bottom: 1px solid #36516a;
		background: #0e1a2e;
	}
	.identity {
		display: inline-flex;
		align-items: center;
		gap: 13px;
		color: inherit;
		text-decoration: none;
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
	.brand-name {
		display: grid;
		gap: 3px;
	}
	.brand-name strong {
		font-size: 14px;
		font-weight: 750;
		letter-spacing: 0.08em;
	}
	.brand-name small {
		color: #a9c0d1;
		font-size: 10px;
		letter-spacing: 0.1em;
	}
	.study-tag {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 11px;
		border: 1px solid #47718a;
		border-radius: 4px;
		color: #bfece8;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.13em;
	}
	.study-tag span {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #65dfd4;
		box-shadow: 0 0 0 3px #65dfd424;
	}
	.entry-grid {
		display: grid;
		flex: 1;
		grid-template-columns: minmax(0, 1.1fr) minmax(350px, 0.9fr);
		min-height: min(720px, calc(100vh - 145px));
	}
	.intro {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: center;
		overflow: hidden;
		padding: 75px 56px 75px 46px;
		background-image:
			linear-gradient(120deg, #112640ef, #112640d4),
			linear-gradient(#71e6d01b 1px, transparent 1px),
			linear-gradient(90deg, #71e6d01b 1px, transparent 1px);
		background-size:
			auto,
			34px 34px,
			34px 34px;
	}
	.intro::after {
		position: absolute;
		right: -160px;
		bottom: -220px;
		width: 470px;
		height: 470px;
		border: 1px solid #70ebe044;
		border-radius: 50%;
		box-shadow:
			0 0 0 58px #70ebe00b,
			0 0 0 116px #70ebe009;
		content: '';
		pointer-events: none;
	}
	.eyebrow {
		position: relative;
		z-index: 1;
		margin: 0 0 24px;
		color: #6ee7de;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.17em;
	}
	.eyebrow span {
		color: #7e9eb5;
	}
	.intro h1 {
		position: relative;
		z-index: 1;
		max-width: 650px;
		margin: 0;
		font-size: clamp(38px, 4.5vw, 63px);
		font-weight: 700;
		letter-spacing: -0.055em;
		line-height: 1.06;
	}
	.intro-copy {
		position: relative;
		z-index: 1;
		max-width: 490px;
		margin: 25px 0 42px;
		color: #c1d5e2;
		font-size: 15px;
		line-height: 1.7;
	}
	.signal {
		position: relative;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.signal div {
		display: grid;
		gap: 8px;
		min-width: 130px;
		padding: 13px;
		border: 1px solid #4d7b865e;
		border-radius: 5px;
		background: #112f4566;
	}
	.signal span {
		color: #6ee7de;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.14em;
	}
	.signal strong {
		font-size: 11px;
		font-weight: 650;
	}
	.access {
		display: flex;
		flex-direction: column;
		background: #f3f6fa;
		color: #17263a;
	}
	.access-topline {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 24px 34px;
		border-bottom: 1px solid #d9e3eb;
		color: #507187;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.15em;
	}
	.access-topline span:last-child {
		color: #17878d;
	}
	.access-body {
		display: flex;
		flex: 1;
		flex-direction: column;
		justify-content: center;
		padding: 40px clamp(30px, 4vw, 62px) 50px;
	}
	.access-icon {
		display: flex;
		align-items: end;
		gap: 5px;
		width: fit-content;
		height: 48px;
		margin-bottom: 27px;
		padding: 9px;
		border: 1px solid #c4dce4;
		border-radius: 8px;
		background: #e2f3f1;
	}
	.access-icon span {
		width: 8px;
		border-radius: 2px;
		background: #16848b;
	}
	.access-icon span:nth-child(1) {
		height: 13px;
	}
	.access-icon span:nth-child(2) {
		height: 23px;
	}
	.access-icon span:nth-child(3) {
		height: 17px;
	}
	.access-label {
		margin: 0 0 11px;
		color: #137b80;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.16em;
	}
	.access h2 {
		max-width: 360px;
		margin: 0;
		font-size: clamp(30px, 3vw, 42px);
		font-weight: 700;
		letter-spacing: -0.045em;
		line-height: 1.15;
	}
	.access-body > p:not(.access-label):not(.email-note) {
		max-width: 360px;
		margin: 17px 0 28px;
		color: #5a6b80;
		font-size: 14px;
		line-height: 1.65;
	}
	.entry-actions {
		display: grid;
		gap: 10px;
		max-width: 360px;
	}
	.entry-actions a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 47px;
		padding: 12px 15px;
		border-radius: 5px;
		font-size: 13px;
		font-weight: 750;
		text-decoration: none;
	}
	.primary-action {
		background: #167f88;
		color: white;
	}
	.primary-action:hover {
		background: #116873;
	}
	.secondary-action {
		border: 1px solid #b9ceda;
		background: white;
		color: #173f57;
	}
	.secondary-action:hover {
		border-color: #167f88;
		background: #f7fcfb;
	}
	.email-note {
		max-width: 360px;
		margin: 25px 0 0;
		padding-top: 18px;
		border-top: 1px solid #d9e3eb;
		color: #64798c;
		font-size: 11px;
		line-height: 1.5;
	}
	footer {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		padding: 20px 46px;
		border-top: 1px solid #36516a;
		color: #9eb7c9;
		font-size: 11px;
	}
	a:focus-visible {
		outline: 3px solid #42cabc;
		outline-offset: 3px;
	}
	@media (max-width: 850px) {
		.entry-grid {
			grid-template-columns: 1fr;
		}
		.intro {
			padding: 70px 34px;
		}
		.access-body {
			padding: 50px 34px 60px;
		}
	}
	@media (max-width: 580px) {
		.entry-frame {
			padding: 0;
		}
		.entry-header,
		footer {
			padding-right: 20px;
			padding-left: 20px;
		}
		.study-tag {
			font-size: 8px;
		}
		.intro {
			padding: 40px 22px;
		}
		.intro h1 {
			font-size: 36px;
		}
		.intro-copy {
			margin: 18px 0 0;
		}
		.signal {
			display: none;
		}
		.access-body {
			padding: 32px 22px 45px;
		}
		.access-icon {
			display: none;
		}
		footer {
			flex-direction: column;
		}
	}
</style>
