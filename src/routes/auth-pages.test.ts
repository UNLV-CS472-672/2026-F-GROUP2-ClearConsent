import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import LoginPage from './login/+page.svelte';
import RegisterPage from './register/+page.svelte';

afterEach(cleanup);

describe('account entry pages', () => {
	it('keeps sign-in fields labeled and shows a failed action as an alert', () => {
		render(LoginPage, { form: { message: 'Invalid login credentials', success: false } } as never);
		expect(screen.getByRole('alert').textContent).toContain('Invalid login credentials');
		expect(
			(screen.getByRole('textbox', { name: 'Email Address' }) as HTMLInputElement).required
		).toBe(true);
		expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('password');
		expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe(
			'/register'
		);
	});

	it('shows registration failure and confirmation in distinct accessible states', () => {
		const failure = render(RegisterPage, {
			form: { message: 'Email already registered', success: false }
		} as never);
		expect(screen.getByRole('alert').textContent).toContain('Email already registered');
		failure.unmount();

		render(RegisterPage, {
			form: { message: 'Registration successful! Please check your email inbox.', success: true }
		} as never);
		expect(screen.getByRole('status').textContent).toContain('Please check your email inbox.');
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.getByRole('link', { name: 'Log In instead' }).getAttribute('href')).toBe(
			'/login'
		);
	});
});
