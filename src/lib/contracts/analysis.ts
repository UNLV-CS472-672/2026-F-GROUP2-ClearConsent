import { z } from 'zod';

// Fixed 'Category' Enum (Aligned with risk scoring requirements)
export const FindingCategoryEnum = z.enum([
	'collection',
	'use',
	'sharing',
	'retention',
	'user_rights',
	'security_practices'
]); // Aligned with scoring needs; DB values pending

export type FindingCategory = z.infer<typeof FindingCategoryEnum>; // Extract inferred type

// Attention Labels for #21 AI analysis workflow Takeaways
/* positive: 		A protection or control explicitly described in the policy, with its limits.
   worth_knowing:	A material practice or tradeoff the reader should understand.
   higher_concern:	A practice warrants closer attention; the reason explains its sensitivity, reach, or limited control.
   unclear:			Ambiguity, conflicting wording, or an unspecified limit prevents a definite interpretation.
*/
export const AttentionLabelEnum = z.enum([
	'positive',
	'worth_knowing',
	'higher_concern',
	'unclear'
]); // Aligned with AI workflow proposal labels

export type AttentionLabel = z.infer<typeof AttentionLabelEnum>;

// Evidence Item Schema (Source passage references)
export const EvidenceItemSchema = z.object({
	passageId: z.string().min(1),
	excerpt: z.string().min(1, 'Non-empty quote excerpt is required')
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// Distinct Finding Schema (consumed by risk scoring)
export const FindingSchema = z.object({
	id: z.string().min(1, 'Finding ID is required (e.g., "F1")'),
	category: FindingCategoryEnum,
	plain_language_description: z.string().min(1, 'Plain-language summary is required'),
	dataCategories: z.array(z.string()).default([]),
	purposes: z.array(z.string()).default([]),
	recipients: z.array(z.string()).default([]),
	evidence: z
		.array(EvidenceItemSchema)
		.min(1, 'At least one evidence item is required to prevent uncited claims')
});

export type Finding = z.infer<typeof FindingSchema>;

// Readable Takeaway Schema (UI presentation layer)
export const TakeawaySchema = z.strictObject({
	id: z.string().min(1, 'Takeaway ID is required'),
	topic: z.string().min(1, 'Topic label is required'),
	reason: z.string().min(1, 'Reason explaining the statement and conditions is required'),
	label: AttentionLabelEnum,
	findingIds: z.array(z.string()).min(1, 'Takeaway must link to at least one finding')
});

export type Takeaway = z.infer<typeof TakeawaySchema>;

// Discriminated Union states for Analysis Result
export const AnalysisInProgressSchema = z.object({
	status: z.literal('in_progress'),
	analysisId: z.string().min(1),
	schemaVersion: z.number().int().positive()
});

export const AnalysisSuccessSchema = z
	.object({
		status: z.literal('success'),
		analysisId: z.string().min(1),
		schemaVersion: z.number().int().positive(),
		summary: z.string().min(1, 'Success state requires an overall readable summary'),
		findings: z.array(FindingSchema).min(1, 'Success state requires at least one finding'),
		takeaways: z.array(TakeawaySchema).min(1, 'Success state requires at least one takeaway')
	})
	// custom rule for findings and takeaways
	.superRefine((data, ctx) => {
		// create findings into a plain ID list
		const findingIds = new Set(data.findings.map((finding) => finding.id));

		// check for duplicate IDs
		if (findingIds.size !== data.findings.length) {
			ctx.addIssue({
				code: 'custom',
				message: 'Finding IDs must be unique',
				path: ['findings']
			});
		}
		// ensure each takeaway links to an existing finding
		data.takeaways.forEach((takeaway, i) => {
			takeaway.findingIds.forEach((id, j) => {
				if (!findingIds.has(id)) {
					ctx.addIssue({
						code: 'custom',
						message: `Takeaway links to unknown finding "${id}"`,
						path: ['takeaways', i, 'findingIds', j]
					});
				}
			});
		});
	});

export const AnalysisInsufficientSchema = z.strictObject({
	status: z.literal('insufficient'),
	analysisId: z.string().min(1),
	schemaVersion: z.number().int().positive(),
	reason: z
		.string()
		.min(1, 'Insufficient state requires an explanation for why analysis could not be completed')
});

export const AnalysisFailedSchema = z.strictObject({
	status: z.literal('failed'),
	analysisId: z.string().min(1),
	schemaVersion: z.number().int().positive(),
	errorCode: z.string().min(1, 'Error code is required for failure states'),
	message: z.string().min(1, 'Error message is required')
});

// Main Discriminated Union Contract
export const AnalysisResultSchema = z.discriminatedUnion('status', [
	AnalysisInProgressSchema,
	AnalysisSuccessSchema,
	AnalysisInsufficientSchema,
	AnalysisFailedSchema
]);

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
