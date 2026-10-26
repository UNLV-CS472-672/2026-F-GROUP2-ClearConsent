import { Stage1Error } from '../errors';
import type { ConsolidationResult } from './schemas';

// Maps a complete consolidation result onto the Supabase columns. Nothing here writes to the database;
// the persistence PR will insert these rows in one transaction once auth and sources are merged.

export type AnalysisResultFields = {
	source_title: string | null;
	source_text: string;
	summary: string;
	outcome: 'findings_identified' | 'no_findings';
};

// Each evidence object passes public.evidence_objects_valid (a nonblank excerpt). Offsets are
// UTF-16, start-inclusive, end-exclusive into analyses.source_text.
export type FindingEvidenceJson = {
	excerpt: string;
	startOffset: number;
	endOffset: number;
	passageId: string;
	match: 'exact' | 'normalized' | 'ellipsis';
};

export type FindingInsertRow = {
	id: string;
	analysis_id: string;
	category: string;
	plain_language_description: string;
	evidence: FindingEvidenceJson[];
	data_categories: string[];
	purposes: string[];
	recipients: string[];
	condition_note: string | null;
	uncertainty_note: string | null;
	effect: 'exposes' | 'protects';
	ambiguous: boolean;
	conditional: boolean;
	purpose_types: string[];
	recipient_types: string[];
	relevant_preferences: string[];
	display_order: number;
};

function requireComplete(
	result: ConsolidationResult
): asserts result is ConsolidationResult & { outcome: AnalysisResultFields['outcome'] } {
	// NFR-5: only a complete analysis may be saved, so a partial result never reaches history.
	if (result.analysisStatus !== 'complete' || result.outcome === null) {
		throw new Stage1Error(
			'invalid_request',
			400,
			'Only a complete analysis can be mapped to database rows.'
		);
	}
}

export function toAnalysisResultFields(result: ConsolidationResult): AnalysisResultFields {
	requireComplete(result);
	const { source } = result.extraction;
	return {
		source_title: source.title,
		source_text: source.passages.map((passage) => passage.text).join(''),
		summary: result.summary,
		outcome: result.outcome
	};
}

export type FindingRows = {
	rows: FindingInsertRow[];
	// Consolidation finding ID (F001) to database UUID, so #12's preference_evaluations can reference
	// findings in the same transaction.
	idMap: Record<string, string>;
};

export function toFindingRows(
	result: ConsolidationResult,
	analysisId: string,
	newId: () => string = () => crypto.randomUUID()
): FindingRows {
	requireComplete(result);
	const idMap: Record<string, string> = {};
	const rows = result.findings.map((finding, index): FindingInsertRow => {
		const id = newId();
		idMap[finding.id] = id;
		return {
			id,
			analysis_id: analysisId,
			category: finding.category,
			plain_language_description: finding.description,
			evidence: finding.evidence.map((item) => ({
				excerpt: item.excerpt,
				startOffset: item.startOffset,
				endOffset: item.endOffset,
				passageId: item.passageId,
				match: item.match
			})),
			data_categories: finding.dataCategories,
			purposes: finding.purposes,
			recipients: finding.recipients,
			condition_note: finding.conditionNote,
			uncertainty_note: finding.uncertaintyNote,
			effect: finding.effect,
			ambiguous: finding.ambiguous,
			conditional: finding.conditional,
			purpose_types: finding.purposeTypes,
			recipient_types: finding.recipientTypes,
			relevant_preferences: finding.relevantPreferences,
			display_order: index
		};
	});
	return { rows, idMap };
}
