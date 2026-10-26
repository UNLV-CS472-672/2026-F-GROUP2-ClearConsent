import { z } from 'zod';
import type { ProviderUsage, Stage1Result, VerifiedEvidence } from '../schemas';

// Internal consolidation contract. The public Finding/result contract is still owned by issue #22; these
// values follow the categories agreed there and the fields issue #12 needs for scoring.
export const FINDING_CATEGORIES = [
	'collection',
	'use',
	'sharing',
	'retention',
	'user_rights',
	'security_practices'
] as const;

// "exposes" is a practice, or a missing or restricted protection. "protects" is a protection, or
// a denial such as "we do not sell".
export const FINDING_EFFECTS = ['exposes', 'protects'] as const;

export const RECIPIENT_TYPES = [
	'service_provider',
	'affiliate',
	'advertiser',
	'data_broker',
	'government',
	'other',
	'unspecified'
] as const;

export const PURPOSE_TYPES = [
	'service',
	'legal_security',
	'analytics',
	'advertising',
	'sale',
	'other',
	'unspecified'
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];
export type FindingEffect = (typeof FINDING_EFFECTS)[number];
export type RecipientType = (typeof RECIPIENT_TYPES)[number];
export type PurposeType = (typeof PURPOSE_TYPES)[number];

// Model-facing schema. The model cites candidate IDs only; code builds every finding's evidence
// from those candidates' verified excerpts, so the model never supplies quotes or offsets.
export const ModelFindingSchema = z.strictObject({
	candidateIds: z.array(z.string()),
	category: z.enum(FINDING_CATEGORIES),
	description: z.string(),
	effect: z.enum(FINDING_EFFECTS),
	conditional: z.boolean(),
	conditionNote: z.string().nullable(),
	ambiguous: z.boolean(),
	uncertaintyNote: z.string().nullable(),
	dataCategories: z.array(z.string()),
	purposes: z.array(z.string()),
	recipients: z.array(z.string()),
	purposeTypes: z.array(z.enum(PURPOSE_TYPES)),
	recipientTypes: z.array(z.enum(RECIPIENT_TYPES)),
	relevantPreferences: z.array(z.string())
});

export const ModelExclusionSchema = z.strictObject({
	candidateId: z.string(),
	reason: z.string()
});

export const ModelConsolidationResponseSchema = z.strictObject({
	summary: z.string(),
	findings: z.array(ModelFindingSchema),
	exclusions: z.array(ModelExclusionSchema)
});

export type ModelFinding = z.infer<typeof ModelFindingSchema>;
export type ModelExclusion = z.infer<typeof ModelExclusionSchema>;
export type ModelConsolidationResponse = z.infer<typeof ModelConsolidationResponseSchema>;

export type ConsolidatedFinding = {
	id: string;
	category: FindingCategory;
	description: string;
	effect: FindingEffect;
	// True only when the practice happens only if the user opts in or turns something on.
	conditional: boolean;
	// Every material condition, exception, or scope limit, such as "except records kept for legal
	// obligations" or "covers sale only". Required when conditional is true, but a finding that is
	// not opt-in can still have one, so it is not always null when conditional is false.
	conditionNote: string | null;
	ambiguous: boolean;
	uncertaintyNote: string | null;
	dataCategories: string[];
	purposes: string[];
	recipients: string[];
	purposeTypes: PurposeType[];
	recipientTypes: RecipientType[];
	// Top-level preference keys this finding relates to. Used for ordering only.
	relevantPreferences: string[];
	candidateIds: string[];
	// Built by code from the cited candidates. Every excerpt is verified and sliced from the source.
	evidence: VerifiedEvidence[];
};

export type ExcludedCandidate = {
	candidateId: string;
	// unverified_evidence: held back by code because extraction could not verify every excerpt.
	// model_excluded: the model said the candidate is unsupported or not a privacy practice.
	// unaccounted: the model did not place the candidate in a valid finding or exclusion.
	code: 'unverified_evidence' | 'model_excluded' | 'unaccounted';
	reason: string;
};

export type RejectedOutput = {
	kind: 'finding' | 'exclusion';
	// Zero-based position in the provider's findings or exclusions array.
	index: number;
	reason: string;
};

export type ConsolidationModelInput = {
	source: Stage1Result['source'];
	candidates: Stage1Result['candidates'];
	preferences: Record<string, unknown> | null;
};

export type ConsolidationResult = {
	stage: 'consolidation';
	schemaVersion: 'stage2-internal-v1';
	// complete: every eligible candidate is in a valid finding or a model exclusion.
	// partial: some model output was rejected or some candidates were not accounted for.
	stageStatus: 'complete' | 'partial';
	// Only a complete stage completes the analysis. A partial result stays in progress so it is
	// never saved or shown as a finished analysis.
	analysisStatus: 'complete' | 'in_progress';
	// Matches the analyses.outcome enum. Null until the analysis is complete.
	outcome: 'findings_identified' | 'no_findings' | null;
	summary: string;
	findings: ConsolidatedFinding[];
	excludedCandidates: ExcludedCandidate[];
	rejectedOutput: RejectedOutput[];
	downstream: {
		nextStage: 'personalized_evaluation';
		preferences: Record<string, unknown> | null;
	};
	// Null when no model call was needed (extraction found no candidates).
	provider: {
		model: string;
		reasoningEffort: string;
		attempts: 1;
		usage: ProviderUsage | null;
	} | null;
	limitations: {
		referenceValidation: 'structural_and_referential_only';
		semanticReviewRequired: true;
	};
	// The complete extraction result, including the source passages, for traceability.
	extraction: Stage1Result;
};
