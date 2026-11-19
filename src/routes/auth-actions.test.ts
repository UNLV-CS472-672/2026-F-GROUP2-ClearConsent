import { describe, expect, it, vi } from 'vitest';
import { actions as login } from './login/+page.server';
import { actions as register } from './register/+page.server';

function event(fields: Record<string, string>) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, value);
	const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
	const signUp = vi.fn().mockResolvedValue({ error: null });
	return {
		request: new Request('https://clearconsent.test/register', { method: 'POST', body }),
		url: new URL('https://clearconsent.test/register'),
		locals: { supabase: { auth: { signInWithPassword, signUp } } },
		signInWithPassword,
		signUp
	};
}

describe('account actions', () => {
	it('rejects missing login fields before an auth request', async () => {
		const test = event({ email: 'person@example.test' });
		const result = await login.default!(test as never);
		expect(result).toMatchObject({
			status: 400,
			data: { success: false, message: 'Email and password are required' }
		});
		expect(test.signInWithPassword).not.toHaveBeenCalled();
	});

	it('reports a sign-in error and redirects only after successful auth', async () => {
		const test = event({ email: 'person@example.test', password: 'synthetic-pass' });
		const retry = { ...test, request: test.request.clone() };
		test.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid credentials' } });
		expect(await login.default!(test as never)).toMatchObject({
			status: 400,
			data: { success: false, message: 'Invalid credentials' }
		});
		await expect(login.default!(retry as never)).rejects.toMatchObject({
			status: 303,
			location: '/dashboard/overview'
		});
		expect(test.signInWithPassword).toHaveBeenCalledWith({
			email: 'person@example.test',
			password: 'synthetic-pass'
		});
	});

	it('rejects missing registration fields without sending an email', async () => {
		const test = event({ email: 'person@example.test' });
		expect(await register.default!(test as never)).toMatchObject({
			status: 400,
			data: { success: false, message: 'Email and password are required' }
		});
		expect(test.signUp).not.toHaveBeenCalled();
	});

	it('uses the same-origin callback and reports provider failure or confirmation', async () => {
		const test = event({ email: 'person@example.test', password: 'synthetic-pass' });
		const retry = { ...test, request: test.request.clone() };
		test.signUp.mockResolvedValueOnce({ error: { message: 'Already registered' } });
		expect(await register.default!(test as never)).toMatchObject({
			status: 400,
			data: { success: false, message: 'Already registered' }
		});
		expect(await register.default!(retry as never)).toEqual({
			success: true,
			message: 'Registration successful! Please check your email inbox.'
		});
		expect(test.signUp).toHaveBeenCalledWith({
			email: 'person@example.test',
			password: 'synthetic-pass',
			options: { emailRedirectTo: 'https://clearconsent.test/auth/callback' }
		});
	});
});
