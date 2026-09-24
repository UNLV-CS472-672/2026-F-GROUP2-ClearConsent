import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import {
	MODELS,
	REASONING_EFFORTS,
	REPEATS,
	REQUEST_TIMEOUT_MS,
	INSTRUCTIONS,
	RESPONSE_SCHEMA,
	actualCostUsd,
	buildRequest,
	estimateMaximumCost,
	extractOutputText,
	loadCases,
	validateAnalysis
} from './eval-config.mjs';

const { values } = parseArgs({
	options: {
		estimate: { type: 'boolean' },
		run: { type: 'boolean' },
		model: { type: 'string' },
		effort: { type: 'string' },
		repeats: { type: 'string' }
	}
});
if (Boolean(values.estimate) === Boolean(values.run)) {
	throw new Error('Specify exactly one of --estimate or --run.');
}
const models = values.model ? MODELS.filter((model) => model.id === values.model) : MODELS;
if (models.length === 0) throw new Error(`Unknown model: ${values.model}`);
const reasoningEfforts = values.effort ? [values.effort] : REASONING_EFFORTS;
if (reasoningEfforts.some((effort) => !REASONING_EFFORTS.includes(effort))) {
	throw new Error(`Unsupported reasoning effort: ${values.effort}`);
}
const repeats = values.repeats === undefined ? REPEATS : Number(values.repeats);
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5) {
	throw new Error('--repeats must be an integer from 1 to 5.');
}

const cases = await loadCases();
const estimate = estimateMaximumCost(cases, { models, reasoningEfforts, repeats });

if (values.estimate) {
	console.log(JSON.stringify(estimate, null, 2));
	process.exit(0);
}

if (process.env.RUN_MODEL_EVALS !== '1') {
	throw new Error('Paid evaluation disabled. Set RUN_MODEL_EVALS=1 explicitly.');
}
if (!process.env.OPENAI_API_KEY) {
	throw new Error('OPENAI_API_KEY is missing.');
}
const approvedMaximum = Number(process.env.EVAL_APPROVED_MAX_USD);
if (!Number.isFinite(approvedMaximum) || approvedMaximum < estimate.maximumUsd) {
	throw new Error(
		`EVAL_APPROVED_MAX_USD must be at least $${estimate.maximumUsd.toFixed(2)} before paid calls.`
	);
}

const digest = createHash('sha256')
	.update(
		JSON.stringify({ cases, INSTRUCTIONS, RESPONSE_SCHEMA, models, reasoningEfforts, repeats })
	)
	.digest('hex');
const resultsDirectory = new URL('../results/', import.meta.url);
await mkdir(resultsDirectory, { recursive: true });
const fileName = `run-${new Date().toISOString().replaceAll(':', '-')}-${digest.slice(0, 12)}.jsonl`;
const outputFile = new URL(fileName, resultsDirectory);
await writeFile(
	outputFile,
	`${JSON.stringify({
		type: 'metadata',
		createdAt: new Date().toISOString(),
		digest,
		caseIds: cases.map((testCase) => testCase.id),
		models: models.map((model) => model.id),
		reasoningEfforts,
		repeats,
		estimate
	})}\n`,
	{ flag: 'wx' }
);

console.log(
	`Starting ${estimate.calls} calls. Maximum estimated cost: $${estimate.maximumUsd.toFixed(2)}.`
);
console.log(`Local results: ${outputFile.pathname}`);

let spentUsd = 0;
for (const testCase of cases) {
	for (const model of models) {
		for (const effort of reasoningEfforts) {
			for (let repeat = 1; repeat <= repeats; repeat++) {
				const request = buildRequest(testCase, model.id, effort);
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
						signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
					});
				} catch (error) {
					throw new Error(
						`Request failed for ${testCase.id}/${model.id}/${effort}/${repeat}: ${error.name}`,
						{ cause: error }
					);
				}
				if (!response.ok) {
					throw new Error(
						`Provider returned HTTP ${response.status} for ${testCase.id}/${model.id}/${effort}/${repeat}`
					);
				}
				const body = await response.json();
				const latencyMs = Math.round(performance.now() - started);
				const outputText = extractOutputText(body);
				let analysis = null;
				let schemaIssues = [];
				let evidenceIssues = [];
				if (body.status !== 'completed') schemaIssues.push(`Response status: ${body.status}`);
				try {
					analysis = JSON.parse(outputText);
					const validation = validateAnalysis(analysis, testCase.policyText);
					schemaIssues = schemaIssues.concat(validation.schemaIssues);
					evidenceIssues = validation.evidenceIssues;
				} catch {
					schemaIssues.push('No parseable JSON output');
				}
				const costUsd = actualCostUsd(model, body.usage);
				spentUsd += costUsd;
				const record = {
					type: 'result',
					caseId: testCase.id,
					caseKind: testCase.source ? 'archived' : 'synthetic',
					model: model.id,
					reasoningEffort: effort,
					repeat,
					responseStatus: body.status,
					schemaValid: schemaIssues.length === 0,
					evidenceQuotesValid: schemaIssues.length === 0 && evidenceIssues.length === 0,
					schemaIssues,
					evidenceIssues,
					analysis,
					unparsedOutput: analysis === null ? outputText : undefined,
					usage: body.usage,
					latencyMs,
					costUsd
				};
				await appendFile(outputFile, `${JSON.stringify(record)}\n`);
				console.log(
					`${testCase.id} ${model.id} ${effort} #${repeat}: ${schemaIssues.length || evidenceIssues.length ? 'review' : 'valid'}`
				);
			}
		}
	}
}
console.log(
	`Completed ${estimate.calls} calls. Estimated billed token cost: $${spentUsd.toFixed(4)}.`
);
