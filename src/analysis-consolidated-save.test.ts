import { describe, expect, it, vi } from 'vitest';
import { runConsolidation } from '$lib/server/analysis/consolidation';
import {
	consolidationProviderWith,
	extractionResult,
	fitnessCandidates,
	fitnessFindings,
	SUMMARY
} from '$lib/server/analysis/consolidation/test-fixtures';

// The provider boundary: a real call here would be a paid Stage 1 + Stage 2 run.
const mocks = vi.hoisted(() => ({ provider: vi.fn(), rpc: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$lib/server/db/supabase', () => ({
	getSupabaseForUser: () => ({
		from: () => {
			const chain = {
				insert: () => chain,
				select: () => chain,
				single: async () => ({ data: { id: 'source-id' }, error: null })
			};
			return chain;
		},
		rpc: mocks.rpc
	})
}));
vi.mock('$lib/server/analysis/consolidation', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/analysis/consolidation')>()),
	handleConsolidatedAnalysisHttpRequest: mocks.provider
}));

describe('POST /api/analyze/consolidated', () => {
	it('saves the model and reasoning effort with the analysis', async () => {
		const result = await runConsolidation(
			await extractionResult(fitnessCandidates()),
			consolidationProviderWith({ summary: SUMMARY, findings: fitnessFindings(), exclusions: [] })
		);
		mocks.provider.mockResolvedValue(Response.json(result));
		mocks.rpc.mockResolvedValue({ data: 'analysis-id', error: null });

		const { POST } = await import('./routes/api/analyze/consolidated/+server');
		const response = await POST({
			request: new Request('https://example.test/api/analyze/consolidated', { method: 'POST' }),
			locals: {
				safeGetSession: async () => ({ session: { access_token: 'token' }, user: { id: 'user' } })
			}
		} as unknown as Parameters<typeof POST>[0]);

		expect(response.status).toBe(200);
		expect(mocks.rpc).toHaveBeenCalledWith(
			'save_analysis',
			expect.objectContaining({
				p_analysis: expect.objectContaining({ model: 'mock-model', reasoning_effort: 'medium' })
			})
		);
	});
});
