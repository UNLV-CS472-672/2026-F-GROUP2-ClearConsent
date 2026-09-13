import { expect, test } from '@playwright/test';

test('shows the welcome page and documentation link', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'Welcome to SvelteKit' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'svelte.dev/docs/kit' })).toHaveAttribute(
		'href',
		'https://svelte.dev/docs/kit'
	);
});
