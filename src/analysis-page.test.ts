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
// What POST /api/analyze and the status check (GET) answer.
let analyze: () => Promise<Response>;
let status: () => Promise<Response>;

function data(analysis: AnalysisState, source = SOURCE) {
	return { data: { source, analysis } } as unknown as Parameters<typeof render>[1];
}

function analyzeRequests() {
	return fetch.mock.calls
		.filter(([, init]) => init?.method === 'POST')
		.map(([, init]) => JSON.parse(init.body));
}

function statusChecks() {
	return fetch.mock.calls.filter(([, init]) => init?.method !== 'POST').length;
}

beforeEach(() => {
	analyze = async () => Response.json({ status: 'running' }, { status: 409 });
	status = async () => Response.json({ status: 'running' });
	fetch = vi.fn((_url: string, init?: RequestInit) =>
		init?.method === 'POST' ? analyze() : status()
	);
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
		expect(statusChecks()).toBe(3);
		// The full page reloads only once the run has finished.
		expect(mocks.invalidate).not.toHaveBeenCalled();
		status = async () => Response.json({ status: 'failed' });
		await vi.advanceTimersByTimeAsync(3_000);
		expect(mocks.invalidate).toHaveBeenCalledTimes(1);
	});

	it('keeps waiting when a status check fails', async () => {
		vi.useFakeTimers();
		render(Page, data({ status: 'running' }));
		status = async () => {
			throw new TypeError('Failed to fetch');
		};
		await vi.advanceTimersByTimeAsync(3_000);
		status = async () => new Response(null, { status: 500 });
		await vi.advanceTimersByTimeAsync(3_000);

		expect(statusChecks()).toBe(2);
		expect(mocks.invalidate).not.toHaveBeenCalled();
		expect(screen.getByText('Analyzing this policy')).toBeTruthy();
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

	it('shows an error the stored state does not, instead of waiting for the run to expire', async () => {
		analyze = async () =>
			Response.json(
				{ error: { code: 'provider_unavailable', message: 'The provider is unavailable.' } },
				{ status: 503 }
			);
		const { rerender } = render(Page, data(failed));

		await fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
		// The server could not record the failure, so the stored run still says running.
		await rerender(data({ status: 'running' }));
		await vi.waitFor(() => expect(screen.getByText('provider_unavailable')).toBeTruthy());

		expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
	});

	it('offers Try again when a new source fails to start while another source is open', async () => {
		let finish!: (response: Response) => void;
		analyze = () => new Promise((resolve) => (finish = resolve));
		const { rerender } = render(Page, data({ status: 'not_started' }));
		await vi.waitFor(() => expect(analyzeRequests()).toHaveLength(1));

		// Move to another source while the first request is still in flight, then let it fail.
		await rerender(data(failed, { ...SOURCE, id: '71000000-0000-4000-8000-000000000002' }));
		finish(Response.json({ message: 'Unable to start the analysis.' }, { status: 500 }));
		await vi.waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
		await rerender(data({ status: 'not_started' }));

		await vi.waitFor(() => expect(screen.getByText('http_500')).toBeTruthy());
		expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
		expect(analyzeRequests()).toHaveLength(1);
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
