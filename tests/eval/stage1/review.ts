import type { Stage1EvalCase } from './eval-config';
import { reviewCandidates, scoreCase } from './score';
import type { QuoteStatus, ReviewCandidate, Stage1EvalRecord } from './score';

const STATUS_LABEL: Record<QuoteStatus, string> = {
	exact: '✅ exact',
	normalized:
		'✅ matched ignoring line breaks, spaces, or quote marks (shown as the policy writes it)',
	ellipsis: '✅ one piece of a quote the model joined with "..."',
	unverified: '⚠️ unverified: not found in the policy; never shown as a quote',
	unchecked: '⛔ not checked: the candidate was dropped as malformed'
};

const blockquote = (text: string) =>
	text
		.split('\n')
		.map((line) => (line ? `> ${line}` : '>'))
		.join('\n');

const list = (values: string[]) => (values.length ? values.join('; ') : '—');

function candidateSection(candidate: ReviewCandidate): string {
	const { fields } = candidate;
	const state = !candidate.kept
		? 'dropped'
		: candidate.supported
			? 'kept'
			: 'kept, no verified quote (hidden from users)';
	const heading = `#### ${candidate.position}. ${candidate.id ?? ''}${candidate.id ? ' · ' : ''}${state} · ${fields.category} / ${fields.practice}`;
	const quotes = candidate.quotes.map((quote) => {
		const range =
			quote.startOffset === null ? '' : ` · characters ${quote.startOffset}–${quote.endOffset}`;
		const reason = quote.reason ? `\n\n  _${quote.reason}_` : '';
		return `- ${STATUS_LABEL[quote.status]} · ${quote.passageId}${range}${reason}\n\n${blockquote(quote.excerpt)}`;
	});

	return [
		heading,
		...(candidate.reason ? [`_Pipeline reason: ${candidate.reason}_`] : []),
		`**Claim:** ${fields.claim}`,
		`**Explanation:** ${fields.explanation}`,
		`**Qualifiers:** ${list(fields.qualifiers)}`,
		`**Uncertainty:** ${fields.uncertainty ?? '—'}`,
		`**Data:** ${list(fields.dataCategories)} · **Purposes:** ${list(fields.purposes)} · **Recipients:** ${list(fields.recipients)}`,
		'**Evidence:**',
		...quotes,
		'**Review:**',
		'- [ ] The quote supports the claim',
		'- [ ] Conditions, exceptions, and denials are kept',
		'- [ ] Nothing is overstated or invented',
		'- Notes:'
	].join('\n\n');
}

function caseSection(record: Stage1EvalRecord, testCase: Stage1EvalCase | undefined): string {
	const score = scoreCase(record, testCase);
	const candidates = reviewCandidates(record);
	const run = [
		`${record.sourceLength.toLocaleString('en-US')} characters, ${record.passageCount} passages`,
		`${(record.durationMs / 1000).toFixed(1)} s`,
		record.usage
			? `${record.usage.inputTokens} in / ${record.usage.outputTokens} out (${record.usage.reasoningTokens} reasoning) tokens`
			: 'no usage recorded',
		`≈ $${record.estimatedCostUsd.toFixed(5)}`,
		`commit ${record.commit}${record.replayedFrom ? ` (model output from ${record.replayedFrom}, replayed)` : ''}`
	].join(' · ');

	const labels = testCase?.expectedFindings;
	const expected =
		labels && record.outcome !== 'failed'
			? [
					'**Expected findings (draft labels):**',
					labels
						.map(
							(finding) =>
								`- ${score.missed.includes(finding.summary) ? '✗ missed' : '✓ covered'}: ${finding.summary}`
						)
						.join('\n')
				]
			: [];

	return [
		`### ${record.caseId}`,
		`**Outcome:** ${record.errorCode ? `failed (${record.errorCode}): ${record.errorMessage}` : record.outcome} · ${score.candidates} kept (${score.unsupported} with no verified quote), ${score.rejected} dropped`,
		run,
		...expected,
		...candidates.map(candidateSection)
	].join('\n\n');
}

// A Markdown file for people to read every candidate and score it by hand.
export function formatReview(
	records: Stage1EvalRecord[],
	cases: Stage1EvalCase[],
	sources: string[]
): string {
	const byId = new Map(cases.map((testCase) => [testCase.id, testCase]));
	const scores = records.map((record) => scoreCase(record, byId.get(record.caseId)));
	const settings = [
		...new Set(records.map((record) => `${record.model} · ${record.reasoningEffort}`))
	];

	const summary = [
		'| Case | Outcome | Kept | No verified quote | Dropped | Unverified quotes | Coverage | Time |',
		'| --- | --- | ---: | ---: | ---: | ---: | --- | ---: |',
		...scores.map(
			(score) =>
				`| ${score.caseId} | ${score.errorCode ? `failed: ${score.errorCode}` : score.outcome} | ${score.candidates} | ${score.unsupported} | ${score.rejected} | ${score.quotes.unverified} | ${score.expected === null ? '—' : `${score.covered}/${score.expected}`} | ${(score.durationMs / 1000).toFixed(1)} s |`
		)
	].join('\n');

	return [
		'# Stage 1 eval review',
		`Results: ${sources.map((source) => `\`${source}\``).join(', ')} · ${settings.join(', ')}`,
		'Read each candidate, compare its quote with the claim, and tick the review boxes. Quote status:',
		Object.values(STATUS_LABEL)
			.map((label) => `- ${label}`)
			.join('\n'),
		'These labels come from the pipeline itself. Every ✅ excerpt is copied from the policy text, never from the model.',
		'## Summary',
		summary,
		'## Cases',
		...records.map((record) => caseSection(record, byId.get(record.caseId)))
	].join('\n\n');
}
