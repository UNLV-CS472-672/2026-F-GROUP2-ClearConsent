import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import Page from './routes/+page.svelte';

describe('welcome page', () => {
	it('renders the project welcome message and documentation link', () => {
		render(Page);

		expect(screen.getByRole('heading', { name: 'Welcome to SvelteKit' })).toBeTruthy();
		expect(screen.getByRole('link', { name: 'svelte.dev/docs/kit' }).getAttribute('href')).toBe(
			'https://svelte.dev/docs/kit'
		);
	});
});
