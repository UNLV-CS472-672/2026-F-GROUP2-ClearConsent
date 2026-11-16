import { error, redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ANALYSIS_DEPENDENCY, type AnalysisState, type Personalization } from '$lib/analysis-run';
import type { AnalysisResult } from '$lib/contracts/analysis';
import { FINDING_COLUMNS, type FindingRow, toAnalysisResult } from '$lib/server/analysis';
import { loadPreferenceEvaluation } from '$lib/server/analysis/personalization';
import { readRunState, type RunState } from '$lib/server/db/analysis-runs';
import { getSupabaseForUser } from '$lib/server/db/supabase';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INPUT_PAGE = '/dashboard/overview/extract';

// The personalized indicators saved with the analysis. A failed read only hides those, not the
// findings: the page labels personalization unavailable instead of failing (FR-9).
async function loadPersonalization(
	supabase: SupabaseClient,
	analysisId: string,
	result: AnalysisResult
): Promise<Personalization> {
	try {
		const evaluation = await loadPreferenceEvaluation(
			supabase,
			analysisId,
			result.status === 'success' ? result.findings : []
		);
		return evaluation ? { status: 'ready', evaluation } : { status: 'not_saved' };
	} catch (loadError) {
		console.error('Failed to load personalized indicators:', (loadError as Error).message);
		return { status: 'unavailable' };
	}
}

// Reads the saved analysis, or else the state of its run. Never starts a run: this load re-runs
// on invalidation and hover preloading, so it must not have paid side effects.
async function loadState(supabase: SupabaseClient, sourceId: string): Promise<AnalysisState> {
	let state: RunState;
	try {
		state = await readRunState(supabase, sourceId);
	} catch (readError) {
		console.error((readError as Error).message);
		error(500, 'Unable to load the analysis.');
	}
	if (state.status === 'running' || state.status === 'not_started') return state;
	if (state.status === 'failed') {
		return {
			status: 'failed',
			result: {
				status: 'failed',
				analysisId: sourceId,
				schemaVersion: 1,
				errorCode: state.errorCode,
				message: state.message
			}
		};
	}
	const { analysis } = state;

	const { data: findings, error: findingsError } = await supabase
		.from('findings')
		.select(FINDING_COLUMNS)
		.eq('analysis_id', analysis.id)
		.order('display_order');

	// A failed read must not be shown as "no findings".
	if (findingsError) {
		console.error('Failed to load findings:', findingsError.message);
		error(500, 'Unable to load the findings.');
	}

	const result = toAnalysisResult(analysis, findings as FindingRow[]);
	return {
		status: 'complete',
		result,
		personalization: await loadPersonalization(supabase, analysis.id, result)
	};
}

export const load: PageServerLoad = async ({ params, locals, depends }) => {
	depends(ANALYSIS_DEPENDENCY);

	const { session } = await locals.safeGetSession();
	if (!session || !UUID.test(params.sourceId)) {
		redirect(303, INPUT_PAGE);
	}

	// Row-level security returns no row for another user's source, so ownership is enforced here.
	const supabase = getSupabaseForUser(session.access_token);
	const { data: source, error: sourceError } = await supabase
		.from('sources')
		.select('id, title, url')
		.eq('id', params.sourceId)
		.maybeSingle();

	if (sourceError) {
		console.error('Failed to load source:', sourceError.message);
		error(500, 'Unable to load the source.');
	}
	if (!source) {
		redirect(303, INPUT_PAGE);
	}

	return {
		source,
		analysis: await loadState(supabase, source.id)
	};
};
