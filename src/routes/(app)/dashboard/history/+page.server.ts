// Slightly modified copy of overview/+layout.server.ts
import { getSupabaseForUser } from '$lib/server/db/supabase';
import type { AnalysisResult } from '$lib/contracts/analysis';
import { SupabaseClient } from '@supabase/supabase-js';
import { type RecentSource } from '$lib/components/DataTable';
import { type SavedAnalysis } from '$lib/server/db/analysis-runs';
import { type FindingRow, toAnalysisResult } from '$lib/server/analysis';

async function findAnalysis(supabase: SupabaseClient, sourceId: string) {
	const { data, error: findError } = await supabase
		.from('analyses')
		.select('id, summary, model, reasoning_effort')
		.eq('source_id', sourceId)
		.order('analyzed_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	// Only a successful empty lookup should start a new (paid) analysis.
	if (findError) {
		console.error('Failed to load analysis:', findError.message);
		throw new Error('Unable to load the analysis.');
	}
	return data as SavedAnalysis | null;
}

// Do not run the analysis if none is stored yet, just grab findings and format.
async function loadResult(supabase: SupabaseClient, sourceId: string): Promise<AnalysisResult> {
	const analysis = await findAnalysis(supabase, sourceId);
	if (!analysis) {
		throw new Error('Unable to find analysis.');
	}

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
		throw new Error('Unable to load the findings.');
	}

	return toAnalysisResult(analysis, findings as FindingRow[]);
}

// Sources with at least one saved analysis. save_analysis only stores completed analyses, so the
// inner join is enough to filter out sources that were never analyzed or whose analysis failed.
export const load = async ({ locals, url }) => {
	// Reading the pathname re-runs this on every overview navigation, so returning from an analysis
	// shows it in the list.
	void url.pathname;

	const { session } = await locals.safeGetSession();
	if (!session) return { recentSources: [] as RecentSource[], results: [] as AnalysisResult[] };
	const supabase = await getSupabaseForUser(session.access_token);

	const { data, error: recentError } = await getSupabaseForUser(session.access_token)
		.from('sources')
		.select('id, title, url, created_at, analyses!inner(id), owner_id')
		.order('created_at', { ascending: false });

	if (recentError) {
		console.error('Failed to load recent analyses:', recentError.message);
	}

	const recentSources = (data ?? []).map(({ id, title, url, created_at }) => ({
		id,
		title,
		url,
		created_at
	})) as RecentSource[];

	const results = await Promise.all(
		recentSources?.map(async (source) => await loadResult(supabase, source.id))
	);

	return {
		recentSources,
		results,
	};
};
