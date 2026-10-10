import { Stage1Error } from './errors';
import { ModelStage1ResponseSchema } from './schemas';
import type {
	ModelCandidate,
	SourceSnapshot,
	ValidatedCandidate,
	ValidatedEvidence
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

function resolveEvidence(
	passages: Map<string, SourceSnapshot['passages'][number]>,
	passageId: string,
	excerpt: string
): ValidatedEvidence {
	const normalizedPassageId = requireNonblank(passageId, 'passage ID');
	if (excerpt.trim().length < MIN_EVIDENCE_LENGTH) {
		throw new Stage1Error(
			'reference_validation_failed',
			502,
			`Evidence for ${normalizedPassageId} is blank or too short to preserve context.`
		);
	}

	const passage = passages.get(normalizedPassageId);
	if (!passage) {
		throw new Stage1Error(
			'reference_validation_failed',
			502,
			`Evidence references unknown passage ${normalizedPassageId}.`
		);
	}

	const localStart = passage.text.indexOf(excerpt);
	if (localStart === -1) {
		throw new Stage1Error(
			'reference_validation_failed',
			502,
			`Evidence excerpt was not found exactly in ${normalizedPassageId}.`
		);
	}

	if (passage.text.indexOf(excerpt, localStart + 1) !== -1) {
		throw new Stage1Error(
			'reference_validation_failed',
			502,
			`Evidence excerpt occurs more than once in ${normalizedPassageId}.`
		);
	}

	const startOffset = passage.startOffset + localStart;
	const endOffset = startOffset + excerpt.length;

	return {
		passageId: normalizedPassageId,
		excerpt: passage.text.slice(localStart, localStart + excerpt.length),
		startOffset,
		endOffset
	};
}

function validateCandidate(
	candidate: ModelCandidate,
	index: number,
	passages: Map<string, SourceSnapshot['passages'][number]>
): ValidatedCandidate {
	if (candidate.evidence.length === 0) {
		throw new Stage1Error(
			'provider_malformed',
			502,
			`Candidate ${index + 1} has no supporting evidence.`
		);
	}

	const uncertainty = candidate.uncertainty;
	if (uncertainty !== null && !uncertainty.trim()) {
		throw new Stage1Error(
			'provider_malformed',
			502,
			`Candidate ${index + 1} has a blank uncertainty value.`
		);
	}

	return {
		id: `C${String(index + 1).padStart(3, '0')}`,
		category: requireNonblank(candidate.category, 'candidate category'),
		practice: requireNonblank(candidate.practice, 'candidate practice'),
		claim: requireNonblank(candidate.claim, 'candidate claim'),
		explanation: requireNonblank(candidate.explanation, 'candidate explanation'),
		qualifiers: normalizeStringList(candidate.qualifiers, 'candidate qualifier'),
		uncertainty: uncertainty?.trim() ?? null,
		dataCategories: normalizeStringList(candidate.dataCategories, 'data category'),
		purposes: normalizeStringList(candidate.purposes, 'purpose'),
		recipients: normalizeStringList(candidate.recipients, 'recipient'),
		evidence: candidate.evidence.map((reference) =>
			resolveEvidence(passages, reference.passageId, reference.excerpt)
		)
	};
}

export function validateAndResolveCandidates(
	rawOutput: unknown,
	snapshot: SourceSnapshot
): ValidatedCandidate[] {
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

	const passages = new Map(snapshot.passages.map((passage) => [passage.id, passage]));
	return parsed.data.candidates.map((candidate, index) =>
		validateCandidate(candidate, index, passages)
	);
}
