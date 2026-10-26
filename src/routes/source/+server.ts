import { error, json } from '@sveltejs/kit';
import { getSupabaseForUser } from '$lib/server/db/supabase';

type RequestBody = {
	content: string;
};

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		error(401, 'Unauthorized');
	}

	const req = (await request.json().catch(() => error(400, 'Body must be JSON'))) as RequestBody;

	if (typeof req.content !== 'string' || req.content.trim() === '') {
		error(400, 'Body must be JSON like { "content": "..." }');
	}

	const { data: source, error: insertError } = await getSupabaseForUser(session.access_token)
		.from('sources')
		.insert({ owner_id: user.id, title: null, text: req.content.trim(), url: null })
		.select()
		.single();

	if (insertError) {
		console.error('Failed to save source:', insertError.message);
		error(500, 'Unable to save the submitted text.');
	}

	return json(source);
}
