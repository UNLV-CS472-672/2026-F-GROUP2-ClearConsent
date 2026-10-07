import { readFile, writeFile } from 'node:fs/promises';
import { GROUNDED_SCHEMA, numberPolicyLines } from './grounded-full-config.mjs';
import { SECTION_INSTRUCTIONS } from './sectioned-full-config.mjs';

const resultsPaths = process.argv.slice(2);
if (!resultsPaths.length) throw new Error('Pass the local sectioned results JSONL paths');
const outputUrl = new URL('../reports/LUNA_SECTIONED_FULL_RUN_2026-09-24.md', import.meta.url);
const fixture = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-cases.json', import.meta.url), 'utf8')
);
const checklist = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-review-checklist.json', import.meta.url), 'utf8')
);
const baselineUrl = new URL(
	'../results/grounded-full-run-2026-09-24T03-10-14.345Z-2aac25582046.jsonl',
	import.meta.url
);
const firstStoppedAttemptUrl = new URL(
	'../results/sectioned-full-run-2026-09-24T03-32-49.884Z-ff35ffa8713c.jsonl',
	import.meta.url
);
const parseJsonl = async (path) =>
	(await readFile(path, 'utf8'))
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
const logs = await Promise.all(resultsPaths.map(parseJsonl));
const records = logs.flat();
const baseline = await parseJsonl(baselineUrl);
const firstStoppedAttempt = await parseJsonl(firstStoppedAttemptUrl);
const results = records.filter(
	(record) => record.type === 'result' && record.responseStatus === 'completed'
);
if (logs.some((log) => log[0]?.type !== 'metadata' || log[0].dataset !== 'sectioned-full')) {
	throw new Error('Not a sectioned-full result log');
}
if (
	results.length !== 15 ||
	new Set(results.map((result) => `${result.caseId}:${result.sectionIndex}`)).size !== 15
) {
	throw new Error('Expected 15 distinct completed section responses');
}
results.sort(
	(left, right) => left.caseId.localeCompare(right.caseId) || left.sectionIndex - right.sectionIndex
);
const fence = (language, content) => {
	if (content.includes('~~~~')) throw new Error('Report fence delimiter appears in source');
	return `~~~~${language}\n${content}\n~~~~`;
};
const findingsFor = (records, caseId) =>
	records
		.filter((record) => record.type === 'result' && record.caseId === caseId)
		.flatMap((record) => record.analysis?.findings ?? []);
const anchored = (findings, ids) =>
	findings.filter((finding) => {
		const cited = [
			...finding.sourceLineIds,
			...finding.qualifications.flatMap((qualification) => qualification.sourceLineIds)
		];
		return ids.some((id) => cited.includes(id));
	});
const stats = fixture.cases.map((testCase) => {
	const policyResults = results.filter((result) => result.caseId === testCase.id);
	return {
		caseId: testCase.id,
		calls: policyResults.length,
		findings: findingsFor(results, testCase.id).length,
		costUsd: policyResults.reduce((sum, result) => sum + result.costUsd, 0),
		schemaIssues: policyResults.flatMap((result) => result.schemaIssues),
		referenceIssues: policyResults.flatMap((result) => result.referenceIssues)
	};
});
const totalCostUsd = stats.reduce((sum, item) => sum + item.costUsd, 0);
const stoppedCostUsd = [...firstStoppedAttempt, ...records]
	.filter((record) => record.type === 'result' && record.responseStatus !== 'completed')
	.reduce((sum, record) => sum + (record.costUsd ?? 0), 0);
const firstStoppedCompletedCostUsd = firstStoppedAttempt
	.filter((record) => record.type === 'result' && record.responseStatus === 'completed')
	.reduce((sum, record) => sum + (record.costUsd ?? 0), 0);
const allAttemptsCostUsd = totalCostUsd + stoppedCostUsd + firstStoppedCompletedCostUsd;
const baselineCitedCount = checklist.claims.filter(
	(claim) => anchored(findingsFor(baseline.slice(1), claim.caseId), claim.anchorLineIds).length
).length;
const sectionedCitedCount = checklist.claims.filter(
	(claim) => anchored(findingsFor(results, claim.caseId), claim.anchorLineIds).length
).length;
const checklistRows = checklist.claims.map((claim) => {
	const oldHits = anchored(findingsFor(baseline.slice(1), claim.caseId), claim.anchorLineIds);
	const newHits = anchored(findingsFor(results, claim.caseId), claim.anchorLineIds);
	return `| ${claim.description} | ${claim.anchorLineIds.join(', ')} | ${oldHits.length ? 'cited' : 'not cited'} | ${newHits.length ? 'cited' : 'not cited'} |`;
});
const lines = [
	'# GPT-6 Luna: bounded-section full-policy test',
	'',
	`**Bottom line:** Bounded slices cited **${sectionedCitedCount}/${checklist.claims.length} selected claim anchors**, versus **${baselineCitedCount}/${checklist.claims.length}** in the earlier one-call-per-policy grounded run. The previously missed Facebook no-sale statement and four privacy-rights claims now appear with their key conditions. This is evidence of improvement on those selected omissions, **not** a measured overall recall gain. The new output is much larger (${stats.reduce((sum, item) => sum + item.findings, 0)} findings versus 75 before) and still has one invalid citation.`,
	'',
	'This was not an isolated A/B test of chunking: the section-oriented instruction also explicitly mentioned negative claims and individual rights, and the total output budget increased. We cannot attribute the selected-claim gain to any one change.',
	'',
	'The invalid citation is `L0895` in a Facebook qualification about reporting posts and managing tags. That line is blank, so code could not copy it. The same qualification refers to control links on nearby lines that it did not cite precisely. This is a real evidence error, not a formatting-only issue. The six checklist examples were spot-checked for their stated core claim and conditions; the remaining findings have **not** received claim-by-claim human review.',
	'',
	'## Run setup and cost',
	'',
	'One `gpt-6-luna` medium-reasoning pass over the same pinned, complete Spotify and Facebook archived Markdown policies. The code partitioned each policy into non-overlapping core line ranges of at most 25,000 source bytes, usually ending at a heading or paragraph break, with three neighboring lines on each side as qualification context. The successful Spotify calls had an 8,000-token output cap; successful Facebook calls had a 6,400-token cap. The model saw only a bounded slice per call, not the withheld checklist. It cited original policy line IDs; code copied the exact raw lines. There was no merge-model call or automatic retry.',
	'',
	`The result combines **${results.length} successful calls** from two local logs after smaller output caps caused incomplete responses. Estimated token cost for the successful calls was **$${totalCostUsd.toFixed(5)}**; including all stopped attempts, **$${allAttemptsCostUsd.toFixed(5)}** in reported token usage (not an invoice). The revised Facebook-only dry run had a conservative **$${logs[1][0].estimate.maximumUsd.toFixed(5)}** ceiling, and the combined conservative allowance for this experiment remained below $0.10. Pricing uses the [official GPT-6 Luna rates](https://developers.openai.com/api/docs/models/gpt-6-luna).`,
	'',
	`The all-attempt figure consists of $${firstStoppedCompletedCostUsd.toFixed(5)} from the first stopped attempt's one complete response, $${stoppedCostUsd.toFixed(5)} from three incomplete responses across both stopped attempts, and $${totalCostUsd.toFixed(5)} from the 15 successful final responses. The DNS-failed request never reached the provider and has no reported usage.`,
	'',
	'| Policy | Calls | Findings | Estimated token cost | Schema issues | Reference issues |',
	'| --- | ---: | ---: | ---: | ---: | ---: |',
	...stats.map(
		(item) =>
			`| ${item.caseId} | ${item.calls} | ${item.findings} | $${item.costUsd.toFixed(5)} | ${item.schemaIssues.length} | ${item.referenceIssues.length} |`
	),
	'',
	'## Known-claim coverage check',
	'',
	'This is a **small manually selected anchor checklist**, not comprehensive gold labels. “Cited” means at least one finding or qualification referenced the listed source line; it does not prove the claim was interpreted correctly. The checklist was not sent to Luna. The prior comparison is the one-call-per-policy grounded run.',
	'',
	'| Claim | Source anchor | Prior grounded run | Bounded-section run |',
	'| --- | --- | --- | --- |',
	...checklistRows,
	'',
	'Finding count and anchor citations do not establish precision, recall, or a model ranking. A person still needs to review whether the claims, conditions, and selected evidence match the source. This run tests the bounded-slice workflow, not Terra or a reasoning-effort increase.',
	'',
	'## Exact inputs and outputs',
	'',
	'The full original inputs are in [full-policy-cases.json](../fixtures/full-policy-cases.json); their source URLs and pinned commits are in each case. The user message for each call was assembled deterministically from its reported core and context ranges, with `L####` prefixes on nonblank lines. This avoids duplicating approximately 337 KB of policy text here. The shared system instruction and JSON schema are below, followed by the actual parsed Luna output for every call. Whitespace in output JSON is reformatting of the saved response; field names and values are unchanged. The raw JSONL remains Git-ignored in this local workspace.',
	'',
	'### System instruction',
	'',
	fence('text', SECTION_INSTRUCTIONS),
	'',
	'### Structured-output schema',
	'',
	fence('json', JSON.stringify(GROUNDED_SCHEMA, null, 2))
];
for (const [index, result] of results.entries()) {
	const testCase = fixture.cases.find((item) => item.id === result.caseId);
	if (!testCase) throw new Error(`Unknown case ${result.caseId}`);
	const { lineMap } = numberPolicyLines(testCase.policyText);
	const ids = new Set();
	for (const finding of result.analysis?.findings ?? []) {
		for (const id of finding.sourceLineIds) ids.add(id);
		for (const qualification of finding.qualifications) {
			for (const id of qualification.sourceLineIds) ids.add(id);
		}
	}
	const citedLines = [...ids]
		.sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)))
		.map((id) => ({ lineId: id, text: lineMap.get(id) }));
	lines.push(
		'',
		`### ${index + 1}. ${testCase.source.service}, core L${String(result.section.coreStart + 1).padStart(4, '0')}-L${String(result.section.coreEnd).padStart(4, '0')}`,
		'',
		`Starting heading: ${result.section.sectionTitle}. Context before: ${result.section.contextStart + 1}-${result.section.coreStart}; context after: ${result.section.coreEnd + 1}-${result.section.contextEnd}. Source: [pinned ${testCase.source.service} policy](${testCase.source.archiveUrl}).`,
		'',
		`Status: ${result.responseStatus}; ${result.analysis?.findings?.length ?? 0} findings; ${result.usage?.input_tokens ?? '?'} input and ${result.usage?.output_tokens ?? '?'} output tokens; $${result.costUsd.toFixed(5)} estimated token cost.`,
		'',
		'Actual parsed Luna output:',
		'',
		fence('json', JSON.stringify(result.analysis, null, 2)),
		'',
		'Exact cited source lines copied by code:',
		'',
		fence('json', JSON.stringify(citedLines, null, 2))
	);
}
await writeFile(outputUrl, `${lines.join('\n')}\n`);
console.log(`Rendered ${results.length} calls to ${outputUrl.pathname}; no model calls made.`);
