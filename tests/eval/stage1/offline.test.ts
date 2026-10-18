import assert from 'node:assert/strict';
import test from 'node:test';
import {
	MAX_SOURCE_CHARACTERS,
	runStage1Analysis
} from '../../../src/lib/server/analysis/pipeline';
import {
	createMockProvider,
	estimateCaseMaximumUsd,
	loadStage1Cases,
	usageCostUsd
} from './eval-config';
import { createSourceSnapshot } from '../../../src/lib/server/analysis/source';
import { formatReview } from './review';
import { formatReport, reviewCandidates, scoreCase, upgradeRecord } from './score';
import type { Stage1EvalRecord } from './score';

test('loads the 14 labeled short cases and the full Spotify policy within the source limit', async () => {
	const cases = await loadStage1Cases();
	const ids = cases.map((testCase) => testCase.id);

	assert.equal(cases.length, 15);
	assert.equal(new Set(ids).size, ids.length);
	assert.ok(ids.includes('spotify-full-privacy-policy'));
	assert.ok(!ids.includes('facebook-full-privacy-policy'));
	const spotify = cases.find((testCase) => testCase.id === 'spotify-full-privacy-policy')!;
	assert.doesNotMatch(spotify.policyText, /<br|\*\*|\]\(|^\|/m);
	for (const testCase of cases) {
		assert.ok(testCase.policyText.length <= MAX_SOURCE_CHARACTERS, testCase.id);
		for (const finding of testCase.expectedFindings ?? []) {
			assert.ok(
				testCase.policyText.includes(finding.evidence),
				`${testCase.id}: ${finding.summary}`
			);
		}
	}
});

test('estimates a positive per-case ceiling that grows with policy length', async () => {
	const cases = await loadStage1Cases();
	const short = await estimateCaseMaximumUsd(cases[0]);
	const full = await estimateCaseMaximumUsd(cases.find((testCase) => testCase.group === 'full')!);

	assert.ok(short > 0);
	assert.ok(full > short);
	assert.equal(usageCostUsd(null), 0);
});

test('mock provider runs every case through the real pipeline and flags its invented quote', async () => {
	const cases = await loadStage1Cases();
	const provider = createMockProvider(cases);

	for (const testCase of cases) {
		const result = await runStage1Analysis(
			{ text: testCase.policyText, title: testCase.title },
			provider
		);
		assert.equal(result.stageStatus, 'partial', testCase.id);
		assert.equal(result.rejectedCandidates.length, 0, testCase.id);
		const invented = result.candidates.at(-1)!.evidence[0];
		assert.equal(invented.status, 'unverified', testCase.id);
		assert.ok(
			result.candidates.slice(0, -1).every((item) => item.evidence[0].status === 'verified'),
			testCase.id
		);
	}
});

test('scores coverage by overlapping labeled evidence with returned ranges', async () => {
	const [testCase] = await loadStage1Cases();
	const [first, second] = testCase.expectedFindings!;
	const start = testCase.policyText.indexOf(first.evidence);
	const record: Stage1EvalRecord = {
		caseId: testCase.id,
		group: testCase.group,
		mode: 'mock',
		commit: 'test',
		model: 'mock-provider',
		reasoningEffort: 'none',
		timeoutMs: 90_000,
		maxOutputTokens: 16_000,
		startedAt: new Date(0).toISOString(),
		durationMs: 45_000,
		sourceLength: testCase.policyText.length,
		passageCount: 1,
		outcome: 'complete',
		errorCode: null,
		errorMessage: null,
		candidates: [
			{
				id: 'C001',
				category: 'collection',
				practice: 'collection',
				claim: 'Partial quote of the first labeled finding.',
				explanation: 'Overlaps the first label only.',
				qualifiers: [],
				uncertainty: null,
				dataCategories: [],
				purposes: [],
				recipients: [],
				evidence: [
					{
						status: 'verified',
						match: 'exact',
						passageId: 'P001',
						excerpt: first.evidence.slice(0, 20),
						startOffset: start,
						endOffset: start + 20
					}
				]
			}
		],
		rejectedCandidates: [],
		rawOutput: null,
		usage: { inputTokens: 500, outputTokens: 4_000, reasoningTokens: 1_000, totalTokens: 4_500 },
		estimatedCostUsd: 0.002
	};

	const score = scoreCase(record, testCase);
	assert.equal(score.covered, 1);
	assert.equal(score.expected, 2);
	assert.deepEqual(score.missed, [second.summary]);
	assert.equal(score.timeoutShare, 0.5);
	assert.equal(score.outputCapShare, 0.25);
	assert.match(formatReport([score]), /Coverage proxy, synthetic: 1\/2 \(50%\)/);

	const failed = scoreCase(
		{ ...record, outcome: 'failed', errorCode: 'provider_timeout', candidates: [] },
		testCase
	);
	assert.equal(failed.expected, null);
	assert.match(formatReport([failed]), /failed: provider_timeout 1/);
});

test('reads records saved before evidence had a status as exact matches', () => {
	const evidence = {
		passageId: 'P001',
		excerpt: 'We keep it for 30 days.',
		startOffset: 0,
		endOffset: 23
	};
	const old = {
		candidates: [{ id: 'C001', evidence: [evidence] }]
	} as unknown as Stage1EvalRecord;

	assert.deepEqual(upgradeRecord(old).candidates[0].evidence, [
		{ status: 'verified', match: 'exact', ...evidence }
	]);
});

test('review lines up each candidate with its labeled quotes', async () => {
	const cases = await loadStage1Cases();
	const testCase = cases[0];
	const result = await runStage1Analysis(
		{ text: testCase.policyText, title: testCase.title },
		createMockProvider(cases)
	);
	const raw = await createMockProvider(cases).extract(
		await createSourceSnapshot(testCase.policyText, { title: testCase.title })
	);
	const record: Stage1EvalRecord = {
		caseId: testCase.id,
		group: testCase.group,
		mode: 'mock',
		commit: 'test',
		model: 'mock-provider',
		reasoningEffort: 'none',
		timeoutMs: 120_000,
		maxOutputTokens: 16_000,
		startedAt: new Date(0).toISOString(),
		durationMs: 1,
		sourceLength: testCase.policyText.length,
		passageCount: 1,
		outcome: result.stageStatus,
		errorCode: null,
		errorMessage: null,
		candidates: result.candidates,
		rejectedCandidates: result.rejectedCandidates,
		rawOutput: raw.output,
		usage: null,
		estimatedCostUsd: 0
	};

	const reviewed = reviewCandidates(record);
	assert.deepEqual(
		reviewed.map((item) => [item.kept, item.supported, item.id]),
		result.candidates.map((item, index, all) => [true, index < all.length - 1, item.id])
	);
	assert.equal(reviewed.at(-1)!.quotes[0].status, 'unverified');

	const markdown = formatReview([record], cases, ['results/test.jsonl']);
	assert.match(markdown, /### collection-account-and-device-data/);
	assert.match(markdown, /✅ exact/);
	assert.match(markdown, /⚠️ unverified/);
	assert.match(markdown, /has an unverified quote \(hidden from users\)/);
	assert.match(markdown, /- \[ \] The quote supports the claim/);
});
