import { describe, expect, it } from 'vitest';
import { Stage1Error } from './errors';
import { validateAndResolveCandidates } from './references';
import type {
	ModelCandidate,
	SourceSnapshot,
	ValidatedEvidence,
	VerifiedEvidence
} from './schemas';
import { createSourceSnapshot } from './source';

function verifiedOnly(evidence: ValidatedEvidence[]): VerifiedEvidence[] {
	for (const item of evidence) expect(item.status).toBe('verified');
	return evidence as VerifiedEvidence[];
}

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

		const { candidates: validated, rejectedCandidates } = validateAndResolveCandidates(
			output,
			snapshot
		);
		expect(rejectedCandidates).toEqual([]);
		expect(validated.map((item) => item.id)).toEqual(['C001', 'C002', 'C003']);
		expect(validated[0].qualifiers).toContain('Only when personalized ads are enabled.');
		expect(validated[1].claim).toContain('not sold');
		expect(validated[2].qualifiers).toContain('Legal-obligation records are excepted.');

		for (const item of validated) {
			for (const evidence of verifiedOnly(item.evidence)) {
				expect(evidence.match).toBe('exact');
				expect(text.slice(evidence.startOffset, evidence.endOffset)).toBe(evidence.excerpt);
			}
		}
	});

	const saleDenial = 'We do not sell personal data.';
	const verified = candidate({ evidence: [{ passageId: 'P001', excerpt: saleDenial }] });

	it.each([
		['unknown passage', { passageId: 'P999', excerpt: saleDenial }, /unknown passage P999/],
		[
			'invented excerpt',
			{ passageId: 'P001', excerpt: 'We sell data to anyone who asks.' },
			/not found in or across the edges of P001/
		],
		['blank excerpt', { passageId: 'P001', excerpt: '   ' }, /blank or too short/]
	])(
		'keeps a candidate with %s evidence and labels it unverified',
		async (_name, evidence, reason) => {
			const snapshot = await createSourceSnapshot(saleDenial);
			const { candidates, rejectedCandidates } = validateAndResolveCandidates(
				{ candidates: [candidate({ evidence: [evidence] }), verified] },
				snapshot
			);

			expect(rejectedCandidates).toEqual([]);
			expect(candidates.map((item) => item.id)).toEqual(['C001', 'C002']);
			expect(candidates[0].evidence).toEqual([
				{
					status: 'unverified',
					passageId: evidence.passageId,
					excerpt: evidence.excerpt,
					reason: expect.stringMatching(reason)
				}
			]);
			expect(candidates[1].evidence[0]).toMatchObject({ status: 'verified', excerpt: saleDenial });
		}
	);

	it('does not verify an excerpt that occurs more than once inside its cited passage', async () => {
		const snapshot = await createSourceSnapshot(
			`${saleDenial} ${saleDenial} We delete data on request.`,
			{},
			2_000
		);
		const { candidates } = validateAndResolveCandidates(
			{
				candidates: [
					verified,
					candidate({ evidence: [{ passageId: 'P001', excerpt: 'We delete data on request.' }] })
				]
			},
			snapshot
		);

		expect(candidates[0].evidence[0]).toMatchObject({
			status: 'unverified',
			reason: expect.stringMatching(/more than once/)
		});
		expect(candidates[1].evidence[0].status).toBe('verified');
	});

	it('keeps every excerpt of a partly verified candidate, each with its own label', async () => {
		const text = `${saleDenial} We delete data on request.`;
		const snapshot = await createSourceSnapshot(text);
		const { candidates, rejectedCandidates } = validateAndResolveCandidates(
			{
				candidates: [
					candidate({
						evidence: [
							{ passageId: 'P001', excerpt: saleDenial },
							{ passageId: 'P001', excerpt: 'except where we must keep it.' }
						]
					})
				]
			},
			snapshot
		);

		expect(rejectedCandidates).toEqual([]);
		expect(candidates[0].evidence.map((item) => item.status)).toEqual(['verified', 'unverified']);
		expect(candidates[0].evidence[1].excerpt).toBe('except where we must keep it.');
	});

	it('reports blank provider fields as malformed without failing other candidates', async () => {
		const snapshot = await createSourceSnapshot(saleDenial);
		const { candidates, rejectedCandidates } = validateAndResolveCandidates(
			{ candidates: [verified, candidate({ claim: '  ', evidence: verified.evidence })] },
			snapshot
		);

		expect(candidates).toHaveLength(1);
		expect(rejectedCandidates).toEqual([
			{ index: 1, claim: null, code: 'provider_malformed', reason: expect.any(String) }
		]);
	});

	it('fails the stage when no candidate can be verified', async () => {
		const snapshot = await createSourceSnapshot(saleDenial);
		const invented = candidate({
			evidence: [{ passageId: 'P001', excerpt: 'We sell data to anyone who asks.' }]
		});

		let thrown: unknown;
		try {
			validateAndResolveCandidates({ candidates: [invented, invented] }, snapshot);
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(Stage1Error);
		expect(thrown).toMatchObject({
			code: 'reference_validation_failed',
			message: expect.stringMatching(/None of the 2 provider candidates had an excerpt/)
		});
	});

	it('resolves an exact quote that runs across the boundary into the next passage', async () => {
		const text = `${'Intro text. '.repeat(3)}We share location with partners only if you opt in.`;
		const snapshot = await createSourceSnapshot(text, {}, 40);
		const excerpt = 'We share location with partners only if you opt in.';
		const crossing = snapshot.passages.filter(
			(passage) =>
				passage.startOffset < text.indexOf(excerpt) + excerpt.length &&
				text.indexOf(excerpt) < passage.endOffset
		);
		expect(crossing.length).toBeGreaterThan(1);

		const { candidates, rejectedCandidates } = validateAndResolveCandidates(
			{ candidates: [candidate({ evidence: [{ passageId: crossing[1].id, excerpt }] })] },
			snapshot
		);

		expect(rejectedCandidates).toEqual([]);
		const [evidence] = verifiedOnly(candidates[0].evidence);
		expect(evidence.passageId).toBe(crossing[1].id);
		expect(text.slice(evidence.startOffset, evidence.endOffset)).toBe(excerpt);
	});

	it('does not verify a real quote cited from a passage it does not touch', async () => {
		const text = `Opening clause one. ${'Intro text. '.repeat(6)}We do not sell personal data.`;
		const snapshot = await createSourceSnapshot(text, {}, 30);
		const { candidates } = validateAndResolveCandidates(
			{
				candidates: [
					candidate({ evidence: [{ passageId: 'P001', excerpt: saleDenial }] }),
					candidate({ evidence: [{ passageId: 'P001', excerpt: 'Opening clause one.' }] })
				]
			},
			snapshot
		);

		expect(candidates[0].evidence[0]).toMatchObject({
			status: 'unverified',
			reason: expect.stringMatching(/not found in or across the edges of P001/)
		});
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

		const {
			candidates: [validated]
		} = validateAndResolveCandidates(
			{ candidates: [candidate({ evidence: [{ passageId: 'P002', excerpt }] })] },
			snapshot
		);
		expect(verifiedOnly(validated.evidence)[0].startOffset).toBe(excerpt.length + 1);
	});

	describe('tolerant matching', () => {
		const listPolicy =
			'This may include your:\n\ndisplay name\nemail address\n\nWe keep it for 30 days.\n\nWe do not sell personal data.';

		async function resolveOne(text: string, excerpt: string): Promise<ValidatedEvidence[]> {
			const snapshot = await createSourceSnapshot(text, {}, 2_000);
			const { candidates } = validateAndResolveCandidates(
				{
					candidates: [
						candidate({ evidence: [{ passageId: 'P001', excerpt }] }),
						candidate({ evidence: [{ passageId: 'P001', excerpt: text.slice(0, 22) }] })
					]
				},
				snapshot
			);
			return candidates[0].evidence;
		}

		it('verifies a quote whose line breaks became spaces, using the source text', async () => {
			const [evidence] = verifiedOnly(
				await resolveOne(listPolicy, 'This may include your: display name email address')
			);

			expect(evidence.match).toBe('normalized');
			expect(evidence.excerpt).toBe('This may include your:\n\ndisplay name\nemail address');
			expect(listPolicy.slice(evidence.startOffset, evidence.endOffset)).toBe(evidence.excerpt);
		});

		it('treats curly and straight quote marks, dashes, and the ellipsis character as equal', async () => {
			const text =
				'Open the \u2018Privacy\u2019 tab \u2014 then choose \u201COff\u201D\u2026 to stop it.';
			const [evidence] = verifiedOnly(
				await resolveOne(text, `Open the 'Privacy' tab - then choose "Off"... to stop it.`)
			);

			expect(evidence.match).toBe('normalized');
			expect(evidence.excerpt).toBe(text);
		});

		it.each([
			['a dropped negation', 'We do sell personal data.'],
			['a changed number', 'We keep it for 90 days.'],
			['a changed word', 'This may include our: display name']
		])('does not verify a quote with %s', async (_name, excerpt) => {
			const [evidence] = await resolveOne(listPolicy, excerpt);
			expect(evidence.status).toBe('unverified');
		});

		it('splits a quote joined with "..." into verified pieces when each is in order', async () => {
			const evidence = verifiedOnly(
				await resolveOne(listPolicy, 'This may include your: ... We keep it for 30 days.')
			);

			expect(evidence.map((item) => [item.match, item.excerpt])).toEqual([
				['ellipsis', 'This may include your:'],
				['ellipsis', 'We keep it for 30 days.']
			]);
		});

		it.each([
			['out of order', 'We keep it for 30 days. ... This may include your:'],
			['with an invented piece', 'This may include your: ... We sell it to data brokers.'],
			['with a piece too short to place', 'This may include your: ... display']
		])('does not verify a "..." quote %s', async (_name, excerpt) => {
			const evidence = await resolveOne(listPolicy, excerpt);
			expect(evidence).toEqual([
				expect.objectContaining({ status: 'unverified', excerpt, reason: expect.any(String) })
			]);
		});
	});

	it('rejects malformed provider response shapes', async () => {
		const snapshot = await createSourceSnapshot('We do not sell personal data.');
		expect(() => validateAndResolveCandidates({ candidates: [{ claim: 42 }] }, snapshot)).toThrow(
			/provider response did not match/
		);
	});
});
