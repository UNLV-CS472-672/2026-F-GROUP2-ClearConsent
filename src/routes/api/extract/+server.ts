import { error, json } from '@sveltejs/kit';
import { extractFromUrl } from '$lib/server/extract';
import { getSupabaseForUser } from '$lib/server/db/supabase';

type RequestBody = {
	url: string;
};

// TODO: Replace with the verified session's access token and user id once auth exists.
const DEV_ACCESS_TOKEN = 'dummy-access-token';
const DEV_OWNER_ID = '00000000-0000-0000-0000-000000000000';

export async function POST({ request }: { request: Request }) {
	const req = (await request.json().catch(() => error(400, 'Body must be JSON'))) as RequestBody;

	if (typeof req.url !== 'string') {
		error(400, 'Body must be JSON like { "url": "https://..." }');
	}

	const extraction = await extractFromUrl(req.url);

	const { error: insertError } = await getSupabaseForUser(DEV_ACCESS_TOKEN)
		.from('sources')
		.insert({
			owner_id: DEV_OWNER_ID,
			title: extraction.title ?? null,
			text: extraction.text,
			url: extraction.url
		});

	if (insertError) {
		console.error('Failed to save source:', insertError.message);
		error(500, 'Unable to save the extracted source.');
	}

	return json(extraction);
}
