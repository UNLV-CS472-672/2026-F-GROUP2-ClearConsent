import { error } from '@sveltejs/kit';
import { htmlToText } from './html';
import { pdfToText } from './pdf';

export async function extractFromUrl(input: string) {
	let url: URL;
	try {
		url = new URL(input.trim());
	} catch {
		error(400, 'Enter a valid URL.');
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		error(400, 'Only http and https URLs are supported.');
	}

	let res;
	try {
		res = await fetch(url, {
			headers: { accept: 'text/html, application/pdf', 'user-agent': 'ClearConsent/0.1' },
			signal: AbortSignal.timeout(10_000)
		});
	} catch {
		error(502, `Unable to fetch ${url.hostname}.`);
	}

	if (!res.ok) {
		error(502, `Page responded with HTTP ${res.status}.`);
	}

	const contentType = res.headers.get('content-type') ?? '';
	let title, text;
	if (contentType.includes('text/html')) {
		({ title, text } = htmlToText(await res.text()));
	} else if (contentType.includes('application/pdf')) {
		({ title, text } = await pdfToText(await res.arrayBuffer(), url));
	} else {
		error(400, `Only HTML pages and PDFs are supported (got ${contentType || 'unknown type'}).`);
	}

	if (!text) {
		error(400, 'No readable text was found on the page.');
	}

	return {
		title,
		text,
		url: res.url
	};
}
