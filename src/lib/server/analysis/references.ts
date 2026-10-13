import { Stage1Error, isStage1Error } from './errors';
import { ModelStage1ResponseSchema } from './schemas';
import type {
	ModelCandidate,
	RejectedCandidate,
	SourceSnapshot,
	ValidatedCandidate,
	ValidatedEvidence,
	VerifiedEvidence
} from './schemas';
import { validateSourceSnapshot } from './source';

export const MIN_EVIDENCE_LENGTH = 12;

function requireNonblank(value: string, field: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Stage1Error('provider_malformed', 502, `The provider returned a blank ${field}.`);
	}
	return trimmed;
}

function normalizeStringList(values: string[], field: string): string[] {
	const normalized = values.map((value) => requireNonblank(value, field));
	return [...new Set(normalized)];
}

type SourceIndex = {
	passages: Map<string, SourceSnapshot['passages'][number]>;
	// The full frozen text; passages are contiguous, so this is their concatenation.
	text: string;
	normalized: NormalizedText;
};

type Passage = SourceSnapshot['passages'][number];
type Span = { startOffset: number; endOffset: number };

// Characters the model routinely rewrites without changing meaning. Words, numbers, and other
// punctuation must still match exactly, so a changed "not", "may", or "30" is never accepted.
const EQUIVALENT_CHARACTERS: Record<string, string> = {
	'\u2018': "'",
	'\u2019': "'",
	'\u201A': "'",
	'\u201B': "'",
	'\u201C': '"',
	'\u201D': '"',
	'\u201E': '"',
	'\u201F': '"',
	'\u2010': '-',
	'\u2011': '-',
	'\u2012': '-',
	'\u2013': '-',
	'\u2014': '-',
	'\u2212': '-',
	'\u2026': '...'
};

type NormalizedText = {
	text: string;
	// Source offset of each normalized character, used to map a match back to the source.
	sourceOffsets: number[];
};

// Collapses every whitespace run to one space and maps equivalent characters.
function normalize(value: string): NormalizedText {
	let text = '';
	const sourceOffsets: number[] = [];
	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (/\s/.test(character)) {
			if (text.endsWith(' ')) continue;
			text += ' ';
			sourceOffsets.push(index);
			continue;
		}
		const replacement = EQUIVALENT_CHARACTERS[character] ?? character;
		text += replacement;
		for (let count = 0; count < replacement.length; count += 1) sourceOffsets.push(index);
	}
	return { text, sourceOffsets };
}

// Passage boundaries are arbitrary cuts, so a quote may run into a neighboring passage. Accept
// any occurrence that overlaps the cited passage.
function occurrencesNear(
	haystack: string,
	needle: string,
	toSpan: (index: number) => Span,
	passage: Passage
): Span[] {
	const spans: Span[] = [];
	for (
		let index = haystack.indexOf(needle);
		index !== -1;
		index = haystack.indexOf(needle, index + 1)
	) {
		const span = toSpan(index);
		if (span.startOffset < passage.endOffset && passage.startOffset < span.endOffset) {
			spans.push(span);
		}
	}
	return spans;
}

type Located = { span: Span; match: 'exact' | 'normalized' } | { reason: string };

// Finds the one place a quote occurs in or next to its passage: verbatim first, then ignoring
// whitespace and quote-mark differences. Repeated text cannot be placed, so it does not verify.
function locate(source: SourceIndex, passage: Passage, excerpt: string): Located {
	const exact = occurrencesNear(
		source.text,
		excerpt,
		(index) => ({ startOffset: index, endOffset: index + excerpt.length }),
		passage
	);
	if (exact.length === 1) return { span: exact[0], match: 'exact' };
	if (exact.length > 1) return { reason: `occurs more than once in or next to ${passage.id}` };

	const needle = normalize(excerpt).text.trim();
	const { text, sourceOffsets } = source.normalized;
	const normalized = occurrencesNear(
		text,
		needle,
		(index) => ({
			startOffset: sourceOffsets[index],
			endOffset: sourceOffsets[index + needle.length - 1] + 1
		}),
		passage
	);
	if (normalized.length === 1) return { span: normalized[0], match: 'normalized' };
	if (normalized.length > 1) {
		return { reason: `occurs more than once in or next to ${passage.id}` };
	}
	return {
		reason: `was not found in or across the edges of ${passage.id}, even ignoring whitespace and quote marks`
	};
}

const ELLIPSIS = /\.{3}|\u2026/;

function resolveEvidence(
	source: SourceIndex,
	passageId: string,
	excerpt: string
): ValidatedEvidence[] {
	const normalizedPassageId = requireNonblank(passageId, 'passage ID');
	const unverified = (reason: string): ValidatedEvidence[] => [
		{ status: 'unverified', passageId: normalizedPassageId, excerpt, reason }
	];

	if (excerpt.trim().length < MIN_EVIDENCE_LENGTH) {
		return unverified('The excerpt is blank or too short to preserve context.');
	}
	const passage = source.passages.get(normalizedPassageId);
	if (!passage) {
		return unverified(`The excerpt cites unknown passage ${normalizedPassageId}.`);
	}

	const verified = (span: Span, match: VerifiedEvidence['match']): VerifiedEvidence => ({
		status: 'verified',
		match,
		passageId: normalizedPassageId,
		excerpt: source.text.slice(span.startOffset, span.endOffset),
		...span
	});

	const whole = locate(source, passage, excerpt);
	if ('span' in whole) return [verified(whole.span, whole.match)];

	// A quote shortened with "..." verifies as separate excerpts when every piece is long enough
	// to place, occurs once near the passage, and appears in the quoted order.
	const pieces = excerpt
		.split(ELLIPSIS)
		.map((piece) => piece.trim())
		.filter(Boolean);
	if (pieces.length > 1) {
		const spans: Span[] = [];
		for (const piece of pieces) {
			const located = piece.length >= MIN_EVIDENCE_LENGTH ? locate(source, passage, piece) : null;
			if (!located || !('span' in located)) break;
			if (spans.length && located.span.startOffset < spans.at(-1)!.endOffset) break;
			spans.push(located.span);
		}
		if (spans.length === pieces.length) return spans.map((span) => verified(span, 'ellipsis'));
	}

	return unverified(`The excerpt ${whole.reason}.`);
}

function validateCandidate(
	candidate: ModelCandidate,
	source: SourceIndex
): Omit<ValidatedCandidate, 'id'> {
	if (candidate.evidence.length === 0) {
		throw new Stage1Error('provider_malformed', 502, 'The candidate has no supporting evidence.');
	}

	const uncertainty = candidate.uncertainty;
	if (uncertainty !== null && !uncertainty.trim()) {
		throw new Stage1Error(
			'provider_malformed',
			502,
			'The candidate has a blank uncertainty value.'
		);
	}

	return {
		category: requireNonblank(candidate.category, 'candidate category'),
		practice: requireNonblank(candidate.practice, 'candidate practice'),
		claim: requireNonblank(candidate.claim, 'candidate claim'),
		explanation: requireNonblank(candidate.explanation, 'candidate explanation'),
		qualifiers: normalizeStringList(candidate.qualifiers, 'candidate qualifier'),
		uncertainty: uncertainty?.trim() ?? null,
		dataCategories: normalizeStringList(candidate.dataCategories, 'data category'),
		purposes: normalizeStringList(candidate.purposes, 'purpose'),
		recipients: normalizeStringList(candidate.recipients, 'recipient'),
		evidence: candidate.evidence.flatMap((reference) =>
			resolveEvidence(source, reference.passageId, reference.excerpt)
		)
	};
}

export type ResolvedCandidates = {
	candidates: ValidatedCandidate[];
	rejectedCandidates: RejectedCandidate[];
};

export function validateAndResolveCandidates(
	rawOutput: unknown,
	snapshot: SourceSnapshot
): ResolvedCandidates {
	validateSourceSnapshot(snapshot);

	const parsed = ModelStage1ResponseSchema.safeParse(rawOutput);
	if (!parsed.success) {
		throw new Stage1Error(
			'provider_malformed',
			502,
			'The provider response did not match the internal Stage 1 schema.',
			{ cause: parsed.error }
		);
	}

	const text = snapshot.passages.map((passage) => passage.text).join('');
	const source: SourceIndex = {
		passages: new Map(snapshot.passages.map((passage) => [passage.id, passage])),
		text,
		normalized: normalize(text)
	};
	const candidates: ValidatedCandidate[] = [];
	const rejectedCandidates: RejectedCandidate[] = [];

	// Quote problems never drop a candidate. Each excerpt is labeled verified or unverified and
	// the candidate keeps all of them, so a later stage can see which claims are supported and no
	// condition or exception is silently lost. Only a malformed candidate (blank fields or no
	// evidence) is dropped and reported.
	parsed.data.candidates.forEach((candidate, index) => {
		try {
			const resolved = validateCandidate(candidate, source);
			candidates.push({ id: `C${String(candidates.length + 1).padStart(3, '0')}`, ...resolved });
		} catch (error) {
			if (!isStage1Error(error)) throw error;
			rejectedCandidates.push({
				index,
				claim: candidate.claim.trim() || null,
				code: 'provider_malformed',
				reason: error.message
			});
		}
	});

	// When the provider returned candidates but not one excerpt could be located, its output as a
	// whole is unreliable. Fail the stage rather than pass on claims with no support at all.
	const anyVerified = candidates.some((candidate) =>
		candidate.evidence.some((evidence) => evidence.status === 'verified')
	);
	const total = candidates.length + rejectedCandidates.length;
	if (total > 0 && !anyVerified) {
		throw new Stage1Error(
			'reference_validation_failed',
			502,
			`None of the ${total} provider candidates had an excerpt that could be verified against the source.`
		);
	}

	return { candidates, rejectedCandidates };
}
