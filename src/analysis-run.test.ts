import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runConsolidation } from '$lib/server/analysis/consolidation';
import {
	consolidationProviderWith,
	extractionResult,
	fitnessCandidates,
	fitnessFindings,
	SUMMARY
} from '$lib/server/analysis/consolidation/test-fixtures';

// The provider boundary: every call here would be a paid Stage 1 + Stage 2 run.
const mocks = vi.hoisted(() => ({
	provider: vi.fn(),
	supabase: null as unknown
}));
vi.mock('$env/dynamic/private', () => ({ env: { ANALYSIS_ACCESS_TOKEN: 'test-token' } }));
vi.mock('$lib/server/db/supabase', () => ({ getSupabaseForUser: () => mocks.supabase }));
vi.mock('$lib/server/analysis/consolidation', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/analysis/consolidation')>()),
	handleConsolidatedAnalysisHttpRequest: mocks.provider
}));

const SOURCE_ID = '71000000-0000-4000-8000-000000000001';
const RUN_ID = '91000000-0000-4000-8000-000000000001';
const SOURCE = { id: SOURCE_ID, title: 'Synthetic policy', text: 'Policy text.', url: null };

type Tables = Partial<Record<'sources' | 'analyses' | 'analysis_runs' | 'findings', unknown>>;
type Rpc = (name: string, args: Record<string, unknown>) => { data?: unknown; error?: unknown };

// Answers every query on a table with the same row, however the query is chained.
function fakeSupabase(tables: Tables, rpc: Rpc = () => ({ data: true })) {
	const query = (result: { data: unknown; error: unknown }) => {
		const chain: Record<string, unknown> = {
			maybeSingle: async () => result,
			then: (resolve: (value: unknown) => unknown) => resolve(result)
		};
		for (const method of ['select', 'eq', 'order', 'limit']) chain[method] = () => chain;
		return chain;
	};
	const client = {
		from: vi.fn((table: keyof Tables) => {
			const row = tables[table];
			return query(
				row instanceof Error
					? { data: null, error: { message: row.message } }
					: { data: row ?? null, error: null }
			);
		}),
		rpc: vi.fn(async (name: string, args: Record<string, unknown>) => ({
			data: null,
			error: null,
			...rpc(name, args)
		}))
	};
	mocks.supabase = client;
	return client;
}

function startsWith(status: string, runId: string | null = null): Rpc {
	return (name) => (name === 'start_analysis_run' ? { data: { status, runId } } : { data: true });
}

const signedIn = {
	safeGetSession: async () => ({ session: { access_token: 'token' }, user: { id: 'user' } })
};

async function post(body: unknown) {
	const { POST } = await import('./routes/api/analyze/+server');
	return POST({
		request: new Request('https://example.test/api/analyze', {
			method: 'POST',
			body: JSON.stringify(body)
		}),
		locals: signedIn
	} as unknown as Parameters<typeof POST>[0]);
}

async function completeResult() {
	return runConsolidation(
		await extractionResult(fitnessCandidates()),
		consolidationProviderWith({ summary: SUMMARY, findings: fitnessFindings(), exclusions: [] })
	);
}

function rpcCalls(client: ReturnType<typeof fakeSupabase>) {
	return client.rpc.mock.calls.map(([name, args]) => [name, args]);
}

beforeEach(() => {
	vi.resetModules();
	mocks.provider.mockReset();
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/analyze', () => {
	it('runs the provider once for a newly claimed run and clears the run after saving', async () => {
		const client = fakeSupabase({ sources: SOURCE }, startsWith('started', RUN_ID));
		mocks.provider.mockResolvedValue(Response.json(await completeResult()));

		const response = await post({ sourceId: SOURCE_ID });

		expect(response.status).toBe(200);
		expect(mocks.provider).toHaveBeenCalledTimes(1);
		expect(rpcCalls(client).map(([name]) => name)).toEqual([
			'start_analysis_run',
			'save_analysis',
			'complete_analysis_run'
		]);
		expect(client.rpc).toHaveBeenCalledWith('start_analysis_run', {
			p_source_id: SOURCE_ID,
			p_retry: false
		});
		expect(client.rpc).toHaveBeenCalledWith('complete_analysis_run', {
			p_source_id: SOURCE_ID,
			p_run_id: RUN_ID
		});
	});

	it.each(['running', 'failed', 'complete'])(
		'makes no provider call when the source is %s',
		async (status) => {
			fakeSupabase({ sources: SOURCE }, startsWith(status));

			const response = await post({ sourceId: SOURCE_ID });

			expect(response.status).toBe(409);
			expect(await response.json()).toEqual({ status });
			expect(mocks.provider).not.toHaveBeenCalled();
		}
	);

	it('asks to retry only when the request says so', async () => {
		const client = fakeSupabase({ sources: SOURCE }, startsWith('failed'));

		await post({ sourceId: SOURCE_ID, retry: true });
		await post({ sourceId: SOURCE_ID, retry: 'yes' });

		expect(client.rpc.mock.calls.map(([, args]) => args.p_retry)).toEqual([true, false]);
	});

	it('records a provider failure with its code and message', async () => {
		const client = fakeSupabase({ sources: SOURCE }, startsWith('started', RUN_ID));
		mocks.provider.mockResolvedValue(
			Response.json(
				{ error: { code: 'provider_unavailable', message: 'The provider is unavailable.' } },
				{ status: 503 }
			)
		);

		const response = await post({ sourceId: SOURCE_ID });

		expect(response.status).toBe(503);
		expect(client.rpc).toHaveBeenLastCalledWith('fail_analysis_run', {
			p_source_id: SOURCE_ID,
			p_run_id: RUN_ID,
			p_error_code: 'provider_unavailable',
			p_error_message: 'The provider is unavailable.'
		});
	});

	it('records an incomplete analysis as failed without saving it', async () => {
		const client = fakeSupabase({ sources: SOURCE }, startsWith('started', RUN_ID));
		mocks.provider.mockResolvedValue(
			Response.json({ ...(await completeResult()), analysisStatus: 'in_progress' })
		);

		await post({ sourceId: SOURCE_ID });

		expect(rpcCalls(client).map(([name]) => name)).toEqual([
			'start_analysis_run',
			'fail_analysis_run'
		]);
		expect(client.rpc).toHaveBeenLastCalledWith(
			'fail_analysis_run',
			expect.objectContaining({ p_error_code: 'analysis_incomplete' })
		);
	});

	it('records a failed save', async () => {
		const client = fakeSupabase({ sources: SOURCE }, (name) =>
			name === 'start_analysis_run'
				? { data: { status: 'started', runId: RUN_ID } }
				: name === 'save_analysis'
					? { error: { message: 'save failed' } }
					: { data: true }
		);
		mocks.provider.mockResolvedValue(Response.json(await completeResult()));

		await expect(post({ sourceId: SOURCE_ID })).rejects.toMatchObject({ status: 500 });
		expect(client.rpc).toHaveBeenLastCalledWith(
			'fail_analysis_run',
			expect.objectContaining({ p_error_code: 'save_failed' })
		);
	});

	it('records an unexpected error', async () => {
		const client = fakeSupabase({ sources: SOURCE }, startsWith('started', RUN_ID));
		mocks.provider.mockRejectedValue(new Error('boom'));

		await expect(post({ sourceId: SOURCE_ID })).rejects.toThrow('boom');
		expect(client.rpc).toHaveBeenLastCalledWith(
			'fail_analysis_run',
			expect.objectContaining({ p_error_code: 'internal_error' })
		);
	});
});

describe('result page load', () => {
	async function load(tables: Tables) {
		const client = fakeSupabase({ sources: SOURCE, ...tables });
		const fetch = vi.fn();
		const { load } =
			await import('./routes/(app)/dashboard/overview/analyze/[sourceId]/+page.server');
		const data = (await load({
			params: { sourceId: SOURCE_ID },
			locals: signedIn,
			fetch,
			depends: vi.fn()
		} as unknown as Parameters<typeof load>[0])) as { analysis: unknown };
		// Loading, invalidating, and preloading all run this, so it must never start a run.
		expect(fetch).not.toHaveBeenCalled();
		expect(client.rpc).not.toHaveBeenCalled();
		expect(mocks.provider).not.toHaveBeenCalled();
		return data.analysis;
	}

	const later = () => new Date(Date.now() + 60_000).toISOString();

	it('reports a source that has never been run', async () => {
		expect(await load({})).toEqual({ status: 'not_started' });
	});

	it('reports a run in progress', async () => {
		expect(await load({ analysis_runs: { status: 'running', expires_at: later() } })).toEqual({
			status: 'running'
		});
	});

	it('shows a stored failure', async () => {
		expect(
			await load({
				analysis_runs: {
					status: 'failed',
					error_code: 'provider_timeout',
					error_message: 'The analysis provider timed out.',
					expires_at: later()
				}
			})
		).toEqual({
			status: 'failed',
			result: {
				status: 'failed',
				analysisId: SOURCE_ID,
				schemaVersion: 1,
				errorCode: 'provider_timeout',
				message: 'The analysis provider timed out.'
			}
		});
	});

	it('shows an expired run as interrupted', async () => {
		const analysis = await load({
			analysis_runs: { status: 'running', expires_at: new Date(Date.now() - 1).toISOString() }
		});
		expect(analysis).toMatchObject({
			status: 'failed',
			result: { errorCode: 'analysis_interrupted' }
		});
	});

	it('shows a saved analysis', async () => {
		const analysis = await load({
			analyses: { id: 'analysis', summary: 'Summary.' },
			findings: []
		});
		expect(analysis).toMatchObject({ status: 'complete', result: { status: 'insufficient' } });
	});

	it('fails instead of reporting not started when the run state cannot be read', async () => {
		await expect(load({ analysis_runs: new Error('read failed') })).rejects.toMatchObject({
			status: 500
		});
	});
});
