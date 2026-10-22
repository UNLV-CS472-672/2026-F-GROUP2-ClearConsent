import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import Page from './routes/+page.svelte';

describe('temporary study entry', () => {
	it('labels demo access and links to the dashboard', () => {
		render(Page);

		expect(
			screen.getByRole('heading', { name: 'Your policy workspace starts here.' })
		).toBeTruthy();
		expect(
			screen.getByText('This button opens the dashboard. It does not sign you in or save data.')
		).toBeTruthy();
		expect(
			screen.getByRole('link', { name: 'Continue with demo access' }).getAttribute('href')
		).toBe('/dashboard/overview');
	});
});
