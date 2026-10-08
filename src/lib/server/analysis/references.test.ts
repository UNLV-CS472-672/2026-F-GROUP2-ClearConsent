import { describe, expect, it } from 'vitest';
import { Stage1Error } from './errors';
import { validateAndResolveCandidates } from './references';
import type { ModelCandidate, SourceSnapshot } from './schemas';
import { createSourceSnapshot } from './source';

function candidate(overrides: Partial<ModelCandidate> = {}): ModelCandidate {
	return {
		category: 'third_party_sharing',
		practice: 'conditional advertising disclosure',
		claim: 'Approximate location is shared only when personalized ads are enabled.',
		explanation: 'The clause makes the disclosure conditional on a user setting.',
		qualifiers: ['Only when personalized ads are enabled.'],
		uncertainty: null,
		dataCategories: ['approximate location'],
		purposes: [],
		recipients: ['advertising partners'],
		evidence: [
			{
				passageId: 'P001',
				excerpt:
					'We share approximate location with advertising partners only if personalized ads are enabled.'
			}
		],
		...overrides
	};
}

describe('candidate reference validation', () => {
	it('reconstructs exact evidence while retaining conditions, denials, and deletion exceptions', async () => {
		const text = [
			'We share approximate location with advertising partners only if personalized ads are enabled.',
			'We do not sell personal data.',
			'We delete account data within 30 days of a verified request, except records kept for legal obligations.'
		].join(' ');
		const snapshot = await createSourceSnapshot(text, {}, 2_000);
		const output = {
			candidates: [
				candidate(),
				candidate({
					category: 'sale',
					practice: 'explicit denial',
					claim: 'The policy states that personal data is not sold.',
					explanation: 'This is an explicit no-sale statement, not a no-sharing statement.',
					qualifiers: ['The denial concerns sale only.'],
					dataCategories: ['personal data'],
					recipients: [],
					evidence: [{ passageId: 'P001', excerpt: 'We do not sell personal data.' }]
				}),
				candidate({
					category: 'deletion',
					practice: 'account deletion',
					claim: 'Account data is deleted within 30 days, with a legal-record exception.',
					explanation:
						'The deadline depends on verification and excludes legally retained records.',
					qualifiers: ['Verified request required.', 'Legal-obligation records are excepted.'],
					dataCategories: ['account data'],
					recipients: [],
					evidence: [
						{
							passageId: 'P001',
							excerpt:
								'We delete account data within 30 days of a verified request, except records kept for legal obligations.'
						}
					]
				})
			]
		};

		const validated = validateAndResolveCandidates(output, snapshot);
		expect(validated.map((item) => item.id)).toEqual(['C001', 'C002', 'C003']);
		expect(validated[0].qualifiers).toContain('Only when personalized ads are enabled.');
		expect(validated[1].claim).toContain('not sold');
		expect(validated[2].qualifiers).toContain('Legal-obligation records are excepted.');

		for (const item of validated) {
			for (const evidence of item.evidence) {
				expect(text.slice(evidence.startOffset, evidence.endOffset)).toBe(evidence.excerpt);
			}
		}
	});

	it.each([
		['unknown passage', { passageId: 'P999', excerpt: 'We do not sell personal data.' }],
		['invented excerpt', { passageId: 'P001', excerpt: 'We sell data to anyone who asks.' }],
		['blank excerpt', { passageId: 'P001', excerpt: '   ' }]
	])('rejects %s evidence', async (_name, evidence) => {
		const snapshot = await createSourceSnapshot('We do not sell personal data.');
		expect(() =>
			validateAndResolveCandidates({ candidates: [candidate({ evidence: [evidence] })] }, snapshot)
		).toThrowError(Stage1Error);
	});

	it('rejects an excerpt that occurs more than once inside its cited passage', async () => {
		const excerpt = 'We do not sell personal data.';
		const snapshot = await createSourceSnapshot(`${excerpt} ${excerpt}`, {}, 2_000);
		expect(() =>
			validateAndResolveCandidates(
				{ candidates: [candidate({ evidence: [{ passageId: 'P001', excerpt }] })] },
				snapshot
			)
		).toThrow(/more than once/);
	});

	it('uses the cited passage to resolve text repeated across different passages', () => {
		const excerpt = 'We do not sell personal data.';
		const separator = '\n';
		const snapshot: SourceSnapshot = {
			id: 'S-repeat',
			identity: 'sha256-utf8',
			offsetConvention: 'utf16-start-inclusive-end-exclusive',
			textLength: excerpt.length * 2 + separator.length,
			title: null,
			url: null,
			passages: [
				{
					id: 'P001',
					startOffset: 0,
					endOffset: excerpt.length + 1,
					text: `${excerpt}${separator}`
				},
				{
					id: 'P002',
					startOffset: excerpt.length + 1,
					endOffset: excerpt.length * 2 + 1,
					text: excerpt
				}
			]
		};

		const [validated] = validateAndResolveCandidates(
			{ candidates: [candidate({ evidence: [{ passageId: 'P002', excerpt }] })] },
			snapshot
		);
		expect(validated.evidence[0].startOffset).toBe(excerpt.length + 1);
	});

	it('rejects malformed provider response shapes', async () => {
		const snapshot = await createSourceSnapshot('We do not sell personal data.');
		expect(() => validateAndResolveCandidates({ candidates: [{ claim: 42 }] }, snapshot)).toThrow(
			/provider response did not match/
		);
	});
});
