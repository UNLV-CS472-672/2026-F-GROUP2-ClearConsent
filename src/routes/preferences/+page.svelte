<script lang="ts">
	import { resolve } from '$app/paths';

	type Detail = 'quick' | 'balanced' | 'detailed';
	type Style = 'bullets' | 'paragraph';

	const topics = [
		{
			value: 'sharing',
			title: 'Data sharing',
			description: 'Who receives my information?'
		},
		{
			value: 'tracking',
			title: 'Tracking and ads',
			description: 'How is my activity used?'
		},
		{
			value: 'retention',
			title: 'Data retention',
			description: 'How long is it kept?'
		}
	] as const;

	let focusAreas = $state<string[]>([]);
	let detail = $state<Detail>('balanced');
	let style = $state<Style>('bullets');

	const coreSentences = [
		'If usage reporting is on, this example service shares usage data with an analytics provider.',
		'It keeps reports for 30 days unless law requires longer.'
	];
	const previewSentences = $derived(
		detail === 'quick'
			? coreSentences
			: detail === 'balanced'
				? [...coreSentences, 'The excerpt does not say whether reporting can be turned off later.']
				: [
						...coreSentences,
						'The excerpt does not say whether reporting can be turned off later.',
						'It does not name the analytics provider or specify which usage events are included.'
					]
	);
</script>

<svelte:head>
	<title>ClearConsent | Preferences preview</title>
</svelte:head>

<main class="page-frame">
	<div class="workspace">
		<header class="masthead">
			<div class="identity">
				<span class="brand-mark" aria-hidden="true">C</span>
				<span><strong>ClearConsent</strong><small>Policy workspace</small></span>
			</div>
			<a class="back-link" href={resolve(`/dashboard/overview/extract?detail=${detail}`)}
				>← Back to dashboard</a
			>
		</header>

		<section class="hero" aria-labelledby="preferences-title">
			<p class="eyebrow">CLEARCONSENT / PREFERENCES</p>
			<h1 id="preferences-title">Make the explanation yours.</h1>
			<p>Explore which privacy topics matter to you and how you would like an answer to read.</p>
		</section>

		<div class="content">
			<div class="notice" role="note">
				<strong>Study preview</strong>
				<span>
					The level of detail carries into the study example when you continue below. Choices are
					not saved. Answer style and privacy interests apply only to this preview.
				</span>
			</div>

			<p class="mb-4">
				<a class="back-link" href={resolve(`/dashboard/overview/extract?detail=${detail}`)}
					>Continue with study sample →</a
				>
			</p>
			<div class="columns">
				<div class="controls">
					<section class="panel" aria-labelledby="topics-title">
						<p class="section-label">01 / PRIVACY INTERESTS</p>
						<h2 id="topics-title">What would you notice first?</h2>
						<p class="helper">Select any topics you would want highlighted in a future analysis.</p>
						<div class="choices">
							{#each topics as topic (topic.value)}
								<label class="choice">
									<input type="checkbox" value={topic.value} bind:group={focusAreas} />
									<span><strong>{topic.title}</strong><small>{topic.description}</small></span>
								</label>
							{/each}
						</div>
					</section>

					<section class="panel" aria-labelledby="presentation-title">
						<p class="section-label">02 / PRESENTATION</p>
						<h2 id="presentation-title">How should answers read?</h2>
						<fieldset>
							<legend>Level of detail</legend>
							<div class="option-row">
								<label
									><input type="radio" name="detail-level" value="quick" bind:group={detail} /> Quick
									scan</label
								>
								<label
									><input type="radio" name="detail-level" value="balanced" bind:group={detail} /> Balanced</label
								>
								<label
									><input type="radio" name="detail-level" value="detailed" bind:group={detail} /> Detailed</label
								>
							</div>
						</fieldset>
						<fieldset>
							<legend>Answer style</legend>
							<div class="option-row">
								<label
									><input type="radio" name="answer-style" value="bullets" bind:group={style} /> Bullet
									points</label
								>
								<label
									><input type="radio" name="answer-style" value="paragraph" bind:group={style} /> Short
									paragraph</label
								>
							</div>
						</fieldset>
					</section>
				</div>

				<section class="panel preview" aria-labelledby="preview-title">
					<p class="section-label">ILLUSTRATIVE PREVIEW</p>
					<h2 id="preview-title">See the answer format</h2>
					<p class="helper">
						This is invented policy text for discussing the format. It is not a generated analysis.
					</p>
					<div class="preview-output" aria-live="polite">
						<p class="preview-label">EXAMPLE ANSWER</p>
						{#if style === 'bullets'}
							<ul>
								{#each previewSentences as sentence (sentence)}<li>
										{sentence}
									</li>{/each}
							</ul>
						{:else}
							<p>{previewSentences.join(' ')}</p>
						{/if}
					</div>
					<details>
						<summary>Example source excerpt</summary>
						<blockquote>
							Usage reporting is optional. If enabled, we send usage data to our analytics provider.
							We keep reports for 30 days unless longer retention is required by law.
						</blockquote>
					</details>
					<p class="preview-note">
						Privacy interests above are discussion prompts and do not change this example.
					</p>
				</section>
			</div>
		</div>

		<footer>
			<strong>ClearConsent</strong><span>Preferences study preview</span>
		</footer>
	</div>
</main>

<style>
	.page-frame {
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
	}
	.masthead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 19px 46px;
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
	.back-link {
		color: #d9e8f1;
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
	}
	.back-link:hover {
		color: #70ebe0;
	}
	.hero {
		padding: 43px 46px;
		background: radial-gradient(circle at 90% 10%, #1c4560, #10233d 55%);
		color: white;
	}
	.eyebrow,
	.section-label,
	.preview-label {
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
	}
	.hero > p:last-child {
		max-width: 560px;
		margin: 12px 0 0;
		color: #d1dfeb;
		font-size: 14px;
		line-height: 1.6;
	}
	.content {
		padding: 36px 46px 54px;
	}
	.notice {
		display: flex;
		gap: 12px;
		margin-bottom: 24px;
		padding: 14px 18px;
		border: 1px solid #b9e9e4;
		border-radius: 5px;
		background: #e3f8f4;
		color: #235c66;
		font-size: 13px;
		line-height: 1.5;
	}
	.notice strong {
		flex-shrink: 0;
	}
	.columns {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 0.85fr);
		gap: 24px;
		align-items: start;
	}
	.controls {
		display: grid;
		gap: 24px;
	}
	.panel {
		min-width: 0;
		padding: 27px;
		border: 1px solid #d7e1ea;
		border-radius: 8px;
		background: white;
	}
	.panel h2 {
		margin: 0 0 8px;
		font-size: 25px;
		font-weight: 690;
		letter-spacing: -0.035em;
	}
	.helper {
		margin: 0 0 22px;
		color: #5a6b80;
		font-size: 13px;
		line-height: 1.55;
	}
	.choices {
		display: grid;
		gap: 9px;
	}
	.choice {
		display: flex;
		align-items: center;
		gap: 13px;
		padding: 13px;
		border: 1px solid #d7e1ea;
		border-radius: 5px;
		cursor: pointer;
	}
	.choice:has(input:checked) {
		border-color: #78c9c3;
		background: #f1fbf8;
	}
	.choice span {
		display: grid;
		gap: 3px;
	}
	.choice strong {
		font-size: 13px;
	}
	.choice small {
		color: #66798d;
		font-size: 12px;
	}
	input {
		accent-color: #167f88;
	}
	fieldset {
		margin-top: 24px;
	}
	legend {
		margin-bottom: 10px;
		font-size: 13px;
		font-weight: 750;
	}
	.option-row {
		display: flex;
		flex-wrap: wrap;
		gap: 9px;
	}
	.option-row label {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 10px 12px;
		border: 1px solid #d7e1ea;
		border-radius: 5px;
		font-size: 12px;
		cursor: pointer;
	}
	.option-row label:has(input:checked) {
		border-color: #78c9c3;
		background: #e3f8f4;
		color: #116873;
	}
	.preview {
		border-top: 3px solid #2ca6af;
	}
	.preview-output {
		padding: 22px;
		border: 1px solid #d7e1ea;
		border-radius: 5px;
		background: #f6fafb;
	}
	.preview-label {
		color: #137b80;
	}
	.preview-output p:last-child,
	.preview-output ul {
		margin: 0;
		color: #294456;
		font-size: 14px;
		line-height: 1.65;
	}
	.preview-output ul {
		padding-left: 19px;
		list-style: disc outside;
	}
	.preview-output li::marker {
		color: #167f88;
	}
	.preview-output li + li {
		margin-top: 10px;
	}
	details {
		margin-top: 22px;
		color: #526b7c;
		font-size: 12px;
	}
	summary {
		cursor: pointer;
		font-weight: 750;
	}
	blockquote {
		margin: 12px 0 0;
		padding: 12px 14px;
		border-left: 3px solid #78c9c3;
		background: #f6fafb;
		line-height: 1.6;
	}
	.preview-note {
		margin: 22px 0 0;
		color: #66798d;
		font-size: 11px;
		line-height: 1.5;
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
	a:focus-visible,
	input:focus-visible,
	summary:focus-visible {
		outline: 3px solid #42cabc;
		outline-offset: 3px;
	}
	@media (max-width: 850px) {
		.columns {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 600px) {
		.page-frame {
			padding: 0;
		}
		.masthead,
		.hero,
		footer {
			padding-right: 20px;
			padding-left: 20px;
		}
		.masthead {
			align-items: start;
			flex-direction: column;
			gap: 18px;
		}
		.content {
			padding: 24px 16px 40px;
		}
		.panel {
			padding: 20px;
		}
		.notice {
			flex-direction: column;
			gap: 4px;
		}
		footer {
			flex-direction: column;
		}
	}
</style>
