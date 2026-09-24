import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { MODELS, actualCostUsd, extractOutputText } from './eval-config.mjs';
import { validateGroundedAnalysis } from './grounded-full-config.mjs';
import { buildSectionRequest, splitPolicyIntoSections } from './sectioned-full-config.mjs';

const { values } = parseArgs({
	options: {
		estimate: { type: 'boolean' },
		run: { type: 'boolean' },
		case: { type: 'string' }
	}
});
if (Boolean(values.estimate) === Boolean(values.run)) {
	throw new Error('Specify exactly one of --estimate or --run.');
}

const MAX_APPROVED_USD = 0.1;
const MAX_REQUEST_BYTES = 32_000;
const OUTPUT_CAPS = {
	'spotify-full-privacy-policy': 8_000,
	'facebook-full-privacy-policy': 6_400
};
const fixture = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-cases.json', import.meta.url), 'utf8')
);
if (fixture.reviewStatus !== 'unlabeled-needs-human-review' || fixture.cases.length !== 2) {
	throw new Error('Expected exactly two unlabeled full-policy cases');
}
if (values.case && !fixture.cases.some((testCase) => testCase.id === values.case)) {
	throw new Error(`Unknown case: ${values.case}`);
}
const selectedCases = fixture.cases.filter(
	(testCase) => !values.case || testCase.id === values.case
);
const priorSpendUsd = Number(process.env.EVAL_PRIOR_SPEND_USD ?? 0);
if (!Number.isFinite(priorSpendUsd) || priorSpendUsd < 0) {
	throw new Error('EVAL_PRIOR_SPEND_USD must be a nonnegative number');
}
const prepared = selectedCases.flatMap((testCase) =>
	splitPolicyIntoSections(testCase).map((section, sectionIndex) => {
		const outputCap = OUTPUT_CAPS[testCase.id];
		if (!outputCap) throw new Error(`Unexpected full-policy case: ${testCase.id}`);
		const { request, lineMap } = buildSectionRequest(testCase, section, outputCap);
		const requestBytes = Buffer.byteLength(JSON.stringify(request), 'utf8');
		if (requestBytes > MAX_REQUEST_BYTES) {
			throw new Error(`Section request exceeds ${MAX_REQUEST_BYTES} bytes`);
		}
		const inputTokenAllowance = requestBytes + 1_024;
		const maximumUsd = (inputTokenAllowance * 0.125 + request.max_output_tokens * 0.5) / 1_000_000;
		return { testCase, section, sectionIndex, request, lineMap, requestBytes, maximumUsd };
	})
);
const maximumUsd = prepared.reduce((sum, item) => sum + item.maximumUsd, 0);
const estimate = {
	model: 'gpt-6-luna',
	reasoningEffort: 'medium',
	repeats: 1,
	calls: prepared.length,
	perPolicy: selectedCases.map((testCase) => ({
		caseId: testCase.id,
		calls: prepared.filter((item) => item.testCase.id === testCase.id).length,
		maximumUsd: prepared
			.filter((item) => item.testCase.id === testCase.id)
			.reduce((sum, item) => sum + item.maximumUsd, 0)
	})),
	maximumUsd,
	priorSpendUsd,
	combinedConservativeUsd: priorSpendUsd + maximumUsd,
	pricing: 'Standard short-context Luna; input allowance assumes every byte is a cache-write token'
};
if (values.estimate) {
	console.log(JSON.stringify(estimate, null, 2));
	process.exit(0);
}
if (priorSpendUsd + maximumUsd > MAX_APPROVED_USD) {
	throw new Error('Conservative estimate exceeds the $0.10 ceiling');
}
if (process.env.RUN_MODEL_EVALS !== '1') {
	throw new Error('Paid evaluation disabled. Set RUN_MODEL_EVALS=1 explicitly.');
}
if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is missing.');
const approvedMaximum = Number(process.env.EVAL_APPROVED_MAX_USD);
if (!Number.isFinite(approvedMaximum) || approvedMaximum < priorSpendUsd + maximumUsd) {
	throw new Error(
		`EVAL_APPROVED_MAX_USD must be at least $${(priorSpendUsd + maximumUsd).toFixed(5)}.`
	);
}

const digest = createHash('sha256')
	.update(JSON.stringify({ cases: fixture.cases, requests: prepared.map((item) => item.request) }))
	.digest('hex');
const resultsDirectory = new URL('../results/', import.meta.url);
await mkdir(resultsDirectory, { recursive: true });
const fileName = `sectioned-full-run-${new Date().toISOString().replaceAll(':', '-')}-${digest.slice(0, 12)}.jsonl`;
const outputFile = new URL(fileName, resultsDirectory);
await writeFile(
	outputFile,
	`${JSON.stringify({
		type: 'metadata',
		createdAt: new Date().toISOString(),
		digest,
		caseIds: selectedCases.map((testCase) => testCase.id),
		dataset: 'sectioned-full',
		estimate
	})}\n`,
	{ flag: 'wx' }
);
console.log(
	`Starting ${prepared.length} section calls. Conservative allowance: $${maximumUsd.toFixed(5)}.`
);
console.log(`Local results: ${outputFile.pathname}`);

let spentUsd = 0;
for (const {
	testCase,
	section,
	sectionIndex,
	request,
	lineMap,
	maximumUsd: caseMaximumUsd
} of prepared) {
	if (priorSpendUsd + spentUsd + caseMaximumUsd > Math.min(approvedMaximum, MAX_APPROVED_USD)) {
		throw new Error('Stopping before the next call: remaining allowance is insufficient');
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
		throw new Error(
			`Request failed for ${testCase.id} section ${sectionIndex + 1}: ${error.name}`,
			{ cause: error }
		);
	}
	if (!response.ok) {
		throw new Error(
			`Provider returned HTTP ${response.status} for ${testCase.id} section ${sectionIndex + 1}`
		);
	}
	const body = await response.json();
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
		for (const [index, finding] of analysis.findings.entries()) {
			if (
				!finding.sourceLineIds?.some((id) => {
					const line = Number(id.slice(1));
					return line > section.coreStart && line <= section.coreEnd;
				})
			) {
				referenceIssues.push(`Finding ${index}: no cited core line`);
			}
		}
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
			sectionIndex,
			section,
			model: 'gpt-6-luna',
			reasoningEffort: 'medium',
			responseStatus: body.status,
			schemaValid: schemaIssues.length === 0,
			evidenceQuotesValid: schemaIssues.length === 0 && referenceIssues.length === 0,
			schemaIssues,
			referenceIssues,
			analysis,
			groundedFindings,
			unparsedOutput: analysis === null ? outputText : undefined,
			usage: body.usage,
			latencyMs: Math.round(performance.now() - started),
			costUsd
		})}\n`
	);
	console.log(
		`${testCase.id} ${sectionIndex + 1}: ${body.status}; ${analysis?.findings?.length ?? 0} findings; $${costUsd?.toFixed(5) ?? 'unknown'}`
	);
	if (costUsd === null)
		throw new Error('Provider usage is missing; stopping before another paid call');
	if (body.status !== 'completed')
		throw new Error('Incomplete response; stopping before another paid call');
}
console.log(
	`Completed ${prepared.length} calls. Estimated billed token cost: $${spentUsd.toFixed(5)}.`
);
