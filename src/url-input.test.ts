import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/state', () => ({
	page: { url: new URL('https://app.example.com/dashboard/overview/extract') }
}));

import Page from './routes/(app)/dashboard/overview/extract/+page.svelte';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn();
	vi.stubGlobal('fetch', fetchMock);
	mocks.goto.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

async function submit() {
	render(Page);
	await fireEvent.input(screen.getByRole('textbox'), {
		target: { value: 'https://policies.example.com/privacy' }
	});
	await fireEvent.click(screen.getByRole('button', { name: 'Extract' }));
}

describe('URL input page', () => {
	it('shows a rejected URL message and keeps the input editable', async () => {
		fetchMock.mockResolvedValue(
			Response.json({ message: 'Use a public policy URL.' }, { status: 400 })
		);
		await submit();
		await vi.waitFor(() => expect(screen.getByText('Use a public policy URL.')).toBeTruthy());
		expect(screen.getByRole('textbox')).toHaveProperty(
			'value',
			'https://policies.example.com/privacy'
		);
		expect(screen.getByRole('button', { name: 'Extract' })).toHaveProperty('disabled', false);
		expect(mocks.goto).not.toHaveBeenCalled();
	});

	it.each([
		() => Promise.reject(new Error('network failure')),
		() => Promise.resolve(new Response('not json', { status: 502 }))
	])('recovers from a network or invalid response', async (answer) => {
		fetchMock.mockImplementation(answer);
		await submit();
		await vi.waitFor(() =>
			expect(
				screen.getByText('Unable to retrieve this page. Check the URL or paste the text.')
			).toBeTruthy()
		);
		expect(screen.getByRole('button', { name: 'Extract' })).toHaveProperty('disabled', false);
	});

	it('opens analysis only when the API returns a saved source ID', async () => {
		fetchMock.mockResolvedValue(Response.json({ id: 'source-1' }));
		await submit();
		await vi.waitFor(() =>
			expect(mocks.goto).toHaveBeenCalledWith(
				'/dashboard/overview/analyze/source-1?detail=balanced'
			)
		);
	});
});
