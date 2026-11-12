import { describe, expect, it } from 'vitest';
import {
	FindingCategoryEnum,
	PurposeTypeEnum,
	RecipientTypeEnum,
	type FindingCategory,
	type PurposeType,
	type RecipientType
} from '$lib/contracts/analysis';
import { LevelEnum, TierEnum, type Level, type Tier } from '$lib/contracts/preferences';
import { fitnessFindings } from '$lib/contracts/scoring-fixtures';
import {
	CONFLICT_THRESHOLD,
	TIER_TABLE,
	causesConflict,
	compareTiers,
	dropOneTier,
	tierOf
} from './tiers';
import type { ScorableFinding } from './types';

function exposes(
	category: FindingCategory,
	purposeTypes: PurposeType[] = [],
	recipientTypes: RecipientType[] = [],
	conditional = false
): ScorableFinding {
	return {
		id: 'F001',
		category,
		effect: 'exposes',
		ambiguous: false,
		conditional,
		purposeTypes,
		recipientTypes,
		evidence: [{ excerpt: 'Quoted policy text.' }]
	};
}

describe('tier table', () => {
	it('covers every category, recipient type, and purpose type', () => {
		expect(Object.keys(TIER_TABLE).sort()).toEqual([...FindingCategoryEnum.options].sort());

		for (const rule of Object.values(TIER_TABLE)) {
			if ('fixed' in rule) {
				expect(TierEnum.options).toContain(rule.fixed);
				continue;
			}
			expect(Object.keys(rule.purposes).sort()).toEqual([...PurposeTypeEnum.options].sort());
			if (rule.recipients) {
				expect(Object.keys(rule.recipients).sort()).toEqual([...RecipientTypeEnum.options].sort());
			}
		}
	});
});

describe('sharing tiers', () => {
	it.each<[RecipientType, PurposeType]>([
		['service_provider', 'service'],
		['service_provider', 'legal_security'],
		['government', 'legal_security'],
		['government', 'service']
	])('is routine for %s with purpose %s', (recipient, purpose) => {
		expect(tierOf(exposes('sharing', [purpose], [recipient]))).toBe('routine');
	});

	it.each<RecipientType>(['affiliate', 'other', 'unspecified'])(
		'is notable for recipient %s',
		(recipient) => {
			expect(tierOf(exposes('sharing', ['service'], [recipient]))).toBe('notable');
		}
	);

	it.each<PurposeType>(['analytics', 'other', 'unspecified'])(
		'is notable for purpose %s',
		(purpose) => {
			expect(tierOf(exposes('sharing', [purpose], ['service_provider']))).toBe('notable');
		}
	);

	it.each<RecipientType>(['advertiser', 'data_broker'])(
		'is serious for recipient %s',
		(recipient) => {
			expect(tierOf(exposes('sharing', ['service'], [recipient]))).toBe('serious');
		}
	);

	it.each<PurposeType>(['advertising', 'sale'])('is serious for purpose %s', (purpose) => {
		expect(tierOf(exposes('sharing', [purpose], ['service_provider']))).toBe('serious');
	});

	it('treats empty types as unspecified', () => {
		expect(tierOf(exposes('sharing', [], ['service_provider']))).toBe('notable');
		expect(tierOf(exposes('sharing', ['service'], []))).toBe('notable');
		expect(tierOf({ ...exposes('sharing'), purposeTypes: undefined, recipientTypes: null })).toBe(
			'notable'
		);
	});

	it('takes the highest tier across all types', () => {
		const finding = exposes(
			'sharing',
			['service', 'analytics'],
			['service_provider', 'data_broker']
		);
		expect(tierOf(finding)).toBe('serious');
	});
});

describe('use tiers', () => {
	it.each<[PurposeType, Tier]>([
		['service', 'routine'],
		['legal_security', 'routine'],
		['analytics', 'notable'],
		['other', 'notable'],
		['unspecified', 'notable'],
		['advertising', 'serious'],
		['sale', 'serious']
	])('purpose %s is %s', (purpose, tier) => {
		expect(tierOf(exposes('use', [purpose]))).toBe(tier);
	});

	it('ignores recipient types', () => {
		expect(tierOf(exposes('use', ['service'], ['data_broker']))).toBe('routine');
	});

	it('treats empty purposes as unspecified', () => {
		expect(tierOf(exposes('use'))).toBe('notable');
	});
});

describe('collection tiers', () => {
	it.each<[PurposeType, Tier]>([
		['service', 'routine'],
		['legal_security', 'routine'],
		['analytics', 'routine'],
		['other', 'routine'],
		['unspecified', 'routine'],
		['advertising', 'notable'],
		['sale', 'notable']
	])('purpose %s is %s', (purpose, tier) => {
		expect(tierOf(exposes('collection', [purpose]))).toBe(tier);
	});

	it('is routine with no purposes', () => {
		expect(tierOf(exposes('collection'))).toBe('routine');
	});
});

describe('fixed tiers', () => {
	it.each<[FindingCategory, Tier]>([
		['retention', 'notable'],
		['user_rights', 'serious'],
		['security_practices', 'serious']
	])('%s is always %s', (category, tier) => {
		expect(tierOf(exposes(category))).toBe(tier);
		expect(tierOf(exposes(category, ['service'], ['service_provider']))).toBe(tier);
		expect(tierOf(exposes(category, ['sale'], ['data_broker']))).toBe(tier);
	});
});

describe('conditional findings', () => {
	it('drops one tier', () => {
		expect(dropOneTier('serious')).toBe('notable');
		expect(dropOneTier('notable')).toBe('routine');
		expect(dropOneTier('routine')).toBe('routine');
	});

	it('applies the drop after the table', () => {
		expect(tierOf(exposes('sharing', ['advertising'], ['advertiser'], true))).toBe('notable');
		expect(tierOf(exposes('retention', [], [], true))).toBe('routine');
		expect(tierOf(exposes('collection', ['service'], [], true))).toBe('routine');
	});

	it('treats a missing conditional as false', () => {
		expect(tierOf({ ...exposes('user_rights'), conditional: undefined })).toBe('serious');
		expect(tierOf({ ...exposes('user_rights'), conditional: null })).toBe('serious');
	});
});

describe('findings without a tier', () => {
	it('gives protects findings no tier', () => {
		expect(tierOf({ ...exposes('security_practices'), effect: 'protects' })).toBeNull();
	});

	it('gives findings without an effect no tier', () => {
		expect(tierOf({ ...exposes('sharing', ['sale']), effect: undefined })).toBeNull();
		expect(tierOf({ ...exposes('sharing', ['sale']), effect: null })).toBeNull();
	});
});

describe('conflict thresholds', () => {
	const expected: Record<Level, Record<Tier, boolean>> = {
		acceptable: { routine: false, notable: false, serious: false },
		concern: { routine: false, notable: false, serious: true },
		major: { routine: false, notable: true, serious: true }
	};

	it.each(LevelEnum.options.flatMap((level) => TierEnum.options.map((tier) => [level, tier])))(
		'level %s with tier %s matches sect. 5',
		(level, tier) => {
			expect(causesConflict(tier as Tier, level as Level)).toBe(
				expected[level as Level][tier as Tier]
			);
		}
	);

	it('never conflicts without a tier', () => {
		for (const level of LevelEnum.options) {
			expect(causesConflict(null, level)).toBe(false);
		}
	});

	it('never uses routine as a threshold', () => {
		expect(Object.values(CONFLICT_THRESHOLD)).not.toContain('routine');
	});

	it('gives opposite results for opposite levels (FR-9)', () => {
		const tier = tierOf(exposes('sharing', ['analytics'], ['service_provider']));
		expect(tier).toBe('notable');
		expect(causesConflict(tier, 'major')).toBe(true);
		expect(causesConflict(tier, 'acceptable')).toBe(false);
	});
});

describe('tier ordering', () => {
	it('sorts highest first', () => {
		const tiers: Tier[] = ['routine', 'serious', 'notable'];
		expect(tiers.sort(compareTiers)).toEqual(['serious', 'notable', 'routine']);
	});
});

describe('sect. 8 fitness example', () => {
	it('gives each finding the tier in the design doc', () => {
		const tiers = Object.fromEntries(
			fitnessFindings.map((finding) => [finding.id, tierOf(finding)])
		);

		expect(tiers).toEqual({
			A: 'routine',
			B: 'notable',
			C: 'serious',
			D: null,
			E: 'notable',
			F: 'routine'
		});
	});
});
