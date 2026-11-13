import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { successFixture } from '$lib/contracts/fixtures';
import { type RecentSource } from '$lib/components/DataTable';

const pageMock = vi.hoisted(() => ({ url: new URL('https://example.test/') }));
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
	pageMock.url = new URL('https://example.test/');
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

	// Synthetic Results -- Either remove or migrate to demo page
	it('does not show the synthetic button when there are real analyses', () => {
		renderPage([src(1)]);
		expect(screen.queryByLabelText('Display synthetic analyses')).toBeNull();
	});

	it('opens the modal with a details link for real data', async () => {
		const { container } = renderPage([src(1)]);
		await fireEvent.click(container.querySelector('.show-modal-button')!);
		const link = await screen.findByText('View more details');
		expect(link.getAttribute('href')).toContain('/dashboard/overview/analyze/id-1');
	});
	// --
});

/*
 * More Synthetic result tests migrate to demo page or remove
 */
describe('history page empty state and synthetic data', () => {
	it('shows the empty state and synthetic button when there are no analyses', () => {
		renderPage([]);
		expect(screen.getByText('No saved analyses yet')).toBeTruthy();
		expect(screen.getByLabelText('Display synthetic analyses')).toBeTruthy();
		expect(screen.queryByText('Synthetic Data')).toBeNull();
	});

	it('reveals 10 synthetic rows by default when toggled', async () => {
		const { container } = renderPage([]);
		await fireEvent.click(screen.getByLabelText('Display synthetic analyses'));
		expect(screen.getByText('Synthetic Data')).toBeTruthy();
		expect(lines(container).length).toBe(10);
		expect(screen.getByText('Company-1')).toBeTruthy();
	});

	it('toggles synthetic data off on a second click', async () => {
		renderPage([]);
		const btn = screen.getByLabelText('Display synthetic analyses');
		await fireEvent.click(btn);
		await fireEvent.click(btn);
		expect(screen.queryByText('Synthetic Data')).toBeNull();
	});

	it.each(['0', '1', '20', '30'])('generates %s synthetic items', async (n) => {
		const { container } = renderPage([]);
		await fireEvent.click(screen.getByLabelText('Display synthetic analyses'));
		const select = screen.getByText('# of synthetic items').parentElement!.querySelector('select')!;
		await fireEvent.change(select, { target: { value: n } });
		// the table page size is 10, so cap what is visible
		expect(lines(container).length).toBe(Math.min(Number(n), 10));
	});

	it('hides the details link in synthetic modals', async () => {
		const { container } = renderPage([]);
		await fireEvent.click(screen.getByLabelText('Display synthetic analyses'));
		await fireEvent.click(container.querySelector('.show-modal-button')!);
		await vi.waitFor(() => expect(container.querySelector('dialog')).not.toBeNull());
		expect(screen.queryByText('View more details')).toBeNull();
	});
});
