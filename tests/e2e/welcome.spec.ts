import { expect, test } from '@playwright/test';

test('demo entry opens the dashboard', async ({ page }) => {
	await page.goto('/');

	await expect(
		page.getByRole('heading', { name: 'Your policy workspace starts here.' })
	).toBeVisible();
	await expect(page.getByText('It does not sign you in or save data.')).toBeVisible();
	await page.getByRole('link', { name: 'Continue with demo access' }).click();
	await expect(page).toHaveURL(/\/dashboard\/overview$/);
	await expect(page.getByRole('heading', { name: 'Policy workspace' })).toBeVisible();
});
