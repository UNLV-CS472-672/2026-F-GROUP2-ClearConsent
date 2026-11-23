import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import SamplePolicyPage from './+page.svelte';
import SampleResultPage from './result/+page.svelte';

afterEach(() => {
	cleanup();
});

describe('public sample policy', () => {
	it('is labeled as fictional and links to the prepared result', () => {
		const { container } = render(SamplePolicyPage);
		expect(screen.getByRole('heading', { level: 1, name: 'Sample privacy policy' })).toBeTruthy();
		expect(screen.getAllByText(/FICTIONAL SAMPLE/).length).toBeGreaterThan(0);
		expect(
			screen.getByRole('link', { name: /View the prepared result/ }).getAttribute('href')
		).toBe('/sample/result');
		expect(container.querySelector('form')).toBeNull();
	});

	it('offers sign-in and account creation for private features', () => {
		render(SamplePolicyPage);
		expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login');
		expect(screen.getByRole('link', { name: 'Create an account' }).getAttribute('href')).toBe(
			'/register'
		);
	});
});

describe('public sample result', () => {
	it('shows the prepared result with a no-save statement and no forms', () => {
		const { container } = render(SampleResultPage);
		expect(screen.getByRole('heading', { level: 1, name: 'Sample policy results' })).toBeTruthy();
		expect(screen.getByRole('note').textContent).toMatch(/did not analyze.*save a result/s);
		expect(screen.getByText('What this policy says')).toBeTruthy();
		expect(container.querySelector('form')).toBeNull();
		expect(container.querySelector('button')).toBeNull();
	});
});
