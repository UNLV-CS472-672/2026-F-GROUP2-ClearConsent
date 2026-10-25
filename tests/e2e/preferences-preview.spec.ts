import { expect, test } from '@playwright/test';
import { hasStudyAccount, signInForStudy } from './study-auth';

test('preferences preview changes format without claiming to save choices', async ({ page }) => {
	test.skip(!hasStudyAccount, 'Requires a confirmed study test account');
	await signInForStudy(page);
	await page.goto('/preferences');
	await expect(page.getByRole('note')).toContainText(
		'The level of detail carries into the study example when you continue below. Choices are not saved. Answer style and privacy interests apply only to this preview.'
	);

	const preview = page.getByRole('region', { name: 'See the answer format' });
	await page.getByRole('radio', { name: 'Quick scan' }).check();
	await expect(
		preview.getByText('The excerpt does not say whether reporting can be turned off later.')
	).toHaveCount(0);

	await page.getByRole('radio', { name: 'Detailed' }).check();
	await expect(
		preview.getByText('The excerpt does not say whether reporting can be turned off later.')
	).toBeVisible();
	await page.getByRole('radio', { name: 'Short paragraph' }).check();
	await expect(preview.locator('ul')).toHaveCount(0);

	await page.getByRole('checkbox', { name: /Data sharing/ }).check();
	await page.reload();
	await expect(page.getByRole('checkbox', { name: /Data sharing/ })).not.toBeChecked();
	await page.getByRole('link', { name: 'Back to dashboard' }).click();
	await expect(page).toHaveURL(
		(url) =>
			url.pathname === '/dashboard/overview/extract' &&
			url.searchParams.get('detail') === 'balanced'
	);
});
