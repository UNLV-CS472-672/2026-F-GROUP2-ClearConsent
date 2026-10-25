import { describe, expect, it } from 'vitest';
import { AnalysisResultSchema } from '$lib/contracts/analysis';
import {
	samplePolicy,
	studyResult,
	isSamplePolicy,
	isSamplePolicyUrl,
	detailLevel
} from './sample';
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

	it.each(['', '?detail=quick', '?detail=balanced', '?detail=detailed', '?detail=invalid'])(
		'accepts the sample URL with presentation query %s',
		(query) => {
			const sampleUrl = new URL('https://example.test/study-sample');
			expect(isSamplePolicyUrl(`  ${sampleUrl.href}${query}  `, sampleUrl)).toBe(true);
		}
	);

	it.each([
		'https://other.test/study-sample?detail=quick',
		'http://example.test/study-sample?detail=quick',
		'https://example.test/other?detail=quick',
		'https://example.test/study-sample/child?detail=quick',
		'https://example.test/study-sample?detail=quick&policy=other',
		'https://example.test/study-sample#other',
		'https://user:password@example.test/study-sample',
		'/study-sample?detail=quick',
		'not a URL'
	])('rejects a non-sample URL: %s', (value) => {
		expect(isSamplePolicyUrl(value, new URL('https://example.test/study-sample'))).toBe(false);
	});

	it('matches the resolved sample path when deployed under a base path', () => {
		const sampleUrl = new URL('https://example.test/app/study-sample');
		expect(isSamplePolicyUrl(`${sampleUrl.href}?detail=detailed`, sampleUrl)).toBe(true);
		expect(isSamplePolicyUrl('https://example.test/study-sample', sampleUrl)).toBe(false);
	});
});
