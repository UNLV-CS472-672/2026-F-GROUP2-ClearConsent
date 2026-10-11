import type {
	ModelCandidate,
	ProviderUsage,
	RejectedCandidate,
	ValidatedCandidate,
	ValidatedEvidence
} from '../../../src/lib/server/analysis/schemas';
import type { Stage1EvalCase } from './eval-config';

export type Stage1EvalRecord = {
	caseId: string;
	group: Stage1EvalCase['group'];
	mode: 'run' | 'mock';
	commit: string;
	// Set when the record was rebuilt by replaying saved provider output through newer code.
	replayedFrom?: string;
	model: string;
	reasoningEffort: string;
	timeoutMs: number;
	maxOutputTokens: number;
	startedAt: string;
	durationMs: number;
	sourceLength: number;
	passageCount: number;
	outcome: 'complete' | 'partial' | 'no_candidates' | 'failed';
	errorCode: string | null;
	errorMessage: string | null;
	candidates: ValidatedCandidate[];
	rejectedCandidates: RejectedCandidate[];
	// The provider's unvalidated output, kept so a run can be replayed and reviewed.
	rawOutput: unknown;
	usage: ProviderUsage | null;
	estimatedCostUsd: number;
};

// Records saved before evidence carried a status only ever kept exact matches.
export function upgradeRecord(record: Stage1EvalRecord): Stage1EvalRecord {
	return {
		...record,
		candidates: record.candidates.map((candidate) => ({
			...candidate,
			evidence: candidate.evidence.map((evidence) =>
				'status' in evidence
					? evidence
					: ({ status: 'verified', match: 'exact', ...(evidence as object) } as ValidatedEvidence)
			)
		}))
	};
}

// The pipeline's label for each quote, plus "unchecked" for quotes in a candidate dropped as
// malformed before its evidence was resolved.
export type QuoteStatus = 'exact' | 'normalized' | 'ellipsis' | 'unverified' | 'unchecked';

export type QuoteCounts = Record<QuoteStatus, number> & { total: number };

export type CaseScore = {
	caseId: string;
	group: Stage1EvalCase['group'];
	outcome: Stage1EvalRecord['outcome'];
	errorCode: string | null;
	candidates: number;
	// Kept candidates without a single verified quote. A later stage must not present them.
	unsupported: number;
	rejected: number;
	// Expected findings whose labeled evidence overlaps at least one verified evidence range.
	covered: number | null;
	expected: number | null;
	missed: string[];
	durationMs: number;
	timeoutShare: number;
	outputTokens: number | null;
	reasoningTokens: number | null;
	outputCapShare: number | null;
	costUsd: number;
	quotes: QuoteCounts;
};

export type ReviewQuote = {
	passageId: string;
	excerpt: string;
	status: QuoteStatus;
	reason: string | null;
	startOffset: number | null;
	endOffset: number | null;
};

export type ReviewCandidate = {
	// Position in the model's output, starting at 1.
	position: number;
	id: string | null;
	kept: boolean;
	// True when at least one quote verified, so a later stage may present the candidate.
	supported: boolean;
	reason: string | null;
	fields: Omit<ModelCandidate, 'evidence'>;
	quotes: ReviewQuote[];
};

type RawOutput = { candidates?: ModelCandidate[] } | null;

function reviewQuote(evidence: ValidatedEvidence): ReviewQuote {
	return evidence.status === 'verified'
		? {
				passageId: evidence.passageId,
				excerpt: evidence.excerpt,
				status: evidence.match,
				reason: null,
				startOffset: evidence.startOffset,
				endOffset: evidence.endOffset
			}
		: {
				passageId: evidence.passageId,
				excerpt: evidence.excerpt,
				status: 'unverified',
				reason: evidence.reason,
				startOffset: null,
				endOffset: null
			};
}

// Lines up the model's raw candidates with what the pipeline kept, labeled, or dropped.
export function reviewCandidates(record: Stage1EvalRecord): ReviewCandidate[] {
	const raw = (record.rawOutput as RawOutput)?.candidates ?? [];
	const rejected = new Map(record.rejectedCandidates.map((item) => [item.index, item]));
	let keptIndex = 0;

	return raw.map((candidate, index) => {
		const { evidence, ...fields } = candidate;
		const drop = rejected.get(index);
		if (!drop) {
			const quotes = (record.candidates[keptIndex]?.evidence ?? []).map(reviewQuote);
			return {
				position: index + 1,
				id: record.candidates[keptIndex++]?.id ?? null,
				kept: true,
				supported: quotes.some((quote) => quote.status !== 'unverified'),
				reason: null,
				fields,
				quotes
			};
		}
		return {
			position: index + 1,
			id: null,
			kept: false,
			supported: false,
			reason: drop.reason,
			fields,
			quotes: evidence.map((item) => ({
				passageId: item.passageId,
				excerpt: item.excerpt,
				status: 'unchecked' as const,
				reason: null,
				startOffset: null,
				endOffset: null
			}))
		};
	});
}

export function countQuotes(candidates: ReviewCandidate[]): QuoteCounts {
	const counts: QuoteCounts = {
		total: 0,
		exact: 0,
		normalized: 0,
		ellipsis: 0,
		unverified: 0,
		unchecked: 0
	};
	for (const quote of candidates.flatMap((candidate) => candidate.quotes)) {
		counts.total += 1;
		counts[quote.status] += 1;
	}
	return counts;
}

function overlaps(start: number, end: number, otherStart: number, otherEnd: number): boolean {
	return start < otherEnd && otherStart < end;
}

export function scoreCase(
	record: Stage1EvalRecord,
	testCase: Stage1EvalCase | undefined
): CaseScore {
	const ranges = record.candidates.flatMap((candidate) =>
		candidate.evidence.flatMap((evidence) =>
			evidence.status === 'verified' ? [[evidence.startOffset, evidence.endOffset] as const] : []
		)
	);
	const labels = testCase?.expectedFindings ?? null;
	const missed: string[] = [];
	let covered: number | null = null;
	if (labels && record.outcome !== 'failed') {
		covered = 0;
		for (const finding of labels) {
			const start = testCase!.policyText.indexOf(finding.evidence);
			const end = start + finding.evidence.length;
			if (start !== -1 && ranges.some(([from, to]) => overlaps(start, end, from, to))) {
				covered += 1;
			} else {
				missed.push(finding.summary);
			}
		}
	}

	return {
		caseId: record.caseId,
		group: record.group,
		outcome: record.outcome,
		errorCode: record.errorCode,
		candidates: record.candidates.length,
		unsupported: record.candidates.filter(
			(candidate) => !candidate.evidence.some((evidence) => evidence.status === 'verified')
		).length,
		rejected: record.rejectedCandidates.length,
		covered,
		expected: labels && record.outcome !== 'failed' ? labels.length : null,
		missed,
		durationMs: record.durationMs,
		timeoutShare: record.durationMs / record.timeoutMs,
		outputTokens: record.usage?.outputTokens ?? null,
		reasoningTokens: record.usage?.reasoningTokens ?? null,
		outputCapShare: record.usage ? record.usage.outputTokens / record.maxOutputTokens : null,
		costUsd: record.estimatedCostUsd,
		quotes: countQuotes(reviewCandidates(record))
	};
}

const percent = (value: number) => `${(value * 100).toFixed(0)}%`;

export function formatReport(scores: CaseScore[]): string {
	const rows = scores.map((score) =>
		[
			score.caseId,
			score.errorCode ? `failed: ${score.errorCode}` : score.outcome,
			String(score.candidates),
			String(score.unsupported),
			String(score.rejected),
			score.expected === null ? '-' : `${score.covered}/${score.expected}`,
			`${(score.durationMs / 1000).toFixed(1)}s (${percent(score.timeoutShare)})`,
			score.outputTokens === null
				? '-'
				: `${score.outputTokens} / ${score.reasoningTokens} (${percent(score.outputCapShare!)})`,
			`$${score.costUsd.toFixed(5)}`
		].join(' | ')
	);

	const sum = (pick: (score: CaseScore) => number) =>
		scores.reduce((total, score) => total + pick(score), 0);
	const totalCandidates = sum((score) => score.candidates + score.rejected);
	const coverage = (group: CaseScore['group']) => {
		const scored = scores.filter((score) => score.group === group && score.expected !== null);
		const covered = scored.reduce((total, score) => total + (score.covered ?? 0), 0);
		const expected = scored.reduce((total, score) => total + (score.expected ?? 0), 0);
		return expected ? `${covered}/${expected} (${percent(covered / expected)})` : 'n/a';
	};
	const outcomes = new Map<string, number>();
	for (const score of scores) {
		const key = score.errorCode ? `failed: ${score.errorCode}` : score.outcome;
		outcomes.set(key, (outcomes.get(key) ?? 0) + 1);
	}
	const slowest = scores.reduce((max, score) =>
		score.timeoutShare > max.timeoutShare ? score : max
	);
	const largest = scores
		.filter((score) => score.outputCapShare !== null)
		.reduce<CaseScore | null>(
			(max, score) => (!max || score.outputCapShare! > max.outputCapShare! ? score : max),
			null
		);

	const quotes = countQuotes([]);
	for (const score of scores) {
		for (const key of Object.keys(quotes) as (keyof QuoteCounts)[])
			quotes[key] += score.quotes[key];
	}
	const quoteLine =
		`Quotes: ${quotes.exact} exact, ${quotes.normalized} matched ignoring whitespace or quote marks, ` +
		`${quotes.ellipsis} pieces of "..." quotes, ${quotes.unverified} unverified` +
		(quotes.unchecked ? `, ${quotes.unchecked} unchecked in dropped candidates` : '') +
		'.';

	const missedLines = scores
		.filter((score) => score.missed.length > 0)
		.map((score) => `  ${score.caseId}: ${score.missed.join(' | ')}`);

	return [
		'case | outcome | kept | no verified quote | dropped | coverage | time (of timeout) | output / reasoning tokens (of cap) | cost',
		...rows,
		'',
		`Outcomes: ${[...outcomes].map(([key, count]) => `${key} ${count}`).join(', ')}`,
		`Candidates: ${totalCandidates} returned; ${sum((score) => score.candidates - score.unsupported)} with a verified quote, ` +
			`${sum((score) => score.unsupported)} without, ${sum((score) => score.rejected)} dropped as malformed`,
		quoteLine,
		`Coverage proxy, synthetic: ${coverage('synthetic')}; archived: ${coverage('archived')}`,
		`Slowest: ${slowest.caseId} at ${(slowest.durationMs / 1000).toFixed(1)}s (${percent(slowest.timeoutShare)} of timeout)`,
		largest
			? `Most output: ${largest.caseId} at ${largest.outputTokens} tokens (${percent(largest.outputCapShare!)} of cap)`
			: 'Most output: n/a',
		`Estimated cost: $${sum((score) => score.costUsd).toFixed(5)}`,
		...(missedLines.length ? ['', 'Missed expected findings:', ...missedLines] : [])
	].join('\n');
}
