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

// Stage 1 and Stage 2 in one request. POST /api/analyze still runs Stage 1 alone.
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		error(401, 'Unauthorized');
	}

	const response = await handleConsolidatedAnalysisHttpRequest(request, env);
	if (!response.ok) return response;

	const result = (await response.json()) as ConsolidationResult;
	if (result.analysisStatus !== 'complete') return Response.json(result);

	const supabase = getSupabaseForUser(session.access_token);
	const fields = toAnalysisResultFields(result);

	const submittedUrl = result.extraction.source.url;

	const { data: source, error: sourceError } = await supabase
		.from('sources')
		.insert({
			owner_id: user.id,
			title: fields.source_title,
			text: fields.source_text,
			url: submittedUrl
		})
		.select('id')
		.single();

	if (sourceError) {
		console.error('Failed to save source:', sourceError.message);
		error(500, 'Unable to save the analysis.');
	}

	const analysisId = crypto.randomUUID();
	const { rows } = toFindingRows(result, analysisId);

	// Not atomic: if a later insert fails, delete the analysis (cascades to findings) and the source.
	const { error: analysisError } = await supabase.from('analyses').insert({
		id: analysisId,
		owner_id: user.id,
		source_id: source.id,
		source_type: submittedUrl === null ? 'pasted_text' : 'url',
		source_title: fields.source_title,
		submitted_url: submittedUrl,
		final_url: submittedUrl,
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
		// Supabase errors are plain objects, so read the message field directly.
		console.error('Failed to save analysis:', (analysisError ?? findingsError)?.message);
		await supabase.from('analyses').delete().eq('id', analysisId);
		await supabase.from('sources').delete().eq('id', source.id);
		error(500, 'Unable to save the analysis.');
	}

	return Response.json({ ...result, analysisId });
};
