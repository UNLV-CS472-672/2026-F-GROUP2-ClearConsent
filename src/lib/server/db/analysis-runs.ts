import type { SupabaseClient } from '@supabase/supabase-js';

export type SavedAnalysis = { id: string; summary: string };

// A source's saved analysis, or else the state of its latest run.
export type RunState =
	| { status: 'complete'; analysis: SavedAnalysis }
	| { status: 'running' }
	| { status: 'failed'; errorCode: string; message: string }
	| { status: 'not_started' };

type RunRow = {
	status: 'running' | 'failed';
	error_code: string | null;
	error_message: string | null;
	expires_at: string;
};

/**
 * Reads what has happened to a source without starting anything, so it is safe to call from a
 * load or a poll. Throws when a read fails: a failed read must not look like "never analyzed",
 * which would start a paid run.
 */
export async function readRunState(supabase: SupabaseClient, sourceId: string): Promise<RunState> {
	const { data: analysis, error: analysisError } = await supabase
		.from('analyses')
		.select('id, summary')
		.eq('source_id', sourceId)
		.order('analyzed_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (analysisError) throw new Error(`Failed to load analysis: ${analysisError.message}`);
	if (analysis) return { status: 'complete', analysis: analysis as SavedAnalysis };

	const { data, error: runError } = await supabase
		.from('analysis_runs')
		.select('status, error_code, error_message, expires_at')
		.eq('source_id', sourceId)
		.maybeSingle();
	if (runError) throw new Error(`Failed to load analysis run: ${runError.message}`);

	const run = data as RunRow | null;
	if (!run) return { status: 'not_started' };
	if (run.status === 'failed') {
		return {
			status: 'failed',
			errorCode: run.error_code ?? 'analysis_failed',
			message: run.error_message ?? 'Unable to analyze this source.'
		};
	}
	// The server stopped before finishing (for example, the worker was cancelled).
	if (new Date(run.expires_at) <= new Date()) {
		return {
			status: 'failed',
			errorCode: 'analysis_interrupted',
			message: 'The analysis stopped before it finished.'
		};
	}
	return { status: 'running' };
}
