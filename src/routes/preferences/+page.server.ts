import { error, fail, redirect } from '@sveltejs/kit';
import { defaultPreferences, preferencesSchema } from '$lib/preferences';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();

	if (!user) {
		redirect(303, '/login');
	}

	const { data, error: loadError } = await locals.supabase
		.from('privacy_preferences')
		.select('preferences, schema_version')
		.eq('user_id', user.id)
		.maybeSingle();

	if (loadError) {
		error(503, 'Unable to load your preferences. Please try again.');
	}

	if (!data) {
		return { preferences: defaultPreferences };
	}

	const parsed = preferencesSchema.safeParse(data.preferences);

	if (data.schema_version !== 1 || !parsed.success) {
		error(500, 'Your saved preferences have an unsupported format.');
	}

	return { preferences: parsed.data };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();

		if (!user) {
			redirect(303, '/login');
		}

		const formData = await request.formData();
		const parsed = preferencesSchema.safeParse({
			focusAreas: formData.getAll('focusAreas'),
			detail: formData.get('detail'),
			style: formData.get('style')
		});

		if (!parsed.success) {
			return fail(400, {
				success: false,
				message: 'Please select valid preference options.'
			});
		}

		const { data, error: saveError } = await locals.supabase
			.from('privacy_preferences')
			.upsert(
				{
					user_id: user.id,
					preferences: parsed.data,
					schema_version: 1
				},
				{ onConflict: 'user_id' }
			)
			.select('user_id')
			.single();

		if (saveError || !data) {
			return fail(503, {
				success: false,
				message: 'Unable to save your preferences. Please try again.',
				preferences: parsed.data
			});
		}

		return {
			success: true,
			message: 'Your preferences have been saved.',
			preferences: parsed.data
		};
	}
};
