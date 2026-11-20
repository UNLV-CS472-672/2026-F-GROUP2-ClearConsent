import { expect, test, type Locator, type Page } from '@playwright/test';

// Anonymous: no account is used. The sample is read-only, so these cases record every request and
// fail if the guest flow makes a POST, calls an analysis, chat, extraction, or save endpoint.
const GUEST_WRITE_OR_PAID_PATTERN = /\/(api\/(analyze|chat|extract)|source)(\?|\/|$)/;

async function tabTo(page: Page, target: Locator) {
	for (let step = 0; step < 80; step++) {
		if (await target.evaluate((element) => element === document.activeElement)) break;
		await page.keyboard.press('Tab');
	}
	await expect(target).toBeFocused();
}

async function overflowPx(page: Page) {
	return page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
}

const viewports = [
	{ name: 'desktop', width: 1280, height: 720 },
	{ name: 'phone', width: 390, height: 844 }
];

for (const viewport of viewports) {
	test(`guest flows landing -> sample -> prepared result -> landing on ${viewport.name}`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		const requests: string[] = [];
		page.on('request', (request) => requests.push(`${request.method()} ${request.url()}`));

		await page.goto('/');
		await page.getByRole('link', { name: /Inspect a sample policy/ }).click();
		await expect(page).toHaveURL(/\/sample$/);
		await expect(
			page.getByRole('heading', { level: 1, name: 'Sample privacy policy' })
		).toBeVisible();
		await expect(page.getByText('Not a real service')).toBeVisible();
		expect(await overflowPx(page), '/sample overflow').toBe(0);

		await page.getByRole('link', { name: /View the prepared result/ }).click();
		await expect(page).toHaveURL(/\/sample\/result$/);
		await expect(
			page.getByRole('heading', { level: 1, name: 'Sample policy results' })
		).toBeVisible();
		await expect(page.getByRole('note').first()).toContainText('Prepared demonstration');
		// Supporting excerpts are visible in the shared result view.
		await expect(page.locator('blockquote').first()).toBeVisible();
		expect(await overflowPx(page), '/sample/result overflow').toBe(0);

		await page.getByRole('link', { name: 'Back to home' }).first().click();
		await expect(page).toHaveURL(/\/$/);
		await expect(
			page.getByRole('heading', { name: 'A clearer way to inspect a privacy policy.' })
		).toBeVisible();

		expect(requests.filter((request) => request.startsWith('POST'))).toEqual([]);
		expect(requests.filter((request) => GUEST_WRITE_OR_PAID_PATTERN.test(request))).toEqual([]);
	});
}

test('guest sample is reachable and navigable by keyboard alone', async ({ page }) => {
	await page.goto('/');
	const entry = page.getByRole('link', { name: /Inspect a sample policy/ });
	await tabTo(page, entry);
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/sample$/);

	const result = page.getByRole('link', { name: /View the prepared result/ });
	await tabTo(page, result);
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/sample\/result$/);

	const back = page.getByRole('link', { name: 'Back to home' }).first();
	await tabTo(page, back);
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/$/);
});

test('protected routes still require sign-in, including sample look-alikes', async ({ page }) => {
	for (const path of [
		'/preferences',
		'/dashboard/history',
		'/dashboard/overview/extract',
		'/sample/other'
	]) {
		await page.goto(path);
		await expect(page, path).toHaveURL(/\/login$/);
	}

	// Protected APIs redirect anonymous callers before doing any work and never reach analysis.
	const response = await page.request.post('/api/analyze', {
		data: { sourceId: '00000000-0000-4000-8000-000000000000', retry: false },
		maxRedirects: 0
	});
	expect(response.status()).toBe(303);
	expect(response.headers()['location']).toContain('/login');
});
