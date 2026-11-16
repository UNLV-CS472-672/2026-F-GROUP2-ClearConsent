import { describe, expect, it } from 'vitest';
import { AnalysisResultSchema, type Finding } from '$lib/contracts/analysis';
import { ProfileIdEnum } from '$lib/contracts/preferences';
import { evaluatePreferences } from '$lib/risk';
import { FINDING_COLUMNS, type FindingRow, toAnalysisResult } from './analysis';
import { runConsolidation, toFindingRows } from './analysis/consolidation';
import {
	SUMMARY,
	consolidationProviderWith,
	extractionResult,
	fitnessCandidates,
	fitnessFindings
} from './analysis/consolidation/test-fixtures';
import { buildPreferenceSave } from './analysis/personalization';

const ANALYSIS = { id: 'analysis-uuid', summary: SUMMARY, model: null, reasoning_effort: null };

// What a loader reads back for a saved row: only the FINDING_COLUMNS, as a select would return.
function asLoaded(row: Record<string, unknown>): FindingRow {
	const columns = FINDING_COLUMNS.split(',').map((column) => column.trim());
	return Object.fromEntries(columns.map((column) => [column, row[column]])) as FindingRow;
}

async function savedFitnessAnalysis() {
	const result = await runConsolidation(
		await extractionResult(fitnessCandidates()),
		consolidationProviderWith({ summary: SUMMARY, findings: fitnessFindings(), exclusions: [] })
	);
	let next = 0;
	const { rows, idMap } = toFindingRows(result, ANALYSIS.id, () => `finding-uuid-${++next}`);
	return { result, rows, idMap };
}

function successFindings(rows: FindingRow[]): Finding[] {
	const loaded = toAnalysisResult(ANALYSIS, rows);
	if (loaded.status !== 'success') throw new Error(`Expected success, got ${loaded.status}`);
	return loaded.findings;
}

describe('toAnalysisResult scoring fields', () => {
	it('passes the scoring fields through in camelCase', async () => {
		const { rows } = await savedFitnessAnalysis();
		const findings = successFindings(rows.map(asLoaded));

		expect(findings).toHaveLength(rows.length);
		findings.forEach((finding, index) => {
			const row = rows[index];
			expect(finding).toMatchObject({
				id: row.id,
				effect: row.effect,
				ambiguous: row.ambiguous,
				conditional: row.conditional,
				purposeTypes: row.purpose_types,
				recipientTypes: row.recipient_types
			});
		});
		// Columns stored only for the database stay out of the contract.
		expect(findings[0]).not.toHaveProperty('purpose_types');
		expect(findings[0]).not.toHaveProperty('condition_note');
	});

	it('produces a result that matches the contract', async () => {
		const { rows } = await savedFitnessAnalysis();

		const loaded = toAnalysisResult(ANALYSIS, rows.map(asLoaded));

		expect(AnalysisResultSchema.parse(loaded)).toEqual(loaded);
	});

	it('leaves out effect for older rows that have none', async () => {
		const { rows } = await savedFitnessAnalysis();
		const older = { ...asLoaded(rows[0]), effect: null };

		const [finding] = successFindings([older]);

		expect(finding).not.toHaveProperty('effect');
		// The scorer then sends it to review instead of guessing.
		expect(evaluatePreferences([finding], 'balanced').needsReview).toEqual([
			{ findingId: finding.id, reason: 'missing_effect' }
		]);
	});

	it.each(ProfileIdEnum.options)(
		'scores a reopened %s analysis the same as when it was saved',
		async (profile) => {
			const { result, rows, idMap } = await savedFitnessAnalysis();
			const saved = buildPreferenceSave(result.findings, profile, idMap).evaluations;

			const reopened = evaluatePreferences(successFindings(rows.map(asLoaded)), profile);

			// Same indicators, links, and wording, so a tier can be recomputed on load.
			expect(
				reopened.indicators.map(({ concern, level, indicator, findingId, explanation }) => ({
					concern,
					level,
					indicator,
					findingId,
					explanation
				}))
			).toEqual(saved);
		}
	);
});
