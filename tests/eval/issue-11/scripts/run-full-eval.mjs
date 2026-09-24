import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
	INSTRUCTIONS,
	MODELS,
	RESPONSE_SCHEMA,
	actualCostUsd,
	buildRequest,
	extractOutputText,
	requestBytes,
	validateAnalysis
} from './eval-config.mjs';

const { values } = parseArgs({
	options: { estimate: { type: 'boolean' }, run: { type: 'boolean' } }
});
if (Boolean(values.estimate) === Boolean(values.run)) {
	throw new Error('Specify exactly one of --estimate or --run.');
}

const MODEL = 'gpt-6-luna';
const EFFORT = 'medium';
const MAX_OUTPUT_TOKENS = 25_000;
const MAX_REQUEST_BYTES = 320_000;
const MAX_APPROVED_USD = 0.1;
const LONG_CONTEXT_THRESHOLD = 272_000;
const fixture = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-cases.json', import.meta.url), 'utf8')
);
if (fixture.reviewStatus !== 'unlabeled-needs-human-review' || fixture.cases.length !== 2) {
	throw new Error('Expected exactly two unlabeled full-policy cases');
}
const cases = fixture.cases;
const prepared = cases.map((testCase) => {
	if (!testCase.policyText || !testCase.source?.archiveCommit) {
		throw new Error(`Invalid full-policy case: ${testCase.id}`);
	}
	const request = {
		...buildRequest(testCase, MODEL, EFFORT),
		max_output_tokens: MAX_OUTPUT_TOKENS
	};
	const bytes = requestBytes(request);
	if (bytes > MAX_REQUEST_BYTES) {
		throw new Error(`Request exceeds ${MAX_REQUEST_BYTES}-byte cap: ${testCase.id}`);
	}
	// A deliberately high input allowance for a text-only request, plus framing margin.
	const inputTokenAllowance = bytes + 1_024;
	const longContext = inputTokenAllowance > LONG_CONTEXT_THRESHOLD;
	const maximumUsd =
		(inputTokenAllowance * (longContext ? 0.2 : 0.1) * 1.25 +
			MAX_OUTPUT_TOKENS * (longContext ? 0.75 : 0.5)) /
		1_000_000;
	return { testCase, request, bytes, maximumUsd };
});
const maximumUsd = prepared.reduce((sum, item) => sum + item.maximumUsd, 0);
if (values.run && maximumUsd > MAX_APPROVED_USD) {
	throw new Error('The conservative full-policy estimate exceeds the $0.10 cap');
}
const estimate = {
	model: MODEL,
	reasoningEffort: EFFORT,
	repeats: 1,
	calls: prepared.length,
	maxOutputTokensPerCall: MAX_OUTPUT_TOKENS,
	maxRequestBytes: MAX_REQUEST_BYTES,
	perCase: prepared.map(({ testCase, bytes, maximumUsd }) => ({
		caseId: testCase.id,
		requestBytes: bytes,
		maximumUsd
	})),
	maximumUsd
};
if (values.estimate) {
	console.log(JSON.stringify(estimate, null, 2));
	process.exit(0);
}

if (process.env.RUN_MODEL_EVALS !== '1') {
	throw new Error('Paid evaluation disabled. Set RUN_MODEL_EVALS=1 explicitly.');
}
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');
const approvedMaximum = Number(process.env.EVAL_APPROVED_MAX_USD);
if (!Number.isFinite(approvedMaximum) || approvedMaximum < maximumUsd) {
	throw new Error(`EVAL_APPROVED_MAX_USD must be at least $${maximumUsd.toFixed(4)}.`);
}

const digest = createHash('sha256')
	.update(
		JSON.stringify({
			cases,
			INSTRUCTIONS,
			RESPONSE_SCHEMA,
			model: MODEL,
			effort: EFFORT,
			MAX_OUTPUT_TOKENS
		})
	)
	.digest('hex');
const resultsDirectory = new URL('../results/', import.meta.url);
await mkdir(resultsDirectory, { recursive: true });
const fileName = `full-run-${new Date().toISOString().replaceAll(':', '-')}-${digest.slice(0, 12)}.jsonl`;
const outputFile = new URL(fileName, resultsDirectory);
await writeFile(
	outputFile,
	`${JSON.stringify({
		type: 'metadata',
		createdAt: new Date().toISOString(),
		digest,
		caseIds: cases.map((testCase) => testCase.id),
		models: [MODEL],
		reasoningEfforts: [EFFORT],
		repeats: 1,
		dataset: 'full',
		estimate
	})}\n`,
	{ flag: 'wx' }
);
console.log(
	`Starting ${prepared.length} full-policy calls. Conservative cap: $${maximumUsd.toFixed(4)}.`
);
console.log(`Local results: ${outputFile.pathname}`);

let spentUsd = 0;
for (const { testCase, request, maximumUsd: caseMaximumUsd } of prepared) {
	if (spentUsd + caseMaximumUsd > Math.min(approvedMaximum, MAX_APPROVED_USD)) {
		throw new Error('Stopping before the next call: remaining $0.10 budget is insufficient');
	}
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
		throw new Error(`Request failed for ${testCase.id}: ${error.name}`, { cause: error });
	}
	if (!response.ok) {
		throw new Error(`Provider returned HTTP ${response.status} for ${testCase.id}`);
	}
	const body = await response.json();
	const latencyMs = Math.round(performance.now() - started);
	const outputText = extractOutputText(body);
	let analysis = null;
	let schemaIssues = body.status === 'completed' ? [] : [`Response status: ${body.status}`];
	let evidenceIssues = [];
	try {
		analysis = JSON.parse(outputText);
		const validation = validateAnalysis(analysis, testCase.policyText);
		schemaIssues = schemaIssues.concat(validation.schemaIssues);
		evidenceIssues = validation.evidenceIssues;
	} catch {
		schemaIssues.push('No parseable JSON output');
	}
	const usage = body.usage;
	const costUsd = usage ? actualCostUsd(MODELS[0], usage) : null;
	if (costUsd !== null) spentUsd += costUsd;
	await appendFile(
		outputFile,
		`${JSON.stringify({
			type: 'result',
			caseId: testCase.id,
			caseKind: 'full',
			model: MODEL,
			reasoningEffort: EFFORT,
			repeat: 1,
			responseStatus: body.status,
			schemaValid: schemaIssues.length === 0,
			evidenceQuotesValid: schemaIssues.length === 0 && evidenceIssues.length === 0,
			schemaIssues,
			evidenceIssues,
			analysis,
			unparsedOutput: analysis === null ? outputText : undefined,
			usage,
			latencyMs,
			costUsd
		})}\n`
	);
	console.log(
		`${testCase.id}: ${schemaIssues.length || evidenceIssues.length ? 'review' : 'valid'}`
	);
	if (costUsd === null)
		throw new Error('Provider usage is missing; stopping before another paid call');
}
console.log(
	`Completed ${prepared.length} calls. Estimated billed token cost: $${spentUsd.toFixed(5)}.`
);
