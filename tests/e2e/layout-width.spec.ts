import { expect, test } from '@playwright/test';
import { hasStudyAccount, signInForStudy } from './study-auth';

// Headless Chromium hides scrollbars by default. Show them, as a normal desktop browser does,
// so a vertical scrollbar takes width from the page (#111).
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test(
	'signed-in pages fit the window with no sideways scroll',
	{ tag: '@authenticated' },
	async ({ page }) => {
		test.skip(!hasStudyAccount, 'Requires a confirmed study test account');
		await signInForStudy(page);

		for (const viewport of [
			{ width: 1280, height: 720 },
			{ width: 390, height: 844 }
		]) {
			await page.setViewportSize(viewport);
			for (const path of ['/dashboard/overview/extract', '/dashboard/history']) {
				await page.goto(path);
				await expect(page.locator('main').first()).toBeVisible();
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth
				);
				expect(overflow, `${path} at ${viewport.width}px`).toBe(0);
			}
		}
	}
);
