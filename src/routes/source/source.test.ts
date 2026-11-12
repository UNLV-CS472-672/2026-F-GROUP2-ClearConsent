import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
const mocks = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock('$lib/server/db/supabase', () => ({ getSupabaseForUser: () => ({}) }));
vi.mock('$lib/server/db/sources', () => ({ findOrCreateSource: mocks.save }));
const locals = {
	safeGetSession: async () => ({ session: { access_token: 'synthetic' }, user: { id: 'owner' } })
} as unknown as App.Locals;
function post(body: unknown) {
	return POST({
		request: new Request('https://example.test/source', {
			method: 'POST',
			body: JSON.stringify(body)
		}),
		locals
	});
}
afterEach(() => vi.clearAllMocks());
describe('source endpoint', () => {
	it.each([null, {}, { content: '' }, { content: '  ' }, { content: 'x'.repeat(50001) }])(
		'rejects invalid input before saving',
		async (body) => {
			await expect(post(body)).rejects.toMatchObject({ status: 400 });
			expect(mocks.save).not.toHaveBeenCalled();
		}
	);
	it('trims the outer whitespace and returns the persisted source', async () => {
		mocks.save.mockResolvedValue({ data: { id: 'saved' }, error: null });
		expect(await (await post({ content: '  Policy\ntext  ' })).json()).toEqual({ id: 'saved' });
		expect(mocks.save).toHaveBeenCalledWith(
			{},
			{ ownerId: 'owner', title: null, text: 'Policy\ntext', url: null }
		);
	});
	it('rejects a persistence error', async () => {
		mocks.save.mockResolvedValue({ data: null, error: { message: 'internal' } });
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await expect(post({ content: 'Policy' })).rejects.toMatchObject({ status: 500 });
			expect(log).toHaveBeenCalledWith('Failed to save source.');
		} finally {
			log.mockRestore();
		}
	});
});
