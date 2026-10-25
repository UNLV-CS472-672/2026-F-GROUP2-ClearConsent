import { describe, expect, it } from 'vitest';
import { AnalysisResultSchema } from '$lib/contracts/analysis';
import { samplePolicy, studyResult, isSamplePolicy, detailLevel } from './sample';
describe('fixed study example', () => {
	it('satisfies the result contract and cites only text in the sample', () => {
		const result = AnalysisResultSchema.parse(studyResult);
		expect(result.status).toBe('success');
		if (result.status !== 'success') throw new Error('Expected success');
		for (const finding of result.findings)
			for (const evidence of finding.evidence) {
				expect(samplePolicy).toContain(evidence.excerpt);
			}
	});
	it('accepts whitespace changes but rejects unrelated or edited submissions', () => {
		expect(isSamplePolicy('  ' + samplePolicy.replaceAll('\n', '  ') + '  ')).toBe(true);
		expect(isSamplePolicy('Unrelated policy')).toBe(false);
		expect(isSamplePolicy(samplePolicy + ' Additional terms.')).toBe(false);
	});
	it('defaults invalid detail levels to balanced', () => {
		expect(detailLevel(null)).toBe('balanced');
		expect(detailLevel('invalid')).toBe('balanced');
		expect(detailLevel('quick')).toBe('quick');
		expect(detailLevel('detailed')).toBe('detailed');
	});
});
