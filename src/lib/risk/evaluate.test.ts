import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FindingCategory } from '$lib/contracts/analysis';
import {
	BUILT_IN_PROFILES,
	PreferenceEvaluationSchema,
	ProfileIdEnum,
	createPreferenceSnapshot,
	type PreferenceEvaluation,
	type ProfileId
} from '$lib/contracts/preferences';
import { fitnessBalancedEvaluation, fitnessFindings } from '$lib/contracts/scoring-fixtures';
import { runConsolidation } from '$lib/server/analysis/consolidation/pipeline';
import {
	SUMMARY,
	consolidationProviderWith,
	extractionResult,
	fitnessCandidates,
	fitnessFindings as stage2ModelFindings
} from '$lib/server/analysis/consolidation/test-fixtures';
import { evaluatePreferences } from './evaluate';
import { causesConflict, tierOf } from './tiers';
import type { ScorableFinding } from './types';

const PROFILES = ProfileIdEnum.options;

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
		plain_language_description: `Description of ${id}.`,
		...overrides
	};
}

// Every evaluation has exactly one indicator per concern, so find() always succeeds here.
function indicatorFor(evaluation: PreferenceEvaluation, concern: FindingCategory) {
	return evaluation.indicators.find((item) => item.concern === concern)!;
}

// Indicators without their wording. Used where two results should agree on the outcome but
// their explanations are allowed to differ (for example, an evidence gap mentions findings in
// review, or the fixture's explanations were written by hand).
function withoutExplanations(evaluation: PreferenceEvaluation) {
	return evaluation.indicators.map((item) => ({
		concern: item.concern,
		level: item.level,
		indicator: item.indicator,
		findingId: item.findingId,
		tier: item.tier
	}));
}

// #72's schema checks the shape of a result but not the sect. 5 thresholds, so this also checks
// that each indicator follows from its level and tier: a conflict must reach the threshold, and
// an alignment that links an exposes finding (tier not null) must stay below it. Alignments that
// link a protection have no tier, so there's nothing to compare.
function expectConsistent(evaluation: PreferenceEvaluation) {
	expect(PreferenceEvaluationSchema.safeParse(evaluation).success).toBe(true);
	for (const item of evaluation.indicators) {
		if (item.indicator === 'conflict') {
			expect(causesConflict(item.tier, item.level)).toBe(true);
		}
		if (item.indicator === 'alignment' && item.tier !== null) {
			expect(causesConflict(item.tier, item.level)).toBe(false);
		}
	}
}

// A pool covering every category, both effects, a conditional finding, and each way a finding is
// held back. Tiers are noted for reference.
const POOL: ScorableFinding[] = [
	finding('F01', { purposeTypes: ['service'], recipientTypes: ['service_provider'] }), // routine
	// serious, dropped to notable because it's conditional
	finding('F02', {
		purposeTypes: ['advertising'],
		recipientTypes: ['advertiser'],
		conditional: true
	}),
	finding('F03', { purposeTypes: ['sale'], recipientTypes: ['data_broker'] }), // serious
	finding('F04', { category: 'use', purposeTypes: ['analytics'] }), // notable
	finding('F05', { category: 'collection', purposeTypes: ['advertising'] }), // notable
	finding('F06', { category: 'retention' }), // notable
	finding('F07', { category: 'user_rights' }), // serious
	finding('F08', { category: 'security_practices', effect: 'protects' }), // no tier
	finding('F09', { category: 'retention', ambiguous: true }), // review: ambiguous
	finding('F10', { category: 'use', effect: undefined }), // review: missing effect
	finding('F11', { category: 'collection', evidence: [] }) // ungrounded
];

// Every combination of the items, from none to all (2^11 = 2,048 for the pool). Each number from
// 0 to 2^n - 1 picks a different combination: bit i set means item i is included. Checking every
// combination tests the rules on all mixes of these findings, not just hand-picked ones.
function subsets<T>(items: T[]): T[][] {
	return Array.from({ length: 2 ** items.length }, (_, mask) =>
		items.filter((_, i) => mask & (1 << i))
	);
}

// Many different orders of the same items: every rotation (each item takes a turn first), plus
// each of those reversed. Fixed rather than random, so a failure always reproduces.
function reorderings<T>(items: T[]): T[][] {
	const rotations = items.map((_, i) => [...items.slice(i), ...items.slice(0, i)]);
	return [...rotations, ...rotations.map((order) => [...order].reverse())];
}

describe('purity', () => {
	afterEach(() => vi.restoreAllMocks());

	it('makes no network calls', () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		evaluatePreferences(POOL, 'balanced');
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('gives identical output for the same input', () => {
		expect(evaluatePreferences(POOL, 'strict')).toEqual(evaluatePreferences(POOL, 'strict'));
	});

	it('does not change its input or the built-in profiles', () => {
		const input = structuredClone(POOL);
		const profiles = structuredClone(BUILT_IN_PROFILES);
		const result = evaluatePreferences(input, 'balanced');

		result.profile.levels.sharing = 'acceptable';
		expect(input).toEqual(POOL);
		expect(BUILT_IN_PROFILES).toEqual(profiles);
	});

	it('gives the same output in any input order', () => {
		for (const profile of PROFILES) {
			const expected = evaluatePreferences(POOL, profile);
			for (const order of reorderings(POOL)) {
				expect(evaluatePreferences(order, profile)).toEqual(expected);
			}
		}
	});
});

describe('indicators', () => {
	it('returns one valid, consistent indicator per concern for every subset and profile', () => {
		for (const subset of subsets(POOL)) {
			for (const profile of PROFILES) {
				const evaluation = evaluatePreferences(subset, profile);
				expect(evaluation.indicators).toHaveLength(6);
				expectConsistent(evaluation);
			}
		}
	});

	it('gives opposite results for opposite levels (FR-9)', () => {
		const notable = finding('F01', { purposeTypes: ['analytics'] });
		expect(tierOf(notable)).toBe('notable');

		const major = evaluatePreferences([notable], 'strict');
		const acceptable = evaluatePreferences([notable], {
			id: 'relaxed',
			levels: { ...BUILT_IN_PROFILES.relaxed, sharing: 'acceptable' }
		});

		expect(indicatorFor(major, 'sharing')).toMatchObject({
			indicator: 'conflict',
			findingId: 'F01'
		});
		expect(indicatorFor(acceptable, 'sharing')).toMatchObject({
			indicator: 'alignment',
			findingId: 'F01'
		});
	});

	it('never conflicts on a routine finding', () => {
		for (const profile of PROFILES) {
			const evaluation = evaluatePreferences([finding('F01')], profile);
			expect(indicatorFor(evaluation, 'sharing').indicator).toBe('alignment');
		}
	});

	it('never conflicts at acceptable', () => {
		const evaluation = evaluatePreferences(
			[finding('F01', { category: 'use', purposeTypes: ['sale'] })],
			'relaxed'
		);
		expect(indicatorFor(evaluation, 'use')).toMatchObject({
			indicator: 'alignment',
			tier: 'serious'
		});
	});

	it('treats a conditional serious finding as notable', () => {
		const conditional = finding('F01', { recipientTypes: ['advertiser'], conditional: true });
		const sharing = (profile: ProfileId) =>
			indicatorFor(evaluatePreferences([conditional], profile), 'sharing');

		expect(sharing('balanced')).toMatchObject({ indicator: 'conflict', tier: 'notable' });
		expect(sharing('relaxed')).toMatchObject({ indicator: 'alignment', tier: 'notable' });
	});

	it('lets effect decide the side: a missing right conflicts, a protection aligns', () => {
		const missing = finding('F01', { category: 'user_rights' });
		const protection = finding('F02', { category: 'user_rights', effect: 'protects' });

		expect(indicatorFor(evaluatePreferences([missing], 'balanced'), 'user_rights')).toMatchObject({
			indicator: 'conflict',
			tier: 'serious'
		});
		expect(
			indicatorFor(evaluatePreferences([protection], 'balanced'), 'user_rights')
		).toMatchObject({
			indicator: 'alignment',
			findingId: 'F02',
			tier: null
		});
	});

	it('links the highest-tier conflicting finding, ties to the lowest ID', () => {
		const evaluation = evaluatePreferences(
			[
				finding('F09', { recipientTypes: ['affiliate'] }),
				finding('F05', { recipientTypes: ['data_broker'] }),
				finding('F03', { recipientTypes: ['advertiser'] })
			],
			'strict'
		);
		expect(indicatorFor(evaluation, 'sharing')).toMatchObject({
			findingId: 'F03',
			tier: 'serious'
		});
	});

	it('links a protects finding for alignment, otherwise the highest-tier exposes finding', () => {
		const withProtection = evaluatePreferences(
			[
				finding('F01', { category: 'use', purposeTypes: ['sale'] }),
				finding('F02', { category: 'use', effect: 'protects' })
			],
			'relaxed'
		);
		expect(indicatorFor(withProtection, 'use')).toMatchObject({ findingId: 'F02', tier: null });

		const withoutProtection = evaluatePreferences(
			[
				finding('F01', { category: 'use', purposeTypes: ['service'] }),
				finding('F02', { category: 'use', purposeTypes: ['sale'] })
			],
			'relaxed'
		);
		expect(indicatorFor(withoutProtection, 'use')).toMatchObject({
			findingId: 'F02',
			tier: 'serious'
		});
	});

	it('prefers a conflict over a protection in the same concern', () => {
		const evaluation = evaluatePreferences(
			[
				finding('F01', { category: 'user_rights', effect: 'protects' }),
				finding('F02', { category: 'user_rights' })
			],
			'balanced'
		);
		expect(indicatorFor(evaluation, 'user_rights')).toMatchObject({
			indicator: 'conflict',
			findingId: 'F02'
		});
	});
});

describe('findings held back', () => {
	it('sends ambiguous and missing-effect findings to review without changing any indicator', () => {
		const base = [finding('F01', { category: 'user_rights' })];
		const unclear = [
			finding('F02', { category: 'retention', ambiguous: true }),
			finding('F03', { category: 'use', effect: undefined, purposeTypes: ['sale'] })
		];

		for (const profile of PROFILES) {
			const withUnclear = evaluatePreferences([...base, ...unclear], profile);
			const without = evaluatePreferences(base, profile);

			// Only the explanations may differ: the retention gap now mentions a passage in review.
			expect(withUnclear.needsReview).toEqual([
				{ findingId: 'F02', reason: 'ambiguous' },
				{ findingId: 'F03', reason: 'missing_effect' }
			]);
			expect(withoutExplanations(withUnclear)).toEqual(withoutExplanations(without));
		}
	});

	it('mentions review in the evidence-gap explanation for that concern', () => {
		const evaluation = evaluatePreferences(
			[finding('F01', { category: 'retention', ambiguous: true })],
			'balanced'
		);
		expect(indicatorFor(evaluation, 'retention').explanation).toBe(
			"Not enough evidence: the policy doesn't clearly describe how long it keeps your data. A related passage is listed for review."
		);
		expect(indicatorFor(evaluation, 'use').explanation).not.toContain('review');
	});

	it('reports uncited findings as ungrounded and uses them for nothing', () => {
		const evaluation = evaluatePreferences(
			[finding('F01', { category: 'user_rights', evidence: [{ excerpt: '  ' }] })],
			'strict'
		);
		expect(evaluation.ungrounded).toEqual([{ findingId: 'F01' }]);
		expect(indicatorFor(evaluation, 'user_rights').indicator).toBe('insufficient_evidence');
	});
});

describe('no false reassurance', () => {
	it('gives insufficient evidence for every concern when there are no findings', () => {
		for (const profile of PROFILES) {
			const evaluation = evaluatePreferences([], profile);
			expect(
				evaluation.indicators.every((item) => item.indicator === 'insufficient_evidence')
			).toBe(true);
			expect(evaluation.counts).toEqual({ conflict: 0, alignment: 0, insufficient_evidence: 6 });
			expect(evaluation.summary).toBe(
				'Not enough evidence to compare this policy with your preferences.'
			);
		}
	});

	it('does not call a policy with gaps conflict-free without saying so', () => {
		const evaluation = evaluatePreferences([finding('F01')], 'balanced');
		expect(evaluation.summary).toBe(
			'No conflicts with your preferences, but 5 concerns could not be checked for lack of evidence.'
		);
	});
});

// More evidence of a risky practice should never make a policy look safer. For every combination
// of the pool, adding any one missing finding must keep every conflict that was already there.
describe('adding a finding never removes a conflict', () => {
	it('holds for every subset of the pool and every profile', () => {
		const conflicts = (findings: ScorableFinding[], profile: ProfileId) =>
			new Set(
				evaluatePreferences(findings, profile)
					.indicators.filter((item) => item.indicator === 'conflict')
					.map((item) => item.concern)
			);

		for (const profile of PROFILES) {
			for (const subset of subsets(POOL)) {
				const before = conflicts(subset, profile);
				for (const extra of POOL.filter((item) => !subset.includes(item))) {
					const after = conflicts([...subset, extra], profile);
					for (const concern of before) expect(after.has(concern)).toBe(true);
				}
			}
		}
	});
});

describe('display order', () => {
	it('puts major before concern among conflicts of the same tier, even against concern order', () => {
		const evaluation = evaluatePreferences(
			[
				finding('F01', { category: 'use', purposeTypes: ['sale'] }), // serious, concern
				finding('F02', { category: 'security_practices' }) // serious, major
			],
			{
				id: 'balanced',
				levels: { ...BUILT_IN_PROFILES.balanced, security_practices: 'major' }
			}
		);

		expect(evaluation.indicators.slice(0, 2).map((item) => item.concern)).toEqual([
			'security_practices',
			'use'
		]);
	});

	it('puts conflicts first by tier then level, then insufficient evidence, then alignment', () => {
		const evaluation = evaluatePreferences(
			[
				finding('F01', { category: 'collection', purposeTypes: ['advertising'] }), // notable, major
				finding('F02', { category: 'use', purposeTypes: ['analytics'] }), // notable, major
				finding('F03', { category: 'retention' }), // notable, concern -> alignment
				finding('F04', { category: 'security_practices' }), // serious, concern
				finding('F05', { recipientTypes: ['data_broker'] }) // serious, major
			],
			{
				id: 'balanced',
				levels: { ...BUILT_IN_PROFILES.balanced, collection: 'major', use: 'major' }
			}
		);

		expect(evaluation.indicators.map((item) => [item.concern, item.indicator])).toEqual([
			['sharing', 'conflict'], // serious, major
			['security_practices', 'conflict'], // serious, concern
			['collection', 'conflict'], // notable, major, earlier concern
			['use', 'conflict'], // notable, major
			['user_rights', 'insufficient_evidence'],
			['retention', 'alignment']
		]);
	});
});

describe('explanations and summary', () => {
	it('names the concern, level, and finding', () => {
		const evaluation = evaluatePreferences(
			[
				finding('F01', {
					recipientTypes: ['advertiser'],
					plain_language_description: 'Location is shared with ad partners'
				})
			],
			'balanced'
		);
		expect(indicatorFor(evaluation, 'sharing').explanation).toBe(
			'Conflict: you marked sharing as a major concern. Location is shared with ad partners.'
		);
		expect(evaluation.summary).toBe(
			'1 conflict with your preferences. Most important (sharing): Location is shared with ad partners.'
		);
	});

	it('explains alignment against the level', () => {
		const evaluation = evaluatePreferences([finding('F01', { category: 'use' })], 'relaxed');
		expect(indicatorFor(evaluation, 'use').explanation).toBe(
			'Alignment: this fits your use preference (acceptable). Description of F01.'
		);
	});

	it('uses the Stage 2 description field, and falls back to the ID', () => {
		const stage2 = finding('F01', {
			plain_language_description: undefined,
			description: 'Stage 2 text.'
		});
		const blank = finding('F02', { category: 'use', plain_language_description: '  ' });

		const evaluation = evaluatePreferences([stage2, blank], 'relaxed');
		expect(indicatorFor(evaluation, 'sharing').explanation).toContain('Stage 2 text.');
		expect(indicatorFor(evaluation, 'use').explanation).toContain('See finding F02.');
	});

	it('mentions findings in review in the summary', () => {
		const evaluation = evaluatePreferences(
			[finding('F01', { ambiguous: true }), finding('F02', { ambiguous: true })],
			'balanced'
		);
		expect(evaluation.summary).toBe(
			'Not enough evidence to compare this policy with your preferences. 2 findings need review.'
		);
	});
});

describe('profiles', () => {
	it('accepts saved snapshot levels and copies them', () => {
		const snapshot = createPreferenceSnapshot('strict');
		const evaluation = evaluatePreferences(POOL, { id: snapshot.profile, levels: snapshot.levels });

		expect(evaluation.profile).toEqual({ id: 'strict', levels: BUILT_IN_PROFILES.strict });
		expect(evaluation.profile.levels).not.toBe(snapshot.levels);
		expect(evaluation).toEqual(evaluatePreferences(POOL, 'strict'));
	});
});

describe('sect. 8 fitness example', () => {
	// The fixture's explanations and summary were written by hand, so they can't match generated
	// wording. Everything else (indicators, links, tiers, counts, review lists) must match exactly.
	const shape = (evaluation: PreferenceEvaluation) => ({
		...evaluation,
		indicators: withoutExplanations(evaluation),
		summary: undefined
	});

	it('matches the expected Balanced evaluation (wording aside)', () => {
		expect(shape(evaluatePreferences(fitnessFindings, 'balanced'))).toEqual(
			shape(fitnessBalancedEvaluation)
		);
	});

	it.each<[ProfileId, string[]]>([
		[
			'balanced',
			[
				'user_rights:conflict:C',
				'sharing:conflict:B',
				'use:insufficient_evidence:',
				'retention:insufficient_evidence:',
				'collection:alignment:F',
				'security_practices:alignment:D'
			]
		],
		[
			'strict',
			[
				'user_rights:conflict:C',
				'sharing:conflict:B',
				'use:insufficient_evidence:',
				'retention:insufficient_evidence:',
				'collection:alignment:F',
				'security_practices:alignment:D'
			]
		],
		[
			'relaxed',
			[
				'user_rights:conflict:C',
				'use:insufficient_evidence:',
				'retention:insufficient_evidence:',
				'collection:alignment:F',
				'sharing:alignment:B',
				'security_practices:alignment:D'
			]
		]
	])('gives the design doc results for %s', (profile, expected) => {
		const evaluation = evaluatePreferences(fitnessFindings, profile);
		expect(
			evaluation.indicators.map((i) => `${i.concern}:${i.indicator}:${i.findingId ?? ''}`)
		).toEqual(expected);
		expect(evaluation.needsReview).toEqual([{ findingId: 'E', reason: 'ambiguous' }]);
		expectConsistent(evaluation);
	});

	it('gives the same indicators for real Stage 2 output', async () => {
		const stage1 = await extractionResult(fitnessCandidates());
		const result = await runConsolidation(
			stage1,
			consolidationProviderWith({
				summary: SUMMARY,
				findings: stage2ModelFindings(),
				exclusions: []
			})
		);

		// Stage 2 numbers findings F001, F002, ... instead of A-F, so this compares results by
		// concern rather than by finding ID.
		for (const profile of PROFILES) {
			const fromStage2 = evaluatePreferences(result.findings, profile);
			const fromContract = evaluatePreferences(fitnessFindings, profile);

			expect(fromStage2.indicators.map((i) => [i.concern, i.indicator, i.tier])).toEqual(
				fromContract.indicators.map((i) => [i.concern, i.indicator, i.tier])
			);
			expectConsistent(fromStage2);
		}
	});
});
