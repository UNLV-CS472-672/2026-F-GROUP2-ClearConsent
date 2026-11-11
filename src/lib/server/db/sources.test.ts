import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateSource } from './sources';

describe('pasted source persistence', () => {
	it('sends near-limit Unicode and reserved characters through RPC parameters only', async () => {
		const text = '😀&?#%+日本語'.repeat(5000).slice(0, 50000);
		const response = { data: { id: 'saved' }, error: null };
		const single = vi.fn().mockResolvedValue(response);
		const rpc = vi.fn().mockReturnValue({ single });
		const from = vi.fn();
		const client = { rpc, from } as unknown as SupabaseClient;
		expect(
			await findOrCreateSource(client, { ownerId: 'owner', title: null, text, url: null })
		).toEqual(response);
		expect(rpc).toHaveBeenCalledWith('find_or_create_pasted_source', {
			p_text: text,
			p_title: null
		});
		expect(from).not.toHaveBeenCalled();
	});

	it('propagates persistence errors without returning a source', async () => {
		const response = { data: null, error: { message: 'unavailable' } };
		const client = {
			rpc: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(response) })
		} as unknown as SupabaseClient;
		expect(
			await findOrCreateSource(client, { ownerId: 'owner', title: null, text: 'Policy', url: null })
		).toEqual(response);
	});
});
