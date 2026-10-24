import { describe, expect, it } from 'vitest';
import { load } from './routes/+page.server';

describe('auth entry handoff', () => {
	it('keeps the entry page available to signed-out visitors', async () => {
		const result = await load({
			locals: { safeGetSession: async () => ({ session: null, user: null }) }
		} as Parameters<typeof load>[0]);
		expect(result).toBeUndefined();
	});

	it('sends an existing session to the dashboard', async () => {
		await expect(
			load({
				locals: { safeGetSession: async () => ({ session: {}, user: {} }) }
			} as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/dashboard/overview' });
	});
});
