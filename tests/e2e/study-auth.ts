import { expect, type Page } from '@playwright/test';

export const hasStudyAccount = Boolean(
	process.env.STUDY_TEST_EMAIL && process.env.STUDY_TEST_PASSWORD
);

export async function signInForStudy(page: Page) {
	await page.goto('/login');
	await page.getByLabel('Email Address').fill(process.env.STUDY_TEST_EMAIL!);
	await page.getByLabel('Password').fill(process.env.STUDY_TEST_PASSWORD!);
	await page.getByRole('button', { name: 'Log In' }).click();
	await expect(page).toHaveURL(/\/dashboard\/overview\/extract$/);
}
