import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import {
	handleConsolidatedAnalysisHttpRequest,
	toAnalysisResultFields,
	toFindingRows,
	type ConsolidationResult
} from '$lib/server/analysis/consolidation';
import {
	PreferenceLoadError,
	buildPreferenceSave,
	loadProfile
} from '$lib/server/analysis/personalization';
import { getSupabaseForUser } from '$lib/server/db/supabase';
import type { RequestHandler } from './$types';

// Stage 1 and Stage 2 in one request. POST /api/analyze still runs Stage 1 alone.
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		error(401, 'Unauthorized');
	}

	const supabase = getSupabaseForUser(session.access_token);
	// Read the profile before the analysis runs, so a failed read costs no provider call.
	const profile = await loadProfile(supabase, user.id).catch((loadError: unknown) => {
		if (loadError instanceof PreferenceLoadError) error(loadError.status, loadError.message);
		throw loadError;
	});

	const response = await handleConsolidatedAnalysisHttpRequest(request, env);
	if (!response.ok) return response;

	const result = (await response.json()) as ConsolidationResult;
	if (result.analysisStatus !== 'complete') return Response.json(result);

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
	const { rows, idMap } = toFindingRows(result, analysisId);
	const preferences = buildPreferenceSave(result.findings, profile, idMap);

	// save_analysis writes the analysis, its findings, and its indicators in one transaction, so a
	// failure leaves none behind. The source stays as separately ingested input.
	const { error: saveError } = await supabase.rpc('save_analysis', {
		p_analysis: {
			id: analysisId,
			source_id: source.id,
			source_type: submittedUrl === null ? 'pasted_text' : 'url',
			submitted_url: submittedUrl,
			source_text: fields.source_text,
			summary: fields.summary,
			outcome: fields.outcome,
			model: fields.model,
			reasoning_effort: fields.reasoning_effort,
			analysis_status: 'complete',
			preference_snapshot: preferences.snapshot,
			preference_schema_version: preferences.snapshotVersion
		},
		p_findings: rows,
		p_evaluations: preferences.evaluations
	});

	if (saveError) {
		// Supabase errors are plain objects, so read the message field directly.
		console.error('Failed to save analysis:', saveError.message);
		error(500, 'Unable to save the analysis.');
	}

	return Response.json({ ...result, analysisId });
};
