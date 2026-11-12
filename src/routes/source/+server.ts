import { error, json } from '@sveltejs/kit';
import { getSupabaseForUser } from '$lib/server/db/supabase';
import { findOrCreateSource } from '$lib/server/db/sources';

type RequestBody = {
	content?: unknown;
};

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		error(401, 'Unauthorized');
	}

	const req = (await request
		.json()
		.catch(() => error(400, 'Body must be JSON'))) as RequestBody | null;

	if (typeof req?.content !== 'string' || req.content.trim() === '') {
		error(400, 'Body must be JSON like { "content": "..." }');
	}

	if (req.content.trim().length > 50000) error(400, 'Input exceeds character limit (50000).');

	const { data: source, error: insertError } = await findOrCreateSource(
		getSupabaseForUser(session.access_token),
		{ ownerId: user.id, title: null, text: req.content.trim(), url: null }
	);

	if (insertError) {
		console.error('Failed to save source.');
		error(500, 'Unable to save the submitted text.');
	}

	return json(source);
}
