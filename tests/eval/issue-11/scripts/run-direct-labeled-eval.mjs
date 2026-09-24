import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { MODELS, actualCostUsd, extractOutputText } from './eval-config.mjs';
import {
	buildDirectLabeledRequest,
	loadSpotifyDirectInput,
	validateDirectLabeledReadout
} from './direct-labeled-config.mjs';

const { values } = parseArgs({
	options: {
		estimate: { type: 'boolean' },
		run: { type: 'boolean' },
		model: { type: 'string' }
	}
});
if (Boolean(values.estimate) === Boolean(values.run)) {
	throw new Error('Specify exactly one of --estimate or --run.');
}

const MAX_RUN_USD = 0.26;
const MAX_REQUEST_BYTES = 80_000;
const input = await loadSpotifyDirectInput();
const request = buildDirectLabeledRequest(input, values.model ?? 'gpt-6-luna');
const model = MODELS.find((item) => item.id === request.model);
if (!model) throw new Error(`Unknown model: ${request.model}`);
const requestBytes = Buffer.byteLength(JSON.stringify(request), 'utf8');
if (requestBytes > MAX_REQUEST_BYTES) {
	throw new Error(`Request exceeds ${MAX_REQUEST_BYTES} bytes`);
}
// Every serialized byte is treated as a cache-write token, plus a margin.
const maximumUsd =
	((requestBytes + 1_024) * model.inputUsdPerMillion * 1.25 +
		request.max_output_tokens * model.outputUsdPerMillion) /
	1_000_000;
const estimate = {
	model: request.model,
	reasoningEffort: request.reasoning.effort,
	caseId: input.testCase.id,
	input: 'full numbered Spotify policy only; no saved findings',
	calls: 1,
	requestBytes,
	maxOutputTokens: request.max_output_tokens,
	maximumUsd,
	pricing:
		'Standard short-context model rate; every serialized input byte priced as a cache-write token'
};
if (values.estimate) {
	console.log(JSON.stringify(estimate, null, 2));
	process.exit(0);
}
if (maximumUsd > MAX_RUN_USD) throw new Error('Estimate exceeds the $0.26 run ceiling');
if (process.env.RUN_MODEL_EVALS !== '1') {
	throw new Error('Paid evaluation disabled. Set RUN_MODEL_EVALS=1 explicitly.');
}
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');
const approvedMaximum = Number(process.env.EVAL_APPROVED_MAX_USD);
if (!Number.isFinite(approvedMaximum) || approvedMaximum < maximumUsd) {
	throw new Error(`EVAL_APPROVED_MAX_USD must be at least $${maximumUsd.toFixed(5)}.`);
}

const digest = createHash('sha256').update(JSON.stringify(request)).digest('hex');
const resultsDirectory = new URL('../results/', import.meta.url);
await mkdir(resultsDirectory, { recursive: true });
const fileName = `direct-labeled-spotify-run-${new Date().toISOString().replaceAll(':', '-')}-${digest.slice(0, 12)}.jsonl`;
const outputFile = new URL(fileName, resultsDirectory);
await writeFile(
	outputFile,
	`${JSON.stringify({
		type: 'metadata',
		createdAt: new Date().toISOString(),
		dataset: 'direct-labeled-spotify',
		digest,
		estimate,
		request
	})}\n`,
	{ flag: 'wx' }
);
console.log(
	`Starting one direct ${request.model}-medium call. Conservative allowance: $${maximumUsd.toFixed(5)}.`
);
console.log(`Local results: ${outputFile.pathname}`);

const started = performance.now();
let response;
try {
	response = await fetch('https://api.openai.com/v1/responses', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(request),
		signal: AbortSignal.timeout(300_000)
	});
} catch (error) {
	throw new Error(`Direct readout request failed: ${error.name}`, { cause: error });
}
if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
const body = await response.json();
const outputText = extractOutputText(body);
let analysis = null;
const schemaIssues = body.status === 'completed' ? [] : [`Response status: ${body.status}`];
let referenceIssues = [];
try {
	analysis = JSON.parse(outputText);
	const validation = validateDirectLabeledReadout(analysis, input.lineMap);
	schemaIssues.push(...validation.schemaIssues);
	referenceIssues = validation.referenceIssues;
} catch {
	schemaIssues.push('No parseable JSON output');
}
const costUsd = body.usage ? actualCostUsd(model, body.usage) : null;
await writeFile(
	outputFile,
	`${JSON.stringify({
		type: 'result',
		responseStatus: body.status,
		schemaValid: schemaIssues.length === 0,
		referencesValid: referenceIssues.length === 0,
		schemaIssues,
		referenceIssues,
		analysis,
		unparsedOutput: analysis === null ? outputText : undefined,
		usage: body.usage,
		latencyMs: Math.round(performance.now() - started),
		costUsd
	})}\n`,
	{ flag: 'a' }
);
console.log(
	`${body.status}; ${analysis?.takeaways?.length ?? 0} takeaways; schema ${schemaIssues.length ? 'failed' : 'valid'}; references ${referenceIssues.length ? 'failed' : 'valid'}; estimated billed token cost $${costUsd?.toFixed(5) ?? 'unknown'}.`
);
if (schemaIssues.length || referenceIssues.length) {
	console.log(JSON.stringify({ schemaIssues, referenceIssues }));
}
