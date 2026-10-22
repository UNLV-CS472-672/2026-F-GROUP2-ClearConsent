import { expect, test } from '@playwright/test';

test('the study page reaches both current input forms', async ({ page }) => {
	await page.goto('/study');
	await expect(
		page.getByRole('heading', { name: /Privacy policies, made easier to inspect/ })
	).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Where the prototype currently stops' })
	).toBeVisible();

	await page.getByRole('link', { name: /Open text form/ }).click();
	await expect(page).toHaveURL(/\/dashboard\/overview\/text$/);
	await expect(page.getByPlaceholder('Paste policy...')).toBeVisible();

	await page.goto('/study');
	await page.getByRole('link', { name: /Open URL form/ }).click();
	await expect(page).toHaveURL(/\/dashboard\/overview\/extract$/);
	await expect(page.getByRole('heading', { name: 'Extract text from a URL' })).toBeVisible();
});

test('preview links reach the existing dashboard, preferences, and sample history', async ({
	page
}) => {
	for (const [label, path] of [
		['View dashboard', '/dashboard/overview'],
		['View preferences', '/preferences'],
		['View sample history', '/dashboard/history']
	]) {
		await page.goto('/study');
		await page.getByRole('link', { name: new RegExp(label) }).click();
		await expect(page).toHaveURL(new RegExp(`${path}$`));
	}

	await expect(
		page.getByText('Nothing substantial here yet. (Duplicate of overview)')
	).toBeVisible();
});

test('the dashboard links back to the study map', async ({ page }) => {
	await page.goto('/dashboard/overview');
	await page.getByRole('link', { name: 'Study map' }).click();
	await expect(page).toHaveURL(/\/study$/);
});
