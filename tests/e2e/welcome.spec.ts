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

test('entry links lead to the styled auth forms', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Sign in' }).click();
	await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Email Address' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();

	await page.getByRole('link', { name: 'Create an account' }).click();
	await expect(page.getByRole('heading', { name: 'Get started.' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Sign Up' })).toBeVisible();
	await expect(page.getByText('Check junk or spam if it does not arrive.')).toBeVisible();
});

test('email confirmation callback can run before a session exists', async ({ page }) => {
	await page.goto('/auth/callback');
	await expect(page).toHaveURL(/\/login\?auth_error=true$/);
});
