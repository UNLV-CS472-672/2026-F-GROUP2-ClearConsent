import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/svelte';
import { createColumnHelper } from '@tanstack/svelte-table';
import { successFixture } from '$lib/contracts/fixtures';

const pageMock = vi.hoisted(() => ({ url: new URL('https://example.test/') }));
vi.mock('$app/state', () => ({ page: pageMock }));

import DataTable from './DataTable.svelte';
import {
	urlOrText,
	titleOrId,
	features,
	type RecentSource,
	type SourceAndResult
} from './DataTable';

// --- Helper Function Tests ----
function createItem(override: Partial<RecentSource> = {}) {
	const source: RecentSource = {
		id: override.id ?? crypto.randomUUID(),
		title: override.title !== undefined ? override.title : 'Generic Policy',
		url: override.url !== undefined ? override.url : 'https://genericurl.com/policy',
		created_at: override.created_at ?? '2026-01-01T00:00:00Z'
	};
	return { source, successFixture };
}

describe('Helper functions', () => {
	it('returns title if title is not null and uuid/id if title is null', () => {
		const source = createItem().source;
		const nullsource = createItem({ title: null }).source;
		expect(titleOrId(source)).toBe(source.title);
		expect(titleOrId(nullsource)).toBe(nullsource.id);
	});

	it('returns url if url is not null and placeholder if url is null', () => {
		const source = createItem().source;
		const nullsource = createItem({ url: null }).source;
		expect(urlOrText(source)).toBe(source.url);
		expect(urlOrText(nullsource)).toBe('No URL Available');
	});

});

// ---- Component tests ----
const helper = createColumnHelper<typeof features, SourceAndResult>();
const tableColumns = helper.columns([
	helper.accessor((row) => row.source.title, { id: 'name', header: 'Name' }),
	helper.accessor((row) => row.source.created_at, {
		id: 'created_at',
		header: 'Date Created',
		cell: (info: any) => 'DATE:' + info.getValue()
	})
]);

function row(i: number, o: Partial<RecentSource> = {}): SourceAndResult {
	return {
		source: {
			id: `id-${i}`,
			title: `Policy ${i}`,
			url: `https://site${i}.test/p`,
			created_at: new Date(Date.UTC(2026, 0, i)).toISOString(),
			...o
		},
		result: successFixture
	};
}
const rows = (n: number) => Array.from({ length: n }, (_, i) => row(i + 1));

function renderTable(data: SourceAndResult[], synthetic?: boolean) {
	return render(DataTable, { data, columns: tableColumns, synthetic } as any);
}
const titles = (container: HTMLElement) =>
	[...container.querySelectorAll('.source-title-text')].map((e) => e.textContent?.trim());

beforeEach(() => {
	pageMock.url = new URL('https://example.test/');
	// jsdom may not implement <dialog> modal methods.
	HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
		this.setAttribute('open', '');
	};
	HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
		this.removeAttribute('open');
		this.dispatchEvent(new Event('close'));
	};
});
afterEach(cleanup);

describe('DataTable rendering', () => {
	it('shows the empty state and no rows when data is empty', () => {
		const { container } = renderTable([]);
		expect(screen.getByText('No saved analyses yet')).toBeTruthy();
		expect(container.querySelectorAll('.table-line').length).toBe(0);
	});

	it('still renders controls when empty, but no pagination', () => {
		renderTable([]);
		expect(screen.getByPlaceholderText('Search by name...')).toBeTruthy();
		expect(screen.getByText('Sort By:')).toBeTruthy();
		expect(screen.queryByText('←')).toBeNull();
	});

	it('renders title, url and formatted date for each row', () => {
		renderTable([row(1)]);
		expect(screen.getByText('Policy 1')).toBeTruthy();
		expect(screen.getByText('https://site1.test/p')).toBeTruthy();
		expect(screen.getByText('DATE:2026-01-01T00:00:00.000Z')).toBeTruthy();
		expect(screen.queryByText('No saved analyses yet')).toBeNull();
	});

	it('falls back to the id when title is null and a placeholder when url is null', () => {
		renderTable([row(1, { title: null, url: null })]);
		expect(screen.getByText('id-1')).toBeTruthy();
		expect(screen.getByText('No URL Available')).toBeTruthy();
	});

	it('renders special characters as text, not markup', () => {
		const { container } = renderTable([row(1, { title: '<b>Bold</b> & co' })]);
		expect(container.querySelector('.source-title-text b')).toBeNull();
		expect(screen.getByText('<b>Bold</b> & co')).toBeTruthy();
	});

	it('handles a very long title without crashing', () => {
		const long = 'x'.repeat(5000);
		renderTable([row(1, { title: long })]);
		expect(screen.getByText(long)).toBeTruthy();
	});

	it('renders one row for a single item', () => {
		const { container } = renderTable(rows(1));
		expect(container.querySelectorAll('.table-line').length).toBe(1);
	});
});

describe('DataTable pagination', () => {
	it('hides pagination with 10 or fewer rows', () => {
		renderTable(rows(10));
		expect(screen.queryByText('←')).toBeNull();
		expect(screen.queryByText('→')).toBeNull();
	});

	it('shows only 10 rows per page and a page indicator when there are more', () => {
		const { container } = renderTable(rows(25));
		expect(container.querySelectorAll('.table-line').length).toBe(10);
		expect(screen.getByText('1/3')).toBeTruthy();
	});

	it('shows pagination at exactly 11 rows with 2 pages', () => {
		const { container } = renderTable(rows(11));
		expect(screen.getByText('1/2')).toBeTruthy();
		expect(container.querySelectorAll('.table-line').length).toBe(10);
	});

	it('next and previous move between pages', async () => {
		const { container } = renderTable(rows(25));
		const first = titles(container);
		await fireEvent.click(screen.getByText('→'));
		expect(screen.getByText('2/3')).toBeTruthy();
		expect(titles(container)).not.toEqual(first);
		await fireEvent.click(screen.getByText('←'));
		expect(screen.getByText('1/3')).toBeTruthy();
		expect(titles(container)).toEqual(first);
	});

	it('last page holds the remainder and next does not go past it', async () => {
		const { container } = renderTable(rows(25));
		for (let i = 0; i < 5; i++) await fireEvent.click(screen.getByText('→'));
		expect(screen.getByText('3/3')).toBeTruthy();
		expect(container.querySelectorAll('.table-line').length).toBe(5);
	});

	it('previous on the first page stays on the first page', async () => {
		renderTable(rows(25));
		await fireEvent.click(screen.getByText('←'));
		expect(screen.getByText('1/3')).toBeTruthy();
	});
});

describe('DataTable sorting', () => {
	const data = [
		row(1, { title: 'Banana', created_at: '2026-03-01T00:00:00.000Z' }),
		row(2, { title: 'Apple', created_at: '2026-05-01T00:00:00.000Z' }),
		row(3, { title: 'Cherry', created_at: '2026-01-01T00:00:00.000Z' })
	];
	const select = () => screen.getByRole('combobox') as unknown as HTMLSelectElement;

	it('offers four sort options and defaults to newest first', () => {
		const { container } = renderTable(data);
		expect([...select().options].map((o) => o.textContent)).toEqual([
			'Name (A-Z)',
			'Name (Z-A)',
			'Date (oldest)',
			'Date (newest)'
		]);
		expect(select().value).toBe('created_at-desc');
		expect(titles(container)).toEqual(['Apple', 'Banana', 'Cherry']);
	});

	it.each([
		['name-asc', ['Apple', 'Banana', 'Cherry']],
		['name-desc', ['Cherry', 'Banana', 'Apple']],
		['created_at-asc', ['Cherry', 'Banana', 'Apple']],
		['created_at-desc', ['Apple', 'Banana', 'Cherry']]
	])('sorts by %s', async (value, expected) => {
		const { container } = renderTable(data);
		await fireEvent.change(select(), { target: { value } });
		expect(titles(container)).toEqual(expected);
	});
});

describe('DataTable search', () => {
	const data = [
		row(1, { title: 'Alpha Corp' }),
		row(2, { title: 'Beta Inc' }),
		row(3, { title: 'alphabet' })
	];
	const search = () => screen.getByPlaceholderText('Search by name...');

	it('filters rows by name, case-insensitively', async () => {
		const { container } = renderTable(data);
		await fireEvent.input(search(), { target: { value: 'ALPHA' } });
		expect(titles(container).sort()).toEqual(['Alpha Corp', 'alphabet']);
	});

	it('clearing the search restores all rows', async () => {
		const { container } = renderTable(data);
		await fireEvent.input(search(), { target: { value: 'beta' } });
		expect(titles(container)).toEqual(['Beta Inc']);
		await fireEvent.input(search(), { target: { value: '' } });
		expect(titles(container).length).toBe(3);
	});

	it('shows no rows (not the empty state) when nothing matches', async () => {
		const { container } = renderTable(data);
		await fireEvent.input(search(), { target: { value: 'zzz' } });
		expect(container.querySelectorAll('.table-line').length).toBe(0);
		expect(screen.queryByText('No saved analyses yet')).toBeNull();
	});

	it('treats regex characters literally', async () => {
		const { container } = renderTable(data);
		await fireEvent.input(search(), { target: { value: '.*' } });
		expect(container.querySelectorAll('.table-line').length).toBe(0);
	});
});

/* Modal Tests
 * If a new modal component is created, these tests will need to be modified.
 */
describe('DataTable modal', () => {
	it('is not rendered until a row is clicked', () => {
		const { container } = renderTable(rows(2));
		expect(container.querySelector('dialog')).toBeNull();
	});

	it('opens a dialog with title, url and analysis result on row click', async () => {
		const { container } = renderTable([row(1)]);
		await fireEvent.click(container.querySelector('.show-modal-button')!);
		const dialog = await vi.waitFor(() => {
			const d = container.querySelector('dialog');
			expect(d).not.toBeNull();
			return d as HTMLDialogElement;
		});
		expect(dialog.hasAttribute('open')).toBe(true);
		expect(within(dialog).getByRole('heading', { level: 1 }).textContent?.trim()).toBe('Policy 1');
		expect(within(dialog).getByText('https://site1.test/p')).toBeTruthy();
		expect(
			within(dialog).getByText(successFixture.status === 'success' ? successFixture.summary : '')
		).toBeTruthy();
	});

	it('shows the id in the modal when title is null', async () => {
		const { container } = renderTable([row(1, { title: null })]);
		await fireEvent.click(container.querySelector('.show-modal-button')!);
		const dialog = await vi.waitFor(() => container.querySelector('dialog')!);
		expect(within(dialog).getByRole('heading', { level: 1 }).textContent?.trim()).toBe('id-1');
	});

	it('links to the full analysis with the default detail level', async () => {
		const { container } = renderTable([row(1)]);
		await fireEvent.click(container.querySelector('.show-modal-button')!);
		const link = await screen.findByText('View more details');
		expect(link.getAttribute('href')).toContain('/dashboard/overview/analyze/id-1?detail=balanced');
	});

	it('carries a valid detail level from the URL and ignores invalid ones', async () => {
		pageMock.url = new URL('https://example.test/?detail=quick');
		const { container, unmount } = renderTable([row(1)]);
		await fireEvent.click(container.querySelector('.show-modal-button')!);
		expect((await screen.findByText('View more details')).getAttribute('href')).toContain(
			'?detail=quick'
		);
		unmount();
		pageMock.url = new URL('https://example.test/?detail=bogus');
		const second = renderTable([row(1)]);
		await fireEvent.click(second.container.querySelector('.show-modal-button')!);
		expect((await screen.findByText('View more details')).getAttribute('href')).toContain(
			'?detail=balanced'
		);
	});

	it('omits the details link for synthetic data', async () => {
		const { container } = renderTable([row(1)], true);
		await fireEvent.click(container.querySelector('.show-modal-button')!);
		await vi.waitFor(() => expect(container.querySelector('dialog')).not.toBeNull());
		expect(screen.queryByText('View more details')).toBeNull();
	});

	it('closes via the close button', async () => {
		const { container } = renderTable([row(1)]);
		await fireEvent.click(container.querySelector('.show-modal-button')!);
		await fireEvent.click(await screen.findByLabelText('close'));
		await vi.waitFor(() => expect(container.querySelector('dialog')).toBeNull());
	});

	it('closes when the backdrop (dialog itself) is clicked but not its content', async () => {
		const { container } = renderTable([row(1)]);
		await fireEvent.click(container.querySelector('.show-modal-button')!);
		const dialog = (await vi.waitFor(() =>
			container.querySelector('dialog')!
		)) as HTMLDialogElement;
		await fireEvent.click(dialog.querySelector('.modal-content')!);
		expect(container.querySelector('dialog')).not.toBeNull();
		await fireEvent.click(dialog);
		await vi.waitFor(() => expect(container.querySelector('dialog')).toBeNull());
	});

	it('shows the clicked row, not a different one', async () => {
		const { container } = renderTable(rows(3));
		const buttons = container.querySelectorAll('.table-line');
		// default order is newest first: Policy 3, 2, 1 -> click the second row
		await fireEvent.click(buttons[1].querySelector('.show-modal-button')!);
		const dialog = await vi.waitFor(() => container.querySelector('dialog')!);
		expect(within(dialog).getByRole('heading', { level: 1 }).textContent?.trim()).toBe('Policy 2');
	});
});
