import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { MODELS, actualCostUsd, extractOutputText } from './eval-config.mjs';
import {
	GROUNDED_INSTRUCTIONS,
	GROUNDED_SCHEMA,
	buildGroundedRequest,
	validateGroundedAnalysis
} from './grounded-full-config.mjs';

const { values } = parseArgs({
	options: { estimate: { type: 'boolean' }, run: { type: 'boolean' } }
});
if (Boolean(values.estimate) === Boolean(values.run)) {
	throw new Error('Specify exactly one of --estimate or --run.');
}

const MAX_APPROVED_USD = 0.1;
const MAX_REQUEST_BYTES = 330_000;
const OUTPUT_CAPS = {
	'spotify-full-privacy-policy': 11_000,
	'facebook-full-privacy-policy': 14_000
};
const fixture = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-cases.json', import.meta.url), 'utf8')
);
if (fixture.reviewStatus !== 'unlabeled-needs-human-review' || fixture.cases.length !== 2) {
	throw new Error('Expected exactly two unlabeled full-policy cases');
}
const cases = fixture.cases;
const prepared = cases.map((testCase) => {
	const outputCap = OUTPUT_CAPS[testCase.id];
	if (!outputCap || !testCase.source?.archiveCommit) {
		throw new Error(`Unexpected full-policy case: ${testCase.id}`);
	}
	const { request, lineMap } = buildGroundedRequest(testCase, outputCap);
	const requestBytes = Buffer.byteLength(JSON.stringify(request), 'utf8');
	if (requestBytes > MAX_REQUEST_BYTES) {
		throw new Error(`Request exceeds ${MAX_REQUEST_BYTES}-byte cap: ${testCase.id}`);
	}
	// Allow one token per request byte plus framing margin and assume every input token
	// is charged as a cache write. Apply Luna's long-context rates when the allowance
	// exceeds 272K tokens, even though actual tokenization may be much smaller.
	const inputTokenAllowance = requestBytes + 1_024;
	const longContext = inputTokenAllowance > 272_000;
	const maximumUsd =
		(inputTokenAllowance * (longContext ? 0.2 : 0.1) * 1.25 +
			outputCap * (longContext ? 0.75 : 0.5)) /
		1_000_000;
	return { testCase, request, lineMap, outputCap, requestBytes, maximumUsd };
});
const maximumUsd = prepared.reduce((sum, item) => sum + item.maximumUsd, 0);
const estimate = {
	model: 'gpt-6-luna',
	reasoningEffort: 'medium',
	repeats: 1,
	calls: prepared.length,
	perCase: prepared.map(({ testCase, lineMap, outputCap, requestBytes, maximumUsd }) => ({
		caseId: testCase.id,
		lineCount: lineMap.size,
		requestBytes,
		maxOutputTokens: outputCap,
		maximumUsd
	})),
	maximumUsd
};
if (values.estimate) {
	console.log(JSON.stringify(estimate, null, 2));
	process.exit(0);
}
if (maximumUsd > MAX_APPROVED_USD) {
	throw new Error('Conservative estimate exceeds the $0.10 ceiling');
}
if (process.env.RUN_MODEL_EVALS !== '1') {
	throw new Error('Paid evaluation disabled. Set RUN_MODEL_EVALS=1 explicitly.');
}
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');
const approvedMaximum = Number(process.env.EVAL_APPROVED_MAX_USD);
if (!Number.isFinite(approvedMaximum) || approvedMaximum < maximumUsd) {
	throw new Error(`EVAL_APPROVED_MAX_USD must be at least $${maximumUsd.toFixed(5)}.`);
}

const digest = createHash('sha256')
	.update(JSON.stringify({ cases, GROUNDED_INSTRUCTIONS, GROUNDED_SCHEMA, OUTPUT_CAPS }))
	.digest('hex');
const resultsDirectory = new URL('../results/', import.meta.url);
await mkdir(resultsDirectory, { recursive: true });
const fileName = `grounded-full-run-${new Date().toISOString().replaceAll(':', '-')}-${digest.slice(0, 12)}.jsonl`;
const outputFile = new URL(fileName, resultsDirectory);
await writeFile(
	outputFile,
	`${JSON.stringify({
		type: 'metadata',
		createdAt: new Date().toISOString(),
		digest,
		caseIds: cases.map((testCase) => testCase.id),
		models: ['gpt-6-luna'],
		reasoningEfforts: ['medium'],
		repeats: 1,
		dataset: 'grounded-full',
		estimate
	})}\n`,
	{ flag: 'wx' }
);
console.log(
	`Starting ${prepared.length} grounded full-policy calls. Conservative allowance: $${maximumUsd.toFixed(5)}.`
);
console.log(`Local results: ${outputFile.pathname}`);

let spentUsd = 0;
for (const { testCase, request, lineMap, maximumUsd: caseMaximumUsd } of prepared) {
	if (spentUsd + caseMaximumUsd > Math.min(approvedMaximum, MAX_APPROVED_USD)) {
		throw new Error('Stopping before the next call: remaining $0.10 allowance is insufficient');
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
	let groundedFindings = [];
	let schemaIssues = body.status === 'completed' ? [] : [`Response status: ${body.status}`];
	let referenceIssues = [];
	try {
		analysis = JSON.parse(outputText);
		const validation = validateGroundedAnalysis(analysis, lineMap);
		schemaIssues = schemaIssues.concat(validation.schemaIssues);
		referenceIssues = validation.referenceIssues;
		groundedFindings = validation.groundedFindings;
	} catch {
		schemaIssues.push('No parseable JSON output');
	}
	const costUsd = body.usage ? actualCostUsd(MODELS[0], body.usage) : null;
	if (costUsd !== null) spentUsd += costUsd;
	await appendFile(
		outputFile,
		`${JSON.stringify({
			type: 'result',
			caseId: testCase.id,
			caseKind: 'grounded-full',
			model: 'gpt-6-luna',
			reasoningEffort: 'medium',
			repeat: 1,
			responseStatus: body.status,
			schemaValid: schemaIssues.length === 0,
			evidenceQuotesValid: schemaIssues.length === 0 && referenceIssues.length === 0,
			schemaIssues,
			referenceIssues,
			analysis,
			groundedFindings,
			unparsedOutput: analysis === null ? outputText : undefined,
			usage: body.usage,
			latencyMs,
			costUsd
		})}\n`
	);
	console.log(
		`${testCase.id}: ${schemaIssues.length || referenceIssues.length ? 'review' : 'valid'}`
	);
	if (costUsd === null)
		throw new Error('Provider usage is missing; stopping before another paid call');
}
console.log(
	`Completed ${prepared.length} calls. Estimated billed token cost: $${spentUsd.toFixed(5)}.`
);
