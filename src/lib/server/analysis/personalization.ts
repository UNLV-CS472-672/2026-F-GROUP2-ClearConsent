import type { SupabaseClient } from '@supabase/supabase-js';
import {
	PreferenceEvaluationSchema,
	PreferenceSnapshotSchema,
	StoredPreferencesSchema,
	createPreferenceSnapshot,
	type Indicator,
	type Level,
	type PreferenceEvaluation,
	type PreferenceIndicator,
	type PreferenceSnapshot,
	type ProfileId
} from '$lib/contracts/preferences';
import type { FindingCategory } from '$lib/contracts/analysis';
import {
	classifyFindings,
	countAndSummarize,
	evaluatePreferences,
	tierOf,
	type ScorableFinding
} from '$lib/risk';

// Version of the shape saved in analyses.preference_snapshot (PreferenceSnapshotSchema). The
// scoring rules have their own version inside the snapshot (rulesVersion).
export const PREFERENCE_SNAPSHOT_VERSION = 1;

// Stored preferences the loader understands (privacy_preferences.schema_version).
const STORED_PREFERENCES_VERSION = 1;

// Thrown when the profile can't be used, with the status and message the route should return.
export class PreferenceLoadError extends Error {
	constructor(
		readonly status: 500 | 503,
		message: string
	) {
		super(message);
		this.name = 'PreferenceLoadError';
	}
}

// The profile that scores a new analysis: the user's saved one, or Balanced if they have never
// saved preferences (#71). A failed read or an unsupported format throws instead of falling back,
// so a result is never saved under a profile the user didn't choose.
export async function loadProfile(
	supabase: Pick<SupabaseClient, 'from'>,
	userId: string
): Promise<ProfileId> {
	const { data, error } = await supabase
		.from('privacy_preferences')
		.select('preferences, schema_version')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) {
		console.error('Failed to load preferences:', error.message);
		throw new PreferenceLoadError(503, 'Unable to load your preferences. Please try again.');
	}
	if (!data) {
		return 'balanced';
	}

	const parsed = StoredPreferencesSchema.safeParse(data.preferences);
	if (data.schema_version !== STORED_PREFERENCES_VERSION || !parsed.success) {
		throw new PreferenceLoadError(500, 'Your saved preferences have an unsupported format.');
	}
	return parsed.data.profile;
}

// One p_evaluations item for save_analysis. findingId is the saved finding's UUID.
export type EvaluationInsert = {
	concern: FindingCategory;
	level: Level;
	indicator: Indicator;
	findingId: string | null;
	explanation: string;
};

export type PreferenceSave = {
	snapshot: PreferenceSnapshot;
	snapshotVersion: number;
	// In display order; save_analysis stores the array order as display_order.
	evaluations: EvaluationInsert[];
};

// Scores a complete analysis for the profile and shapes the result for save_analysis. idMap is
// toFindingRows' map from Stage 2 IDs (F001) to the UUIDs the findings are saved under.
// Only call this for a complete result; failed, partial, and in-progress results are never scored.
export function buildPreferenceSave(
	findings: readonly ScorableFinding[],
	profile: ProfileId,
	idMap: Readonly<Record<string, string>>
): PreferenceSave {
	const evaluation = evaluatePreferences(findings, profile);

	const evaluations = evaluation.indicators.map((item): EvaluationInsert => {
		let findingId: string | null = null;
		if (item.findingId !== null) {
			findingId = idMap[item.findingId] ?? null;
			// Every linked finding is saved in the same call, so a missing ID is a bug, and saving
			// the indicator without its finding would break the database's finding check.
			if (findingId === null) {
				throw new Error(`No saved ID for finding ${item.findingId}`);
			}
		}
		return {
			concern: item.concern,
			level: item.level,
			indicator: item.indicator,
			findingId,
			explanation: item.explanation
		};
	});

	return {
		snapshot: createPreferenceSnapshot(profile),
		snapshotVersion: PREFERENCE_SNAPSHOT_VERSION,
		evaluations
	};
}

// A saved preference_evaluations row, as read back.
type EvaluationRow = {
	preference_key: string;
	preference_value: unknown;
	indicator: string;
	finding_id: string | null;
	explanation: string;
};

// The personalized evaluation saved with an analysis, in #72's PreferenceEvaluation shape, for the
// results page. findings are the analysis's loaded findings (toAnalysisResult), whose IDs are the
// saved UUIDs. Returns null for analyses saved before indicators were (no snapshot).
//
// The indicators and explanations are the saved ones, so a reopened result shows what was saved even
// if the user's profile or the rules have changed since (FR-12). The tier, review list, counts, and
// summary aren't stored, so they're recomputed from the saved findings with the same rules.
export async function loadPreferenceEvaluation(
	supabase: Pick<SupabaseClient, 'from'>,
	analysisId: string,
	findings: readonly ScorableFinding[]
): Promise<PreferenceEvaluation | null> {
	const { data: analysis, error: analysisError } = await supabase
		.from('analyses')
		.select('preference_snapshot, preference_schema_version')
		.eq('id', analysisId)
		.maybeSingle();
	if (analysisError) {
		throw new Error(`Failed to load the preference snapshot: ${analysisError.message}`);
	}
	if (
		!analysis ||
		analysis.preference_snapshot === null ||
		analysis.preference_snapshot === undefined
	) {
		return null;
	}
	if (analysis.preference_schema_version !== PREFERENCE_SNAPSHOT_VERSION) {
		throw new Error(
			`Unsupported preference snapshot version ${analysis.preference_schema_version}`
		);
	}
	const snapshot = PreferenceSnapshotSchema.parse(analysis.preference_snapshot);

	const { data: rows, error: rowsError } = await supabase
		.from('preference_evaluations')
		.select('preference_key, preference_value, indicator, finding_id, explanation')
		.eq('analysis_id', analysisId)
		.order('display_order');
	// A failed read must not be shown as "no indicators".
	if (rowsError) {
		throw new Error(`Failed to load the personalized indicators: ${rowsError.message}`);
	}

	const findingsById = new Map(findings.map((finding) => [finding.id, finding]));
	const indicators = ((rows ?? []) as EvaluationRow[]).map((row) => {
		let tier = null;
		if (row.finding_id !== null) {
			const finding = findingsById.get(row.finding_id);
			// The database deletes an analysis's indicators with its findings, so this is a bug.
			if (!finding) {
				throw new Error(`Indicator links finding ${row.finding_id}, which was not loaded`);
			}
			tier = tierOf(finding);
		}
		return {
			concern: row.preference_key,
			level: row.preference_value,
			indicator: row.indicator,
			findingId: row.finding_id,
			tier,
			explanation: row.explanation
		} as PreferenceIndicator;
	});

	const { needsReview, ungrounded } = classifyFindings(findings);

	// Checks the rebuilt evaluation the same way as the scorer's output: one indicator per concern,
	// levels that match the snapshot, and links and tiers that fit each indicator.
	return PreferenceEvaluationSchema.parse({
		rulesVersion: snapshot.rulesVersion,
		profile: { id: snapshot.profile, levels: snapshot.levels },
		indicators,
		needsReview,
		ungrounded,
		...countAndSummarize(indicators, needsReview.length, findings)
	});
}
