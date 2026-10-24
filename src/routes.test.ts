import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import Page from './routes/+page.svelte';

describe('study entry page', () => {
	it('shows the entry heading and sign-in path', () => {
		render(Page);

		expect(
			screen.getByRole('heading', { level: 1, name: 'A clearer way to inspect a privacy policy.' })
		).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy();
	});
});
