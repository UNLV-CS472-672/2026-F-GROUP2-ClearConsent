import { env } from '$env/dynamic/private';
import { handleConsolidatedAnalysisHttpRequest } from '$lib/server/analysis/consolidation';
import type { RequestHandler } from './$types';

// Stage 1 and Stage 2 in one request. POST /api/analyze still runs Stage 1 alone.
export const POST: RequestHandler = async ({ request }) => {
	return handleConsolidatedAnalysisHttpRequest(request, env);
};
