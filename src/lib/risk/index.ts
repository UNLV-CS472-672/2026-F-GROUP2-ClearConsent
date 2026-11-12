// Personalized risk indicators (#12, docs/scoring-model.md). Pure: no network, database, or model.
export { classifyFindings, compareIds } from './classify';
export {
	CONFLICT_THRESHOLD,
	TIER_TABLE,
	causesConflict,
	compareTiers,
	dropOneTier,
	higherTier,
	tierOf
} from './tiers';
export type {
	ClassifiedFindings,
	ReviewEntry,
	ScorableFinding,
	UngroundedEntry,
	UsableFinding
} from './types';
