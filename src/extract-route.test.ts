import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	extract: vi.fn(),
	save: vi.fn(),
	client: vi.fn()
}));
vi.mock('$lib/server/extract', () => ({ extractFromUrl: mocks.extract }));
vi.mock('$lib/server/db/sources', () => ({ findOrCreateSource: mocks.save }));
vi.mock('$lib/server/db/supabase', () => ({ getSupabaseForUser: mocks.client }));

import { POST } from './routes/api/extract/+server';

const SOURCE = { id: '71000000-0000-4000-8000-000000000001' };

function post(body: string, signedIn = true) {
	return POST({
		request: new Request('https://app.example.com/api/extract', { method: 'POST', body }),
		locals: {
			safeGetSession: async () => ({
				session: signedIn ? { access_token: 'test-token' } : null,
				user: signedIn ? { id: 'owner-a' } : null
			})
		}
	} as unknown as Parameters<typeof POST>[0]);
}

beforeEach(() => {
	vi.resetAllMocks();
	mocks.extract.mockResolvedValue({
		title: 'Privacy',
		text: 'We collect data.',
		url: 'https://policies.example.com/privacy'
	});
	mocks.save.mockResolvedValue({ data: SOURCE, error: null });
	mocks.client.mockReturnValue({});
});

describe('POST /api/extract', () => {
	it('rejects anonymous and malformed requests without retrieval or saving', async () => {
		await expect(post('{"url":"https://policies.example.com/"}', false)).rejects.toMatchObject({
			status: 401
		});
		await expect(post('not json')).rejects.toMatchObject({ status: 400 });
		await expect(post('{"url":42}')).rejects.toMatchObject({ status: 400 });
		expect(mocks.extract).not.toHaveBeenCalled();
		expect(mocks.save).not.toHaveBeenCalled();
	});

	it('saves only extracted text for the signed-in owner', async () => {
		const response = await post('{"url":"https://policies.example.com/old"}');
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(SOURCE);
		expect(mocks.extract).toHaveBeenCalledWith('https://policies.example.com/old');
		expect(mocks.client).toHaveBeenCalledWith('test-token');
		expect(mocks.save).toHaveBeenCalledWith(expect.anything(), {
			ownerId: 'owner-a',
			title: 'Privacy',
			text: 'We collect data.',
			url: 'https://policies.example.com/privacy'
		});
	});

	it('does not write a source when extraction rejects the URL', async () => {
		mocks.extract.mockRejectedValue({ status: 400, message: 'Use a public policy URL.' });
		await expect(post('{"url":"http://localhost/"}')).rejects.toMatchObject({ status: 400 });
		expect(mocks.save).not.toHaveBeenCalled();
	});

	it('stores a missing page title as null so analysis can proceed', async () => {
		mocks.extract.mockResolvedValue({
			title: '',
			text: 'We collect data.',
			url: 'https://policies.example.com/privacy'
		});
		await post('{"url":"https://policies.example.com/privacy"}');
		expect(mocks.save).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ title: null })
		);
	});

	it('reports a database failure without returning a saved result', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mocks.save.mockResolvedValue({ data: null, error: { message: 'database unavailable' } });
		await expect(post('{"url":"https://policies.example.com/"}')).rejects.toMatchObject({
			status: 500
		});
	});

	it('does not report success when the save returns no source', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		mocks.save.mockResolvedValue({ data: null, error: null });
		await expect(post('{"url":"https://policies.example.com/"}')).rejects.toMatchObject({
			status: 500
		});
	});
});
