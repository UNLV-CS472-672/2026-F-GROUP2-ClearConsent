import { describe, expect, it, vi } from 'vitest';
import { actions } from './routes/register/+page.server';

describe('registration confirmation redirect', () => {
	it('targets the origin where signup started', async () => {
		const signUp = vi.fn().mockResolvedValue({ error: null });
		const form = new FormData();
		form.set('email', 'person@example.com');
		form.set('password', 'test-password');
		const request = new Request('http://127.0.0.1:5180/register', {
			method: 'POST',
			body: form
		});

		await actions.default!({
			request,
			url: new URL(request.url),
			locals: { supabase: { auth: { signUp } } }
		} as unknown as Parameters<NonNullable<typeof actions.default>>[0]);

		expect(signUp).toHaveBeenCalledWith({
			email: 'person@example.com',
			password: 'test-password',
			options: { emailRedirectTo: 'http://127.0.0.1:5180/auth/callback' }
		});
	});
});
