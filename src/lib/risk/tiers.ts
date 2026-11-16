import type { FindingCategory, PurposeType, RecipientType } from '$lib/contracts/analysis';
import type { Level, Tier } from '$lib/contracts/preferences';
import type { ScorableFinding } from './types';

// Tier table from docs/scoring-model.md sect. 4. Kept as data so values can be tuned without
// touching the logic below. A category either has a fixed tier, or a tier per recipient and
// purpose type, where the finding gets the highest tier any of its types reaches.
type TypeRule = {
	recipients?: Record<RecipientType, Tier>;
	purposes: Record<PurposeType, Tier>;
	// The type lists every finding in this category has. Stage 2 leaves a list empty when it does
	// not apply, so an empty list only counts as unspecified when it always applies (sect. 3).
	alwaysApplies: { recipients: boolean; purposes: boolean };
};

type CategoryRule = { fixed: Tier } | TypeRule;

// Sharing with service providers or government is routine only when the purpose is also service
// or legal/security; any other recipient or purpose raises the tier.
const SHARING_RECIPIENTS: Record<RecipientType, Tier> = {
	service_provider: 'routine',
	government: 'routine',
	affiliate: 'notable',
	other: 'notable',
	unspecified: 'notable',
	advertiser: 'serious',
	data_broker: 'serious'
};

const SHARING_AND_USE_PURPOSES: Record<PurposeType, Tier> = {
	service: 'routine',
	legal_security: 'routine',
	analytics: 'notable',
	other: 'notable',
	unspecified: 'notable',
	advertising: 'serious',
	sale: 'serious'
};

// Sensitive data could make collection serious later (sect. 10); for now ads or sale is the top.
const COLLECTION_PURPOSES: Record<PurposeType, Tier> = {
	service: 'routine',
	legal_security: 'routine',
	analytics: 'routine',
	other: 'routine',
	unspecified: 'routine',
	advertising: 'notable',
	sale: 'notable'
};

export const TIER_TABLE: Record<FindingCategory, CategoryRule> = {
	// Sharing always has a recipient, but its purpose may not apply: "we use a cloud hosting
	// provider" is rated by the recipient alone.
	sharing: {
		recipients: SHARING_RECIPIENTS,
		purposes: SHARING_AND_USE_PURPOSES,
		alwaysApplies: { recipients: true, purposes: false }
	},
	// Use is about purpose, so a use finding with no purpose type was not classified.
	use: {
		purposes: SHARING_AND_USE_PURPOSES,
		alwaysApplies: { recipients: false, purposes: true }
	},
	// Unspecified collection is routine anyway, so an empty list gives the same tier either way.
	collection: {
		purposes: COLLECTION_PURPOSES,
		alwaysApplies: { recipients: false, purposes: false }
	},
	retention: { fixed: 'notable' },
	// An exposes finding here is a missing or restricted right, or a missing or weak protection.
	user_rights: { fixed: 'serious' },
	security_practices: { fixed: 'serious' }
};

const TIER_RANK: Record<Tier, number> = { routine: 0, notable: 1, serious: 2 };

const TIER_BY_RANK: Tier[] = ['routine', 'notable', 'serious'];

export function higherTier(a: Tier, b: Tier): Tier {
	return TIER_RANK[a] >= TIER_RANK[b] ? a : b;
}

// The types a finding is rated on (sect. 3):
// - a missing list (null or undefined) means the finding was never classified, so it counts as
//   unspecified rather than as safe (FR-7);
// - an empty list means the types do not apply, unless the category always has them, in which
//   case the type was left out and also counts as unspecified;
// - otherwise the listed types, including an explicit 'unspecified'.
function typesToRate<T extends string>(
	types: readonly T[] | null | undefined,
	alwaysApplies: boolean
): T[] {
	if (types === null || types === undefined) {
		return ['unspecified' as T];
	}
	if (types.length === 0) {
		return alwaysApplies ? ['unspecified' as T] : [];
	}
	return [...types];
}

function baseTier(finding: ScorableFinding): Tier {
	const rule = TIER_TABLE[finding.category];

	if ('fixed' in rule) {
		return rule.fixed;
	}

	let tier: Tier = 'routine';

	for (const purpose of typesToRate(finding.purposeTypes, rule.alwaysApplies.purposes)) {
		tier = higherTier(tier, rule.purposes[purpose]);
	}

	if (rule.recipients) {
		for (const recipient of typesToRate(finding.recipientTypes, rule.alwaysApplies.recipients)) {
			tier = higherTier(tier, rule.recipients[recipient]);
		}
	}

	return tier;
}

// A practice that only happens if the user opts in drops one tier; routine stays routine.
export function dropOneTier(tier: Tier): Tier {
	return TIER_BY_RANK[Math.max(TIER_RANK[tier] - 1, 0)];
}

// Tier of an exposes finding. Protects findings and findings without an effect have no tier.
export function tierOf(finding: ScorableFinding): Tier | null {
	if (finding.effect !== 'exposes') {
		return null;
	}

	const tier = baseTier(finding);
	return finding.conditional === true ? dropOneTier(tier) : tier;
}

// Lowest tier that causes a conflict at each level (sect. 5). null means the level never
// conflicts. Routine is never a threshold, so routine findings never conflict.
export const CONFLICT_THRESHOLD: Record<Level, Tier | null> = {
	acceptable: null,
	concern: 'serious',
	major: 'notable'
};

export function causesConflict(tier: Tier | null, level: Level): boolean {
	const threshold = CONFLICT_THRESHOLD[level];

	if (tier === null || threshold === null) {
		return false;
	}

	return TIER_RANK[tier] >= TIER_RANK[threshold];
}

// Highest first, for picking and ordering the strongest finding.
export function compareTiers(a: Tier, b: Tier): number {
	return TIER_RANK[b] - TIER_RANK[a];
}
