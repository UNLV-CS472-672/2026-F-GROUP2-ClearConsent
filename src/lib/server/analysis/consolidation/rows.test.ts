import { describe, expect, it } from 'vitest';
import { runStage2Consolidation } from './pipeline';
import { toAnalysisResultFields, toFindingRows } from './rows';
import { FINDING_CATEGORIES, PURPOSE_TYPES, RECIPIENT_TYPES } from './schemas';
import {
	FITNESS_POLICY,
	fitnessCandidates,
	fitnessFindings,
	stage1Result,
	stage2ProviderWith,
	SUMMARY
} from './test-fixtures';

async function completeResult() {
	const findings = fitnessFindings();
	findings[0].relevantPreferences = ['sharing'];
	return runStage2Consolidation(
		await stage1Result(fitnessCandidates(), { sharing: 'major' }),
		stage2ProviderWith({ summary: SUMMARY, findings, exclusions: [] })
	);
}

describe('Stage 2 database mapping', () => {
	it('maps a complete result onto the analyses columns', async () => {
		const result = await completeResult();
		expect(toAnalysisResultFields(result)).toEqual({
			source_title: null,
			source_text: FITNESS_POLICY,
			summary: SUMMARY,
			outcome: 'findings_identified'
		});
	});

	it('maps findings onto rows that satisfy the migration constraints', async () => {
		const result = await completeResult();
		let next = 0;
		const { rows, idMap } = toFindingRows(result, 'analysis-uuid', () => `uuid-${++next}`);

		expect(rows).toHaveLength(6);
		expect(Object.keys(idMap)).toEqual(['F001', 'F002', 'F003', 'F004', 'F005', 'F006']);
		expect(rows.map((row) => row.display_order)).toEqual([0, 1, 2, 3, 4, 5]);
		for (const [index, row] of rows.entries()) {
			expect(row.id).toBe(idMap[result.findings[index].id]);
			expect(row.analysis_id).toBe('analysis-uuid');
			expect(FINDING_CATEGORIES).toContain(row.category);
			expect(['exposes', 'protects']).toContain(row.effect);
			expect(row.plain_language_description.trim()).not.toBe('');
			if (row.ambiguous) expect(row.uncertainty_note?.trim()).toBeTruthy();
			if (row.conditional) expect(row.condition_note?.trim()).toBeTruthy();
			for (const value of row.purpose_types) expect(PURPOSE_TYPES).toContain(value);
			for (const value of row.recipient_types) expect(RECIPIENT_TYPES).toContain(value);
			// evidence_objects_valid: a nonempty array of objects with a nonblank excerpt.
			expect(row.evidence.length).toBeGreaterThan(0);
			for (const item of row.evidence) {
				expect(item.excerpt).toMatch(/\S/);
				expect(FITNESS_POLICY.slice(item.startOffset, item.endOffset)).toBe(item.excerpt);
			}
		}
		expect(rows[0].relevant_preferences).toEqual(['sharing']);
	});

	it('refuses to map a result that is not complete', async () => {
		const findings = fitnessFindings().slice(1);
		const partial = await runStage2Consolidation(
			await stage1Result(fitnessCandidates()),
			stage2ProviderWith({ summary: SUMMARY, findings, exclusions: [] })
		);
		expect(partial.analysisStatus).toBe('in_progress');
		expect(() => toFindingRows(partial, 'analysis-uuid')).toThrow(/Only a complete analysis/);
		expect(() => toAnalysisResultFields(partial)).toThrow(/Only a complete analysis/);
	});
});
