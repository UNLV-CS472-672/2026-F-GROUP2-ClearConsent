import { readFile } from 'node:fs/promises';

const resultsPaths = process.argv.slice(2);
if (!resultsPaths.length) throw new Error('Pass the local sectioned results JSONL paths');
const fixture = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-cases.json', import.meta.url), 'utf8')
);
const checklist = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-review-checklist.json', import.meta.url), 'utf8')
);
const baselinePath = new URL(
	'../results/grounded-full-run-2026-09-24T03-10-14.345Z-2aac25582046.jsonl',
	import.meta.url
);
const parseJsonl = async (path) =>
	(await readFile(path, 'utf8'))
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
const logs = await Promise.all(resultsPaths.map(parseJsonl));
const records = logs.flat();
const baseline = await parseJsonl(baselinePath);
const results = records.filter(
	(record) => record.type === 'result' && record.responseStatus === 'completed'
);
const baselineResults = baseline.filter((record) => record.type === 'result');

function anchorHits(records) {
	return checklist.claims.map((claim) => {
		const findings = records
			.filter((record) => record.caseId === claim.caseId)
			.flatMap((record) => record.analysis?.findings ?? []);
		const matching = findings.filter((finding) => {
			const ids = [
				...finding.sourceLineIds,
				...finding.qualifications.flatMap((qualification) => qualification.sourceLineIds)
			];
			return claim.anchorLineIds.some((id) => ids.includes(id));
		});
		return {
			id: claim.id,
			cited: matching.length > 0,
			matchingPractices: matching.map((finding) => finding.practice)
		};
	});
}

const perPolicy = fixture.cases.map((testCase) => {
	const calls = results.filter((record) => record.caseId === testCase.id);
	const findings = calls.flatMap((record) => record.analysis?.findings ?? []);
	const exactKeys = findings.map((finding) =>
		JSON.stringify([finding.practice, [...finding.sourceLineIds].sort()])
	);
	return {
		caseId: testCase.id,
		calls: calls.length,
		complete: calls.filter((record) => record.responseStatus === 'completed').length,
		findings: findings.length,
		exactDuplicatePracticeAndCitation: exactKeys.length - new Set(exactKeys).size,
		schemaIssues: calls.flatMap((record) => record.schemaIssues),
		referenceIssues: calls.flatMap((record) => record.referenceIssues),
		costUsd: calls.reduce((sum, record) => sum + (record.costUsd ?? 0), 0)
	};
});

console.log(
	JSON.stringify(
		{
			metadata: logs.map((log) => log[0]),
			perPolicy,
			baselineAnchorHits: anchorHits(baselineResults),
			sectionedAnchorHits: anchorHits(results),
			totalCostUsd: perPolicy.reduce((sum, item) => sum + item.costUsd, 0)
		},
		null,
		2
	)
);
