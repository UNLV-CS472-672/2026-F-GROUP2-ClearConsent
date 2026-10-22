import { Stage1Error, isStage1Error } from '../errors';
import type { Stage1Result } from '../schemas';
import { validateSourceSnapshot } from '../source';
import type { ProviderConsolidation, Stage2Provider } from './provider';
import type { Stage2Result } from './schemas';
import { selectEligibleCandidates, validateConsolidation } from './validate';

// Used when Stage 1 found nothing to consolidate. FR-7: no findings is not the same as no risk.
export const NO_FINDINGS_SUMMARY =
	'No supported privacy practices were identified in the submitted text. This does not mean the policy has no privacy risks; the text may not describe its practices clearly or completely.';

// The library may receive a Stage 1 result from outside the server in the future, so re-check
// that every verified excerpt is still the source's own text before anything is presented.
function checkStage1Result(stage1: Stage1Result): void {
	validateSourceSnapshot(stage1.source);
	const text = stage1.source.passages.map((passage) => passage.text).join('');
	const ids = new Set<string>();
	for (const candidate of stage1.candidates) {
		if (ids.has(candidate.id)) {
			throw new Stage1Error(
				'reference_validation_failed',
				502,
				`Stage 1 result repeats candidate ID ${candidate.id}.`
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
					`Stage 1 evidence for ${candidate.id} does not match the source text.`
				);
			}
		}
	}
}

const LIMITATIONS = {
	referenceValidation: 'structural_and_referential_only',
	semanticReviewRequired: true
} as const;

export async function runStage2Consolidation(
	stage1: Stage1Result,
	provider: Stage2Provider
): Promise<Stage2Result> {
	checkStage1Result(stage1);
	const preferences = stage1.downstream.preferences;
	const downstream = { nextStage: 'personalized_evaluation', preferences } as const;

	if (stage1.candidates.length === 0) {
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
			extraction: stage1
		};
	}

	const { eligible, heldBack } = selectEligibleCandidates(stage1.candidates);
	if (eligible.length === 0) {
		throw new Stage1Error(
			'reference_validation_failed',
			502,
			`None of the ${stage1.candidates.length} Stage 1 candidates had every excerpt verified, so none can be presented.`
		);
	}

	let consolidation: ProviderConsolidation;
	try {
		consolidation = await provider.consolidate({
			source: stage1.source,
			candidates: eligible,
			preferences
		});
	} catch (error) {
		if (isStage1Error(error)) throw error;
		throw new Stage1Error(
			'provider_unavailable',
			502,
			'The Stage 2 provider failed unexpectedly.',
			{ cause: error }
		);
	}

	const validated = validateConsolidation(consolidation.output, eligible, preferences);
	const complete =
		validated.rejectedOutput.length === 0 &&
		validated.excludedCandidates.every((item) => item.code !== 'unaccounted');
	const order = new Map(stage1.candidates.map((candidate, index) => [candidate.id, index]));

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
		extraction: stage1
	};
}
