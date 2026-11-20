import { expect, test } from '@playwright/test';
import { hasStudyAccount, signInForStudy } from './study-auth';

// The text the retired fixed sample used. It is ordinary pasted input now.
const pastedPolicy =
	'ClearConsent Study Sample Privacy Policy\n\nWe collect approximate location from your IP address to operate the service.\nWe share approximate location with advertising partners only if you enable personalized ads.\nYou can disable personalized ads in Settings; this stops that sharing.\nWe do not sell personal data.\nWe delete your account data within 30 days of a verified deletion request, except records we must keep for legal obligations.';

test(
	'pasted and URL input follow the ordinary save path and keep validation errors visible',
	{ tag: '@authenticated' },
	async ({ page }) => {
		test.skip(!hasStudyAccount, 'Requires a confirmed study test account');
		await signInForStudy(page);

		// Only the save and extraction endpoints are stubbed. The paste action still runs the real
		// server validation, and nothing is written to the account or fetched from an external site.
		const saveBodies: string[] = [];
		const extractBodies: string[] = [];
		let analysisCalls = 0;
		await page.route('**/source', async (route) => {
			saveBodies.push(route.request().postData() ?? '');
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Save stubbed for test' })
			});
		});
		await page.route('**/api/extract', async (route) => {
			extractBodies.push(route.request().postData() ?? '');
			await route.fulfill({
				status: 400,
				contentType: 'application/json',
				body: JSON.stringify({ message: 'Could not read that page.' })
			});
		});
		await page.route('**/api/analyze', async (route) => {
			analysisCalls++;
			await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
		});

		const methods = page.getByRole('navigation', { name: 'Policy input methods' });
		await expect(page.getByRole('button', { name: /study sample/i })).toHaveCount(0);
		await expect(page.getByRole('link', { name: /study sample/i })).toHaveCount(0);

		// Paste Text: a non-policy is rejected by the server and the message stays visible.
		await methods.getByRole('link', { name: /Paste Text/ }).click();
		await expect(page).toHaveURL(/\/dashboard\/overview\/text/);
		const textarea = page.getByRole('textbox', { name: 'Ctrl+Enter to submit.' });
		await textarea.fill('Hello, this is not a policy.');
		await page.getByRole('button', { name: 'Submit', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('Input does not appear to be a policy.');
		expect(saveBodies).toHaveLength(0);

		// The former sample text passes validation and reaches the save path, not a prepared result.
		await textarea.fill(pastedPolicy);
		await page.getByRole('button', { name: 'Submit', exact: true }).click();
		await expect.poll(() => saveBodies.length).toBe(1);
		expect(saveBodies[0]).toContain('We collect approximate location');
		await expect(page.getByRole('alert')).toContainText('Unable to save the submitted text.');
		await expect(page).toHaveURL(/\/dashboard\/overview\/text/);

		// URL: the former sample URL goes to extraction like any other address.
		await methods.getByRole('link', { name: /URL/ }).click();
		await expect(page).toHaveURL(/\/dashboard\/overview\/extract/);
		const sampleUrl = new URL('/study-sample', page.url()).href;
		await page.locator('input[type="url"]').fill(sampleUrl);
		await page.getByRole('button', { name: 'Extract', exact: true }).click();
		await expect.poll(() => extractBodies.length).toBe(1);
		expect(extractBodies[0]).toContain(sampleUrl);
		await expect(page.getByRole('alert')).toContainText('Could not read that page.');
		await expect(page).toHaveURL(/\/dashboard\/overview\/extract/);

		// Old prepared-result links no longer show an example; they land on the input page.
		await page.goto('/dashboard/overview/result?detail=quick');
		await expect(page).toHaveURL(/\/dashboard\/overview\/extract\?detail=quick$/);
		await expect(page.getByRole('heading', { name: 'Policy workspace' })).toBeVisible();
		await expect(page.getByText('Study example results')).toHaveCount(0);

		expect(analysisCalls).toBe(0);
	}
);
