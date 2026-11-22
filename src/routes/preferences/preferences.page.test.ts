import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';
import { defaultPreferences } from '$lib/preferences';

afterEach(cleanup);

const saved = {
	...defaultPreferences,
	focusAreas: ['tracking'],
	detail: 'quick' as const,
	style: 'bullets' as const
};

describe('preferences page', () => {
	it('restores saved choices and changes only the illustrative answer format', async () => {
		render(Page, { data: { preferences: saved } } as never);
		expect(
			(screen.getByRole('checkbox', { name: /Tracking and ads/ }) as HTMLInputElement).checked
		).toBe(true);
		expect((screen.getByRole('radio', { name: 'Quick scan' }) as HTMLInputElement).checked).toBe(
			true
		);
		expect(
			screen.queryByText('The excerpt does not say whether reporting can be turned off later.')
		).toBeNull();

		await fireEvent.click(screen.getByRole('radio', { name: 'Detailed' }));
		expect(
			screen.getByText('The excerpt does not say whether reporting can be turned off later.')
		).toBeTruthy();
		await fireEvent.click(screen.getByRole('radio', { name: 'Short paragraph' }));
		expect(
			screen.getByText('See the answer format').closest('section')?.querySelector('ul')
		).toBeNull();
		expect(screen.getByText(/invented policy text/)).toBeTruthy();
	});

	it('retains submitted choices and reports a failed save without claiming success', () => {
		render(Page, {
			data: { preferences: defaultPreferences },
			form: {
				preferences: { ...saved, focusAreas: ['sharing'], detail: 'detailed' },
				message: 'Unable to save your preferences. Please try again.',
				success: false
			}
		} as never);
		expect(screen.getByRole('status').textContent).toContain('Unable to save');
		expect(
			(screen.getByRole('checkbox', { name: /Data sharing/ }) as HTMLInputElement).checked
		).toBe(true);
		expect((screen.getByRole('radio', { name: 'Detailed' }) as HTMLInputElement).checked).toBe(
			true
		);
		expect(screen.getByRole('link', { name: /Back to dashboard/ }).getAttribute('href')).toContain(
			'detail=detailed'
		);
	});
});
