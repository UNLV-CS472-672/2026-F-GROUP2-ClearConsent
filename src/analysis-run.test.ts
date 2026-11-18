import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Finding } from '$lib/contracts/analysis';
import { createPreferenceSnapshot, type PreferenceEvaluation } from '$lib/contracts/preferences';
import { evaluatePreferences } from '$lib/risk';
import {
	runConsolidation,
	toFindingRows,
	type ConsolidationResult
} from '$lib/server/analysis/consolidation';
import { buildPreferenceSave } from '$lib/server/analysis/personalization';
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

type Tables = Partial<
	Record<
		| 'sources'
		| 'analyses'
		| 'analysis_runs'
		| 'findings'
		| 'privacy_preferences'
		| 'preference_evaluations',
		unknown
	>
>;
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

async function getStatus(sourceId: string) {
	const { GET } = await import('./routes/api/analyze/+server');
	return GET({
		url: new URL(`https://example.test/api/analyze?sourceId=${sourceId}`),
		locals: signedIn
	} as unknown as Parameters<typeof GET>[0]);
}

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
	it('runs the provider once for a newly claimed run and releases the run after saving', async () => {
		const client = fakeSupabase({ sources: SOURCE }, startsWith('started', RUN_ID));
		mocks.provider.mockResolvedValue(Response.json(await completeResult()));

		const response = await post({ sourceId: SOURCE_ID });

		expect(response.status).toBe(200);
		expect(mocks.provider).toHaveBeenCalledTimes(1);
		expect(rpcCalls(client).map(([name]) => name)).toEqual([
			'start_analysis_run',
			'save_analysis',
			'release_analysis_run'
		]);
		expect(client.rpc).toHaveBeenCalledWith('start_analysis_run', {
			p_source_id: SOURCE_ID,
			p_retry: false
		});
		expect(client.rpc).toHaveBeenCalledWith('release_analysis_run', {
			p_source_id: SOURCE_ID,
			p_run_id: RUN_ID
		});
		expect(client.rpc).toHaveBeenCalledWith(
			'save_analysis',
			expect.objectContaining({
				p_analysis: expect.objectContaining({ model: 'mock-model', reasoning_effort: 'medium' })
			})
		);
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

	it.each(['analysis_disabled', 'configuration_error', 'unauthorized'])(
		'releases the run instead of failing the source on %s',
		async (code) => {
			const client = fakeSupabase({ sources: SOURCE }, startsWith('started', RUN_ID));
			mocks.provider.mockResolvedValue(
				Response.json({ error: { code, message: 'Not available.' } }, { status: 503 })
			);

			const response = await post({ sourceId: SOURCE_ID });

			expect(response.status).toBe(503);
			expect(rpcCalls(client).map(([name]) => name)).toEqual([
				'start_analysis_run',
				'release_analysis_run'
			]);
		}
	);

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

	it('retries ending the run once after a passing error', async () => {
		let releases = 0;
		const client = fakeSupabase({ sources: SOURCE }, (name) =>
			name === 'start_analysis_run'
				? { data: { status: 'started', runId: RUN_ID } }
				: name === 'release_analysis_run' && releases++ === 0
					? { error: { message: 'connection reset' } }
					: { data: true }
		);
		mocks.provider.mockResolvedValue(Response.json(await completeResult()));

		const response = await post({ sourceId: SOURCE_ID });

		expect(response.status).toBe(200);
		expect(rpcCalls(client).map(([name]) => name)).toEqual([
			'start_analysis_run',
			'save_analysis',
			'release_analysis_run',
			'release_analysis_run'
		]);
	});

	it('gives up after one retry and still returns the response', async () => {
		const client = fakeSupabase({ sources: SOURCE }, (name) =>
			name === 'start_analysis_run'
				? { data: { status: 'started', runId: RUN_ID } }
				: name === 'fail_analysis_run'
					? { error: { message: 'connection reset' } }
					: { data: true }
		);
		mocks.provider.mockResolvedValue(
			Response.json(
				{ error: { code: 'provider_unavailable', message: 'The provider is unavailable.' } },
				{ status: 503 }
			)
		);

		const response = await post({ sourceId: SOURCE_ID });

		expect(response.status).toBe(503);
		expect(rpcCalls(client).map(([name]) => name)).toEqual([
			'start_analysis_run',
			'fail_analysis_run',
			'fail_analysis_run'
		]);
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

// The arguments of the save_analysis call, if one was made.
function saveArgs(client: ReturnType<typeof fakeSupabase>) {
	const call = client.rpc.mock.calls.find(([name]) => name === 'save_analysis');
	return call?.[1] as
		| {
				p_analysis: Record<string, unknown>;
				p_findings: { id: string }[];
				p_evaluations: { concern: string; indicator: string; findingId: string | null }[];
		  }
		| undefined;
}

function savedPreferences(profile: string) {
	return { preferences: { profile }, schema_version: 1 };
}

describe('POST /api/analyze personalized indicators', () => {
	it('saves one indicator per concern and a Balanced snapshot by default', async () => {
		const client = fakeSupabase({ sources: SOURCE }, startsWith('started', RUN_ID));
		mocks.provider.mockResolvedValue(Response.json(await completeResult()));

		expect((await post({ sourceId: SOURCE_ID })).status).toBe(200);

		const args = saveArgs(client)!;
		expect(args.p_analysis).toMatchObject({
			preference_snapshot: createPreferenceSnapshot('balanced'),
			preference_schema_version: 1
		});
		expect(args.p_evaluations.map((e) => e.concern).sort()).toEqual(
			['collection', 'retention', 'security_practices', 'sharing', 'use', 'user_rights'].sort()
		);
		// Linked findings are the UUIDs saved in the same call, never Stage 2's F001 IDs.
		const savedIds = args.p_findings.map((row) => row.id);
		for (const { indicator, findingId } of args.p_evaluations) {
			if (indicator === 'insufficient_evidence') expect(findingId).toBeNull();
			else expect(savedIds).toContain(findingId);
		}
	});

	it('uses the saved profile, so Strict and Relaxed users get different indicators', async () => {
		const indicatorsFor = async (profile: string) => {
			const client = fakeSupabase(
				{ sources: SOURCE, privacy_preferences: savedPreferences(profile) },
				startsWith('started', RUN_ID)
			);
			mocks.provider.mockResolvedValue(Response.json(await completeResult()));
			expect((await post({ sourceId: SOURCE_ID })).status).toBe(200);

			const args = saveArgs(client)!;
			expect(args.p_analysis.preference_snapshot).toEqual(
				createPreferenceSnapshot(profile as 'strict' | 'relaxed')
			);
			return args.p_evaluations.map((e) => `${e.concern}:${e.indicator}`);
		};

		expect(await indicatorsFor('strict')).not.toEqual(await indicatorsFor('relaxed'));
	});

	it.each([
		['cannot be read', new Error('timeout'), 503],
		['have an unsupported format', savedPreferences('paranoid'), 500]
	])('makes no provider call when the preferences %s', async (_label, preferences, status) => {
		const client = fakeSupabase(
			{ sources: SOURCE, privacy_preferences: preferences },
			startsWith('started', RUN_ID)
		);

		await expect(post({ sourceId: SOURCE_ID })).rejects.toMatchObject({ status });
		expect(mocks.provider).not.toHaveBeenCalled();
		// No run is claimed, so the source isn't left running or failed.
		expect(client.rpc).not.toHaveBeenCalled();
	});

	it('saves nothing for an incomplete analysis', async () => {
		const client = fakeSupabase({ sources: SOURCE }, startsWith('started', RUN_ID));
		mocks.provider.mockResolvedValue(
			Response.json({ ...(await completeResult()), analysisStatus: 'partial' })
		);

		await post({ sourceId: SOURCE_ID });

		expect(saveArgs(client)).toBeUndefined();
	});
});

describe('GET /api/analyze', () => {
	it('reports the status without starting anything', async () => {
		const client = fakeSupabase({
			analysis_runs: { status: 'running', expires_at: new Date(Date.now() + 60_000).toISOString() }
		});

		const response = await getStatus(SOURCE_ID);

		expect(await response.json()).toEqual({ status: 'running' });
		expect(client.rpc).not.toHaveBeenCalled();
		expect(mocks.provider).not.toHaveBeenCalled();
	});

	it('reports a run that finishes between its reads as complete', async () => {
		// The first read sees the run in progress. The second sees it saved and its run row removed.
		let reads = 0;
		fakeSupabase({
			get analyses() {
				return reads++ === 0 ? null : { id: 'analysis', summary: 'Summary.' };
			},
			get analysis_runs() {
				return reads++ === 0
					? { status: 'running', expires_at: new Date(Date.now() + 60_000).toISOString() }
					: null;
			}
		});

		const response = await getStatus(SOURCE_ID);

		expect(await response.json()).toEqual({ status: 'complete' });
	});

	it('fails instead of reporting not started when the state cannot be read', async () => {
		fakeSupabase({ analysis_runs: new Error('read failed') });

		await expect(getStatus(SOURCE_ID)).rejects.toMatchObject({ status: 500 });
	});

	it('rejects a malformed source id', async () => {
		fakeSupabase({});

		await expect(getStatus('not-a-uuid')).rejects.toMatchObject({ status: 400 });
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
		expect(analysis).toMatchObject({
			status: 'complete',
			result: { status: 'insufficient' },
			// Saved before personalized indicators were.
			personalization: { status: 'not_saved' }
		});
	});

	// The tables as the analyze route saved them for a Strict user.
	async function savedStrictAnalysis(result?: ConsolidationResult) {
		result ??= await completeResult();
		const { rows, idMap } = toFindingRows(result, 'analysis');
		const saved = buildPreferenceSave(result.findings, 'strict', idMap);
		return {
			analyses: {
				id: 'analysis',
				summary: SUMMARY,
				preference_snapshot: saved.snapshot,
				preference_schema_version: saved.snapshotVersion
			},
			findings: rows,
			preference_evaluations: saved.evaluations.map((item) => ({
				preference_key: item.concern,
				preference_value: item.level,
				indicator: item.indicator,
				finding_id: item.findingId,
				explanation: item.explanation
			}))
		};
	}

	type Loaded = {
		result: { status: string; findings?: Finding[] };
		personalization: { status: string; evaluation: PreferenceEvaluation };
	};

	it('shows a saved analysis with the indicators saved for it', async () => {
		const tables = await savedStrictAnalysis();

		const analysis = (await load(tables)) as Loaded;

		expect(analysis.personalization.status).toBe('ready');
		const { evaluation } = analysis.personalization;
		expect(evaluation.profile.id).toBe('strict');
		expect(evaluation.indicators.map((item) => item.indicator)).toEqual(
			tables.preference_evaluations.map((row) => row.indicator)
		);
		expect(evaluation).toEqual(evaluatePreferences(analysis.result.findings!, 'strict'));
	});

	it('shows the saved indicators for an analysis with no findings', async () => {
		// Every concern is insufficient evidence, with no linked finding.
		const tables = await savedStrictAnalysis({ ...(await completeResult()), findings: [] });

		const analysis = (await load({ ...tables, findings: [] })) as Loaded;

		expect(analysis.result.status).toBe('insufficient');
		expect(analysis.personalization.status).toBe('ready');
		expect(analysis.personalization.evaluation.counts).toEqual({
			conflict: 0,
			alignment: 0,
			insufficient_evidence: 6
		});
	});

	it('keeps showing the saved indicators after the user changes their profile', async () => {
		const tables = await savedStrictAnalysis();
		const before = (await load(tables)) as Loaded;

		// The user switches from Strict to Relaxed after the analysis was saved.
		const after = (await load({
			...tables,
			privacy_preferences: { preferences: { profile: 'relaxed' }, schema_version: 1 }
		})) as Loaded;

		expect(after.personalization.evaluation.profile.id).toBe('strict');
		expect(after.personalization).toEqual(before.personalization);
	});

	it.each([
		['cannot be read', new Error('timeout')],
		['do not fit the snapshot', [{ preference_key: 'sharing', indicator: 'conflict' }]]
	])(
		'still shows the findings, with personalization unavailable, when the indicators %s',
		async (_label, rows) => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			const tables = await savedStrictAnalysis();

			const analysis = (await load({ ...tables, preference_evaluations: rows })) as Loaded;

			expect(analysis.result.status).toBe('success');
			expect(analysis.result.findings).toHaveLength(tables.findings.length);
			// Never shown as no concerns.
			expect(analysis.personalization).toEqual({ status: 'unavailable' });
		}
	);

	it('fails instead of reporting not started when the run state cannot be read', async () => {
		await expect(load({ analysis_runs: new Error('read failed') })).rejects.toMatchObject({
			status: 500
		});
	});
});
