// src/routes/register/+page.server.ts
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;

		if (!email || !password) {
			return fail(400, { message: 'Email and password are required', success: false });
		}

		const { error } = await locals.supabase.auth.signUp({
			email,
			password
		});

		if (error) {
			return fail(400, { message: error.message, success: false });
		}

		return {
			success: true,
			message: 'Registration successful! Please check your email inbox.'
		};
	}
};
