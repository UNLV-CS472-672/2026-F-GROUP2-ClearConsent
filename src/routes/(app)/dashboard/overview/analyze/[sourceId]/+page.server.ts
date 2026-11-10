import { error, redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ANALYSIS_DEPENDENCY, type AnalysisState } from '$lib/analysis-run';
import { type FindingRow, toAnalysisResult } from '$lib/server/db/analysis';
import { readRunState, type RunState } from '$lib/server/db/analysis-runs';
import { getSupabaseForUser } from '$lib/server/db/supabase';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INPUT_PAGE = '/dashboard/overview/extract';

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
		.select(
			'id, category, plain_language_description, evidence, effect, ambiguous, data_categories, purposes, recipients'
		)
		.eq('analysis_id', analysis.id)
		.order('display_order');

	// A failed read must not be shown as "no findings".
	if (findingsError) {
		console.error('Failed to load findings:', findingsError.message);
		error(500, 'Unable to load the findings.');
	}

	return { status: 'complete', result: toAnalysisResult(analysis, findings as FindingRow[]) };
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
