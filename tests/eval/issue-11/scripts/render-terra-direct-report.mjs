import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const terraFile = new URL(
	'../results/direct-labeled-spotify-run-2026-09-24T04-40-31.644Z-7b5206c98ed3.jsonl',
	import.meta.url
);
const lunaFile = new URL(
	'../results/direct-labeled-spotify-run-2026-09-24T04-31-16.298Z-31dfcfef8aa0.jsonl',
	import.meta.url
);
const reportFile = new URL(
	'../reports/TERRA_DIRECT_LABELED_SPOTIFY_2026-09-24.md',
	import.meta.url
);
const readLog = async (file) => (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
const [terraMetadata, terraResult] = await readLog(terraFile);
const [lunaMetadata, lunaResult] = await readLog(lunaFile);
if (
	terraMetadata.dataset !== 'direct-labeled-spotify' ||
	lunaMetadata.dataset !== 'direct-labeled-spotify' ||
	terraMetadata.request.model !== 'gpt-5.6-terra' ||
	lunaMetadata.request.model !== 'gpt-6-luna' ||
	terraResult.responseStatus !== 'completed' ||
	lunaResult.responseStatus !== 'completed'
) {
	throw new Error('Unexpected direct labeled result logs');
}
assert.deepEqual(
	{ ...terraMetadata.request, model: 'gpt-6-luna' },
	lunaMetadata.request,
	'Terra and Luna direct requests must differ only by model ID'
);
const fixture = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-cases.json', import.meta.url), 'utf8')
);
const spotify = fixture.cases.find((item) => item.id === 'spotify-full-privacy-policy');
const terraTakeaways = terraResult.analysis.takeaways;
const lunaTakeaways = lunaResult.analysis.takeaways;
const labels = ['higher_concern', 'worth_knowing', 'positive', 'unclear'];
const counts = (items) =>
	Object.fromEntries(
		labels.map((label) => [label, items.filter((item) => item.label === label).length])
	);
const terraCounts = counts(terraTakeaways);
const lunaCounts = counts(lunaTakeaways);
const costRatio = terraResult.costUsd / lunaResult.costUsd;
const tableRows = terraTakeaways.map(
	(item, index) =>
		`| ${index + 1} | ${item.topic} | \`${item.label}\` | ${item.sourceLineIds.join(', ')} |`
);
const report = `# Terra direct labeled Spotify test — September 24, 2026

**Result:** One GPT-5.6 Terra call at medium reasoning read the complete archived Spotify policy directly and produced **${terraTakeaways.length} labeled takeaways**. It received **no saved findings or expected checklist**. The request was byte-for-byte the same as the [direct Luna run](LUNA_DIRECT_LABELED_SPOTIFY_2026-09-24.md) after replacing only the model ID. The schema and every cited line ID passed offline checks. Terra's estimated billed token cost was **$${terraResult.costUsd.toFixed(5)}** (about ${(terraResult.costUsd * 100).toFixed(2)}¢), versus Luna's **$${lunaResult.costUsd.toFixed(5)}**; approximately **${costRatio.toFixed(1)}×** the cost for this pair of calls. This is a one-document, one-call-per-model comparison—not a validated accuracy score or a production model choice.

## Input and run settings

- **Source:** [Platform Governance Archive v2 Spotify Privacy Policy](${spotify.source.archiveUrl}), effective ${spotify.source.effectiveDate}, pinned commit \`${spotify.source.archiveCommit}\` and Git blob \`${spotify.source.archiveBlobSha}\`. The complete archived Markdown policy is in [full-policy-cases.json](../fixtures/full-policy-cases.json). Credit: Platform Governance Archive v2, Lab Platform Governance, Media and Technology at ZeMKI, University of Bremen, with Open Terms Archive. This tests policy text analysis, **not PDF extraction**.
- **Identical setup:** full policy with stable source-line IDs; the same instruction, strict JSON Schema, \`reason\` before \`label\`, allowed labels (\`positive\`, \`worth_knowing\`, \`higher_concern\`, \`unclear\`), medium reasoning, 10,000 output-token cap, and \`store: false\`. No saved findings, retries, tools, or Terra-specific prompt changes. The exact Terra request and output are reproduced below.
- **Terra call:** request digest \`${terraMetadata.digest}\`; ${terraResult.latencyMs} ms; ${terraResult.usage.input_tokens} input tokens (${terraResult.usage.input_tokens_details.cache_write_tokens} cache-write), ${terraResult.usage.output_tokens} output tokens (${terraResult.usage.output_tokens_details.reasoning_tokens} reasoning). The pre-run conservative allowance was $${terraMetadata.estimate.maximumUsd.toFixed(5)}. The estimate applies [OpenAI's published Terra Standard token rates](https://developers.openai.com/api/docs/models/gpt-5.6-terra); the actual invoice may differ.
- **Luna call:** ${lunaTakeaways.length} takeaways, ${lunaResult.latencyMs} ms, ${lunaResult.usage.input_tokens} input tokens, ${lunaResult.usage.output_tokens} output tokens (${lunaResult.usage.output_tokens_details.reasoning_tokens} reasoning), estimated billed token cost $${lunaResult.costUsd.toFixed(5)}.

| Model | Takeaways | Higher concern | Worth knowing | Positive | Unclear | Estimated cost |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| GPT-5.6 Terra | ${terraTakeaways.length} | ${terraCounts.higher_concern} | ${terraCounts.worth_knowing} | ${terraCounts.positive} | ${terraCounts.unclear} | $${terraResult.costUsd.toFixed(5)} |
| GPT-6 Luna | ${lunaTakeaways.length} | ${lunaCounts.higher_concern} | ${lunaCounts.worth_knowing} | ${lunaCounts.positive} | ${lunaCounts.unclear} | $${lunaResult.costUsd.toFixed(5)} |

The counts are **not** accuracy scores. Different grouping can change the number of takeaways without improving coverage, and a valid JSON schema or valid citation ID does not prove that every clause in a reason is supported.

| # | Terra topic | Label | Cited policy lines |
| --- | --- | --- | --- |
${tableRows.join('\n')}

## What Terra did well and where it fell short

- **Useful detail:** Terra separated the limits of ad opt-out from partner data sharing; it isolated podcast-host IP disclosure (L0247), which Luna's direct readout did not mention; and it separately explained age-check-data deletion. Its summary of under-18 advertising and marketing-partner limits preserved the important “by default” qualifier for marketing partners.
- **Material omissions:** Terra did not mention the policy's statement that logged-out mobile-app usage can later be combined with account data (L0171), or the child-age-limit collection and deletion rules (L0334–L0336). Luna's direct pass included both. Terra included the automated-decision limitation inside its rights takeaway rather than as a separate item, which is acceptable grouping, not an omission. Neither direct output highlighted pseudonymized academic-research disclosure (L0248).
- **Citation gaps:** The rights takeaway names correction but omits its direct source line L0089. The social-sharing takeaway enumerates profile photos, playlists, and posted content while citing L0208 and L0212 but not the intervening L0209–L0211. The broad legal-disclosure takeaway mentions investigations and safety but omits L0256, which directly supports those examples. These are under-citations, not necessarily invented claims. The mechanical validator checks that IDs exist, not that they support every clause.
- **One retention qualification to watch:** Terra says search-query data is an example of data deleted after 90 days, but does not repeat the policy's explicit “subject to other applicable retention rules” condition in L0280. Luna also summarized this point without that caveat. Both need human qualification review.
- **Label judgment differs:** Terra rates partner advertising \`higher_concern\`; Luna rates it \`worth_knowing\`. Terra also labels no-account request limitations \`higher_concern\` as a standalone point. These are editorial attention labels, not legal judgments; an agreed human rubric is needed before treating a label as a model-quality win.

**Preliminary read:** Terra adds some useful precision and one notable disclosure, but it does **not** clearly outperform Luna on coverage in this document: it missed two material topics Luna surfaced while costing about ${costRatio.toFixed(1)}× as much. This pair of unblinded, single-run summaries cannot establish precision, recall, consistency, or which model should ship. More policies and independently reviewed claims are needed before a recommendation.

## Terra's actual model output

This is the complete structured output from the one paid Terra call.

\`\`\`json
${JSON.stringify(terraResult.analysis, null, 2)}
\`\`\`

## Exact Terra API input

This is the complete request object saved before the call, including the full numbered archived policy, instruction, schema, and run settings. It contains no API key. The large policy is collapsed for readability.

<details>
<summary>Expand the complete request JSON</summary>

\`\`\`json
${JSON.stringify(terraMetadata.request, null, 2)}
\`\`\`

</details>

The raw local response record is \`results/${terraFile.pathname.split('/').at(-1)}\` (Git-ignored). \`node tests/eval/issue-11/scripts/run-direct-labeled-eval.mjs --estimate --model gpt-5.6-terra\` estimates the same request offline, without another API call. A fresh paid run requires explicit \`--run\`, \`RUN_MODEL_EVALS=1\`, and an approved dollar ceiling; this report does not authorize a repeat.
`;
await writeFile(reportFile, report);
console.log(
	`${reportFile.pathname}: ${terraTakeaways.length} takeaways; ${Buffer.byteLength(report)} bytes`
);
