import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractFromUrl } from './index';

const html = (body: string) =>
	new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn();
	vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

describe('URL extraction boundary', () => {
	it('extracts synthetic HTML and preserves the final public URL', async () => {
		fetchMock.mockResolvedValue(
			html('<title>Privacy</title><header>Menu</header><p>We collect data.</p>')
		);
		const result = await extractFromUrl('  https://policies.example.com/privacy  ');
		expect(result).toEqual({
			title: 'Privacy',
			text: 'We collect data.',
			url: 'https://policies.example.com/privacy'
		});
		expect(fetchMock).toHaveBeenCalledWith(
			new URL('https://policies.example.com/privacy'),
			expect.objectContaining({ redirect: 'manual' })
		);
	});

	it.each([
		'',
		'not a url',
		'file:///etc/passwd',
		'http://localhost/policy',
		'http://foo.localhost/policy',
		'http://127.0.0.1/policy',
		'http://0x7f000001/policy',
		'http://[::1]/policy',
		'http://intranet/policy',
		'https://user:pass@policies.example.com/',
		'https://policies.example.com:8443/'
	])('rejects unsupported or non-public input %s before fetching', async (input) => {
		await expect(extractFromUrl(input)).rejects.toMatchObject({ status: 400 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('validates each redirect before making the next request', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } })
		);
		await expect(extractFromUrl('https://policies.example.com/')).rejects.toMatchObject({
			status: 400
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('accepts a relative redirect to another public page', async () => {
		fetchMock
			.mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/privacy' } }))
			.mockResolvedValueOnce(html('<p>We retain data.</p>'));
		const result = await extractFromUrl('https://policies.example.com/old');
		expect(result.url).toBe('https://policies.example.com/privacy');
		expect(result.text).toBe('We retain data.');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('stops a redirect loop after a bounded number of requests', async () => {
		fetchMock.mockResolvedValue(
			new Response(null, { status: 302, headers: { location: '/again' } })
		);
		await expect(extractFromUrl('https://policies.example.com/')).rejects.toMatchObject({
			status: 400
		});
		expect(fetchMock).toHaveBeenCalledTimes(6);
	});

	it.each([
		[new Response('Missing', { status: 404 }), 502],
		[new Response('binary', { headers: { 'content-type': 'application/octet-stream' } }), 400],
		[new Response('near miss', { headers: { 'content-type': 'text/htmlplus' } }), 400],
		[html('<title>Empty</title><script>ignore</script>'), 400],
		[
			new Response('too big', {
				headers: { 'content-type': 'text/html', 'content-length': '1000001' }
			}),
			413
		],
		[new Response(new Uint8Array(1_000_001), { headers: { 'content-type': 'text/html' } }), 413]
	] as const)('reports unsupported, empty, and oversized responses', async (response, status) => {
		fetchMock.mockResolvedValue(response);
		await expect(extractFromUrl('https://policies.example.com/')).rejects.toMatchObject({
			status
		});
	});

	it('rejects a URL above the analysis metadata limit before fetching', async () => {
		await expect(
			extractFromUrl('https://policies.example.com/' + 'x'.repeat(2_100))
		).rejects.toMatchObject({ status: 413 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('reports a retrieval failure without saving a result', async () => {
		fetchMock.mockRejectedValue(new Error('network timeout'));
		await expect(extractFromUrl('https://policies.example.com/')).rejects.toMatchObject({
			status: 502
		});
	});

	it('rejects extracted text above the analysis limit before saving', async () => {
		fetchMock.mockResolvedValue(html(`<p>${'x'.repeat(60_001)}</p>`));
		await expect(extractFromUrl('https://policies.example.com/')).rejects.toMatchObject({
			status: 413
		});
	});

	it('distinguishes a timeout from a general retrieval failure', async () => {
		fetchMock.mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
		await expect(extractFromUrl('https://policies.example.com/')).rejects.toMatchObject({
			status: 504
		});
	});

	it('reports a failed response stream as a read error', async () => {
		const body = new ReadableStream({
			pull(controller) {
				controller.error(new Error('stream failed'));
			}
		});
		fetchMock.mockResolvedValue(new Response(body, { headers: { 'content-type': 'text/html' } }));
		await expect(extractFromUrl('https://policies.example.com/')).rejects.toMatchObject({
			status: 502
		});
	});
});
