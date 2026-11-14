import { FindingCategoryEnum, type FindingCategory } from '$lib/contracts/analysis';
import {
	BUILT_IN_PROFILES,
	RULES_VERSION,
	type ConcernLevels,
	type Indicator,
	type Level,
	type PreferenceEvaluation,
	type PreferenceIndicator,
	type ProfileId
} from '$lib/contracts/preferences';
import { classifyFindings, compareIds } from './classify';
import { causesConflict, compareTiers } from './tiers';
import type { ScorableFinding, UsableFinding } from './types';

// A built-in profile ID, or explicit levels. Explicit levels let a saved analysis be re-scored
// with the preferences stored in its preference_snapshot, even if the built-in profile changes
// later (FR-12).
export type ProfileInput = ProfileId | { id: ProfileId; levels: ConcernLevels };

// Concern order from docs/scoring-model.md sect. 3. Used as the last tiebreaker so the display order never depends on input order.
const CONCERNS = FindingCategoryEnum.options;

const CONCERN_LABEL: Record<FindingCategory, string> = {
	collection: 'collection',
	use: 'use',
	sharing: 'sharing',
	retention: 'retention',
	user_rights: 'user rights',
	security_practices: 'security practices'
};

// What the policy would need to describe for each concern, for evidence-gap explanations.
const GAP_TOPIC: Record<FindingCategory, string> = {
	collection: 'what data it collects',
	use: 'how it uses your data',
	sharing: 'who it shares your data with',
	retention: 'how long it keeps your data',
	user_rights: 'what you can do with your data',
	security_practices: 'how it protects your data'
};

const LEVEL_PHRASE: Record<Level, string> = {
	acceptable: 'acceptable',
	concern: 'a concern',
	major: 'a major concern'
};

const LEVEL_RANK: Record<Level, number> = { acceptable: 0, concern: 1, major: 2 };

// Lower ranks are shown first.
const INDICATOR_RANK: Record<Indicator, number> = {
	conflict: 0,
	insufficient_evidence: 1,
	alignment: 2
};

// The levels are copied so a caller that edits the result can't change BUILT_IN_PROFILES or
// the snapshot it passed in.
function resolveProfile(profile: ProfileInput): PreferenceEvaluation['profile'] {
	if (typeof profile === 'string') {
		return { id: profile, levels: { ...BUILT_IN_PROFILES[profile] } };
	}
	return { id: profile.id, levels: { ...profile.levels } };
}

// Sort order for picking a concern's linked finding: highest tier first, then lowest ID, so the
// pick is the same in any input order. Protects findings have no tier, so they sort after any
// exposes finding.
function strongestFirst(a: UsableFinding, b: UsableFinding): number {
	if (a.tier !== b.tier) {
		if (a.tier === null) return 1;
		if (b.tier === null) return -1;
		return compareTiers(a.tier, b.tier);
	}
	return compareIds(a.id, b.id);
}

function sentence(text: string): string {
	const trimmed = text.trim();
	return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

// Explanations quote the finding's own plain-language text. The contract calls the field
// plain_language_description and Stage 2 calls it description, so either is used. If neither
// has text, the finding ID is shown instead so the explanation is never blank (the schema
// rejects blank explanations).
function findingText(finding: ScorableFinding | undefined, id: string): string {
	const text = finding?.plain_language_description ?? finding?.description;
	return text && /\S/.test(text) ? sentence(text) : `See finding ${id}.`;
}

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// An indicator before its explanation is written. reviewCount is how many of this concern's
// findings went to review, so an evidence gap can mention them.
type Draft = Omit<PreferenceIndicator, 'explanation'> & { reviewCount: number };

// The sect. 6 rules for one concern, checked in order:
// 1. Conflict if any exposes finding reaches the level's threshold. It links the most serious
//    one, since that's the strongest reason for the conflict.
// 2. Otherwise alignment if the concern has any usable finding. It links a protection if there
//    is one, because that best explains why the concern is fine; otherwise the most serious
//    exposes finding, which shows what was checked and found within the user's level.
// 3. Otherwise insufficient evidence, with no linked finding. This is never shown as alignment,
//    because no findings doesn't mean no risk (FR-7).
function evaluateConcern(
	concern: FindingCategory,
	level: Level,
	usable: UsableFinding[],
	reviewCount: number
): Draft {
	const exposes = usable.filter((item) => item.effect === 'exposes').sort(strongestFirst);
	const conflicting = exposes.filter((item) => causesConflict(item.tier, level));

	if (conflicting.length > 0) {
		const linked = conflicting[0];
		return {
			concern,
			level,
			indicator: 'conflict',
			findingId: linked.id,
			tier: linked.tier,
			reviewCount
		};
	}

	if (usable.length > 0) {
		const protects = usable.filter((item) => item.effect === 'protects').sort(strongestFirst);
		// usable isn't empty, so at least one of these lists has a finding.
		const linked = protects[0] ?? exposes[0];
		return {
			concern,
			level,
			indicator: 'alignment',
			findingId: linked.id,
			tier: linked.tier,
			reviewCount
		};
	}

	return {
		concern,
		level,
		indicator: 'insufficient_evidence',
		findingId: null,
		tier: null,
		reviewCount
	};
}

function explain(draft: Draft, findingsById: Map<string, ScorableFinding>): string {
	const label = CONCERN_LABEL[draft.concern];

	// findingId is null exactly when the indicator is insufficient_evidence. Checking it here
	// also lets TypeScript treat findingId as a string below.
	if (draft.findingId === null) {
		const gap = `Not enough evidence: the policy doesn't clearly describe ${GAP_TOPIC[draft.concern]}.`;
		if (draft.reviewCount === 0) return gap;
		const passages = draft.reviewCount === 1 ? 'A related passage is' : 'Related passages are';
		return `${gap} ${passages} listed for review.`;
	}

	const text = findingText(findingsById.get(draft.findingId), draft.findingId);

	if (draft.indicator === 'conflict') {
		return `Conflict: you marked ${label} as ${LEVEL_PHRASE[draft.level]}. ${text}`;
	}

	return `Alignment: this fits your ${label} preference (${LEVEL_PHRASE[draft.level]}). ${text}`;
}

// Display order from sect. 6, so the most important result comes first:
// 1. Conflicts, then insufficient evidence, then alignment.
// 2. Among conflicts, serious before notable, then major before concern, since a conflict on
//    something the user cares more about matters more.
// 3. Any remaining tie goes by concern order.
function displayOrder(a: Draft, b: Draft): number {
	if (a.indicator !== b.indicator) {
		return INDICATOR_RANK[a.indicator] - INDICATOR_RANK[b.indicator];
	}

	if (a.indicator === 'conflict' && a.tier !== null && b.tier !== null) {
		if (a.tier !== b.tier) return compareTiers(a.tier, b.tier);
		if (a.level !== b.level) return LEVEL_RANK[b.level] - LEVEL_RANK[a.level];
	}

	return CONCERNS.indexOf(a.concern) - CONCERNS.indexOf(b.concern);
}

function summarize(
	indicators: PreferenceIndicator[],
	counts: PreferenceEvaluation['counts'],
	reviewCount: number,
	findingsById: Map<string, ScorableFinding>
): string {
	// Indicators are already in display order, so the first conflict is the most important one.
	const top = indicators.find((item) => item.indicator === 'conflict');
	let summary: string;

	if (top && top.findingId !== null) {
		const text = findingText(findingsById.get(top.findingId), top.findingId);
		summary = `${plural(counts.conflict, 'conflict')} with your preferences. Most important (${CONCERN_LABEL[top.concern]}): ${text}`;
	} else if (counts.alignment === 0) {
		summary = 'Not enough evidence to compare this policy with your preferences.';
	} else if (counts.insufficient_evidence > 0) {
		// Don't call a policy conflict-free without saying which concerns couldn't be checked.
		summary = `No conflicts with your preferences, but ${plural(counts.insufficient_evidence, 'concern')} could not be checked for lack of evidence.`;
	} else {
		summary = 'No conflicts with your preferences.';
	}

	if (reviewCount > 0) {
		summary += ` ${plural(reviewCount, 'finding')} ${reviewCount === 1 ? 'needs' : 'need'} review.`;
	}

	return summary;
}

// Compares findings with a preference profile (docs/scoring-model.md sect. 5-7). Pure: no
// network, database, or model access, and the same findings and profile always give the same
// result, in any input order.
export function evaluatePreferences(
	findings: readonly ScorableFinding[],
	profile: ProfileInput
): PreferenceEvaluation {
	const resolved = resolveProfile(profile);
	const { usable, needsReview, ungrounded } = classifyFindings(findings);

	// For looking up a finding's text and category by ID. IDs are unique: the contract rejects
	// duplicates and Stage 2 numbers findings itself.
	const findingsById = new Map(findings.map((finding) => [finding.id, finding]));

	const drafts = CONCERNS.map((concern) => {
		// Findings in review aren't used for the indicator, but an evidence gap mentions them so
		// the user knows the policy may say something about this concern.
		const reviewCount = needsReview.filter(
			(entry) => findingsById.get(entry.findingId)?.category === concern
		).length;

		return evaluateConcern(
			concern,
			resolved.levels[concern],
			usable.filter((item) => item.category === concern),
			reviewCount
		);
	}).sort(displayOrder);

	const indicators: PreferenceIndicator[] = drafts.map((draft) => ({
		concern: draft.concern,
		level: draft.level,
		indicator: draft.indicator,
		findingId: draft.findingId,
		tier: draft.tier,
		explanation: explain(draft, findingsById)
	}));

	const counts = { conflict: 0, alignment: 0, insufficient_evidence: 0 };
	for (const item of indicators) counts[item.indicator] += 1;

	return {
		rulesVersion: RULES_VERSION,
		profile: resolved,
		indicators,
		counts,
		needsReview,
		ungrounded,
		summary: summarize(indicators, counts, needsReview.length, findingsById)
	};
}
