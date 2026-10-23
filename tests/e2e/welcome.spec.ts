import { expect, test } from '@playwright/test';

test('shows the welcome page and documentation link', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByText('Welcome to Clear Consent!')).toBeVisible();
});

test('email confirmation callback can run before a session exists', async ({ page }) => {
	await page.goto('/auth/callback');
	await expect(page).toHaveURL(/\/login\?auth_error=true$/);
});
