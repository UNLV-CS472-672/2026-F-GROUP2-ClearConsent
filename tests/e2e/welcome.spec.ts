import { expect, test } from '@playwright/test';

test('shows the study entry and auth links', async ({ page }) => {
	await page.goto('/');

	await expect(
		page.getByRole('heading', { name: 'A clearer way to inspect a privacy policy.' })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', /login$/);
	await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
		'href',
		/register$/
	);
});

test('email confirmation callback can run before a session exists', async ({ page }) => {
	await page.goto('/auth/callback');
	await expect(page).toHaveURL(/\/login\?auth_error=true$/);
});
