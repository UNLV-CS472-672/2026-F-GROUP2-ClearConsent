import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import Page from './+page.svelte';

describe('study navigation', () => {
	it('links to current screens and identifies unfinished results', () => {
		render(Page);

		expect(
			screen.getByRole('heading', { name: /Privacy policies, made easier to inspect/ })
		).toBeTruthy();
		expect(screen.getByRole('link', { name: /Open text form/ }).getAttribute('href')).toBe(
			'/dashboard/overview/text'
		);
		expect(screen.getByRole('link', { name: /Open URL form/ }).getAttribute('href')).toBe(
			'/dashboard/overview/extract'
		);
		expect(screen.getByText(/still being connected to these screens/)).toBeTruthy();
	});
});
