import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { successFixture } from '$lib/contracts/fixtures';
import { type RecentSource } from '$lib/components/DataTable';

const pageMock = vi.hoisted(() => ({ url: new URL('https://example.test/dashboard/history') }));
vi.mock('$app/state', () => ({ page: pageMock }));

import Page from './+page.svelte';

function src(i: number, o: Partial<RecentSource> = {}): RecentSource {
	return {
		id: `id-${i}`,
		title: `Policy ${i}`,
		url: `https://site${i}.test`,
		created_at: new Date(Date.UTC(2026, 0, i + 1, 12)).toISOString(),
		...o
	};
}

function renderPage(sources: RecentSource[], results = sources.map(() => successFixture)) {
	return render(Page, { data: { recentSources: sources, results } } as any);
}
const lines = (c: HTMLElement) => c.querySelectorAll('.table-line');

beforeEach(() => {
	pageMock.url = new URL('https://example.test/dashboard/history');
	HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
		this.setAttribute('open', '');
	};
	HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
		this.removeAttribute('open');
		this.dispatchEvent(new Event('close'));
	};
});
afterEach(cleanup);

describe('history page layout', () => {
	it('renders the heading, brand and footer', () => {
		renderPage([src(1)]);
		expect(screen.getByRole('heading', { name: 'Analyses' })).toBeTruthy();
		expect(screen.getByText('HISTORY')).toBeTruthy();
		expect(screen.getAllByText('ClearConsent').length).toBe(2);
		expect(screen.getByText('Privacy policy workspace')).toBeTruthy();
	});

	it('links to preferences and back to the dashboard with the default detail', () => {
		renderPage([src(1)]);
		expect(screen.getByText('Preferences').getAttribute('href')).toContain('/preferences');
		expect(screen.getByText(/Back to dashboard/).getAttribute('href')).toContain(
			'/dashboard/overview/extract?detail=balanced'
		);
	});

	it('preserves a valid detail level and normalizes an invalid one', () => {
		pageMock.url = new URL('https://example.test/?detail=detailed');
		renderPage([]);
		expect(screen.getByText(/Back to dashboard/).getAttribute('href')).toContain('detail=detailed');
		cleanup();
		pageMock.url = new URL('https://example.test/?detail=nope');
		renderPage([]);
		expect(screen.getByText(/Back to dashboard/).getAttribute('href')).toContain('detail=balanced');
	});
});

describe('history page data', () => {
	// Duplicated Tests for DataTable
	// However it covers the history page.
	it('lists saved analyses with titles, urls and formatted dates', () => {
		const { container } = renderPage([src(1), src(2)]);
		expect(lines(container).length).toBe(2);
		expect(screen.getByText('Policy 1')).toBeTruthy();
		expect(screen.getByText('https://site2.test')).toBeTruthy();
		// Date column rendered through toLocaleDateString (year always present)
		expect(screen.getAllByText(/2026/).length).toBe(2);
	});

	it('orders newest first by default', () => {
		const { container } = renderPage([src(1), src(3), src(2)]);
		const names = [...container.querySelectorAll('.source-title-text')].map((e) =>
			e.textContent?.trim()
		);
		expect(names).toEqual(['Policy 3', 'Policy 2', 'Policy 1']);
	});

	it('falls back to Untitled and placeholder url for untitled, urlless sources', () => {
		renderPage([src(1, { title: null, url: null })]);
		expect(screen.getByText('Untitled')).toBeTruthy();
		expect(screen.getByText('No URL Available')).toBeTruthy();
	});

	it('does not crash when results are missing for a source', () => {
		expect(() => renderPage([src(1)], [])).not.toThrow();
		expect(screen.getByText('Policy 1')).toBeTruthy();
	});

	it('treats null/undefined recentSources as empty', () => {
		render(Page, { data: { recentSources: undefined, results: [] } } as any);
		expect(screen.getByText('No saved analyses yet')).toBeTruthy();
	});

	it('paginates when there are more than 10 analyses', () => {
		const many = Array.from({ length: 12 }, (_, i) => src(i + 1));
		const { container } = renderPage(many);
		expect(lines(container).length).toBe(10);
		expect(screen.getByText('1/2')).toBeTruthy();
	});
	//  --
	it('opens the modal with a details link for real data', async () => {
		const { container } = renderPage([src(1)]);
		await fireEvent.click(container.querySelector('.show-modal-button')!);
		const link = await screen.findByText('View more details');
		expect(link.getAttribute('href')).toContain('/dashboard/overview/analyze/id-1');
	});
	// --
});

describe('history page empty state', () => {
	it('shows the empty state when there are no analyses', () => {
		renderPage([]);
		expect(screen.getByText('No saved analyses yet')).toBeTruthy();
	});
	it('ensures there is no synthetic data text or display button when there are no analyses', () => {
		renderPage([]);
		expect(screen.queryByText(/Synthetic( Data)?/i)).toBeNull();
		expect(screen.queryByLabelText(/Display Synthetic .*/i)).toBeNull();
	});
});
