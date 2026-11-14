import type {
	FindingCategory,
	FindingEffect,
	PurposeType,
	RecipientType
} from '$lib/contracts/analysis';
import type { PreferenceEvaluation, Tier } from '$lib/contracts/preferences';

// The fields scoring reads (docs/scoring-model.md sect. 3). Both the public contract Finding and
// Stage 2's ConsolidatedFinding fit this shape, so the scorer works on either without converting.
// Scoring fields are optional because older saved findings may not have them; null is accepted
// because database rows store a missing effect as null.
export type ScorableFinding = {
	id: string;
	category: FindingCategory;
	effect?: FindingEffect | null;
	ambiguous?: boolean | null;
	conditional?: boolean | null;
	recipientTypes?: readonly RecipientType[] | null;
	purposeTypes?: readonly PurposeType[] | null;
	evidence: readonly { excerpt: string }[];
	// Used only for explanations. The contract and Stage 2 name this field differently.
	plain_language_description?: string;
	description?: string;
};

// A finding that passed the sect. 3 checks. tier is null for protects findings.
export type UsableFinding = {
	id: string;
	category: FindingCategory;
	effect: FindingEffect;
	tier: Tier | null;
};

export type ReviewEntry = PreferenceEvaluation['needsReview'][number];

export type UngroundedEntry = PreferenceEvaluation['ungrounded'][number];

export type ClassifiedFindings = {
	usable: UsableFinding[];
	needsReview: ReviewEntry[];
	ungrounded: UngroundedEntry[];
};
