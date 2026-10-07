import { readFile, writeFile } from 'node:fs/promises';

const resultFile = new URL(
	'../results/direct-labeled-spotify-run-2026-09-24T04-31-16.298Z-31dfcfef8aa0.jsonl',
	import.meta.url
);
const reportFile = new URL('../reports/LUNA_DIRECT_LABELED_SPOTIFY_2026-09-24.md', import.meta.url);
const rows = (await readFile(resultFile, 'utf8')).trim().split('\n').map(JSON.parse);
const [metadata, result] = rows;
if (
	rows.length !== 2 ||
	metadata?.dataset !== 'direct-labeled-spotify' ||
	result?.responseStatus !== 'completed'
) {
	throw new Error('Unexpected direct labeled result log');
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
const sourceLineIds = new Set(takeaways.flatMap((item) => item.sourceLineIds));
const tableRows = takeaways.map(
	(item, index) =>
		`| ${index + 1} | ${item.topic} | \`${item.label}\` | ${item.sourceLineIds.join(', ')} |`
);
const report = `# Direct Luna labeled Spotify test — September 24, 2026

**Result:** One GPT-6 Luna call at medium reasoning read the **complete archived Spotify policy directly** and produced **${takeaways.length} labeled takeaways**. It received **no saved findings, prior model output, or expected review checklist**. Each output item puts \`reason\` before \`label\`. The strict schema and all ${sourceLineIds.size} distinct cited line IDs passed offline checks. The estimated billed token cost was **$${result.costUsd.toFixed(5)}** (about ${Math.round(result.costUsd * 1000) / 10}¢), below the $${metadata.estimate.maximumUsd.toFixed(5)} conservative pre-run allowance. This is a single exploratory test, not a validated accuracy score or a production workflow change.

## Input and method

- **Document:** [Platform Governance Archive v2 Spotify Privacy Policy](${spotify.source.archiveUrl}), effective ${spotify.source.effectiveDate}, pinned commit \`${spotify.source.archiveCommit}\` and Git blob \`${spotify.source.archiveBlobSha}\`. The full ${spotify.policyText.split('\n').length}-line archived Markdown document is in [full-policy-cases.json](../fixtures/full-policy-cases.json). Credit: Platform Governance Archive v2, Lab Platform Governance, Media and Technology at ZeMKI, University of Bremen, with Open Terms Archive. This fixture is **Markdown, not a PDF**; PDF extraction was not tested.
- **Model input:** the full policy text with stable source-line IDs, plus a short instruction to identify materially distinct practices and explain attention labels. No 73-finding intermediate artifact was supplied. The complete request JSON is reproduced below.
- **Output contract:** strict JSON Schema with \`reason\`, \`label\`, \`topic\`, and \`sourceLineIds\` in that order. Allowed labels: \`positive\`, \`worth_knowing\`, \`higher_concern\`, \`unclear\`. These are reader-attention judgments, not legal conclusions or objective risk scores. This is a document-to-readout test, not a PDF ingestion test.
- **Call:** \`gpt-6-luna\`, \`reasoning.effort: medium\`, \`max_output_tokens: 10000\`, \`store: false\`; one call, no retry, no Terra. Request digest \`${metadata.digest}\`; response \`${result.responseStatus}\`; ${result.latencyMs} ms; ${result.usage.input_tokens} input tokens (${result.usage.input_tokens_details.cache_write_tokens} cache-write), ${result.usage.output_tokens} output tokens (${result.usage.output_tokens_details.reasoning_tokens} reasoning). The estimate uses [OpenAI's published Luna Standard rates](https://developers.openai.com/api/docs/models/gpt-6-luna); the actual invoice may differ.

The output has ${labelCounts.higher_concern} \`higher_concern\`, ${labelCounts.worth_knowing} \`worth_knowing\`, ${labelCounts.positive} \`positive\`, and ${labelCounts.unclear} \`unclear\` items.

| # | Topic | Label | Cited policy lines |
| --- | --- | --- | --- |
${tableRows.join('\n')}

## Human review and comparison

This direct pass surfaced logged-out usage being combined with account data (L0171), the child-age-limit rules (L0334–L0336), and Spotify's stated limit on consequential solely automated decisions (L0093). The earlier [two-stage labeled readout](LUNA_LABELED_SPOTIFY_READOUT_2026-09-24.md) omitted these as separate takeaways. That is useful evidence about this particular run, **not proof that direct prompting is generally better**: the prompts differ, there was only one call per approach, and neither output has been fully graded.

- **Citation gaps:** The “Voice, location, and age-check data” reason also names survey and customer-service data, but its cited IDs omit the direct supporting lines L0156–L0157. The “Visibility and sharing with other users” reason lists specific profile and playlist fields but omits their enumerating lines L0208–L0212 and L0216–L0218. The “Privacy rights and their limits” item omits the direct correction and portability lines L0089 and L0092. These are under-citations, even though the statements appear elsewhere in the supplied policy. ID-existence validation does not catch this.
- **Label judgment varies:** This direct pass labels advertising and partner sharing \`worth_knowing\`; the two-stage pass labeled a similar theme \`higher_concern\`. Neither label is an objective risk score. Reviewers need an agreed rubric before product use.
- **Coverage is not established:** The 13 takeaways are a compact readout, not a complete inventory of every practice or exception. For example, podcast-host IP disclosure and pseudonymized academic research are not singled out. A human should review the full policy for omissions and test multiple documents before deciding on a workflow.

## Actual model output

This is the complete structured output from the direct call.

\`\`\`json
${JSON.stringify(result.analysis, null, 2)}
\`\`\`

## Exact API input

This is the complete request object saved before the call: instruction, full numbered policy, schema, and run settings. It contains no API key or saved findings. The long policy is collapsed for readability.

<details>
<summary>Expand the complete request JSON</summary>

\`\`\`json
${JSON.stringify(metadata.request, null, 2)}
\`\`\`

</details>

The raw local response record is \`results/${resultFile.pathname.split('/').at(-1)}\` (Git-ignored). \`node tests/eval/issue-11/scripts/run-direct-labeled-eval.mjs --estimate\` computes the same request estimate offline and makes no API call. A fresh paid run requires explicit \`--run\`, \`RUN_MODEL_EVALS=1\`, and an approved dollar ceiling; this report does not authorize a repeat.
`;
await writeFile(reportFile, report);
console.log(
	`${reportFile.pathname}: ${takeaways.length} takeaways; ${Buffer.byteLength(report)} bytes`
);
