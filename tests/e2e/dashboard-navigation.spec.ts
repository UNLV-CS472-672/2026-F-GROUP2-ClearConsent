import { expect, test } from '@playwright/test';

test('dashboard keeps the policy input forms accessible', async ({ page }) => {
	await page.goto('/dashboard/overview');
	await expect(page.getByRole('heading', { name: 'Policy workspace' })).toBeVisible();
	await expect(page.getByText('Sample entries show the planned history layout.')).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Policy input methods' })
		.getByRole('link', { name: 'URL' })
		.click();
	await expect(page).toHaveURL(/\/dashboard\/overview\/extract$/);
	await expect(page.locator('input')).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Policy input methods' })
		.getByRole('link', { name: 'Paste Text' })
		.click();
	await expect(page).toHaveURL(/\/dashboard\/overview\/text$/);
	await expect(page.getByRole('textbox', { name: 'Ctrl+Enter to submit.' })).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Dashboard links' })
		.getByRole('link', { name: 'Preferences' })
		.click();
	await expect(page).toHaveURL(/\/preferences$/);
	await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();
	await expect(page.locator('input[name="Tracking"]')).toBeVisible();
});
