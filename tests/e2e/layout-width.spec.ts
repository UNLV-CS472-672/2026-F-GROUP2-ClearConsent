import { expect, test } from '@playwright/test';
import { stringify } from 'devalue';
import { successFixture } from '../../src/lib/contracts/fixtures';
import { hasStudyAccount, signInForStudy } from './study-auth';

// Headless Chromium hides scrollbars by default. Show them, as a normal desktop browser does,
// so a vertical scrollbar takes width from the page (#111).
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test(
	'signed-in pages fit the window with no sideways scroll',
	{ tag: '@authenticated' },
	async ({ page }) => {
		test.skip(!hasStudyAccount, 'Requires a confirmed study test account');
		const recentSources = [
			{
				id: '00000000-0000-4000-8000-000000000001',
				title: 'Example Company Privacy Policy and Data Protection Notice',
				url: 'https://example.com/privacy',
				created_at: '2026-11-01T12:00:00Z'
			},
			{
				id: '00000000-0000-4000-8000-000000000002',
				title: 'Long URL',
				url: `https://example.com/privacy/${'abcdefghijklmnopqrstuvwxyz'.repeat(6)}`,
				created_at: '2026-11-02T12:00:00Z'
			},
			{
				id: '00000000-0000-4000-8000-000000000003',
				title: 'PrivacyPolicy'.repeat(12),
				url: 'https://example.com/privacy',
				created_at: '2026-11-03T12:00:00Z'
			}
		];
		// Replace only History's load data during client navigation. Render real components
		// with fixed long text without depending on or writing the test account's saved rows.
		await page.route('**/dashboard/history/__data.json*', async (route) => {
			const response = await route.fetch();
			const payload = await response.json();
			const historyNode = payload.nodes.at(-1);
			expect(historyNode.type).toBe('data');
			historyNode.data = JSON.parse(
				stringify({
					recentSources,
					results: recentSources.map(() => successFixture),
					type: 'saved'
				})
			);
			await route.fulfill({ response, json: payload });
		});
		await signInForStudy(page);

		for (const viewport of [
			{ width: 1280, height: 720 },
			{ width: 390, height: 844 }
		]) {
			await page.setViewportSize(viewport);
			for (const path of ['/dashboard/overview/extract', '/dashboard/history']) {
				if (path === '/dashboard/history') {
					// Wait for hydration and the initial auth invalidation before client navigation.
					await page.waitForLoadState('networkidle');
					await page.getByRole('link', { name: 'History', exact: true }).click();
					await expect(page).toHaveURL(/\/dashboard\/history$/);
					await expect(page.locator('.table-line')).toHaveCount(recentSources.length);
					for (const source of recentSources) {
						await expect(page.getByText(source.title, { exact: true })).toBeVisible();
					}
				} else {
					await page.goto(path);
				}
				await expect(page.locator('main').first()).toBeVisible();
				const overflow = await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth
				);
				expect(overflow, `${path} at ${viewport.width}px`).toBe(0);
			}
		}
	}
);
