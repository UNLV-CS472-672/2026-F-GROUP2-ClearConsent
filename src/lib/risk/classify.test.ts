import { describe, expect, it } from 'vitest';
import type { Finding } from '$lib/contracts/analysis';
import { fitnessFindings } from '$lib/contracts/scoring-fixtures';
import { runConsolidation } from '$lib/server/analysis/consolidation/pipeline';
import type { ConsolidatedFinding } from '$lib/server/analysis/consolidation/schemas';
import {
	SUMMARY,
	consolidationProviderWith,
	extractionResult,
	fitnessCandidates,
	fitnessFindings as stage2ModelFindings
} from '$lib/server/analysis/consolidation/test-fixtures';
import { classifyFindings, compareIds } from './classify';
import type { ScorableFinding } from './types';

// Compile-time check: both finding shapes are accepted without converting.
const acceptsContractFinding = (finding: Finding): ScorableFinding => finding;
const acceptsStage2Finding = (finding: ConsolidatedFinding): ScorableFinding => finding;

function finding(id: string, overrides: Partial<ScorableFinding> = {}): ScorableFinding {
	return {
		id,
		category: 'sharing',
		effect: 'exposes',
		ambiguous: false,
		conditional: false,
		purposeTypes: ['service'],
		recipientTypes: ['service_provider'],
		evidence: [{ excerpt: 'Quoted policy text.' }],
		...overrides
	};
}

describe('classifyFindings', () => {
	it('uses a finding with evidence, an effect, and clear text', () => {
		expect(classifyFindings([finding('F001')])).toEqual({
			usable: [{ id: 'F001', category: 'sharing', effect: 'exposes', tier: 'routine' }],
			needsReview: [],
			ungrounded: []
		});
	});

	it('uses protects findings with no tier', () => {
		const result = classifyFindings([finding('F001', { effect: 'protects' })]);
		expect(result.usable).toEqual([
			{ id: 'F001', category: 'sharing', effect: 'protects', tier: null }
		]);
	});

	it.each([
		['no evidence items', []],
		['blank excerpts', [{ excerpt: '' }, { excerpt: '  \n\t' }]]
	])('reports a finding with %s as ungrounded', (_label, evidence) => {
		expect(classifyFindings([finding('F001', { evidence })])).toEqual({
			usable: [],
			needsReview: [],
			ungrounded: [{ findingId: 'F001' }]
		});
	});

	it('keeps a finding if any excerpt has real text', () => {
		const result = classifyFindings([
			finding('F001', { evidence: [{ excerpt: '  ' }, { excerpt: 'Real text.' }] })
		]);
		expect(result.usable).toHaveLength(1);
	});

	it.each([undefined, null])('sends a finding with effect %s to review', (effect) => {
		expect(classifyFindings([finding('F001', { effect })])).toEqual({
			usable: [],
			needsReview: [{ findingId: 'F001', reason: 'missing_effect' }],
			ungrounded: []
		});
	});

	it('sends an ambiguous finding to review', () => {
		expect(classifyFindings([finding('F001', { ambiguous: true })])).toEqual({
			usable: [],
			needsReview: [{ findingId: 'F001', reason: 'ambiguous' }],
			ungrounded: []
		});
	});

	it('treats a missing ambiguous flag as clear', () => {
		const result = classifyFindings([finding('F001', { ambiguous: undefined })]);
		expect(result.usable).toHaveLength(1);
	});

	it('applies the checks in order: evidence, then effect, then ambiguity', () => {
		const result = classifyFindings([
			finding('F001', { evidence: [], effect: undefined, ambiguous: true }),
			finding('F002', { effect: undefined, ambiguous: true })
		]);

		expect(result.ungrounded).toEqual([{ findingId: 'F001' }]);
		expect(result.needsReview).toEqual([{ findingId: 'F002', reason: 'missing_effect' }]);
	});

	it('gives the same output for any input order', () => {
		const findings = [
			finding('F003', { ambiguous: true }),
			finding('F001'),
			finding('F005', { evidence: [] }),
			finding('F002', { effect: 'protects' }),
			finding('F004', { effect: undefined })
		];
		const expected = classifyFindings(findings);

		for (const order of [[...findings].reverse(), [2, 4, 0, 3, 1].map((i) => findings[i])]) {
			expect(classifyFindings(order)).toEqual(expected);
		}
		expect(expected.usable.map((item) => item.id)).toEqual(['F001', 'F002']);
		expect(expected.needsReview.map((item) => item.findingId)).toEqual(['F003', 'F004']);
	});

	it('does not change its input', () => {
		const findings = [finding('F002'), finding('F001')];
		const copy = structuredClone(findings);
		classifyFindings(findings);
		expect(findings).toEqual(copy);
	});

	it('returns empty lists for no findings', () => {
		expect(classifyFindings([])).toEqual({ usable: [], needsReview: [], ungrounded: [] });
	});
});

describe('compareIds', () => {
	it('sorts by code units, not locale', () => {
		expect(['F010', 'F002', 'F001', 'a', 'B'].sort(compareIds)).toEqual([
			'B',
			'F001',
			'F002',
			'F010',
			'a'
		]);
	});
});

describe('sect. 8 fitness example', () => {
	it('classifies the contract fixture as the design doc says', () => {
		expect(classifyFindings(fitnessFindings.map(acceptsContractFinding))).toEqual({
			usable: [
				{ id: 'A', category: 'sharing', effect: 'exposes', tier: 'routine' },
				{ id: 'B', category: 'sharing', effect: 'exposes', tier: 'notable' },
				{ id: 'C', category: 'user_rights', effect: 'exposes', tier: 'serious' },
				{ id: 'D', category: 'security_practices', effect: 'protects', tier: null },
				{ id: 'F', category: 'collection', effect: 'exposes', tier: 'routine' }
			],
			needsReview: [{ findingId: 'E', reason: 'ambiguous' }],
			ungrounded: []
		});
	});

	it('classifies real Stage 2 output the same way', async () => {
		const stage1 = await extractionResult(fitnessCandidates());
		const provider = consolidationProviderWith({
			summary: SUMMARY,
			findings: stage2ModelFindings(),
			exclusions: []
		});
		const result = await runConsolidation(stage1, provider);
		const classified = classifyFindings(result.findings.map(acceptsStage2Finding));

		// Stage 2 numbers findings by its own ordering, so compare as a sorted set.
		const tiers = classified.usable.map(({ category, tier }) => `${category}:${tier}`).sort();
		expect(tiers).toEqual([
			'collection:routine',
			'security_practices:null',
			'sharing:notable',
			'sharing:routine',
			'user_rights:serious'
		]);
		expect(classified.needsReview.map((item) => item.reason)).toEqual(['ambiguous']);
		expect(classified.ungrounded).toEqual([]);
	});
});
