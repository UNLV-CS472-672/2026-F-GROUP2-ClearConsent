import { error, json } from '@sveltejs/kit';
import { extractFromUrl } from '$lib/server/extract';

type RequestBody = {
	url: string;
};

export async function POST({ request }: { request: Request }) {
	const req = (await request.json().catch(() => error(400, 'Body must be JSON'))) as RequestBody;

	if (typeof req.url !== 'string') {
		error(400, 'Body must be JSON like { "url": "https://..." }');
	}

	const extraction = await extractFromUrl(req.url);

	// TODO: Save extraction to database

	return json(extraction);
}
