<script lang="ts">
	import { resolve } from '$app/paths';

	const inputPaths = [
		{
			number: '01',
			title: 'Paste policy text',
			description:
				'Try the text form and review its validation response. It does not produce an analysis yet.',
			href: '/dashboard/overview/text',
			link: 'Open text form'
		},
		{
			number: '02',
			title: 'Enter a policy URL',
			description:
				'Try the URL form and inspect extracted text from a public page. Retrieval may fail.',
			href: '/dashboard/overview/extract',
			link: 'Open URL form'
		}
	] as const;

	const previewPaths = [
		{
			title: 'Dashboard',
			description: 'See the current workspace and submission tabs.',
			href: '/dashboard/overview',
			link: 'View dashboard'
		},
		{
			title: 'Preferences',
			description: 'Preview example choices. Changes are not saved.',
			href: '/preferences',
			link: 'View preferences'
		},
		{
			title: 'History',
			description: 'Preview a layout populated with sample entries.',
			href: '/dashboard/history',
			link: 'View sample history'
		}
	] as const;
</script>

<svelte:head>
	<title>Explore the ClearConsent prototype</title>
	<meta name="description" content="Explore the current ClearConsent prototype screens." />
</svelte:head>

<div class="site-frame">
	<div class="workspace">
		<a class="skip-link" href="#study-content">Skip to prototype links</a>
		<header class="masthead">
			<a class="identity" href={resolve('/')} aria-label="ClearConsent home">
				<span class="brand-mark" aria-hidden="true"><span></span></span>
				<span class="brand-copy"
					><strong>ClearConsent</strong><small>Policy intelligence preview</small></span
				>
			</a>
			<span class="header-status"><span class="status-dot"></span> USER STUDY PREVIEW</span>
		</header>

		<section class="hero" aria-labelledby="hero-title">
			<div class="hero-copy">
				<p class="eyebrow">CLEARCONSENT / PROTOTYPE 01</p>
				<h1 id="hero-title" aria-label="Privacy policies, made easier to inspect.">
					Privacy policies,<br /><span>made easier to inspect.</span>
				</h1>
				<p class="hero-description">
					Explore the parts of ClearConsent available today. Your feedback will help us shape the
					path from a policy to a useful, source-supported explanation.
				</p>
				<a class="hero-action" href="#study-content"
					>Explore the prototype <span aria-hidden="true">↗</span></a
				>
			</div>
			<div class="hero-schematic" aria-hidden="true">
				<div class="schematic-top"><span>DOCUMENT INPUT</span><span>● ● ●</span></div>
				<div class="schematic-line long"></div>
				<div class="schematic-line medium"></div>
				<div class="schematic-line short"></div>
				<div class="schematic-track">
					<span>01</span><i></i><span>02</span><i></i><span>03</span>
				</div>
				<div class="schematic-output">
					<span class="output-icon">◇</span><span
						><strong>Evidence mapping</strong><small>Design concept</small></span
					>
				</div>
			</div>
		</section>

		<main id="study-content" class="content">
			<div class="section-heading">
				<div>
					<p class="section-label">AVAILABLE INPUT PATHS</p>
					<h2>Start with a document</h2>
					<p>Choose a way to submit. These forms currently stop before a full policy analysis.</p>
				</div>
				<span class="section-count">01 / SUBMIT</span>
			</div>

			<div class="input-grid">
				{#each inputPaths as path (path.href)}
					<article class="input-card">
						<div class="card-meta">
							<span class="card-number">{path.number} / INPUT</span><span class="card-status"
								>TRY IT</span
							>
						</div>
						<h3>{path.title}</h3>
						<p>{path.description}</p>
						<a href={resolve(path.href)}>{path.link} <span aria-hidden="true">→</span></a>
					</article>
				{/each}
			</div>

			<section class="boundary" aria-labelledby="boundary-title">
				<span class="boundary-icon" aria-hidden="true">i</span>
				<div>
					<h2 id="boundary-title">Where the prototype currently stops</h2>
					<p>
						Plain-language findings, personalized evaluation, and saved analyses are still being
						connected to these screens. The other pages below are layout previews.
					</p>
				</div>
			</section>

			<div class="section-heading preview-heading">
				<div>
					<p class="section-label">WORKSPACE PREVIEWS</p>
					<h2>Look around</h2>
				</div>
				<span class="section-count">02 / EXPLORE</span>
			</div>
			<div class="preview-grid">
				{#each previewPaths as path (path.href)}
					<article class="preview-card">
						<h3>{path.title}</h3>
						<p>{path.description}</p>
						<a href={resolve(path.href)}>{path.link} <span aria-hidden="true">→</span></a>
					</article>
				{/each}
			</div>
		</main>

		<footer>
			<strong>ClearConsent</strong><span>Prototype navigation for participant walkthroughs</span>
		</footer>
	</div>
</div>

<style>
	.site-frame {
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
	.skip-link {
		position: absolute;
		top: -60px;
		left: 35px;
		z-index: 4;
		padding: 10px 14px;
		background: white;
		color: #155e75;
	}
	.skip-link:focus {
		top: 10px;
	}
	.masthead {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
		padding: 21px 46px;
		background: #0e1a2e;
		color: white;
		border-bottom: 1px solid #2c4058;
	}
	.identity {
		display: flex;
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
		transform: rotate(-6deg);
	}
	.brand-mark span {
		display: block;
		width: 16px;
		height: 16px;
		border: 3px solid #62d7d0;
		border-right-color: transparent;
		border-radius: 50%;
	}
	.brand-copy {
		display: grid;
		gap: 3px;
	}
	.brand-copy strong {
		font-size: 14px;
		font-weight: 750;
		letter-spacing: 0.08em;
	}
	.brand-copy small {
		color: #a9c0d1;
		font-size: 10px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.header-status {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 9px 11px;
		border: 1px solid #38516b;
		border-radius: 4px;
		color: #c9d9e6;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.12em;
		white-space: nowrap;
	}
	.status-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #5eead4;
		box-shadow: 0 0 10px #5eead488;
	}
	.hero {
		display: grid;
		grid-template-columns: minmax(0, 1.2fr) minmax(230px, 0.8fr);
		align-items: center;
		gap: 42px;
		min-height: 350px;
		padding: 51px 46px;
		overflow: hidden;
		background-color: #10233d;
		background-image:
			linear-gradient(90deg, #10233dfc 0%, #10233de9 55%, #10233db0 100%),
			linear-gradient(#71e6d010 1px, transparent 1px),
			linear-gradient(90deg, #71e6d010 1px, transparent 1px);
		background-size:
			auto,
			32px 32px,
			32px 32px;
		color: white;
	}
	.eyebrow,
	.section-label {
		margin: 0 0 13px;
		color: #137b80;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.18em;
	}
	.eyebrow {
		color: #6ee7de;
	}
	h1 {
		margin: 0;
		font-size: clamp(35px, 4.3vw, 57px);
		font-weight: 670;
		letter-spacing: -0.055em;
		line-height: 1.07;
	}
	h1 span {
		color: #a4f3e8;
	}
	.hero-description {
		max-width: 570px;
		margin: 20px 0 24px;
		color: #d1dfeb;
		font-size: 15px;
		line-height: 1.65;
	}
	.hero-action {
		display: inline-flex;
		gap: 15px;
		align-items: center;
		padding: 12px 16px;
		border-radius: 4px;
		background: #5eead4;
		color: #0d2535;
		font-size: 13px;
		font-weight: 750;
		text-decoration: none;
	}
	.hero-action:hover {
		background: #a4f3e8;
	}
	.hero-schematic {
		width: min(100%, 320px);
		justify-self: center;
		padding: 22px;
		border: 1px solid #6c9cac;
		border-radius: 9px;
		background: #142b45;
		box-shadow:
			18px 20px 0 #6ee7de12,
			0 25px 55px #0005;
		transform: rotate(5deg);
	}
	.schematic-top {
		display: flex;
		justify-content: space-between;
		margin-bottom: 30px;
		color: #8db7c7;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.1em;
	}
	.schematic-top span:last-child {
		color: #5eead4;
		letter-spacing: 0.3em;
	}
	.schematic-line {
		height: 7px;
		margin: 11px 0;
		border-radius: 8px;
		background: #46647e;
	}
	.schematic-line.long {
		width: 92%;
	}
	.schematic-line.medium {
		width: 74%;
	}
	.schematic-line.short {
		width: 51%;
	}
	.schematic-track {
		display: flex;
		align-items: center;
		gap: 11px;
		margin: 29px 0 23px;
		color: #65e7d9;
		font-size: 10px;
		font-weight: 700;
	}
	.schematic-track i {
		flex: 1;
		height: 1px;
		background: #488b95;
	}
	.schematic-output {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 12px;
		border: 1px solid #417d83;
		border-radius: 5px;
		background: #1b404f;
	}
	.output-icon {
		display: grid;
		place-items: center;
		width: 31px;
		height: 31px;
		border-radius: 50%;
		background: #5eead4;
		color: #0d2535;
		font-weight: 800;
	}
	.schematic-output span:last-child {
		display: grid;
		gap: 2px;
	}
	.schematic-output strong {
		font-size: 11px;
	}
	.schematic-output small {
		color: #b2d2d8;
		font-size: 10px;
	}
	.content {
		padding: 43px 46px 55px;
	}
	.section-heading {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 20px;
	}
	.section-heading h2 {
		margin: 0 0 7px;
		font-size: 28px;
		font-weight: 670;
		letter-spacing: -0.035em;
	}
	.section-heading p:last-child {
		margin: 0;
		color: #5a6b80;
		font-size: 14px;
		line-height: 1.55;
	}
	.section-count {
		flex-shrink: 0;
		margin-bottom: 7px;
		color: #6a7e92;
		font-size: 10px;
		font-weight: 750;
		letter-spacing: 0.12em;
	}
	.input-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 17px;
		margin-top: 25px;
	}
	.input-card,
	.preview-card {
		display: flex;
		flex-direction: column;
		min-width: 0;
		border: 1px solid #d7e1ea;
		border-radius: 7px;
		background: white;
	}
	.input-card {
		min-height: 221px;
		padding: 22px;
		border-top: 3px solid #2ca6af;
	}
	.card-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
	}
	.card-number {
		color: #1a8b93;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.11em;
	}
	.card-status {
		padding: 5px 8px;
		border-radius: 3px;
		background: #dff6f1;
		color: #16695f;
		font-size: 10px;
		font-weight: 750;
		letter-spacing: 0.06em;
	}
	h3 {
		margin: 18px 0 7px;
		font-size: 21px;
		font-weight: 680;
		letter-spacing: -0.03em;
	}
	.input-card p,
	.preview-card p {
		margin: 0 0 21px;
		color: #5a6b80;
		font-size: 13px;
		line-height: 1.6;
	}
	.input-card a,
	.preview-card a {
		display: inline-flex;
		align-items: center;
		gap: 11px;
		width: fit-content;
		margin-top: auto;
		color: #115b77;
		font-size: 13px;
		font-weight: 750;
		text-decoration: none;
	}
	.input-card a:hover,
	.preview-card a:hover {
		text-decoration: underline;
	}
	.boundary {
		display: flex;
		align-items: start;
		gap: 14px;
		margin: 25px 0 42px;
		padding: 19px 20px;
		border: 1px solid #cadbe5;
		border-left: 3px solid #3e94b0;
		background: #e8f1f6;
	}
	.boundary-icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 22px;
		height: 22px;
		border: 1px solid #63899e;
		border-radius: 50%;
		color: #165a74;
		font-size: 13px;
		font-weight: 800;
	}
	.boundary h2 {
		margin: 0 0 5px;
		font-size: 15px;
		font-weight: 720;
	}
	.boundary p {
		margin: 0;
		color: #425c70;
		font-size: 13px;
		line-height: 1.6;
	}
	.preview-heading {
		margin-bottom: 18px;
	}
	.preview-heading h2 {
		margin-bottom: 0;
	}
	.preview-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 17px;
	}
	.preview-card {
		min-height: 171px;
		padding: 20px;
	}
	.preview-card h3 {
		margin: 0 0 9px;
		font-size: 17px;
	}
	.preview-card p {
		margin-bottom: 16px;
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
	@media (max-width: 850px) {
		.hero {
			grid-template-columns: 1fr;
			min-height: 0;
		}
		.hero-schematic {
			display: none;
		}
		.preview-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 620px) {
		.site-frame {
			padding: 0;
		}
		.masthead {
			padding: 18px 20px;
		}
		.header-status {
			display: none;
		}
		.hero {
			padding: 39px 20px 43px;
		}
		h1 {
			font-size: 38px;
		}
		.hero-description {
			font-size: 14px;
		}
		.content {
			padding: 35px 20px 45px;
		}
		.section-heading {
			align-items: start;
			flex-direction: column;
			gap: 7px;
		}
		.input-grid,
		.preview-grid {
			grid-template-columns: 1fr;
		}
		.input-card {
			min-height: 203px;
		}
		.preview-card {
			min-height: 0;
		}
		footer {
			padding: 20px;
			flex-direction: column;
		}
	}
</style>
