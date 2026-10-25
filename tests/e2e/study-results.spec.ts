import { expect, test } from '@playwright/test';
import { hasStudyAccount, signInForStudy } from './study-auth';

test('fixed sample reaches prepared results from both input methods', async ({ page }) => {
	test.skip(!hasStudyAccount, 'Requires a confirmed study test account');
	await signInForStudy(page);
	let analysisCalls = 0;
	page.on('request', (request) => {
		if (request.url().includes('/api/analyze')) analysisCalls++;
	});
	await page.getByRole('link', { name: 'Submit study sample' }).click();
	await expect(page.getByRole('heading', { name: 'Study example results' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Start with a policy' })).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Recent analyses' })).toHaveCount(0);
	await page.goto('/preferences');
	await page.getByRole('radio', { name: 'Detailed', exact: true }).check();
	await page.getByRole('link', { name: /Continue with study sample/ }).click();
	await page.getByRole('button', { name: 'Use study sample' }).click();
	await page.getByRole('button', { name: 'Extract', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Study example results' })).toBeVisible();
	await expect(page.getByText('Detailed', { exact: true })).toBeVisible();
	await expect(page.locator('details.evidence').first()).toHaveAttribute('open', '');
	await expect(page.locator('blockquote').first()).toBeVisible();
	await page.getByRole('link', { name: 'Try Paste Text' }).click();
	await page.getByRole('button', { name: 'Use study sample' }).click();
	await page.getByRole('button', { name: 'Submit', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Study example results' })).toBeVisible();
	expect(analysisCalls).toBe(0);
	await page.goto('/dashboard/overview/result?detail=quick');
	await expect(page.locator('details.evidence').first()).not.toHaveAttribute('open', '');
	await expect(page.locator('blockquote').first()).toBeHidden();
	await page.locator('details.evidence summary').first().click();
	await expect(page.locator('blockquote').first()).toBeVisible();
	await page.getByRole('link', { name: 'Back to dashboard', exact: true }).click();
	await expect(page).toHaveURL(/\/dashboard\/overview\/extract\?detail=quick$/);
	await expect(page.getByRole('heading', { name: 'Policy workspace' })).toBeVisible();
});
