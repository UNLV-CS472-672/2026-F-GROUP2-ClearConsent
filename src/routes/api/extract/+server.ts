import { error, json } from '@sveltejs/kit';
import { extractFromUrl } from '$lib/server/extract';
import { getSupabaseForUser } from '$lib/server/db/supabase';
import { findOrCreateSource } from '$lib/server/db/sources';

type RequestBody = {
	url: string;
};

export async function POST({ request, locals }: { request: Request; locals: App.Locals }) {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		error(401, 'Unauthorized');
	}

	const req = (await request.json().catch(() => error(400, 'Body must be JSON'))) as RequestBody;

	if (typeof req.url !== 'string') {
		error(400, 'Body must be JSON like { "url": "https://..." }');
	}

	const extraction = await extractFromUrl(req.url);

	const { data: source, error: insertError } = await findOrCreateSource(
		getSupabaseForUser(session.access_token),
		{
			ownerId: user.id,
			title: extraction.title ?? null,
			text: extraction.text,
			url: extraction.url
		}
	);

	if (insertError) {
		console.error('Failed to save source:', insertError.message);
		error(500, 'Unable to save the extracted source.');
	}

	return json(source);
}
