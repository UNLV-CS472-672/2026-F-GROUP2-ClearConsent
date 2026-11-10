import type { AnalysisResult, AttentionLabel, FindingCategory } from '$lib/contracts/analysis';
import { analysisModel, type SavedAnalysis } from './analysis-runs';

const TOPICS: Record<FindingCategory, string> = {
	collection: 'Information collection',
	use: 'How data is used',
	sharing: 'Data sharing',
	retention: 'Data retention',
	user_rights: 'Your rights',
	security_practices: 'Security practices'
};

export type FindingRow = {
	id: string;
	category: FindingCategory;
	plain_language_description: string;
	evidence: { passageId: string; excerpt: string }[];
	effect: 'exposes' | 'protects' | null;
	ambiguous: boolean;
	data_categories: string[];
	purposes: string[];
	recipients: string[];
};

function plural(count: number, word: string) {
	return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// The AI returns findings but no takeaways, so each category becomes one takeaway. Its label and
// reason come only from the stored findings: ambiguity, and whether each one exposes or protects.
export function toAnalysisResult(analysis: SavedAnalysis, rows: FindingRow[]): AnalysisResult {
	if (rows.length === 0) {
		return {
			status: 'insufficient',
			analysisId: analysis.id,
			schemaVersion: 1,
			reason: analysis.summary,
			model: analysisModel(analysis)
		};
	}

	const groups = new Map<FindingCategory, FindingRow[]>();
	for (const row of rows) {
		groups.set(row.category, [...(groups.get(row.category) ?? []), row]);
	}

	const takeaways = [...groups].map(([category, group]) => {
		const protections = group.filter((row) => row.effect === 'protects').length;
		const practices = group.length - protections;
		const label: AttentionLabel = group.some((row) => row.ambiguous)
			? 'unclear'
			: practices === 0
				? 'positive'
				: 'worth_knowing';
		const described = [
			practices && plural(practices, 'practice'),
			protections && plural(protections, 'protection')
		].filter(Boolean);
		return {
			id: category,
			topic: TOPICS[category],
			reason: `The policy describes ${described.join(' and ')} in this area.`,
			label,
			findingIds: group.map((row) => row.id)
		};
	});

	return {
		status: 'success',
		analysisId: analysis.id,
		schemaVersion: 1,
		summary: analysis.summary,
		model: analysisModel(analysis),
		findings: rows.map((row) => ({
			id: row.id,
			category: row.category,
			plain_language_description: row.plain_language_description,
			dataCategories: row.data_categories,
			purposes: row.purposes,
			recipients: row.recipients,
			evidence: row.evidence.map(({ passageId, excerpt }) => ({ passageId, excerpt }))
		})),
		takeaways
	};
}
