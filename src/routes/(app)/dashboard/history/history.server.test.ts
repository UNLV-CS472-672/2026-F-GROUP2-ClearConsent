import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ getSupabaseForUser: vi.fn() }));
vi.mock('$lib/server/db/supabase', () => db);

import { load } from './+page.server';

function query(result: { data: unknown; error: { message: string } | null }) {
	return {
		select: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		order: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		maybeSingle: vi.fn().mockResolvedValue(result),
		// The source and findings queries end at order(), where Supabase is thenable.
		then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve)
	};
}

function setup(
	session = { access_token: 'synthetic-owner-token' } as { access_token: string } | null
) {
	const sources = query({
		data: [
			{ id: 'source-a', title: 'First policy', url: null, created_at: '2026-11-01' },
			{
				id: 'source-b',
				title: 'Second policy',
				url: 'https://example.test',
				created_at: '2026-11-02'
			}
		],
		error: null
	});
	const analyses = query({
		data: {
			id: 'analysis-a',
			summary: 'First summary',
			model: 'test-model',
			reasoning_effort: 'low'
		},
		error: null
	});
	const findings = query({ data: [], error: null });
	const client = {
		from: vi.fn((table: string) => {
			if (table === 'sources') return sources;
			if (table === 'analyses') return analyses;
			if (table === 'findings') return findings;
			throw new Error(`Unexpected table: ${table}`);
		})
	};
	db.getSupabaseForUser.mockResolvedValue(client);
	const locals = { safeGetSession: vi.fn().mockResolvedValue({ session }) };
	const run = () =>
		load({ locals, url: new URL('https://example.test/dashboard/history') } as never);
	return { run, client, sources, analyses, findings, locals };
}

beforeEach(() => vi.clearAllMocks());

describe('History server loader', () => {
	it('does not query saved results without a session', async () => {
		const test = setup(null);
		expect(await test.run()).toEqual({ recentSources: [], results: [] });
		expect(db.getSupabaseForUser).not.toHaveBeenCalled();
	});

	it('loads each source with its latest saved result and no provider request', async () => {
		const test = setup();
		test.analyses.maybeSingle
			.mockResolvedValueOnce({
				data: {
					id: 'analysis-a',
					summary: 'First summary',
					model: 'test-model',
					reasoning_effort: 'low'
				},
				error: null
			})
			.mockResolvedValueOnce({
				data: {
					id: 'analysis-b',
					summary: 'Second summary',
					model: 'test-model',
					reasoning_effort: 'low'
				},
				error: null
			});

		const result = await test.run();
		expect(db.getSupabaseForUser).toHaveBeenCalledTimes(1);
		expect(db.getSupabaseForUser).toHaveBeenCalledWith('synthetic-owner-token');
		expect(test.sources.select).toHaveBeenCalledWith(
			'id, title, url, created_at, analyses!inner(id), owner_id'
		);
		expect(test.sources.order).toHaveBeenCalledWith('created_at', { ascending: false });
		expect(test.analyses.eq.mock.calls.map(([column, id]) => [column, id])).toEqual([
			['source_id', 'source-a'],
			['source_id', 'source-b']
		]);
		expect(test.findings.eq.mock.calls.map(([column, id]) => [column, id])).toEqual([
			['analysis_id', 'analysis-a'],
			['analysis_id', 'analysis-b']
		]);
		expect(result.recentSources.map((source) => source.id)).toEqual(['source-a', 'source-b']);
		expect(result.results.map((analysis) => analysis.analysisId)).toEqual([
			'analysis-a',
			'analysis-b'
		]);
		expect(result.results.every((analysis) => analysis.status === 'insufficient')).toBe(true);
	});

	it('shows a source read failure instead of a false empty History', async () => {
		const test = setup();
		test.sources.then = (resolve) =>
			Promise.resolve({ data: null, error: { message: 'database unavailable' } }).then(resolve);
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await expect(test.run()).rejects.toThrow('Unable to load recent analyses.');
			expect(test.client.from).toHaveBeenCalledTimes(1);
		} finally {
			log.mockRestore();
		}
	});

	it('does not present a missing analysis or failed findings read as a saved success', async () => {
		const test = setup();
		test.analyses.maybeSingle.mockResolvedValue({ data: null, error: null });
		await expect(test.run()).rejects.toThrow('Unable to find analysis.');

		test.analyses.maybeSingle.mockResolvedValue({
			data: { id: 'analysis-a', summary: 'Summary', model: 'test-model', reasoning_effort: 'low' },
			error: null
		});
		test.findings.then = (resolve) =>
			Promise.resolve({ data: null, error: { message: 'database unavailable' } }).then(resolve);
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		try {
			await expect(test.run()).rejects.toThrow('Unable to load the findings.');
		} finally {
			log.mockRestore();
		}
	});
});
