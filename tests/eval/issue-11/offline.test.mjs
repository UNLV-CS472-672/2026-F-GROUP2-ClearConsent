import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
	MODELS,
	REASONING_EFFORTS,
	REPEATS,
	actualCostUsd,
	buildRequest,
	estimateMaximumCost,
	extractOutputText,
	loadCases,
	validateAnalysis
} from './scripts/eval-config.mjs';
import {
	buildGroundedRequest,
	numberPolicyLines,
	validateGroundedAnalysis
} from './scripts/grounded-full-config.mjs';
import { buildSectionRequest, splitPolicyIntoSections } from './scripts/sectioned-full-config.mjs';
import {
	DIRECT_LABELS,
	buildDirectLabeledRequest,
	loadSpotifyDirectInput,
	validateDirectLabeledReadout
} from './scripts/direct-labeled-config.mjs';
import {
	LABELS,
	buildLabeledReadoutRequest,
	loadSpotifyReadoutInput,
	validateLabeledReadout
} from './scripts/labeled-readout-config.mjs';

test('direct labeled request uses only the full policy and preserves reason-before-label order', async () => {
	const input = await loadSpotifyDirectInput();
	const request = buildDirectLabeledRequest(input);
	const terraRequest = buildDirectLabeledRequest(input, 'gpt-5.6-terra');
	const itemSchema = request.text.format.schema.properties.takeaways.items;
	assert.equal(request.model, 'gpt-6-luna');
	assert.equal(terraRequest.model, 'gpt-5.6-terra');
	assert.deepEqual(
		{ ...terraRequest, model: request.model },
		request,
		'Terra must receive the exact Luna request apart from the model ID'
	);
	assert.equal(request.reasoning.effort, 'medium');
	assert.deepEqual(Object.keys(itemSchema.properties), [
		'reason',
		'label',
		'topic',
		'sourceLineIds'
	]);
	assert.deepEqual(itemSchema.properties.label.enum, DIRECT_LABELS);
	assert.ok(request.input[1].content.includes('Full archived Spotify Privacy Policy:'));
	assert.ok(request.input[1].content.includes('L0146 '));
	assert.ok(!request.input[1].content.includes('Saved Spotify findings'));
	assert.ok(!JSON.stringify(request).includes('sourceFindingIds'));
	const valid = validateDirectLabeledReadout(
		{
			takeaways: [
				{
					reason: 'A grounded, concise reason.',
					label: 'worth_knowing',
					topic: 'Example',
					sourceLineIds: ['L0146']
				}
			]
		},
		input.lineMap
	);
	assert.deepEqual(valid, { schemaIssues: [], referenceIssues: [] });
	const invalid = validateDirectLabeledReadout(
		{
			takeaways: [
				{
					label: 'not_a_label',
					reason: 'Misordered fields',
					topic: 'Example',
					sourceLineIds: ['L9999']
				}
			]
		},
		input.lineMap
	);
	assert.ok(invalid.schemaIssues.some((issue) => issue.includes('out of order')));
	assert.ok(invalid.schemaIssues.some((issue) => issue.includes('invalid label')));
	assert.equal(invalid.referenceIssues.length, 1);
});

test('labeled readout uses 73 saved Spotify findings and reason-before-label schema', async () => {
	const input = await loadSpotifyReadoutInput();
	const request = buildLabeledReadoutRequest(input);
	const itemSchema = request.text.format.schema.properties.takeaways.items;
	assert.equal(input.findings.length, 73);
	assert.equal(request.model, 'gpt-6-luna');
	assert.equal(request.reasoning.effort, 'medium');
	assert.deepEqual(Object.keys(itemSchema.properties), [
		'reason',
		'label',
		'topic',
		'sourceLineIds',
		'sourceFindingIds'
	]);
	assert.deepEqual(itemSchema.properties.label.enum, LABELS);
	assert.ok(request.input[1].content.includes('S1F1'));
	assert.ok(request.input[1].content.includes('Original numbered policy'));
	const valid = validateLabeledReadout(
		{
			takeaways: [
				{
					reason: 'A grounded, concise reason.',
					label: 'worth_knowing',
					topic: 'Example',
					sourceLineIds: [input.findings[0].sourceLineIds[0]],
					sourceFindingIds: ['S1F1']
				}
			]
		},
		input.lineMap,
		new Set(input.findings.map((finding) => finding.id))
	);
	assert.deepEqual(valid, { schemaIssues: [], referenceIssues: [] });
	const invalid = validateLabeledReadout(
		{
			takeaways: [
				{
					label: 'not_a_label',
					reason: 'Misordered fields',
					topic: 'Example',
					sourceLineIds: ['L9999'],
					sourceFindingIds: ['S9F9']
				}
			]
		},
		input.lineMap,
		new Set(input.findings.map((finding) => finding.id))
	);
	assert.ok(invalid.schemaIssues.some((issue) => issue.includes('out of order')));
	assert.ok(invalid.schemaIssues.some((issue) => issue.includes('invalid label')));
	assert.equal(invalid.referenceIssues.length, 2);
});

test('all fixtures have unique IDs and evidence copied from their input', async () => {
	const cases = await loadCases();
	assert.equal(cases.length, 14);
	assert.equal(cases.filter((testCase) => testCase.source).length, 4);
	assert.equal(cases.filter((testCase) => !testCase.source).length, 10);
});

test('cost accounting includes cache writes and cached reads', () => {
	assert.equal(
		actualCostUsd(MODELS[0], {
			input_tokens: 1000,
			input_tokens_details: { cached_tokens: 100, cache_write_tokens: 200 },
			output_tokens: 1000
		}),
		0.000596
	);
	assert.equal(
		actualCostUsd(MODELS[0], {
			input_tokens: 300_000,
			input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
			output_tokens: 1000
		}),
		0.06075
	);
});

test('full policies are whole pinned archive blobs and include the short excerpts', async () => {
	const fixture = JSON.parse(
		await readFile(new URL('./fixtures/full-policy-cases.json', import.meta.url), 'utf8')
	);
	const shortCases = (await loadCases()).filter((testCase) =>
		['Facebook', 'Spotify'].includes(testCase.source?.service)
	);
	assert.equal(fixture.reviewStatus, 'unlabeled-needs-human-review');
	assert.equal(fixture.cases.length, 2);
	for (const testCase of fixture.cases) {
		const bytes = Buffer.from(testCase.policyText, 'utf8');
		const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
		assert.equal(sha, testCase.source.archiveBlobSha);
		assert.ok(bytes.length > 40_000);
		assert.ok(testCase.source.archiveUrl.includes(testCase.source.archiveCommit));
		for (const excerpt of shortCases.filter(
			(shortCase) => shortCase.source.service === testCase.source.service
		)) {
			assert.equal(excerpt.source.archiveCommit, testCase.source.archiveCommit);
			assert.ok(testCase.policyText.includes(excerpt.policyText));
		}
	}
});

test('all configurations share the same prompt, schema, and token limit', async () => {
	const [testCase] = await loadCases();
	const requests = MODELS.flatMap((model) =>
		REASONING_EFFORTS.map((effort) => buildRequest(testCase, model.id, effort))
	);
	for (const request of requests.slice(1)) {
		assert.deepEqual(request.input, requests[0].input);
		assert.deepEqual(request.text, requests[0].text);
		assert.equal(request.max_output_tokens, requests[0].max_output_tokens);
	}
	assert.equal(
		estimateMaximumCost(await loadCases()).calls,
		14 * MODELS.length * REASONING_EFFORTS.length * REPEATS
	);
});

test('Luna medium single-pass selection is exactly 14 short-case calls', async () => {
	const cases = await loadCases();
	const estimate = estimateMaximumCost(cases, {
		models: [MODELS[0]],
		reasoningEfforts: ['medium'],
		repeats: 1
	});
	assert.equal(estimate.cases, 14);
	assert.equal(estimate.calls, 14);
	assert.deepEqual(
		estimate.perModel.map((model) => model.model),
		['gpt-6-luna']
	);
	assert.ok(estimate.maximumUsd < 0.1);
});

test('response extraction, schema checks, and exact evidence checks work offline', () => {
	const text = '{"summary":"One finding","findings":[]}';
	assert.equal(
		extractOutputText({ output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }),
		text
	);
	assert.deepEqual(validateAnalysis(JSON.parse(text), 'source'), {
		schemaIssues: [],
		evidenceIssues: []
	});
	const finding = {
		practice: 'collection',
		dataCategories: [],
		purposes: [],
		recipients: [],
		summary: 'Claim',
		evidence: 'not in input',
		ambiguous: false,
		negated: false
	};
	const checked = validateAnalysis({ summary: 'Claim', findings: [finding] }, 'source');
	assert.equal(checked.schemaIssues.length, 0);
	assert.equal(checked.evidenceIssues.length, 1);
	for (const evidence of ['“source”', 'one ... two']) {
		const policyText = evidence === '“source”' ? 'source' : 'one and two';
		const check = validateAnalysis(
			{ summary: 'Claim', findings: [{ ...finding, evidence }] },
			policyText
		);
		assert.equal(check.evidenceIssues.length, 1);
	}
});

test('grounded extraction copies cited raw Markdown lines and keeps qualifications separate', () => {
	const policyText =
		'# Retention\n\nWe delete [search data](https://example.com) after 90 days.\nSubject to other retention rules.';
	const { numberedText, lineMap } = numberPolicyLines(policyText);
	assert.ok(numberedText.includes('L0003 We delete [search data](https://example.com)'));
	assert.equal(lineMap.get('L0004'), 'Subject to other retention rules.');
	const request = buildGroundedRequest({ policyText }, 11_000).request;
	assert.equal(request.reasoning.effort, 'medium');
	assert.equal(request.max_output_tokens, 11_000);
	const finding = {
		practice: 'data_retention',
		dataCategories: ['search_data'],
		purposes: [],
		recipients: [],
		summary: 'Search data is deleted after 90 days, subject to other rules.',
		sourceLineIds: ['L0003'],
		qualifications: [{ summary: 'Other retention rules may apply.', sourceLineIds: ['L0004'] }],
		ambiguous: false,
		negated: false
	};
	const valid = validateGroundedAnalysis({ summary: 'Retention', findings: [finding] }, lineMap);
	assert.deepEqual(valid.schemaIssues, []);
	assert.deepEqual(valid.referenceIssues, []);
	assert.deepEqual(valid.groundedFindings[0].evidenceLines, [
		{ lineId: 'L0003', text: 'We delete [search data](https://example.com) after 90 days.' }
	]);
	assert.equal(
		valid.groundedFindings[0].qualifications[0].evidenceLines[0].text,
		'Subject to other retention rules.'
	);
	const invalid = validateGroundedAnalysis(
		{ summary: 'Retention', findings: [{ ...finding, sourceLineIds: ['L9999'] }] },
		lineMap
	);
	assert.deepEqual(invalid.referenceIssues, ['Finding 0: unknown line ID L9999']);
});

test('sectioned requests partition each full policy without losing source lines', async () => {
	const fixture = JSON.parse(
		await readFile(new URL('./fixtures/full-policy-cases.json', import.meta.url), 'utf8')
	);
	for (const testCase of fixture.cases) {
		const sections = splitPolicyIntoSections(testCase);
		const lines = testCase.policyText.split('\n');
		assert.equal(sections[0].coreStart, 0);
		assert.equal(sections.at(-1).coreEnd, lines.length);
		for (let index = 0; index < sections.length; index++) {
			const section = sections[index];
			if (index) assert.equal(section.coreStart, sections[index - 1].coreEnd);
			assert.ok(section.coreEnd > section.coreStart);
			const { request, lineMap } = buildSectionRequest(testCase, section);
			assert.equal(request.reasoning.effort, 'medium');
			assert.equal(request.model, 'gpt-6-luna');
			assert.equal(lineMap.size, lines.filter((line) => line.trim()).length);
			assert.ok(request.input[1].content.includes('CORE:'));
		}
	}
});

test('review checklist anchors resolve to the pinned source but are not in model instructions', async () => {
	const fixture = JSON.parse(
		await readFile(new URL('./fixtures/full-policy-cases.json', import.meta.url), 'utf8')
	);
	const checklist = JSON.parse(
		await readFile(new URL('./fixtures/full-policy-review-checklist.json', import.meta.url), 'utf8')
	);
	for (const claim of checklist.claims) {
		const testCase = fixture.cases.find((item) => item.id === claim.caseId);
		assert.ok(testCase);
		const { lineMap } = numberPolicyLines(testCase.policyText);
		for (const id of claim.anchorLineIds) assert.ok(lineMap.has(id));
		const section = splitPolicyIntoSections(testCase).find((item) =>
			claim.anchorLineIds.some(
				(id) => Number(id.slice(1)) > item.coreStart && Number(id.slice(1)) <= item.coreEnd
			)
		);
		assert.ok(section);
		const { request } = buildSectionRequest(testCase, section);
		assert.ok(!request.input[0].content.includes(claim.description));
	}
});
