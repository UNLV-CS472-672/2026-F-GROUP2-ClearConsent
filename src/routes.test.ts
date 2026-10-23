import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import Page from './routes/+page.svelte';

describe('welcome page', () => {
	it('renders the project starting page', () => {
		render(Page);

		expect(screen.getByText('Welcome to Clear Consent!')).toBeTruthy();
	});
});
