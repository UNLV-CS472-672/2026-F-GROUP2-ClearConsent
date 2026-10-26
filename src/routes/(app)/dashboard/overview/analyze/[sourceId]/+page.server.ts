import { redirect } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
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
	const { data } = await supabase
		.from('analyses')
		.select('id, summary')
		.eq('source_id', sourceId)
		.order('analyzed_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	return data as Analysis | null;
}

// Runs the analysis if none is stored yet, then loads its findings. Returned as a promise so the
// page can render the source and a loading state while this is in progress.
async function loadResult(
	supabase: SupabaseClient,
	sourceId: string,
	fetch: typeof globalThis.fetch
): Promise<AnalysisResult> {
	let analysis = await findAnalysis(supabase, sourceId);
	if (!analysis) {
		const res = await fetch('/api/analyze', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ sourceId })
		});
		if (!res.ok) {
			throw new Error('Unable to analyze this source.');
		}
		analysis = await findAnalysis(supabase, sourceId);
		if (!analysis) {
			throw new Error('The analysis did not complete.');
		}
	}

	const { data: findings } = await supabase
		.from('findings')
		.select(
			'id, category, plain_language_description, evidence, effect, ambiguous, data_categories, purposes, recipients'
		)
		.eq('analysis_id', analysis.id)
		.order('display_order');

	return toAnalysisResult(analysis, (findings ?? []) as FindingRow[]);
}

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const { session } = await locals.safeGetSession();
	if (!session || !UUID.test(params.sourceId)) {
		redirect(303, INPUT_PAGE);
	}

	// Row-level security returns no row for another user's source, so ownership is enforced here.
	const supabase = getSupabaseForUser(session.access_token);
	const { data: source } = await supabase
		.from('sources')
		.select('id, title, url')
		.eq('id', params.sourceId)
		.maybeSingle();

	if (!source) {
		redirect(303, INPUT_PAGE);
	}

	return {
		source,
		result: loadResult(supabase, source.id, fetch)
	};
};
