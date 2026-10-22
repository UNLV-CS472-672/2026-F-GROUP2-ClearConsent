import { expect, test } from '@playwright/test';

test('dashboard keeps the policy input forms accessible', async ({ page }) => {
	await page.goto('/dashboard/overview');
	await expect(page).toHaveURL(/\/dashboard\/overview\/extract$/);
	await expect(page.getByRole('heading', { name: 'Policy workspace' })).toBeVisible();
	await expect(page.getByText('Sample entries show the planned history layout.')).toBeVisible();

	const methods = page.getByRole('navigation', { name: 'Policy input methods' });
	const urlCard = methods.getByRole('link', { name: /URL/ });
	const textCard = methods.getByRole('link', { name: /Paste Text/ });
	await expect(page.locator('input[type="url"]')).toBeVisible();
	await expect(urlCard).toHaveAttribute('aria-current', 'page');
	await expect(textCard).not.toHaveAttribute('aria-current', 'page');

	await textCard.click();
	await expect(page).toHaveURL(/\/dashboard\/overview\/text$/);
	await expect(textCard).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('textbox', { name: 'Ctrl+Enter to submit.' })).toBeVisible();
	await expect(methods.getByText('Search')).toBeVisible();
	await expect(methods.getByRole('link', { name: /Search/ })).toHaveCount(0);

	await page
		.getByRole('navigation', { name: 'Dashboard links' })
		.getByRole('link', { name: 'Preferences' })
		.click();
	await expect(page).toHaveURL(/\/preferences$/);
	await expect(page.getByRole('heading', { name: 'Make the explanation yours.' })).toBeVisible();
	await expect(page.getByRole('checkbox', { name: /Tracking and ads/ })).toBeVisible();
});
