<script lang="ts">
	import type { AnalysisResult, AttentionLabel } from '$lib/contracts/analysis';

	let {
		result,
		detail = 'detailed'
	}: { result: AnalysisResult; detail?: 'quick' | 'balanced' | 'detailed' } = $props();

	const attentionLabels: Record<AttentionLabel, string> = {
		positive: 'Helpful control',
		worth_knowing: 'Worth knowing',
		higher_concern: 'Closer look',
		unclear: 'Unclear wording'
	};
</script>

{#if result.status === 'failed'}
	<div class="result-state" role="status">
		<h2>We couldn't analyze this policy</h2>
		<p>Please try again.</p>
	</div>
{:else if result.status === 'insufficient'}
	<div class="result-state" role="status">
		<h2>There isn't enough information for a result</h2>
		<p>{result.reason}</p>
	</div>
{:else if result.status === 'in_progress'}
	<div class="result-state" role="status">
		<h2>Analysis in progress</h2>
		<p>We're processing the policy.</p>
	</div>
{:else}
	<div class="analysis-result">
		<section class="summary-card" aria-labelledby="result-summary-title">
			<p class="eyebrow">01 / OVERVIEW</p>
			<h2 id="result-summary-title">What this policy says</h2>
			<p>{result.summary}</p>
		</section>

		<section class="takeaways-section" aria-labelledby="takeaways-title">
			<div class="section-heading">
				<div>
					<p class="eyebrow">02 / KEY POINTS</p>
					<h2 id="takeaways-title">Key takeaways</h2>
				</div>
				<p>Each point links back to wording in the policy.</p>
			</div>

			<div class="takeaway-list">
				{#each result.takeaways as takeaway, index (takeaway.id)}
					{@const linked = result.findings.filter((finding) =>
						takeaway.findingIds.includes(finding.id)
					)}
					{@const quoteCount = linked.reduce(
						(count, finding) => count + finding.evidence.length,
						0
					)}
					<article class="takeaway-card">
						<div class="takeaway-header">
							<div>
								<p class="item-number">POINT 0{index + 1}</p>
								<h3>{takeaway.topic}</h3>
							</div>
							<span
								class="attention-tag"
								class:positive={takeaway.label === 'positive'}
								class:concern={takeaway.label === 'higher_concern'}
								class:unclear={takeaway.label === 'unclear'}>{attentionLabels[takeaway.label]}</span
							>
						</div>
						<p class="takeaway-reason">{takeaway.reason}</p>

						{#if detail !== 'quick'}
							<div class="findings">
								{#each linked as finding (finding.id)}
									<div class="finding">
										<p>{finding.plain_language_description}</p>
										{#if finding.dataCategories.length || finding.purposes.length || finding.recipients.length}
											<dl>
												{#if finding.dataCategories.length}
													<div>
														<dt>Data</dt>
														<dd>{finding.dataCategories.join(', ')}</dd>
													</div>
												{/if}
												{#if finding.purposes.length}
													<div>
														<dt>Purpose</dt>
														<dd>{finding.purposes.join(', ')}</dd>
													</div>
												{/if}
												{#if finding.recipients.length}
													<div>
														<dt>Recipients</dt>
														<dd>{finding.recipients.join(', ')}</dd>
													</div>
												{/if}
											</dl>
										{/if}
									</div>
								{/each}
							</div>
						{/if}

						<details class="evidence" open={detail === 'detailed'}>
							<summary>Policy excerpts <span>{quoteCount}</span></summary>
							<div class="quotes">
								{#each linked as finding (finding.id)}
									{#each finding.evidence as item, quoteIndex (quoteIndex)}
										<blockquote>{item.excerpt}</blockquote>
									{/each}
								{/each}
							</div>
						</details>
					</article>
				{/each}
			</div>
		</section>
	</div>
{/if}

<style>
	.analysis-result {
		display: grid;
		gap: 28px;
		color: #17263a;
	}
	.summary-card {
		padding: 25px 28px;
		border: 1px solid #c9e0e4;
		border-left: 4px solid #168a92;
		border-radius: 8px;
		background: #f4fafb;
	}
	.eyebrow,
	.item-number {
		margin: 0 0 8px;
		color: #0c737b;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.14em;
	}
	.summary-card h2,
	.section-heading h2 {
		margin: 0;
		font-size: 24px;
		letter-spacing: -0.035em;
		line-height: 1.2;
	}
	.summary-card > p:last-child {
		max-width: 72ch;
		margin: 14px 0 0;
		font-size: 15px;
		line-height: 1.7;
	}
	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
		margin-bottom: 16px;
	}
	.section-heading > p {
		max-width: 28ch;
		margin: 0;
		color: #607488;
		font-size: 12px;
		line-height: 1.5;
	}
	.takeaway-list {
		display: grid;
		gap: 14px;
	}
	.takeaway-card {
		padding: 22px 24px;
		border: 1px solid #d6e2e9;
		border-radius: 8px;
		background: white;
		box-shadow: 0 4px 12px #132c4209;
	}
	.takeaway-header {
		display: flex;
		align-items: start;
		justify-content: space-between;
		gap: 14px;
	}
	.takeaway-header h3 {
		margin: 0;
		font-size: 19px;
		letter-spacing: -0.025em;
	}
	.attention-tag {
		flex: 0 0 auto;
		padding: 6px 9px;
		border-radius: 4px;
		background: #e9f3f6;
		color: #275f6c;
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.03em;
	}
	.attention-tag.positive {
		background: #e6f5ed;
		color: #226646;
	}
	.attention-tag.concern {
		background: #fff0dd;
		color: #855318;
	}
	.attention-tag.unclear {
		background: #f2ecfa;
		color: #674897;
	}
	.takeaway-reason {
		max-width: 75ch;
		margin: 14px 0 0;
		color: #354c5d;
		font-size: 14px;
		line-height: 1.65;
	}
	.findings {
		display: grid;
		gap: 12px;
		margin-top: 18px;
		padding-top: 17px;
		border-top: 1px solid #e1e9ed;
	}
	.finding {
		padding-left: 14px;
		border-left: 3px solid #b5d7d8;
	}
	.finding > p {
		margin: 0;
		font-size: 13px;
		font-weight: 650;
		line-height: 1.55;
	}
	.finding dl {
		display: grid;
		gap: 4px;
		margin: 9px 0 0;
		font-size: 12px;
		line-height: 1.5;
	}
	.finding dl > div {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.finding dt {
		color: #6a7c8d;
		font-weight: 750;
	}
	.finding dt::after {
		content: ':';
	}
	.finding dd {
		margin: 0;
		color: #3c5566;
	}
	.evidence {
		margin-top: 19px;
		padding-top: 15px;
		border-top: 1px solid #e1e9ed;
	}
	.evidence summary {
		width: fit-content;
		color: #0c6871;
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
	}
	.evidence summary span {
		margin-left: 4px;
		padding: 2px 6px;
		border-radius: 10px;
		background: #e4f3f2;
	}
	.quotes {
		display: grid;
		gap: 9px;
		margin-top: 14px;
	}
	.quotes blockquote {
		margin: 0;
		padding: 10px 14px;
		border-left: 3px solid #73c6c5;
		border-radius: 0 5px 5px 0;
		background: #f6fafb;
		color: #365264;
		font-size: 12px;
		line-height: 1.6;
	}
	.result-state {
		padding: 22px;
		border: 1px solid #d6e2e9;
		border-radius: 8px;
		background: #f6fafb;
	}
	.result-state h2 {
		margin: 0 0 6px;
		font-size: 18px;
	}
	.result-state p {
		margin: 0;
	}
	@media (max-width: 600px) {
		.summary-card,
		.takeaway-card {
			padding: 18px;
		}
		.section-heading,
		.takeaway-header {
			align-items: start;
			flex-direction: column;
		}
	}
</style>
