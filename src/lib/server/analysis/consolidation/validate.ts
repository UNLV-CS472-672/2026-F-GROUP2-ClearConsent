import { Stage1Error } from '../errors';
import type { ValidatedCandidate, VerifiedEvidence } from '../schemas';
import {
	FINDING_CATEGORIES,
	ModelConsolidationResponseSchema,
	PURPOSE_TYPES,
	RECIPIENT_TYPES
} from './schemas';
import type {
	ConsolidatedFinding,
	ExcludedCandidate,
	ModelFinding,
	RejectedOutput
} from './schemas';

export type EligibleCandidates = {
	eligible: ValidatedCandidate[];
	heldBack: ExcludedCandidate[];
};

// Extraction's rule: a candidate may be presented only when every one of its excerpts is verified.
// Qualifiers are not linked to individual excerpts, so one unverified excerpt may be the only
// support for an exception. Such candidates never reach the model.
export function selectEligibleCandidates(candidates: ValidatedCandidate[]): EligibleCandidates {
	const eligible: ValidatedCandidate[] = [];
	const heldBack: ExcludedCandidate[] = [];
	for (const candidate of candidates) {
		const unverified = candidate.evidence.filter((evidence) => evidence.status === 'unverified');
		if (unverified.length === 0) {
			eligible.push(candidate);
		} else {
			heldBack.push({
				candidateId: candidate.id,
				code: 'unverified_evidence',
				reason: `${unverified.length} of ${candidate.evidence.length} excerpts could not be verified against the source.`
			});
		}
	}
	return { eligible, heldBack };
}

function verifiedEvidence(candidate: ValidatedCandidate): VerifiedEvidence[] {
	return candidate.evidence.filter(
		(evidence): evidence is VerifiedEvidence => evidence.status === 'verified'
	);
}

class RejectedFinding extends Error {}

function cleanNote(value: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

function cleanList(values: string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

// Fixed-value lists keep their declared order so the same set always serializes the same way.
function cleanTypes<T extends string>(values: T[], order: readonly T[]): T[] {
	const present = new Set(values);
	return order.filter((value) => present.has(value));
}

function buildFinding(
	finding: ModelFinding,
	eligible: Map<string, ValidatedCandidate>,
	preferenceKeys: string[]
): Omit<ConsolidatedFinding, 'id'> {
	const candidateIds = [...new Set(finding.candidateIds.map((id) => id.trim()))];
	if (candidateIds.length === 0 || candidateIds.includes('')) {
		throw new RejectedFinding('The finding cites no candidate.');
	}
	const unknown = candidateIds.filter((id) => !eligible.has(id));
	if (unknown.length > 0) {
		throw new RejectedFinding(
			`The finding cites unknown or held-back candidates: ${unknown.join(', ')}.`
		);
	}

	const description = finding.description.trim();
	if (!description) throw new RejectedFinding('The finding has a blank description.');

	const conditionNote = cleanNote(finding.conditionNote);
	if (finding.conditional && !conditionNote) {
		throw new RejectedFinding('The finding is conditional but has no condition note.');
	}
	const uncertaintyNote = cleanNote(finding.uncertaintyNote);
	if (finding.ambiguous && !uncertaintyNote) {
		throw new RejectedFinding('The finding is ambiguous but has no uncertainty note.');
	}

	// Evidence comes only from the cited candidates' verified excerpts, never from the model.
	const evidence = new Map<string, VerifiedEvidence>();
	for (const id of candidateIds) {
		for (const item of verifiedEvidence(eligible.get(id)!)) {
			const key = `${item.startOffset}:${item.endOffset}`;
			if (!evidence.has(key)) evidence.set(key, item);
		}
	}

	// Preferences only tag relevance. Keys the user does not have are dropped.
	const relevant = new Set(finding.relevantPreferences.map((key) => key.trim()));

	return {
		category: finding.category,
		description,
		effect: finding.effect,
		conditional: finding.conditional,
		conditionNote,
		ambiguous: finding.ambiguous,
		uncertaintyNote,
		dataCategories: cleanList(finding.dataCategories),
		purposes: cleanList(finding.purposes),
		recipients: cleanList(finding.recipients),
		purposeTypes: cleanTypes(finding.purposeTypes, PURPOSE_TYPES),
		recipientTypes: cleanTypes(finding.recipientTypes, RECIPIENT_TYPES),
		relevantPreferences: preferenceKeys.filter((key) => relevant.has(key)),
		candidateIds,
		evidence: [...evidence.values()].sort(
			(a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset
		)
	};
}

// Display order: findings related to the user's preferences first (when preferences exist), then
// by category, then by where their evidence starts in the source. Deterministic for a given output.
function compareFindings(
	a: Omit<ConsolidatedFinding, 'id'>,
	b: Omit<ConsolidatedFinding, 'id'>
): number {
	const relevance =
		Number(b.relevantPreferences.length > 0) - Number(a.relevantPreferences.length > 0);
	if (relevance !== 0) return relevance;
	const category = FINDING_CATEGORIES.indexOf(a.category) - FINDING_CATEGORIES.indexOf(b.category);
	if (category !== 0) return category;
	const start = a.evidence[0].startOffset - b.evidence[0].startOffset;
	if (start !== 0) return start;
	return a.candidateIds[0].localeCompare(b.candidateIds[0]);
}

export type ValidatedConsolidation = {
	summary: string;
	findings: ConsolidatedFinding[];
	// Model exclusions and unaccounted candidates. Held-back candidates are added by the pipeline.
	excludedCandidates: ExcludedCandidate[];
	rejectedOutput: RejectedOutput[];
};

// Values that mean "this preference is off", so they never mark a finding as relevant.
const OFF_VALUES = new Set(['', 'none', 'off', 'no', 'false']);

// Preference keys the user actually holds: a key set to null, false, or a value like "none" is
// treated as not set, so it can't move a finding up the display order.
export function activePreferenceKeys(preferences: Record<string, unknown> | null): string[] {
	if (!preferences) return [];
	return Object.entries(preferences)
		.filter(([, value]) => {
			if (value === null || value === undefined || value === false) return false;
			if (typeof value === 'string') return !OFF_VALUES.has(value.trim().toLowerCase());
			return true;
		})
		.map(([key]) => key);
}

/**
 * Checks the model's consolidation output and turns it into findings the app can show.
 *
 * 1. Checks the output matches the schema and has a summary (otherwise provider_malformed).
 * 2. Builds each finding. A finding is rejected (listed in rejectedOutput) if it cites an
 *    unknown or held-back candidate, or is missing required text. Its evidence is copied from
 *    the cited candidates' verified excerpts, never from the model.
 * 3. Checks each exclusion. Unknown, repeated, reasonless, or contradictory ones are rejected.
 * 4. Lists every eligible candidate that ended up in no finding or exclusion as "unaccounted".
 * 5. Orders the findings and numbers them F001, F002, ...
 *
 * Throws provider_malformed if the model returned findings but none were usable.
 */
export function validateConsolidation(
	rawOutput: unknown,
	eligibleCandidates: ValidatedCandidate[],
	preferences: Record<string, unknown> | null
): ValidatedConsolidation {
	const parsed = ModelConsolidationResponseSchema.safeParse(rawOutput);
	if (!parsed.success) {
		throw new Stage1Error(
			'provider_malformed',
			502,
			'The provider response did not match the internal consolidation schema.',
			{ cause: parsed.error }
		);
	}

	const summary = parsed.data.summary.trim();
	if (!summary) {
		throw new Stage1Error('provider_malformed', 502, 'The provider returned a blank summary.');
	}

	const eligible = new Map(eligibleCandidates.map((candidate) => [candidate.id, candidate]));
	const preferenceKeys = activePreferenceKeys(preferences);
	const rejectedOutput: RejectedOutput[] = [];
	const kept: Omit<ConsolidatedFinding, 'id'>[] = [];

	parsed.data.findings.forEach((finding, index) => {
		try {
			kept.push(buildFinding(finding, eligible, preferenceKeys));
		} catch (error) {
			if (!(error instanceof RejectedFinding)) throw error;
			rejectedOutput.push({ kind: 'finding', index, reason: error.message });
		}
	});

	// When the provider returned findings but none were usable, its output as a whole is unreliable.
	if (parsed.data.findings.length > 0 && kept.length === 0) {
		throw new Stage1Error(
			'provider_malformed',
			502,
			`None of the ${parsed.data.findings.length} provider findings passed validation.`
		);
	}

	const inFindings = new Set(kept.flatMap((finding) => finding.candidateIds));
	const excluded = new Map<string, ExcludedCandidate>();
	parsed.data.exclusions.forEach((exclusion, index) => {
		const candidateId = exclusion.candidateId.trim();
		const reason = exclusion.reason.trim();
		const reject = (why: string) => rejectedOutput.push({ kind: 'exclusion', index, reason: why });
		if (!eligible.has(candidateId)) return reject(`Excludes unknown candidate ${candidateId}.`);
		if (!reason) return reject(`The exclusion of ${candidateId} has no reason.`);
		if (inFindings.has(candidateId)) {
			return reject(`${candidateId} is both excluded and used in a finding.`);
		}
		if (excluded.has(candidateId)) return reject(`${candidateId} is excluded more than once.`);
		excluded.set(candidateId, { candidateId, code: 'model_excluded', reason });
	});

	// Anything the model did not place is reported, never silently dropped.
	for (const candidate of eligibleCandidates) {
		if (!inFindings.has(candidate.id) && !excluded.has(candidate.id)) {
			excluded.set(candidate.id, {
				candidateId: candidate.id,
				code: 'unaccounted',
				reason: 'The provider did not place this candidate in a valid finding or exclusion.'
			});
		}
	}

	const findings = kept
		.sort(compareFindings)
		.map((finding, index) => ({ id: `F${String(index + 1).padStart(3, '0')}`, ...finding }));
	const order = new Map(eligibleCandidates.map((candidate, index) => [candidate.id, index]));
	const excludedCandidates = [...excluded.values()].sort(
		(a, b) => order.get(a.candidateId)! - order.get(b.candidateId)!
	);

	return { summary, findings, excludedCandidates, rejectedOutput };
}
