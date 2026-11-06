import { expect, test } from '@playwright/test';
import { hasStudyAccount, signInForStudy } from './study-auth';

test(
	'preferences preview saves choices and restores them after reload',
	{ tag: '@authenticated' },
	async ({ page }) => {
		test.skip(!hasStudyAccount, 'Requires a confirmed study test account');
		await signInForStudy(page);
		await page.goto('/preferences');
		// The layout invalidates page data on initial auth; let that refresh finish before editing.
		await page.waitForLoadState('networkidle');
		await expect(page.getByRole('note')).toContainText(
			'Use Save preferences to keep your choices for future visits. The level of detail carries into the study example when you continue below. Saving these choices does not yet change live AI analyses. Answer style applies only to this preview, and privacy interests do not change this example.'
		);

		// Restore the dedicated account's presentation choices even if an assertion fails.
		// The form never submits the scoring profile introduced by #72.
		const original = {
			focusAreas: await page
				.locator('input[name="focusAreas"]:checked')
				.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value)),
			detail: await page.locator('input[name="detail"]:checked').inputValue(),
			style: await page.locator('input[name="style"]:checked').inputValue()
		};
		const sharing = page.getByRole('checkbox', { name: /Data sharing/ });
		const savedSharing = !original.focusAreas.includes('sharing');
		let saveAttempted = false;
		try {
			await page.getByRole('radio', { name: 'Bullet points' }).check();

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

			await sharing.setChecked(savedSharing);
			await expect(page.getByRole('radio', { name: 'Detailed' })).toBeChecked();
			await expect(page.getByRole('radio', { name: 'Short paragraph' })).toBeChecked();
			saveAttempted = true;
			await page.getByRole('button', { name: 'Save preferences' }).click();
			await expect(page.getByRole('status')).toHaveText('Your preferences have been saved.');
			await page.reload();
			await page.waitForLoadState('networkidle');
			await expect(sharing).toBeChecked({ checked: savedSharing });
			await expect(page.getByRole('radio', { name: 'Detailed' })).toBeChecked();
			await expect(page.getByRole('radio', { name: 'Short paragraph' })).toBeChecked();
			await expect(preview.locator('ul')).toHaveCount(0);

			// Unsaved edits must not replace the persisted choices.
			await sharing.setChecked(!savedSharing);
			await page.getByRole('radio', { name: 'Quick scan' }).check();
			await page.getByRole('radio', { name: 'Bullet points' }).check();
			await page.reload();
			await page.waitForLoadState('networkidle');
			await expect(sharing).toBeChecked({ checked: savedSharing });
			await expect(page.getByRole('radio', { name: 'Detailed' })).toBeChecked();
			await expect(page.getByRole('radio', { name: 'Short paragraph' })).toBeChecked();
			await page.getByRole('link', { name: 'Back to dashboard' }).click();
			await expect(page).toHaveURL(
				(url) =>
					url.pathname === '/dashboard/overview/extract' &&
					url.searchParams.get('detail') === 'detailed'
			);
		} finally {
			if (saveAttempted) {
				await page.goto('/preferences');
				await page.waitForLoadState('networkidle');
				for (const value of ['sharing', 'tracking', 'retention']) {
					await page
						.locator(`input[name="focusAreas"][value="${value}"]`)
						.setChecked(original.focusAreas.includes(value));
				}
				await page.locator(`input[name="detail"][value="${original.detail}"]`).check();
				await page.locator(`input[name="style"][value="${original.style}"]`).check();
				await page.getByRole('button', { name: 'Save preferences' }).click();
				await expect(page.getByRole('status')).toHaveText('Your preferences have been saved.');
			}
		}
	}
);
