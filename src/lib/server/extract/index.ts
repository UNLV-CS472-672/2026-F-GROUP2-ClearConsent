import { error } from '@sveltejs/kit';
import {
	MAX_SOURCE_CHARACTERS,
	MAX_TITLE_CHARACTERS,
	MAX_URL_CHARACTERS
} from '$lib/server/analysis/pipeline';
import { htmlToText } from './html';
import { pdfToText } from './pdf';

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 1_000_000;

function publicUrl(input: string, base?: URL): URL {
	let url: URL;
	try {
		url = new URL(input.trim(), base);
	} catch {
		error(400, 'Enter a valid public URL.');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		error(400, 'Only http and https URLs are supported.');
	}
	if (url.href.length > MAX_URL_CHARACTERS) {
		error(413, 'The URL is too long. Try a shorter public URL or paste the text.');
	}
	const host = url.hostname.toLowerCase().replace(/\.$/, '');
	// IP literals, single-label names and local-use domains are not public policy sites.
	// URL canonicalizes alternate IPv4 spellings (for example 0x7f000001) before this check.
	if (
		url.username ||
		url.password ||
		url.port ||
		!host.includes('.') ||
		/^\d+(?:\.\d+){3}$/.test(host) ||
		host.startsWith('[') ||
		/(^|\.)(localhost|local|internal|lan|test|invalid|example|arpa|onion)$/.test(host)
	) {
		error(400, 'Use a public policy URL without credentials or a custom port.');
	}
	return url;
}

async function boundedBytes(response: Response): Promise<Uint8Array> {
	const declared = Number(response.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
		await response.body?.cancel().catch(() => {});
		error(413, 'The page is too large to process. Try pasting the policy text.');
	}
	if (!response.body) return new Uint8Array();
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	let complete = false;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > MAX_RESPONSE_BYTES) {
				error(413, 'The page is too large to process. Try pasting the policy text.');
			}
			chunks.push(value);
		}
		complete = true;
	} catch (cause) {
		if (cause && typeof cause === 'object' && 'status' in cause) throw cause;
		error(502, 'The page could not be read. Try again or paste the policy text.');
	} finally {
		if (!complete) await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

export async function extractFromUrl(input: string) {
	let url = publicUrl(input);
	let res: Response;
	const signal = AbortSignal.timeout(10_000);
	for (let hop = 0; ; hop++) {
		try {
			res = await fetch(url, {
				headers: { accept: 'text/html, application/pdf', 'user-agent': 'ClearConsent/0.1' },
				redirect: 'manual',
				signal
			});
		} catch (cause) {
			if (
				signal.aborted ||
				(cause !== null &&
					typeof cause === 'object' &&
					'name' in cause &&
					['AbortError', 'TimeoutError'].includes(String(cause.name)))
			) {
				error(504, 'The page took too long to respond. Try again or paste the policy text.');
			}
			error(502, `Unable to fetch ${url.hostname}. Check the URL or try pasting the text.`);
		}
		if (![301, 302, 303, 307, 308].includes(res.status)) break;
		if (hop === MAX_REDIRECTS) error(400, 'The page redirected too many times.');
		const location = res.headers.get('location');
		if (!location) error(502, 'The page redirected without a destination.');
		url = publicUrl(location, url);
	}

	if (!res.ok) {
		error(502, `Page responded with HTTP ${res.status}. Check the URL or try pasting the text.`);
	}

	const contentType = (res.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase();
	if (contentType !== 'text/html' && contentType !== 'application/pdf') {
		error(400, `Only HTML pages and PDFs are supported (got ${contentType || 'unknown type'}).`);
	}
	const bytes = await boundedBytes(res);
	let title, text;
	if (contentType === 'text/html') {
		({ title, text } = htmlToText(new TextDecoder().decode(bytes)));
	} else {
		({ title, text } = await pdfToText(bytes, url));
	}

	if (!text) {
		error(400, 'No readable text was found on the page. Try pasting the policy text.');
	}
	if (text.length > MAX_SOURCE_CHARACTERS) {
		error(413, 'The extracted policy is too long to analyze. Try a shorter policy.');
	}

	return {
		title: title?.slice(0, MAX_TITLE_CHARACTERS),
		text,
		url: url.href
	};
}
