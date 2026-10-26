import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import {
	handleConsolidatedAnalysisHttpRequest,
	toAnalysisResultFields,
	toFindingRows,
	type ConsolidationResult
} from '$lib/server/analysis/consolidation';
import { getSupabaseForUser } from '$lib/server/db/supabase';
import type { RequestHandler } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Runs Stage 1 and Stage 2 on a saved source, then stores the analysis and its findings against it.
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		error(401, 'Unauthorized');
	}

	const body = (await request.json().catch(() => error(400, 'Body must be JSON'))) as {
		sourceId?: unknown;
	};
	if (typeof body.sourceId !== 'string' || !UUID.test(body.sourceId)) {
		error(400, 'Body must be JSON like { "sourceId": "..." }');
	}

	const supabase = getSupabaseForUser(session.access_token);
	const { data: source, error: sourceError } = await supabase
		.from('sources')
		.select('id, title, text, url')
		.eq('id', body.sourceId)
		.maybeSingle();

	if (sourceError) {
		console.error('Failed to load source:', sourceError.message);
		error(500, 'Unable to load the source.');
	}
	if (!source) {
		error(404, 'Source not found.');
	}

	// The consolidation handler still requires the server's analysis token, which the browser never sees.
	const pipelineRequest = new Request(request.url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${env.ANALYSIS_ACCESS_TOKEN}`
		},
		body: JSON.stringify({
			text: source.text,
			title: source.title ?? undefined,
			url: source.url ?? undefined
		})
	});

	const response = await handleConsolidatedAnalysisHttpRequest(pipelineRequest, env);
	if (!response.ok) return response;

	const result = (await response.json()) as ConsolidationResult;
	if (result.analysisStatus !== 'complete') return Response.json(result);

	const fields = toAnalysisResultFields(result);
	const analysisId = crypto.randomUUID();
	const { rows } = toFindingRows(result, analysisId);

	// Not atomic. On failure, delete the analysis (cascades to findings). The source belongs to the user and is kept.
	const { error: analysisError } = await supabase.from('analyses').insert({
		id: analysisId,
		owner_id: user.id,
		source_id: source.id,
		source_type: source.url ? 'url' : 'pasted_text',
		source_title: fields.source_title,
		submitted_url: source.url,
		final_url: source.url,
		source_text: fields.source_text,
		summary: fields.summary,
		outcome: fields.outcome,
		result_schema_version: 1
	});

	let findingsError = null;
	if (!analysisError && rows.length > 0) {
		({ error: findingsError } = await supabase.from('findings').insert(rows));
	}

	if (analysisError || findingsError) {
		console.error('Failed to save analysis:', (analysisError ?? findingsError)?.message);
		await supabase.from('analyses').delete().eq('id', analysisId);
		error(500, 'Unable to save the analysis.');
	}

	return Response.json({ ...result, analysisId });
};
