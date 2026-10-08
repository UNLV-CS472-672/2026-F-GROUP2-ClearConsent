import { z } from 'zod';

// This is an internal Stage 1 contract. It deliberately does not define or replace
// the public Finding/result contract owned by issue #22.
export const ModelEvidenceReferenceSchema = z.strictObject({
	passageId: z.string(),
	excerpt: z.string()
});

export const ModelCandidateSchema = z.strictObject({
	category: z.string(),
	practice: z.string(),
	claim: z.string(),
	explanation: z.string(),
	qualifiers: z.array(z.string()),
	uncertainty: z.string().nullable(),
	dataCategories: z.array(z.string()),
	purposes: z.array(z.string()),
	recipients: z.array(z.string()),
	evidence: z.array(ModelEvidenceReferenceSchema)
});

// Keep the model-facing schema free of application-only IDs and source ranges.
// The server creates those after validating exact references.
export const ModelStage1ResponseSchema = z.strictObject({
	candidates: z.array(ModelCandidateSchema)
});

export type ModelStage1Response = z.infer<typeof ModelStage1ResponseSchema>;
export type ModelCandidate = z.infer<typeof ModelCandidateSchema>;

export const Stage1RequestSchema = z.strictObject({
	text: z.string(),
	title: z.string().optional(),
	url: z.string().optional(),
	preferences: z.record(z.string(), z.unknown()).optional()
});

export type Stage1Request = z.infer<typeof Stage1RequestSchema>;

export const SourcePassageSchema = z.strictObject({
	id: z.string(),
	startOffset: z.number().int().nonnegative(),
	endOffset: z.number().int().positive(),
	text: z.string()
});

export type SourcePassage = z.infer<typeof SourcePassageSchema>;

export const SourceSnapshotSchema = z.strictObject({
	id: z.string(),
	identity: z.literal('sha256-utf8'),
	offsetConvention: z.literal('utf16-start-inclusive-end-exclusive'),
	textLength: z.number().int().positive(),
	title: z.string().nullable(),
	url: z.string().nullable(),
	passages: z.array(SourcePassageSchema).min(1)
});

export type SourceSnapshot = z.infer<typeof SourceSnapshotSchema>;

export type ValidatedEvidence = {
	passageId: string;
	excerpt: string;
	startOffset: number;
	endOffset: number;
};

export type ValidatedCandidate = Omit<ModelCandidate, 'evidence'> & {
	id: string;
	evidence: ValidatedEvidence[];
};

export type ProviderUsage = {
	inputTokens: number;
	outputTokens: number;
	reasoningTokens: number;
	totalTokens: number;
};

export type Stage1Result = {
	stage: 'evidence_extraction';
	schemaVersion: 'stage1-internal-v1';
	stageStatus: 'complete' | 'no_candidates';
	analysisStatus: 'in_progress';
	coverage: 'complete';
	source: SourceSnapshot;
	candidates: ValidatedCandidate[];
	downstream: {
		nextStage: 'consolidation';
		preferences: Record<string, unknown> | null;
	};
	provider: {
		model: string;
		reasoningEffort: string;
		attempts: 1;
		usage: ProviderUsage | null;
	};
	limitations: {
		referenceValidation: 'structural_and_referential_only';
		semanticReviewRequired: true;
	};
};
