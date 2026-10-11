import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSectionRequest } from './scripts/sectioned-full-config.mjs';
import { validateGroundedAnalysis } from './scripts/grounded-full-config.mjs';
import { summarizeCosts } from './scripts/cost-summary.mjs';
// All controls are synthetic and offline: no API client or paid model calls.
test('section claims and qualifications can cite only supplied lines', () => {
	const policyText =
		'Outside claim\nBefore condition\nCore practice\nAfter condition\nOutside exception';
	// Indices are zero-based and end-exclusive; citation IDs are one-based.
	// Supply the core claim and adjacent context, excluding the outer two source lines.
	const { lineMap } = buildSectionRequest(
		{ policyText, source: { service: 'Synthetic' } },
		{ coreStart: 2, coreEnd: 3, contextStart: 1, contextEnd: 4, sectionTitle: 'Synthetic' }
	);
	assert.deepEqual([...lineMap.keys()], ['L0002', 'L0003', 'L0004']);
	// Supplied context can qualify the core claim, so both neighboring lines are valid.
	const finding = {
		practice: 'collection',
		summary: 'Claim',
		dataCategories: [],
		purposes: [],
		recipients: [],
		ambiguous: false,
		negated: false,
		sourceLineIds: ['L0003'],
		qualifications: [{ summary: 'Condition', sourceLineIds: ['L0002', 'L0004'] }]
	};
	assert.deepEqual(
		validateGroundedAnalysis({ summary: 'Result', findings: [finding] }, lineMap).referenceIssues,
		[]
	);
	// Reject a real source line omitted from this section and a nonexistent line.
	for (const sourceLineIds of [['L0001'], ['L9999']])
		assert.equal(
			validateGroundedAnalysis(
				{ summary: 'Result', findings: [{ ...finding, sourceLineIds }] },
				lineMap
			).referenceIssues.length,
			1
		);
	// Qualification citations obey the same supplied-line boundary as the main finding.
	const invalid = {
		...finding,
		qualifications: [{ summary: 'Exception', sourceLineIds: ['L0005'] }]
	};
	assert.match(
		validateGroundedAnalysis({ summary: 'Result', findings: [invalid] }, lineMap)
			.referenceIssues[0],
		/qualification/
	);
});
// Billed usage includes incomplete attempts while completion counts remain separate.
test('cost totals include incomplete billed attempts without reporting success', () => {
	assert.deepEqual(
		summarizeCosts([
			// Metadata is not an attempted response and contributes no billed cost.
			{ type: 'metadata', costUsd: 50 },
			{ type: 'result', responseStatus: 'completed', costUsd: 0.02 },
			{ type: 'result', responseStatus: 'incomplete', costUsd: 0.03 },
			// Missing usage stays explicitly unknown rather than being reported as free.
			{ type: 'result', responseStatus: 'incomplete', costUsd: null }
		]),
		{ attemptedResponses: 3, completedResponses: 1, unknownCostResponses: 1, costUsd: 0.05 }
	);
	// Empty input is the zero-attempt control.
	assert.deepEqual(summarizeCosts([]), {
		attemptedResponses: 0,
		completedResponses: 0,
		unknownCostResponses: 0,
		costUsd: 0
	});
});
