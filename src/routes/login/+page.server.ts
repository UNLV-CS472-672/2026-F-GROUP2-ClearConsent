// src/routes/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		if (!email || !password) {
			return fail(400, { message: 'Email and password are required', success: false });
		}

		// Use the modern server client setup via locals
		const { error } = await locals.supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			return fail(400, { message: error.message, success: false });
		}

		// If successful, push them back to the home or dashboard route
		throw redirect(303, '/');
	}
};
