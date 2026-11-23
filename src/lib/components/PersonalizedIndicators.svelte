<script lang="ts">
	import type { Personalization } from '$lib/analysis-run';
	import type { Finding, FindingCategory } from '$lib/contracts/analysis';
	import type {
		Indicator,
		PreferenceEvaluation,
		ProfileId,
		Tier
	} from '$lib/contracts/preferences';

	// Personalized indicators for a saved analysis (FR-9, #101)
	// Everything shown comes from the saved evaluation (#107)
	// this component only presents it
	let { personalization, findings }: { personalization: Personalization; findings: Finding[] } =
		$props();

	type ReviewReason = PreferenceEvaluation['needsReview'][number]['reason'];

	// Each verdict has a text label and a symbol
	const VERDICTS: Record<Indicator, { label: string; symbol: string }> = {
		conflict: { label: 'Conflict', symbol: '!' },
		alignment: { label: 'Fits your preferences', symbol: '✓' },
		insufficient_evidence: { label: 'Not enough evidence', symbol: '?' }
	};

	// Same topic names as the key takeaways (src/lib/server/analysis.ts)
	const CONCERNS: Record<FindingCategory, string> = {
		collection: 'Information collection',
		use: 'How data is used',
		sharing: 'Data sharing',
		retention: 'Data retention',
		user_rights: 'Your rights',
		security_practices: 'Security practices'
	};

	const TIERS: Record<Tier, string> = {
		routine: 'Routine',
		notable: 'Notable',
		serious: 'Serious'
	};

	const PROFILES: Record<ProfileId, string> = {
		balanced: 'Balanced',
		strict: 'Strict',
		relaxed: 'Relaxed'
	};

	const REVIEW_REASONS: Record<ReviewReason, string> = {
		ambiguous: 'The wording is unclear.',
		missing_effect: "It isn't clear whether this protects or exposes your data."
	};

	// Indicators and review entries refer to findings by their saved ID.
	const findingsById = $derived(new Map(findings.map((finding) => [finding.id, finding])));
</script>

<section class="indicators" aria-labelledby="indicators-title">
	<div class="section-heading">
		<div>
			<p class="eyebrow">03 / YOUR PREFERENCES</p>
			<h2 id="indicators-title">How this fits your preferences</h2>
		</div>
		<p>Each topic is checked against your privacy profile.</p>
	</div>

	{#if personalization.status === 'ready'}
		{@const evaluation = personalization.evaluation}

		<div class="summary">
			<p class="summary-text">{evaluation.summary}</p>
			<p class="profile-note">
				Compared with your {PROFILES[evaluation.profile.id]} profile when this analysis was saved.
			</p>
		</div>

		<!-- Already in display order: most important first -->
		<ol class="indicator-list" aria-label="Preference results">
			{#each evaluation.indicators as item (item.concern)}
				{@const finding = item.findingId ? findingsById.get(item.findingId) : undefined}
				<li class="indicator-card">
					<div class="indicator-header">
						<h3>{CONCERNS[item.concern]}</h3>
						<div class="tags">
							<span
								class="verdict"
								class:conflict={item.indicator === 'conflict'}
								class:alignment={item.indicator === 'alignment'}
								class:insufficient={item.indicator === 'insufficient_evidence'}
							>
								<span class="symbol" aria-hidden="true">{VERDICTS[item.indicator].symbol}</span>
								<span>{VERDICTS[item.indicator].label}</span>
							</span>
							{#if item.tier}
								<span class="tier">Severity: {TIERS[item.tier]}</span>
							{/if}
						</div>
					</div>

					<p class="explanation">{item.explanation}</p>

					{#if finding}
						<details class="evidence">
							<summary>Related policy wording</summary>
							<div class="quotes">
								<p class="finding-text">{finding.plain_language_description}</p>
								{#each finding.evidence as quote, index (index)}
									<blockquote>{quote.excerpt}</blockquote>
								{/each}
							</div>
						</details>
					{/if}
				</li>
			{/each}
		</ol>

		{#if evaluation.needsReview.length > 0}
			<div class="review">
				<h3 id="review-title">Needs review</h3>
				<p class="review-intro">
					These passages weren't used for the results above because they couldn't be read reliably.
					Review them yourself.
				</p>
				<ul class="review-list" aria-labelledby="review-title">
					{#each evaluation.needsReview as entry (entry.findingId)}
						{@const finding = findingsById.get(entry.findingId)}
						<li>
							<p class="finding-text">
								{finding?.plain_language_description ?? 'A passage from this policy'}
							</p>
							<p class="review-reason">{REVIEW_REASONS[entry.reason]}</p>
							{#if finding}
								{#each finding.evidence as quote, index (index)}
									<blockquote>{quote.excerpt}</blockquote>
								{/each}
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	{:else if personalization.status === 'not_saved'}
		<p class="state-note" role="note">
			Personalized results aren't available for this analysis because it was saved before they were
			added. The findings above still apply.
		</p>
	{:else}
		<p class="state-note" role="note">
			Personalized results couldn't be loaded right now. The findings above are not affected. Try
			reloading the page.
		</p>
	{/if}

	<p class="legal-note">
		These results compare the policy with your privacy preferences. They are not legal advice.
	</p>
</section>

<style>
	.indicators {
		color: #17263a;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 16px;
	}
	.section-heading h2 {
		margin: 0;
		font-size: 24px;
		letter-spacing: -0.035em;
		line-height: 1.2;
	}
	.section-heading > p {
		max-width: 28ch;
		margin: 0;
		color: #607488;
		font-size: 12px;
		line-height: 1.5;
	}
	.eyebrow {
		margin: 0 0 8px;
		color: #0c737b;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.14em;
	}
	.summary {
		margin-bottom: 14px;
		padding: 18px 22px;
		border: 1px solid #c9e0e4;
		border-left: 4px solid #168a92;
		border-radius: 8px;
		background: #f4fafb;
	}
	.summary-text {
		margin: 0;
		font-size: 15px;
		font-weight: 650;
		line-height: 1.6;
	}
	.profile-note {
		margin: 8px 0 0;
		color: #607488;
		font-size: 12px;
	}
	.indicator-list,
	.review-list {
		display: grid;
		gap: 12px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.indicator-card {
		padding: 18px 22px;
		border: 1px solid #d6e2e9;
		border-radius: 8px;
		background: white;
		box-shadow: 0 4px 12px #132c4209;
	}
	.indicator-header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 14px;
	}
	.indicator-header h3 {
		margin: 0;
		font-size: 17px;
		letter-spacing: -0.02em;
	}
	.tags {
		display: flex;
		flex-wrap: wrap;
		justify-content: end;
		gap: 6px;
	}
	.verdict,
	.tier {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 5px 9px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 800;
	}
	.verdict {
		border: 1px solid currentColor;
	}
	.verdict.conflict {
		background: #fff0dd;
		color: #855318;
	}
	.verdict.alignment {
		background: #e6f5ed;
		color: #226646;
	}
	.verdict.insufficient {
		background: #f2ecfa;
		color: #674897;
	}
	.tier {
		background: #e9f3f6;
		color: #275f6c;
	}
	.explanation {
		max-width: 75ch;
		margin: 12px 0 0;
		color: #354c5d;
		font-size: 14px;
		line-height: 1.6;
	}
	.evidence {
		margin-top: 14px;
		padding-top: 12px;
		border-top: 1px solid #e1e9ed;
	}
	.evidence summary {
		width: fit-content;
		color: #0c6871;
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
	}
	.quotes {
		display: grid;
		gap: 9px;
		margin-top: 12px;
	}
	.finding-text {
		margin: 0;
		font-size: 13px;
		font-weight: 650;
		line-height: 1.55;
	}
	blockquote {
		margin: 0;
		padding: 10px 14px;
		border-left: 3px solid #73c6c5;
		border-radius: 0 5px 5px 0;
		background: #f6fafb;
		color: #365264;
		font-size: 12px;
		line-height: 1.6;
	}
	.review {
		margin-top: 20px;
		padding: 18px 22px;
		border: 1px dashed #c3ccd6;
		border-radius: 8px;
		background: #fafbfc;
	}
	.review h3 {
		margin: 0;
		font-size: 16px;
	}
	.review-intro,
	.review-reason {
		margin: 6px 0 0;
		color: #5a6b80;
		font-size: 12px;
		line-height: 1.5;
	}
	.review-list {
		margin-top: 14px;
	}
	.review-list blockquote {
		margin-top: 8px;
	}
	.state-note,
	.legal-note {
		margin: 0;
		color: #3b5968;
		font-size: 12px;
		line-height: 1.55;
	}
	.state-note {
		padding: 13px 16px;
		border-left: 3px solid #3aa5a8;
		border-radius: 0 5px 5px 0;
		background: #f2f8f9;
	}
	.legal-note {
		margin-top: 14px;
		color: #607488;
	}
	@media (max-width: 600px) {
		.section-heading,
		.indicator-header {
			align-items: start;
			flex-direction: column;
		}
		.tags {
			justify-content: start;
		}
	}
</style>
