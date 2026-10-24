<script lang="ts">
	import type { LayoutProps } from './$types';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	let { children }: LayoutProps = $props();

	const INPUT_METHODS = [
		{ name: 'URL', description: 'Start from a web address', href: '/dashboard/overview/extract' },
		{
			name: 'Paste Text',
			description: 'Use text you already have',
			href: '/dashboard/overview/text'
		}
	] as const;
</script>

<div class="dashboard-frame">
	<div class="workspace">
		<header class="masthead">
			<div class="identity">
				<span class="brand-mark" aria-hidden="true">C</span>
				<span><strong>ClearConsent</strong><small>Policy workspace</small></span>
			</div>
			<nav aria-label="Dashboard links" class="dashboard-links">
				<a href={resolve('/preferences')}>Preferences</a>
				<form action={resolve('/logout')} method="POST">
					<button type="submit">Sign out</button>
				</form>
			</nav>
		</header>

		<section class="hero" aria-labelledby="dashboard-title">
			<div>
				<p class="eyebrow">CLEARCONSENT / WORKSPACE</p>
				<h1 id="dashboard-title">Policy workspace</h1>
				<p>Submit a policy URL or paste its text to begin.</p>
			</div>
		</section>

		<div class="dashboard-content">
			<section class="submission-panel" aria-labelledby="submission-title">
				<div class="section-heading">
					<div>
						<p class="section-label">01 / SUBMIT</p>
						<h2 id="submission-title">Start with a policy</h2>
						<p>
							These forms currently validate text or extract it from a URL. Full analysis is still
							being connected.
						</p>
					</div>
				</div>
				<nav aria-label="Policy input methods" class="input-nav">
					{#each INPUT_METHODS as method, index (method.name)}
						<a
							href={resolve(method.href)}
							class="method-card"
							class:active={page.url.pathname === method.href}
							aria-current={page.url.pathname === method.href ? 'page' : undefined}
						>
							<span class="method-top"
								><span>0{index + 1} / INPUT</span>{#if page.url.pathname === method.href}<span
										class="method-state">SELECTED</span
									>{/if}</span
							>
							<strong>{method.name}</strong>
							<small>{method.description}</small>
						</a>
					{/each}
					<div class="method-card unavailable" aria-disabled="true">
						<span class="method-top"><span>03 / LATER</span><span>COMING SOON</span></span>
						<strong>Search</strong>
						<small>Find a previous analysis</small>
					</div>
				</nav>
				<div class="route-content">
					{@render children()}
				</div>
			</section>

			<section class="history-panel" aria-labelledby="history-title">
				<div class="section-heading history-heading">
					<div>
						<p class="section-label">02 / HISTORY</p>
						<h2 id="history-title">Recent analyses</h2>
					</div>
				</div>
				<div class="history-empty">
					<span class="history-empty-mark" aria-hidden="true">◫</span>
					<div>
						<h3>No saved analyses yet</h3>
						<p>
							Once saving is connected, your completed policies will appear here with a readable
							title and date.
						</p>
						<span class="history-status">Saving is coming soon</span>
					</div>
				</div>
			</section>
		</div>
		<footer>
			<strong>ClearConsent</strong><span>Privacy policy workspace</span>
		</footer>
	</div>
</div>

<style>
	.dashboard-frame {
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
	.dashboard-links {
		display: flex;
		align-items: center;
		gap: 25px;
		font-size: 12px;
		font-weight: 700;
	}
	.dashboard-links a {
		color: #d9e8f1;
		text-decoration: none;
	}
	.dashboard-links a:hover {
		color: #70ebe0;
	}
	.dashboard-links form {
		margin: 0;
	}
	.dashboard-links button {
		padding: 8px 12px;
		border: 1px solid #5a8095;
		border-radius: 5px;
		background: transparent;
		color: #d9e8f1;
		font: inherit;
		cursor: pointer;
	}
	.dashboard-links button:hover {
		border-color: #70ebe0;
		color: #70ebe0;
	}
	.dashboard-links button:focus-visible {
		outline: 3px solid #42cabc;
		outline-offset: 3px;
	}
	.hero {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 30px;
		min-height: 218px;
		padding: 40px 46px;
		background-color: #10233d;
		background-image:
			linear-gradient(90deg, #10233dfc, #10233ddc), linear-gradient(#71e6d010 1px, transparent 1px),
			linear-gradient(90deg, #71e6d010 1px, transparent 1px);
		background-size:
			auto,
			32px 32px,
			32px 32px;
		color: white;
	}
	.eyebrow,
	.section-label {
		margin: 0 0 12px;
		color: #137b80;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.18em;
	}
	.eyebrow {
		color: #6ee7de;
	}
	.hero h1 {
		margin: 0;
		font-size: clamp(34px, 4vw, 50px);
		font-weight: 690;
		letter-spacing: -0.05em;
		line-height: 1.1;
	}
	.hero p:last-child {
		max-width: 540px;
		margin: 14px 0 0;
		color: #d1dfeb;
		font-size: 14px;
		line-height: 1.6;
	}
	.dashboard-content {
		display: grid;
		gap: 26px;
		padding: 38px 46px 54px;
	}
	.submission-panel,
	.history-panel {
		min-width: 0;
		padding: 27px;
		border: 1px solid #d7e1ea;
		border-radius: 8px;
		background: white;
	}
	.submission-panel {
		border-top: 3px solid #2ca6af;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
	}
	.section-heading h2 {
		margin: 0 0 7px;
		font-size: 28px;
		font-weight: 690;
		letter-spacing: -0.035em;
	}
	.section-heading p:last-child {
		margin: 0;
		color: #5a6b80;
		font-size: 13px;
		line-height: 1.55;
	}
	.input-nav {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin-top: 26px;
	}
	.method-card {
		display: grid;
		align-content: start;
		gap: 7px;
		min-height: 114px;
		padding: 14px 16px;
		border: 1px solid #cad8e3;
		border-top: 4px solid #9fb8c7;
		border-radius: 7px;
		background: #f8fafc;
		box-shadow: 0 3px 8px #132c4210;
		color: #294456;
		text-decoration: none;
	}
	.method-card:hover:not(.unavailable) {
		border-color: #2ca6af;
		border-top-color: #2ca6af;
		box-shadow: 0 6px 16px #11788322;
	}
	.method-card.active {
		border-color: #188a94;
		border-top-color: #0e737e;
		background: #dcf6f1;
		box-shadow:
			0 0 0 2px #2ca6af55,
			0 8px 20px #11788322;
		color: #0d606b;
	}
	.method-top {
		display: flex;
		justify-content: space-between;
		gap: 6px;
		color: #597486;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.1em;
	}
	.method-state {
		color: #0d737b;
	}
	.method-card strong {
		font-size: 18px;
		font-weight: 750;
	}
	.method-card small {
		color: #526b7c;
		font-size: 11px;
		line-height: 1.4;
	}
	.method-card.unavailable {
		border-color: #e3e9ee;
		border-top-color: #d3dde5;
		background: #f5f7f9;
		box-shadow: none;
		color: #7a8b9b;
	}
	.method-card.unavailable small,
	.method-card.unavailable .method-top {
		color: #8999a8;
	}
	.route-content {
		min-width: 0;
		padding-top: 27px;
	}
	.route-content :global(form),
	.route-content :global(.w-200) {
		max-width: 100%;
	}
	.route-content :global(textarea),
	.route-content :global(input) {
		border: 1px solid #cbdde4;
		border-radius: 5px;
		background: white;
		color: #17263a;
	}
	.route-content :global(button[type='submit']) {
		padding: 10px 16px;
		border-radius: 4px;
		background: #167f88;
		color: white;
		font-size: 13px;
		font-weight: 750;
	}
	.route-content :global(button[type='submit']:hover:not(:disabled)) {
		background: #116873;
	}
	.history-heading {
		margin-bottom: 18px;
	}
	.history-empty {
		display: flex;
		align-items: flex-start;
		gap: 18px;
		padding: 27px;
		border: 1px dashed #b9d0dd;
		border-radius: 7px;
		background: #f5fafb;
	}
	.history-empty-mark {
		display: grid;
		flex: 0 0 42px;
		place-items: center;
		width: 42px;
		height: 42px;
		border-radius: 8px;
		background: #e1f3f0;
		color: #167f88;
		font-size: 24px;
	}
	.history-empty h3 {
		margin: 0 0 6px;
		color: #243b4d;
		font-size: 16px;
	}
	.history-empty p {
		max-width: 540px;
		margin: 0 0 13px;
		color: #5a6b80;
		font-size: 13px;
		line-height: 1.55;
	}
	.history-status {
		color: #137b80;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
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
		.dashboard-frame {
			padding: 0;
		}
		.masthead,
		.hero,
		footer {
			padding-right: 20px;
			padding-left: 20px;
		}
		.hero {
			align-items: start;
			flex-direction: column;
			gap: 20px;
		}
		.dashboard-content {
			padding: 24px 16px 40px;
		}
		.submission-panel,
		.history-panel {
			padding: 20px;
		}
		.route-content :global(textarea),
		.route-content :global(form),
		.route-content :global(input) {
			max-width: 100%;
		}
	}
	@media (max-width: 480px) {
		.masthead {
			align-items: start;
			flex-direction: column;
			gap: 15px;
		}
		.hero h1 {
			font-size: 36px;
		}
		.input-nav {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.method-card {
			padding: 12px;
		}
		.method-card.unavailable {
			grid-column: 1 / -1;
			min-height: 86px;
		}
		.section-heading {
			align-items: start;
			flex-direction: column;
		}
		footer {
			flex-direction: column;
		}
	}
</style>
