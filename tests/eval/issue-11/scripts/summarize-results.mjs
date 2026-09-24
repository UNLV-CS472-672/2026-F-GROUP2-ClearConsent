import { readFile } from 'node:fs/promises';
import { MODELS, actualCostUsd } from './eval-config.mjs';

if (process.argv.length !== 3) {
	console.error(
		'Usage: node tests/eval/issue-11/scripts/summarize-results.mjs tests/eval/issue-11/results/run-....jsonl'
	);
	process.exit(2);
}

const lines = (await readFile(process.argv[2], 'utf8')).trim().split('\n');
const records = lines.map((line) => JSON.parse(line));
if (records[0]?.type !== 'metadata') throw new Error('First line must contain run metadata');
const results = records.filter((record) => record.type === 'result');
const groups = new Map();

function signature(analysis) {
	if (!analysis?.findings) return null;
	return JSON.stringify(
		analysis.findings
			.map((finding) => ({
				practice: finding.practice,
				dataCategories: [...finding.dataCategories].sort(),
				purposes: [...finding.purposes].sort(),
				recipients: [...finding.recipients].sort(),
				evidence: finding.evidence,
				ambiguous: finding.ambiguous,
				negated: finding.negated
			}))
			.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
	);
}

for (const record of results) {
	const key = `${record.model}/${record.reasoningEffort}/${record.caseKind}`;
	if (!groups.has(key)) groups.set(key, []);
	groups.get(key).push(record);
}

const summary = [...groups.entries()].map(([configuration, rows]) => {
	const byCase = new Map();
	for (const row of rows) {
		if (!byCase.has(row.caseId)) byCase.set(row.caseId, []);
		byCase.get(row.caseId).push(row);
	}
	let matchingRepeatCases = 0;
	for (const repeats of byCase.values()) {
		if (
			repeats.length === records[0].repeats &&
			repeats.every((row) => row.schemaValid) &&
			repeats.every((row) => signature(row.analysis) === signature(repeats[0].analysis))
		) {
			matchingRepeatCases++;
		}
	}
	const sum = (getValue) => rows.reduce((total, row) => total + getValue(row), 0);
	return {
		configuration,
		responses: rows.length,
		schemaSuccessRate: sum((row) => Number(row.schemaValid)) / rows.length,
		evidenceMetric:
			records[0].dataset === 'grounded-full' ? 'source_line_id_resolution' : 'exact_quote',
		exactEvidenceRate: sum((row) => Number(row.evidenceQuotesValid)) / rows.length,
		meanLatencyMs: sum((row) => row.latencyMs) / rows.length,
		inputTokens: sum((row) => row.usage?.input_tokens ?? 0),
		outputTokens: sum((row) => row.usage?.output_tokens ?? 0),
		reasoningTokens: sum((row) => row.usage?.output_tokens_details?.reasoning_tokens ?? 0),
		costUsd: sum((row) => {
			const model = MODELS.find((candidate) => candidate.id === row.model);
			return model && row.usage ? actualCostUsd(model, row.usage) : (row.costUsd ?? 0);
		}),
		exactRepeatAgreement: records[0].repeats > 1 ? `${matchingRepeatCases}/${byCase.size}` : null
	};
});

console.log(
	JSON.stringify({ metadata: records[0], completedResponses: results.length, summary }, null, 2)
);
