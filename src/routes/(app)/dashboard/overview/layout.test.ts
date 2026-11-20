import { cleanup, render, screen, within } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Layout from './+layout.svelte';

vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));
vi.mock('$app/state', () => ({
	page: { url: new URL('https://example.test/dashboard/overview/extract?detail=detailed') }
}));

afterEach(() => {
	cleanup();
});

const child = createRawSnippet(() => ({ render: () => '<p>Child route</p>' }));

describe('signed-in dashboard', () => {
	it('shows the ordinary input methods with no fixed-sample callout', () => {
		render(Layout, { props: { data: { recentSources: [] }, children: child } as any });

		const methods = screen.getByRole('navigation', { name: 'Policy input methods' });
		expect(within(methods).getByRole('link', { name: /URL/ }).getAttribute('href')).toBe(
			'/dashboard/overview/extract?detail=detailed'
		);
		expect(
			within(methods)
				.getByRole('link', { name: /Paste Text/ })
				.getAttribute('href')
		).toBe('/dashboard/overview/text?detail=detailed');
		expect(screen.queryByRole('link', { name: /study sample/i })).toBeNull();
		expect(screen.queryByRole('link', { name: /Read sample policy/i })).toBeNull();
		expect(screen.queryByText(/fixed sample|user study|prepared study/i)).toBeNull();
		expect(screen.getByText('Child route')).toBeTruthy();
	});

	it('lists recent saved analyses with the detail level preserved', () => {
		render(Layout, {
			props: {
				data: {
					recentSources: [
						{
							id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
							title: 'Example policy',
							url: 'https://example.test/policy',
							created_at: '2026-11-01T12:00:00Z'
						}
					]
				},
				children: child
			} as any
		});

		expect(screen.getByRole('link', { name: /Example policy/ }).getAttribute('href')).toBe(
			'/dashboard/overview/analyze/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?detail=detailed'
		);
	});

	it('shows the empty history state when nothing is saved', () => {
		render(Layout, { props: { data: { recentSources: [] }, children: child } as any });
		expect(screen.getByRole('heading', { name: 'No saved analyses yet' })).toBeTruthy();
	});
});
