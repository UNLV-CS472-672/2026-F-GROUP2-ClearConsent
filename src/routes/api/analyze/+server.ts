import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import {
	handleConsolidatedAnalysisHttpRequest,
	toAnalysisResultFields,
	toFindingRows,
	type ConsolidationResult
} from '$lib/server/analysis/consolidation';
import { readRunState } from '$lib/server/db/analysis-runs';
import { getSupabaseForUser } from '$lib/server/db/supabase';
import type { RequestHandler } from './$types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RunStart = { status: 'started' | 'running' | 'failed' | 'complete'; runId: string | null };

// Stored on the run so revisiting a failed source shows why it failed.
type RunFailure = { code: string; message: string };

// Pipeline errors raised before any provider call. Nothing is wrong with the source, so the run is
// released instead of failed, and the source starts normally once analysis is enabled.
const NOT_STARTED_CODES = new Set(['analysis_disabled', 'configuration_error', 'unauthorized']);

// Pause before retrying a failed call that ends a run.
const END_RETRY_MS = 500;

// Reports a source's status without starting anything, for the result page to poll.
export const GET: RequestHandler = async ({ url, locals }) => {
	const { session } = await locals.safeGetSession();
	if (!session) {
		error(401, 'Unauthorized');
	}
	const sourceId = url.searchParams.get('sourceId');
	if (!sourceId || !UUID.test(sourceId)) {
		error(400, 'sourceId must be a UUID');
	}

	try {
		const { status } = await readRunState(getSupabaseForUser(session.access_token), sourceId);
		return Response.json({ status });
	} catch (readError) {
		console.error((readError as Error).message);
		error(500, 'Unable to load the analysis.');
	}
};

// Runs Stage 1 and Stage 2 on a saved source, then stores the analysis and its findings against it.
// At most one run per source happens at a time: a source that is already running, already
// analyzed, or failed (without { "retry": true }) returns 409 with its status and makes no
// provider call. A failed run is recorded so a later visit shows it instead of re-running.
export const POST: RequestHandler = async ({ request, locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		error(401, 'Unauthorized');
	}

	const body = (await request.json().catch(() => error(400, 'Body must be JSON'))) as {
		sourceId?: unknown;
		retry?: unknown;
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

	const { data: run, error: startError } = await supabase.rpc('start_analysis_run', {
		p_source_id: source.id,
		p_retry: body.retry === true
	});
	if (startError) {
		console.error('Failed to start analysis run:', startError.message);
		error(500, 'Unable to start the analysis.');
	}
	const { status, runId } = run as RunStart;
	if (status !== 'started' || runId === null) {
		return Response.json({ status }, { status: 409 });
	}

	// Any path below that does not save the analysis records the run as failed, unless it clears
	// this first.
	let failure: RunFailure | null = {
		code: 'internal_error',
		message: 'The analysis stopped unexpectedly.'
	};
	try {
		// The consolidation handler still requires the server's analysis token, which the browser
		// never sees.
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
		if (!response.ok) {
			// Pipeline errors look like { error: { code, message } }.
			const failed = (await response
				.clone()
				.json()
				.catch(() => null)) as { error?: Partial<RunFailure> } | null;
			const code = failed?.error?.code ?? `http_${response.status}`;
			failure = NOT_STARTED_CODES.has(code)
				? null
				: { code, message: failed?.error?.message ?? 'Unable to analyze this source.' };
			return response;
		}

		const result = (await response.json()) as ConsolidationResult;
		if (result.analysisStatus !== 'complete') {
			failure = {
				code: 'analysis_incomplete',
				message: 'The analysis could not account for every part of the policy.'
			};
			return Response.json(result);
		}

		const fields = toAnalysisResultFields(result);
		const analysisId = crypto.randomUUID();
		const { rows } = toFindingRows(result, analysisId);

		// save_analysis writes the analysis and its findings in one transaction, so a failure leaves
		// neither behind and a concurrent read never sees an analysis without its findings.
		const { error: saveError } = await supabase.rpc('save_analysis', {
			p_analysis: {
				id: analysisId,
				source_id: source.id,
				source_type: source.url ? 'url' : 'pasted_text',
				submitted_url: source.url,
				// The RPC requires this to match the stored source exactly.
				source_text: source.text,
				summary: fields.summary,
				outcome: fields.outcome,
				analysis_status: 'complete'
			},
			p_findings: rows,
			// No personalization runs on this route yet.
			p_evaluations: []
		});

		if (saveError) {
			console.error('Failed to save analysis:', saveError.message);
			failure = { code: 'save_failed', message: 'Unable to save the analysis.' };
			error(500, 'Unable to save the analysis.');
		}

		failure = null;
		return Response.json({ ...result, analysisId });
	} finally {
		const end = () =>
			failure
				? supabase.rpc('fail_analysis_run', {
						p_source_id: source.id,
						p_run_id: runId,
						p_error_code: failure.code,
						p_error_message: failure.message
					})
				: supabase.rpc('release_analysis_run', { p_source_id: source.id, p_run_id: runId });
		// Until the run ends, the source stays running and blocks Try again, so a passing error gets
		// one retry. Both calls only act on this run id, so repeating one that did succeed is harmless.
		let { error: endError } = await end();
		if (endError) {
			console.error('Failed to end analysis run, retrying:', endError.message);
			await new Promise((resolve) => setTimeout(resolve, END_RETRY_MS));
			({ error: endError } = await end());
		}
		// A saved analysis already takes precedence over its run. Otherwise the run expires and is
		// shown as failed once its time limit passes, and the page shows this response's error.
		if (endError) {
			console.error('Failed to end analysis run:', endError.message);
		}
	}
};
