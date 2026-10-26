import { Stage1Error, isStage1Error } from '../errors';
import type { Stage1Result } from '../schemas';
import { validateSourceSnapshot } from '../source';
import { ConsolidationError } from './errors';
import type { ProviderConsolidation, ConsolidationProvider } from './provider';
import type { ConsolidationResult } from './schemas';
import { selectEligibleCandidates, validateConsolidation } from './validate';

// Used when extraction found nothing to consolidate. FR-7: no findings is not the same as no risk.
export const NO_FINDINGS_SUMMARY =
	'No supported privacy practices were identified in the submitted text. This does not mean the policy has no privacy risks; the text may not describe its practices clearly or completely.';

// The library may receive an extraction result from outside the server in the future, so re-check
// that every verified excerpt is still the source's own text before anything is presented.
function checkExtraction(extraction: Stage1Result): void {
	validateSourceSnapshot(extraction.source);
	const text = extraction.source.passages.map((passage) => passage.text).join('');
	const ids = new Set<string>();
	for (const candidate of extraction.candidates) {
		if (ids.has(candidate.id)) {
			throw new Stage1Error(
				'reference_validation_failed',
				502,
				`Extraction result repeats candidate ID ${candidate.id}.`
			);
		}
		ids.add(candidate.id);
		for (const evidence of candidate.evidence) {
			if (
				evidence.status === 'verified' &&
				text.slice(evidence.startOffset, evidence.endOffset) !== evidence.excerpt
			) {
				throw new Stage1Error(
					'reference_validation_failed',
					502,
					`Extraction evidence for ${candidate.id} does not match the source text.`
				);
			}
		}
	}
}

const LIMITATIONS = {
	referenceValidation: 'structural_and_referential_only',
	semanticReviewRequired: true
} as const;

export async function runConsolidation(
	extraction: Stage1Result,
	provider: ConsolidationProvider
): Promise<ConsolidationResult> {
	checkExtraction(extraction);
	const preferences = extraction.downstream.preferences;
	const downstream = { nextStage: 'personalized_evaluation', preferences } as const;

	if (extraction.candidates.length === 0) {
		return {
			stage: 'consolidation',
			schemaVersion: 'stage2-internal-v1',
			stageStatus: 'complete',
			analysisStatus: 'complete',
			outcome: 'no_findings',
			summary: NO_FINDINGS_SUMMARY,
			findings: [],
			excludedCandidates: [],
			rejectedOutput: [],
			downstream,
			provider: null,
			limitations: LIMITATIONS,
			extraction: extraction
		};
	}

	const { eligible, heldBack } = selectEligibleCandidates(extraction.candidates);
	if (eligible.length === 0) {
		throw new Stage1Error(
			'reference_validation_failed',
			502,
			`None of the ${extraction.candidates.length} extraction candidates had every excerpt verified, so none can be presented.`
		);
	}

	let consolidation: ProviderConsolidation;
	try {
		consolidation = await provider.consolidate({
			source: extraction.source,
			candidates: eligible,
			preferences
		});
	} catch (error) {
		if (isStage1Error(error)) throw error;
		throw new Stage1Error(
			'provider_unavailable',
			502,
			'The consolidation provider failed unexpectedly.',
			{ cause: error }
		);
	}

	let validated: ReturnType<typeof validateConsolidation>;
	try {
		validated = validateConsolidation(consolidation.output, eligible, preferences);
	} catch (error) {
		// The model already responded, so keep the call's model and usage on the error for logging.
		if (!isStage1Error(error)) throw error;
		throw new ConsolidationError(error, { model: consolidation.model, usage: consolidation.usage });
	}
	const complete =
		validated.rejectedOutput.length === 0 &&
		validated.excludedCandidates.every((item) => item.code !== 'unaccounted');
	const order = new Map(extraction.candidates.map((candidate, index) => [candidate.id, index]));

	return {
		stage: 'consolidation',
		schemaVersion: 'stage2-internal-v1',
		stageStatus: complete ? 'complete' : 'partial',
		analysisStatus: complete ? 'complete' : 'in_progress',
		outcome: complete
			? validated.findings.length > 0
				? 'findings_identified'
				: 'no_findings'
			: null,
		summary: validated.summary,
		findings: validated.findings,
		excludedCandidates: [...heldBack, ...validated.excludedCandidates].sort(
			(a, b) => order.get(a.candidateId)! - order.get(b.candidateId)!
		),
		rejectedOutput: validated.rejectedOutput,
		downstream,
		provider: {
			model: consolidation.model,
			reasoningEffort: consolidation.reasoningEffort,
			attempts: consolidation.attempts,
			usage: consolidation.usage
		},
		limitations: LIMITATIONS,
		extraction: extraction
	};
}
