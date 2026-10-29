import { error, redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ANALYSIS_DEPENDENCY, type AnalysisState } from '$lib/analysis-run';
import type { AnalysisResult, AttentionLabel, FindingCategory } from '$lib/contracts/analysis';
import { getSupabaseForUser } from '$lib/server/db/supabase';
import type { PageServerLoad } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INPUT_PAGE = '/dashboard/overview/extract';

const TOPICS: Record<FindingCategory, string> = {
	collection: 'Information collection',
	use: 'How data is used',
	sharing: 'Data sharing',
	retention: 'Data retention',
	user_rights: 'Your rights',
	security_practices: 'Security practices'
};

type Analysis = { id: string; summary: string };

type RunRow = {
	status: 'running' | 'failed';
	error_code: string | null;
	error_message: string | null;
	expires_at: string;
};

type FindingRow = {
	id: string;
	category: FindingCategory;
	plain_language_description: string;
	evidence: { passageId: string; excerpt: string }[];
	effect: 'exposes' | 'protects' | null;
	ambiguous: boolean;
	data_categories: string[];
	purposes: string[];
	recipients: string[];
};

function plural(count: number, word: string) {
	return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// The AI returns findings but no takeaways, so each category becomes one takeaway. Its label and
// reason come only from the stored findings: ambiguity, and whether each one exposes or protects.
function toAnalysisResult(analysis: Analysis, rows: FindingRow[]): AnalysisResult {
	if (rows.length === 0) {
		return {
			status: 'insufficient',
			analysisId: analysis.id,
			schemaVersion: 1,
			reason: analysis.summary
		};
	}

	const groups = new Map<FindingCategory, FindingRow[]>();
	for (const row of rows) {
		groups.set(row.category, [...(groups.get(row.category) ?? []), row]);
	}

	const takeaways = [...groups].map(([category, group]) => {
		const protections = group.filter((row) => row.effect === 'protects').length;
		const practices = group.length - protections;
		const label: AttentionLabel = group.some((row) => row.ambiguous)
			? 'unclear'
			: practices === 0
				? 'positive'
				: 'worth_knowing';
		const described = [
			practices && plural(practices, 'practice'),
			protections && plural(protections, 'protection')
		].filter(Boolean);
		return {
			id: category,
			topic: TOPICS[category],
			reason: `The policy describes ${described.join(' and ')} in this area.`,
			label,
			findingIds: group.map((row) => row.id)
		};
	});

	return {
		status: 'success',
		analysisId: analysis.id,
		schemaVersion: 1,
		summary: analysis.summary,
		findings: rows.map((row) => ({
			id: row.id,
			category: row.category,
			plain_language_description: row.plain_language_description,
			dataCategories: row.data_categories,
			purposes: row.purposes,
			recipients: row.recipients,
			evidence: row.evidence.map(({ passageId, excerpt }) => ({ passageId, excerpt }))
		})),
		takeaways
	};
}

async function findAnalysis(supabase: SupabaseClient, sourceId: string) {
	const { data, error: findError } = await supabase
		.from('analyses')
		.select('id, summary')
		.eq('source_id', sourceId)
		.order('analyzed_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	if (findError) {
		console.error('Failed to load analysis:', findError.message);
		error(500, 'Unable to load the analysis.');
	}
	return data as Analysis | null;
}

async function findRun(supabase: SupabaseClient, sourceId: string) {
	const { data, error: runError } = await supabase
		.from('analysis_runs')
		.select('status, error_code, error_message, expires_at')
		.eq('source_id', sourceId)
		.maybeSingle();
	// A failed read must not look like "never analyzed", which would start a paid run.
	if (runError) {
		console.error('Failed to load analysis run:', runError.message);
		error(500, 'Unable to load the analysis.');
	}
	return data as RunRow | null;
}

function failed(sourceId: string, errorCode: string, message: string): AnalysisState {
	return {
		status: 'failed',
		result: { status: 'failed', analysisId: sourceId, schemaVersion: 1, errorCode, message }
	};
}

// Reads the saved analysis, or else the state of its run. Never starts a run: this load re-runs
// on invalidation and hover preloading, so it must not have paid side effects.
async function loadState(supabase: SupabaseClient, sourceId: string): Promise<AnalysisState> {
	const analysis = await findAnalysis(supabase, sourceId);
	if (!analysis) {
		const run = await findRun(supabase, sourceId);
		if (!run) return { status: 'not_started' };
		if (run.status === 'failed') {
			return failed(
				sourceId,
				run.error_code ?? 'analysis_failed',
				run.error_message ?? 'Unable to analyze this source.'
			);
		}
		// The server stopped before finishing (for example, the worker was cancelled).
		if (new Date(run.expires_at) <= new Date()) {
			return failed(sourceId, 'analysis_interrupted', 'The analysis stopped before it finished.');
		}
		return { status: 'running' };
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
