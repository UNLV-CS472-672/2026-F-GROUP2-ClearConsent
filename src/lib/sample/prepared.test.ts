import { describe, expect, it } from 'vitest';
import { AnalysisResultSchema } from '$lib/contracts/analysis';
import { samplePolicy, samplePolicyTitle, samplePreparedResult } from './prepared';

describe('prepared sample', () => {
	it('satisfies the shared result contract', () => {
		const result = AnalysisResultSchema.parse(samplePreparedResult);
		expect(result.status).toBe('success');
	});

	it('cites only wording that appears in the fictional policy', () => {
		const text = samplePolicy.join('\n');
		if (samplePreparedResult.status !== 'success') throw new Error('Expected success');
		for (const finding of samplePreparedResult.findings) {
			for (const evidence of finding.evidence) expect(text).toContain(evidence.excerpt);
		}
	});

	it('is labeled as fictional', () => {
		expect(samplePolicyTitle).toMatch(/fictional/i);
	});
});
