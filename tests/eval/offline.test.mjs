import assert from 'node:assert/strict';
import test from 'node:test';
import {
	MODELS,
	REASONING_EFFORTS,
	REPEATS,
	buildRequest,
	estimateMaximumCost,
	extractOutputText,
	loadCases,
	validateAnalysis
} from './eval-config.mjs';

test('all fixtures have unique IDs and evidence copied from their input', async () => {
	const cases = await loadCases();
	assert.equal(cases.length, 14);
	assert.equal(cases.filter((testCase) => testCase.source).length, 4);
	assert.equal(cases.filter((testCase) => !testCase.source).length, 10);
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
});
