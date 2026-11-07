import { error, fail, redirect } from '@sveltejs/kit';
import { DEFAULT_STORED_PREFERENCES, StoredPreferencesSchema } from '$lib/contracts/preferences';
import type { Actions, PageServerLoad } from './$types';

// The form edits presentation choices; profile comes from the saved row.
const formSchema = StoredPreferencesSchema.pick({
	focusAreas: true,
	detail: true,
	style: true
});

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
		return { preferences: DEFAULT_STORED_PREFERENCES };
	}

	const parsed = StoredPreferencesSchema.safeParse(data.preferences);

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
		const parsed = formSchema.safeParse({
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

		// Read the current profile instead of accepting one from the form.
		const { data: existing, error: loadError } = await locals.supabase
			.from('privacy_preferences')
			.select('preferences, schema_version')
			.eq('user_id', user.id)
			.maybeSingle();

		if (loadError) {
			return fail(503, {
				success: false,
				message: 'Unable to load your current preferences. Please try again.',
				preferences: parsed.data
			});
		}

		const current = StoredPreferencesSchema.safeParse(
			existing ? existing.preferences : DEFAULT_STORED_PREFERENCES
		);

		if ((existing && existing.schema_version !== 1) || !current.success) {
			return fail(500, {
				success: false,
				message: 'Your saved preferences have an unsupported format.',
				preferences: parsed.data
			});
		}

		const preferences = {
			...current.data,
			...parsed.data
		};

		const { data, error: saveError } = await locals.supabase
			.from('privacy_preferences')
			.upsert(
				{
					user_id: user.id,
					preferences,
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
				preferences
			});
		}

		return {
			success: true,
			message: 'Your preferences have been saved.',
			preferences
		};
	}
};
