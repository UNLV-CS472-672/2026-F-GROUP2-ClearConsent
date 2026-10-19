import { env } from '$env/dynamic/private';
import { handleStage1HttpRequest } from '$lib/server/analysis';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	return handleStage1HttpRequest(request, env);
};
