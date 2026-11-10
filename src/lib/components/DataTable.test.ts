import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { successFixture } from '$lib/contracts/fixtures';
import DataTable from './DataTable.svelte';
import { urlOrText, titleOrId, type RecentSource } from './DataTable';

function createItem(override: Partial<RecentSource> = {}) {
	const source: RecentSource = {
		id: override.id ?? String(crypto.randomUUID),
		title: override.title !== undefined ? override.title : 'Generic Policy',
		url: override.url !== undefined ? override.url : 'https://genericurl.com/policy',
		created_at: override.created_at ?? '2026-01-01T00:00:00Z'
	};
	return { source, successFixture };
}

const columns = [
	{ accessorKey: 'name', header: 'Name' },
	{ accessorKey: 'created_at', header: 'Created' }
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('Helper functions', () => {
	it('returns title if title is not null', () => {
		const source = createItem().source;
		expect(titleOrId(source)).toBe(source.title);
	});

	it('returns uuid if title is null', () => {
		const source = createItem({ title: null }).source;
		console.log(source.id);
		console.log(source.title);
		console.log(titleOrId(source));
		expect(titleOrId(source)).toBe(source.id);
	});
});
