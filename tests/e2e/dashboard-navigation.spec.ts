import { expect, test } from '@playwright/test';
import { hasStudyAccount, signInForStudy } from './study-auth';

test('signed-out visitors are sent to login', async ({ page }) => {
	await page.goto('/dashboard/overview');
	await expect(page).toHaveURL(/\/login$/);
});

test('dashboard keeps the policy input forms accessible', async ({ page }) => {
	test.skip(!hasStudyAccount, 'Requires a confirmed study test account');
	await signInForStudy(page);
	await page.goto('/dashboard/overview');
	await expect(page).toHaveURL(/\/dashboard\/overview\/extract$/);
	await expect(page.getByRole('heading', { name: 'Policy workspace' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'No saved analyses yet' })).toBeVisible();
	await expect(page.getByText('Hash', { exact: true })).toHaveCount(0);

	const methods = page.getByRole('navigation', { name: 'Policy input methods' });
	const urlCard = methods.getByRole('link', { name: /URL/ });
	const textCard = methods.getByRole('link', { name: /Paste Text/ });
	await expect(page.locator('input[type="url"]')).toBeVisible();
	await expect(urlCard).toHaveAttribute('aria-current', 'page');
	await expect(textCard).not.toHaveAttribute('aria-current', 'page');

	await textCard.click();
	await expect(page).toHaveURL(
		(url) =>
			url.pathname === '/dashboard/overview/text' && url.searchParams.get('detail') === 'balanced'
	);
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

	await page.getByRole('link', { name: 'Back to dashboard' }).click();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

for (const viewport of [
	{ name: 'desktop', width: 1280, height: 720 },
	{ name: 'phone', width: 390, height: 844 }
]) {
	test(`switching input methods keeps the scroll position on ${viewport.name}`, async ({
		page
	}) => {
		test.skip(!hasStudyAccount, 'Requires a confirmed study test account');
		await page.setViewportSize(viewport);
		await signInForStudy(page);

		const methods = page.getByRole('navigation', { name: 'Policy input methods' });
		const urlCard = methods.getByRole('link', { name: /URL/ });
		const textCard = methods.getByRole('link', { name: /Paste Text/ });
		await methods.evaluate((nav) => window.scrollTo(0, nav.getBoundingClientRect().top - 40));
		const scrolled = await page.evaluate(() => window.scrollY);
		expect(scrolled).toBeGreaterThan(0);

		await textCard.click();
		await expect(textCard).toHaveAttribute('aria-current', 'page');
		await expect(textCard).toBeFocused();
		expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);

		await urlCard.click();
		await expect(urlCard).toHaveAttribute('aria-current', 'page');
		await expect(urlCard).toBeFocused();
		expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);

		await page.getByRole('link', { name: /Submit study sample/ }).click();
		await expect(page).toHaveURL(/\/dashboard\/overview\/result/);
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
	});
}
