import { expect, test } from '@playwright/test';

test('shows the welcome page and documentation link', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByText('Welcome to Clear Consent!')).toBeVisible();
});
