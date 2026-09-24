import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import {
	GROUNDED_INSTRUCTIONS,
	GROUNDED_SCHEMA,
	numberPolicyLines
} from './grounded-full-config.mjs';

const reportUrl = new URL('../reports/LUNA_GROUNDED_FULL_RUN_2026-09-24.md', import.meta.url);
const resultsUrl = new URL(
	'../results/grounded-full-run-2026-09-24T03-10-14.345Z-2aac25582046.jsonl',
	import.meta.url
);
const fixture = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-cases.json', import.meta.url), 'utf8')
);
const records = (await readFile(resultsUrl, 'utf8'))
	.trim()
	.split('\n')
	.map((line) => JSON.parse(line));
const metadata = records[0];
const results = records.slice(1);
const digest = createHash('sha256')
	.update(
		JSON.stringify({
			cases: fixture.cases,
			GROUNDED_INSTRUCTIONS,
			GROUNDED_SCHEMA,
			OUTPUT_CAPS: {
				'spotify-full-privacy-policy': 11_000,
				'facebook-full-privacy-policy': 14_000
			}
		})
	)
	.digest('hex');
if (
	metadata.type !== 'metadata' ||
	metadata.digest !== digest ||
	metadata.models?.join() !== 'gpt-6-luna' ||
	metadata.reasoningEfforts?.join() !== 'medium' ||
	metadata.repeats !== 1 ||
	results.length !== fixture.cases.length
) {
	throw new Error('Saved grounded results do not match the expected two-policy run');
}

function fenced(language, content) {
	if (content.includes('~~~~')) throw new Error('Content contains the Markdown fence delimiter');
	return `~~~~${language}\n${content}\n~~~~`;
}

const appendix = [
	'Output JSON below is pretty-printed from the saved parsed model response; field names and values are unchanged, but whitespace is not the original wire formatting. The citation table after each output is created locally by looking up model-returned line IDs in the exact original Markdown. It is not another model response.',
	'',
	'### Shared instructions (system input)',
	'',
	fenced('text', GROUNDED_INSTRUCTIONS),
	'',
	'### Shared structured-output schema',
	'',
	fenced('json', JSON.stringify(GROUNDED_SCHEMA, null, 2))
];

for (const [index, testCase] of fixture.cases.entries()) {
	const result = results[index];
	if (
		result?.type !== 'result' ||
		result.caseId !== testCase.id ||
		result.model !== 'gpt-6-luna' ||
		result.reasoningEffort !== 'medium' ||
		result.repeat !== 1 ||
		!result.analysis
	) {
		throw new Error(`Unexpected result for ${testCase.id}`);
	}
	const { lineMap } = numberPolicyLines(testCase.policyText);
	const citedIds = new Set();
	for (const finding of result.analysis.findings) {
		for (const id of finding.sourceLineIds) citedIds.add(id);
		for (const qualification of finding.qualifications) {
			for (const id of qualification.sourceLineIds) citedIds.add(id);
		}
	}
	const citedLines = [...citedIds]
		.sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)))
		.map((id) => {
			const text = lineMap.get(id);
			if (text === undefined) throw new Error(`Unknown cited line ${id}`);
			return { lineId: id, text };
		});
	appendix.push(
		'',
		`### ${index + 1}. ${testCase.title} (\`${testCase.id}\`)`,
		'',
		`Source: [${testCase.source.service} ${testCase.source.document}](${testCase.source.archiveUrl}), pinned at \`${testCase.source.archiveCommit}\`.`,
		'',
		`Input: [full-policy-cases.json](../fixtures/full-policy-cases.json), case \`${testCase.id}\`, \`policyText\` (${Buffer.byteLength(testCase.policyText, 'utf8').toLocaleString()} UTF-8 bytes; blob SHA \`${testCase.source.archiveBlobSha}\`). Each nonempty source line received its one-based \`L####\` prefix before being sent.`,
		'',
		'**Actual Luna output**',
		'',
		fenced('json', JSON.stringify(result.analysis, null, 2)),
		'',
		`Reference check: **${result.referenceIssues.length === 0 ? 'all line IDs resolved' : result.referenceIssues.join('; ')}**.`,
		'',
		'**Exact source lines selected by Luna, copied by the application**',
		'',
		fenced('json', JSON.stringify(citedLines, null, 2))
	);
}

const report = await readFile(reportUrl, 'utf8');
const startMarker = '<!-- BEGIN GROUNDED_TRANSCRIPT -->';
const endMarker = '<!-- END GROUNDED_TRANSCRIPT -->';
const start = report.indexOf(startMarker);
const end = report.indexOf(endMarker);
if (start < 0 || end < start) throw new Error('Report transcript markers are missing');
await writeFile(
	reportUrl,
	`${report.slice(0, start + startMarker.length)}\n\n${appendix.join('\n')}\n\n${report.slice(end)}`
);
console.log(`Wrote ${fixture.cases.length} full-policy inputs and outputs; no model calls made.`);
