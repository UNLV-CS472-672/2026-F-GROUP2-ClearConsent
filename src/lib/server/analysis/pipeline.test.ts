import { describe, expect, it, vi } from 'vitest';
import { Stage1Error } from './errors';
import { MAX_SOURCE_CHARACTERS, runStage1Analysis } from './pipeline';
import type { Stage1Provider } from './provider';

const policy =
	'We share approximate location with advertising partners only if personalized ads are enabled.';

function providerWith(output: unknown): Stage1Provider {
	return {
		extract: vi.fn().mockResolvedValue({
			output,
			model: 'mock-model',
			reasoningEffort: 'medium',
			attempts: 1,
			usage: null
		})
	};
}

function supportedCandidate() {
	return {
		category: 'third_party_sharing',
		practice: 'conditional disclosure',
		claim: 'Location sharing occurs only when personalized ads are enabled.',
		explanation: 'The disclosure is conditional on the personalized-ads setting.',
		qualifiers: ['Only if personalized ads are enabled.'],
		uncertainty: null,
		dataCategories: ['approximate location'],
		purposes: [],
		recipients: ['advertising partners'],
		evidence: [{ passageId: 'P001', excerpt: policy }]
	};
}

describe('Stage 1 pipeline', () => {
	it.each([
		{ text: '' },
		{ text: '   \n' },
		{ text: 'x'.repeat(MAX_SOURCE_CHARACTERS + 1) },
		{ text: 'Policy with a lone surrogate: \ud800' }
	])('rejects invalid source text before a provider call', async (input) => {
		const provider = providerWith({ candidates: [] });
		await expect(runStage1Analysis(input, provider)).rejects.toBeInstanceOf(Stage1Error);
		expect(provider.extract).not.toHaveBeenCalled();
	});

	it('keeps preferences out of extraction and separate in the downstream handoff', async () => {
		let providerInput: unknown;
		const provider: Stage1Provider = {
			extract: vi.fn(async (snapshot) => {
				providerInput = snapshot;
				return {
					output: { candidates: [supportedCandidate()] },
					model: 'mock-model',
					reasoningEffort: 'medium',
					attempts: 1 as const,
					usage: null
				};
			})
		};
		const preferences = { advertising: 'avoid' };
		const result = await runStage1Analysis({ text: policy, preferences }, provider);

		expect(JSON.stringify(providerInput)).not.toContain('advertising":"avoid');
		expect(result.downstream.preferences).toEqual(preferences);
		expect(result.stageStatus).toBe('complete');
		expect(result.analysisStatus).toBe('in_progress');
		expect(result).not.toHaveProperty('score');
		expect(result).not.toHaveProperty('takeaways');
		expect(result.limitations.semanticReviewRequired).toBe(true);
	});

	it('returns a distinct no-candidates stage outcome without claiming safety or completion', async () => {
		const result = await runStage1Analysis({ text: policy }, providerWith({ candidates: [] }));

		expect(result.stageStatus).toBe('no_candidates');
		expect(result.analysisStatus).toBe('in_progress');
		expect(result.candidates).toEqual([]);
		expect(JSON.stringify(result)).not.toMatch(/safe|low.risk/i);
	});

	it('does not hide provider failure as an empty result', async () => {
		const provider: Stage1Provider = {
			extract: vi
				.fn()
				.mockRejectedValue(
					new Stage1Error('provider_timeout', 504, 'The provider timed out.', { retryable: true })
				)
		};

		await expect(runStage1Analysis({ text: policy }, provider)).rejects.toMatchObject({
			code: 'provider_timeout',
			retryable: true
		});
	});
});
