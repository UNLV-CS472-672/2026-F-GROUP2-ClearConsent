import { describe, expect, it, vi } from 'vitest';
import { actions, load } from './+page.server';
import { defaultPreferences } from '$lib/preferences';

const savedPreferences = {
	focusAreas: ['tracking'],
	detail: 'quick',
	style: 'paragraph'
};

function setup(userId: string | null = 'user-a') {
	const query = {
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		upsert: vi.fn().mockReturnThis(),
		maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
		single: vi.fn().mockResolvedValue({
			data: { user_id: userId },
			error: null
		})
	};

	const from = vi.fn().mockReturnValue(query);
	const locals = {
		safeGetSession: vi.fn().mockResolvedValue({
			user: userId ? { id: userId } : null,
			session: null
		}),
		supabase: { from }
	};

	const form = new FormData();
	form.append('focusAreas', 'tracking');
	form.set('detail', 'quick');
	form.set('style', 'paragraph');

	const loadPreferences = () => load({ locals } as unknown as Parameters<typeof load>[0]);

	const savePreferences = () =>
		actions.default!({
			locals,
			request: new Request('http://localhost/preferences', {
				method: 'POST',
				body: form
			})
		} as unknown as Parameters<NonNullable<typeof actions.default>>[0]);

	return { query, from, form, loadPreferences, savePreferences };
}

describe('preferences server', () => {
	it('returns defaults when the user has no saved preferences', async () => {
		const test = setup();

		expect(await test.loadPreferences()).toEqual({
			preferences: defaultPreferences
		});
		expect(test.from).toHaveBeenCalledWith('privacy_preferences');
		expect(test.query.eq).toHaveBeenCalledWith('user_id', 'user-a');
	});

	it('restores saved preferences', async () => {
		const test = setup();
		test.query.maybeSingle.mockResolvedValue({
			data: {
				preferences: savedPreferences,
				schema_version: 1
			},
			error: null
		});

		expect(await test.loadPreferences()).toEqual({
			preferences: savedPreferences
		});
	});

	it('redirects signed-out users before reading or saving', async () => {
		const test = setup(null);

		await expect(test.loadPreferences()).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
		await expect(test.savePreferences()).rejects.toMatchObject({
			status: 303,
			location: '/login'
		});
		expect(test.from).not.toHaveBeenCalled();
	});

	it('uses the authenticated user ID even if a different ID is submitted', async () => {
		const test = setup();
		test.form.set('user_id', 'user-b');

		expect(await test.savePreferences()).toMatchObject({ success: true });
		expect(test.query.upsert).toHaveBeenCalledWith(
			{
				user_id: 'user-a',
				preferences: savedPreferences,
				schema_version: 1
			},
			{ onConflict: 'user_id' }
		);
	});

	it('rejects invalid submissions without writing to the database', async () => {
		const test = setup();
		test.form.set('detail', 'invalid');

		expect(await test.savePreferences()).toMatchObject({
			status: 400,
			data: { success: false }
		});
		expect(test.from).not.toHaveBeenCalled();
	});

	it('preserves submitted choices when saving fails', async () => {
		const test = setup();
		test.query.single.mockResolvedValue({
			data: null,
			error: { message: 'Database unavailable' }
		});

		expect(await test.savePreferences()).toMatchObject({
			status: 503,
			data: {
				success: false,
				preferences: savedPreferences
			}
		});
	});
});
