import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisState } from '$lib/analysis-run';
import { FailureFixture } from '$lib/contracts/fixtures';

const mocks = vi.hoisted(() => ({ invalidate: vi.fn() }));
vi.mock('$app/navigation', () => ({ invalidate: mocks.invalidate }));
vi.mock('$app/state', () => ({ page: { url: new URL('https://example.test/') } }));

import Page from './routes/(app)/dashboard/overview/analyze/[sourceId]/+page.svelte';

const SOURCE = { id: '71000000-0000-4000-8000-000000000001', title: 'Synthetic', url: null };
const failed = { status: 'failed', result: FailureFixture } as AnalysisState;

let fetch: ReturnType<typeof vi.fn>;

function data(analysis: AnalysisState) {
	return { data: { source: SOURCE, analysis } } as unknown as Parameters<typeof render>[1];
}

function analyzeRequests() {
	return fetch.mock.calls
		.filter(([url]) => url === '/api/analyze')
		.map(([, init]) => JSON.parse(init.body));
}

beforeEach(() => {
	fetch = vi.fn(async () => Response.json({ status: 'running' }, { status: 409 }));
	vi.stubGlobal('fetch', fetch);
	mocks.invalidate.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('analysis result page', () => {
	it('requests a run for a new source once, even when its data reloads', async () => {
		const { rerender } = render(Page, data({ status: 'not_started' }));
		// Auth events and invalidation hand the page fresh data that is still not started.
		await rerender(data({ status: 'not_started' }));
		await rerender(data({ status: 'not_started' }));
		await vi.waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());

		expect(analyzeRequests()).toEqual([{ sourceId: SOURCE.id, retry: false }]);
	});

	it('waits on a run in progress without starting another', async () => {
		vi.useFakeTimers();
		render(Page, data({ status: 'running' }));

		expect(screen.getByText('Analyzing this policy')).toBeTruthy();
		await vi.advanceTimersByTimeAsync(9_000);

		expect(analyzeRequests()).toEqual([]);
		expect(mocks.invalidate).toHaveBeenCalledTimes(3);
	});

	it('shows a stored failure without re-running it', async () => {
		render(Page, data(failed));

		expect(screen.getByText("We couldn't analyze this policy")).toBeTruthy();
		expect(analyzeRequests()).toEqual([]);
	});

	it('starts exactly one new run on Try again', async () => {
		render(Page, data(failed));

		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		await vi.waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());

		expect(analyzeRequests()).toEqual([{ sourceId: SOURCE.id, retry: true }]);
	});

	it('shows a saved analysis without requesting a run', () => {
		render(
			Page,
			data({
				status: 'complete',
				result: {
					status: 'insufficient',
					analysisId: 'analysis',
					schemaVersion: 1,
					reason: 'Not enough policy text.'
				}
			})
		);

		expect(screen.getByText('Not enough policy text.')).toBeTruthy();
		expect(analyzeRequests()).toEqual([]);
	});
});
