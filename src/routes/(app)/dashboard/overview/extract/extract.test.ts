import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExtractPage from './+page.svelte';

const mocks = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));
vi.mock('$app/state', () => ({ page: { url: new URL('https://example.test/?detail=quick') } }));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

// The retired fixed sample lived at this path. It is an ordinary URL now.
const formerSampleUrl = 'https://example.test/study-sample';

async function submitUrl(value: string) {
	render(ExtractPage);
	await fireEvent.input(screen.getByRole('textbox'), { target: { value } });
	return await fireEvent.submit(screen.getByRole('button', { name: 'Extract' }).closest('form')!);
}

describe('URL extraction', () => {
	it('sends the former sample URL to extraction like any other URL', async () => {
		const fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
		});
		vi.stubGlobal('fetch', fetch);
		await submitUrl(formerSampleUrl);
		await waitFor(() =>
			expect(mocks.goto).toHaveBeenCalledWith(
				'/dashboard/overview/analyze/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa?detail=quick'
			)
		);
		expect(fetch).toHaveBeenCalledWith(
			'/api/extract',
			expect.objectContaining({ method: 'POST', body: JSON.stringify({ url: formerSampleUrl }) })
		);
	});

	it('keeps the server message visible when extraction is rejected', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				json: async () => ({ message: 'Could not read that page.' })
			})
		);
		await submitUrl('https://example.test/policy');
		expect((await screen.findByRole('alert')).textContent).toBe('Could not read that page.');
		expect(mocks.goto).not.toHaveBeenCalled();
	});

	it('shows no fixed-sample shortcut or study copy', () => {
		render(ExtractPage);
		expect(screen.queryByRole('button', { name: /study sample/i })).toBeNull();
		expect(screen.queryByText(/prepared study/i)).toBeNull();
	});
});
