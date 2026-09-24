import { readFile, writeFile } from 'node:fs/promises';
import { SPOTIFY_SOURCE_LOG } from './labeled-readout-config.mjs';

const resultFile = new URL(
	'../results/labeled-spotify-run-2026-09-24T04-24-27.319Z-6d08ce729064.jsonl',
	import.meta.url
);
const reportFile = new URL(
	'../reports/LUNA_LABELED_SPOTIFY_READOUT_2026-09-24.md',
	import.meta.url
);
const rows = (await readFile(resultFile, 'utf8')).trim().split('\n').map(JSON.parse);
const [metadata, result] = rows;
if (
	rows.length !== 2 ||
	metadata?.dataset !== 'labeled-spotify-readout' ||
	metadata.estimate.sourceLog !== SPOTIFY_SOURCE_LOG ||
	result?.responseStatus !== 'completed'
) {
	throw new Error('Unexpected labeled Spotify result log');
}
const fixture = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-cases.json', import.meta.url), 'utf8')
);
const spotify = fixture.cases.find((item) => item.id === 'spotify-full-privacy-policy');
const takeaways = result.analysis.takeaways;
const labelCounts = Object.fromEntries(
	['higher_concern', 'worth_knowing', 'positive', 'unclear'].map((label) => [
		label,
		takeaways.filter((item) => item.label === label).length
	])
);
const sourceFindingIds = new Set(takeaways.flatMap((item) => item.sourceFindingIds));
const sourceLineIds = new Set(takeaways.flatMap((item) => item.sourceLineIds));
const tableRows = takeaways.map(
	(item, index) =>
		`| ${index + 1} | ${item.topic} | \`${item.label}\` | ${item.sourceLineIds.join(', ')} |`
);
const report = `# Luna labeled Spotify readout — September 24, 2026

**Result:** One GPT-6 Luna call at medium reasoning consolidated 73 saved Spotify extraction findings into **${takeaways.length} labeled takeaways**. The JSON structure and all ${sourceLineIds.size} distinct cited line IDs passed offline checks. The estimated billed token cost of this additional call was **$${result.costUsd.toFixed(5)}** (about ${Math.round(result.costUsd * 1000) / 10}¢), against a conservative pre-run allowance of $${metadata.estimate.maximumUsd.toFixed(5)}. This is an exploratory readout, **not** a validated accuracy score or a Luna-vs-Terra decision.

The new schema puts \`reason\` immediately before \`label\` in each takeaway. Labels are reader-attention judgments—\`positive\`, \`worth_knowing\`, \`higher_concern\`, or \`unclear\`—not legal conclusions or objective risk scores. This pass produced ${labelCounts.higher_concern} higher-concern, ${labelCounts.worth_knowing} worth-knowing, ${labelCounts.positive} positive, and ${labelCounts.unclear} unclear items. The model cited ${sourceFindingIds.size} distinct saved finding IDs out of 73; that is traceability, **not** a recall measure, because consolidation and omission of peripheral findings are intentional.

## What was tested

- **Source:** [Platform Governance Archive v2 Spotify Privacy Policy](${spotify.source.archiveUrl}), effective ${spotify.source.effectiveDate}, pinned commit \`${spotify.source.archiveCommit}\` and Git blob \`${spotify.source.archiveBlobSha}\`. The complete archived text is in [full-policy-cases.json](../fixtures/full-policy-cases.json). Credit: Platform Governance Archive v2, Lab Platform Governance, Media and Technology at ZeMKI, University of Bremen, with Open Terms Archive.
- **Input:** the 73 saved findings from the two completed Spotify sections in \`results/${SPOTIFY_SOURCE_LOG}\`, plus the entire numbered archived Spotify policy as verification material. No expected review checklist was sent. The exact API request, including all 73 finding summaries, qualifications, and policy lines, is reproduced below.
- **Call:** \`gpt-6-luna\`, \`reasoning.effort: medium\`, strict JSON-schema output, \`max_output_tokens: 8000\`, \`store: false\`; one request, no automatic retry. This is a second-stage consolidation test, not another extraction run and not a Terra test.
- **Run:** request digest \`${metadata.digest}\`; response \`${result.responseStatus}\`; ${result.latencyMs} ms; ${result.usage.input_tokens} input tokens (${result.usage.input_tokens_details.cache_write_tokens} cache-write), ${result.usage.output_tokens} output tokens (${result.usage.output_tokens_details.reasoning_tokens} reasoning). Price estimate uses [OpenAI's published Luna Standard token rates](https://developers.openai.com/api/docs/models/gpt-6-luna); the actual invoice may differ.

| # | Topic | Label | Cited policy lines |
| --- | --- | --- | --- |
${tableRows.join('\n')}

## Human review

The nine grouped themes are substantially easier to scan than 73 individual records, and the high-attention labels for broad behavioral collection, partner advertising, and optional sensitive inputs are understandable editorial judgments. In a spot-check against the cited policy lines, the core claims and most qualifications were supported. **Do not read the valid-ID result as semantic validation.**

- **One overgeneralization:** The “Privacy rights and controls” reason says Spotify cannot verify and honor “these requests” for people without accounts. [Policy line L0098](${spotify.source.archiveUrl}) specifically discusses requests to know, delete, and correct; the takeaway's wording could be read as extending that limitation to portability and consent withdrawal. It should name the three request types, or separate the limitation from the broader rights sentence.
- **Compression omissions:** The short readout leaves out the policy's statement that logged-out mobile-app usage data may later be combined with account data (L0171), and it does not give the child-age-limit rules (L0334–L0336) their own takeaway. These are not proof of an extraction failure; they show that grouping quality and coverage still need a human rubric.
- **Label subjectivity:** \`higher_concern\` and \`positive\` reflect a general reader's attention priorities. The schema guarantees one of four allowed labels, but cannot prove that a label is the best choice. A human reviewer should check impact, controls, and conditions before using these labels in a product.
- **Scope:** This test covers only the archived Spotify document and one stochastic call. We have not graded all 73 findings, all nine takeaways, or the policy for recall; we have not tested Facebook or Terra with this new schema.

## Actual model output

The following is the complete structured output from this call; the order of each object is \`reason\`, then \`label\`, followed by topic and provenance IDs.

\`\`\`json
${JSON.stringify(result.analysis, null, 2)}
\`\`\`

## Exact API input

This is the exact request JSON saved before the paid call, including the system instruction, all 73 saved finding summaries, the full numbered Spotify policy, the strict schema, and run settings. It is long because the original archived policy lines are long. The request contains no API key.

<details>
<summary>Expand the complete request JSON</summary>

\`\`\`json
${JSON.stringify(metadata.request, null, 2)}
\`\`\`

</details>

The local raw response record is \`results/${resultFile.pathname.split('/').at(-1)}\` (Git-ignored). To reproduce the cost estimate offline, run \`node tests/eval/issue-11/scripts/run-labeled-readout.mjs --estimate\`. That command does not contact the API. A fresh paid run requires explicit \`--run\`, \`RUN_MODEL_EVALS=1\`, and an approved dollar ceiling; this report is not permission to repeat it.
`;
await writeFile(reportFile, report);
console.log(
	`${reportFile.pathname}: ${takeaways.length} takeaways; ${Buffer.byteLength(report)} bytes`
);
