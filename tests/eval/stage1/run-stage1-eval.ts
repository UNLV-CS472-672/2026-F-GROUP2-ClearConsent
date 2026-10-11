// Runs the real Stage 1 pipeline over the issue #11 fixtures. See README.md in this directory.
import { execSync } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isStage1Error } from '../../../src/lib/server/analysis/errors';
import {
	createOpenAIStage1Provider,
	DEFAULT_OPENAI_MODEL,
	DEFAULT_REASONING_EFFORT,
	OPENAI_MAX_OUTPUT_TOKENS,
	OPENAI_TIMEOUT_MS
} from '../../../src/lib/server/analysis/openai-provider';
import type { ReasoningEffort } from '../../../src/lib/server/analysis/openai-provider';
import { runStage1Analysis } from '../../../src/lib/server/analysis/pipeline';
import type { Stage1Provider } from '../../../src/lib/server/analysis/provider';
import { createSourceSnapshot } from '../../../src/lib/server/analysis/source';
import {
	LUNA,
	createMockProvider,
	estimateCaseMaximumUsd,
	loadStage1Cases,
	usageCostUsd
} from './eval-config';
import type { Stage1EvalCase } from './eval-config';
import { formatReview } from './review';
import { formatReport, scoreCase, upgradeRecord } from './score';
import type { Stage1EvalRecord } from './score';

const RESULTS = path.resolve('tests/eval/stage1/results');
const REPORTS = path.resolve('tests/eval/stage1/reports');
const args = process.argv.slice(2);
const mode = args.includes('--run')
	? 'run'
	: args.includes('--mock')
		? 'mock'
		: args.includes('--score')
			? 'score'
			: args.includes('--review')
				? 'review'
				: args.includes('--replay')
					? 'replay'
					: 'estimate';
// Round cost ceilings up so a displayed maximum is always enough to approve the run.
const roundUp = (usd: number, places: number) => Math.ceil(usd * 10 ** places) / 10 ** places;
const selectedIds = args.flatMap((arg, index) => (arg === '--case' ? [args[index + 1]] : []));

function currentCommit(): string {
	const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
	const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== '';
	return dirty ? `${sha}+uncommitted` : sha;
}

async function selectedCases(): Promise<Stage1EvalCase[]> {
	const cases = await loadStage1Cases();
	if (selectedIds.length === 0) return cases;
	const unknown = selectedIds.filter((id) => !cases.some((testCase) => testCase.id === id));
	if (unknown.length) throw new Error(`Unknown case ID: ${unknown.join(', ')}`);
	return cases.filter((testCase) => selectedIds.includes(testCase.id));
}

async function estimate(cases: Stage1EvalCase[]) {
	const perCase = await Promise.all(
		cases.map(async (testCase) => ({
			id: testCase.id,
			characters: testCase.policyText.length,
			maximumUsd: await estimateCaseMaximumUsd(testCase)
		}))
	);
	return { perCase, maximumUsd: perCase.reduce((sum, item) => sum + item.maximumUsd, 0) };
}

async function runCases(
	cases: Stage1EvalCase[],
	provider: Stage1Provider,
	settings: { mode: 'run' | 'mock'; model: string; reasoningEffort: string }
): Promise<Stage1EvalRecord[]> {
	const file = path.join(
		RESULTS,
		`${settings.mode}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`
	);
	const commit = currentCommit();
	const records: Stage1EvalRecord[] = [];

	// Sequential on purpose: one paid call at a time, each saved before the next starts.
	for (const testCase of cases) {
		const snapshot = await createSourceSnapshot(testCase.policyText, { title: testCase.title });
		const startedAt = new Date().toISOString();
		const started = performance.now();
		const base = {
			caseId: testCase.id,
			group: testCase.group,
			mode: settings.mode,
			commit,
			model: settings.model,
			reasoningEffort: settings.reasoningEffort,
			timeoutMs: OPENAI_TIMEOUT_MS,
			maxOutputTokens: OPENAI_MAX_OUTPUT_TOKENS,
			startedAt,
			sourceLength: testCase.policyText.length,
			passageCount: snapshot.passages.length
		};

		let rawOutput: unknown = null;
		const capturing: Stage1Provider = {
			async extract(source) {
				const extraction = await provider.extract(source);
				rawOutput = extraction.output;
				return extraction;
			}
		};

		let record: Stage1EvalRecord;
		try {
			const result = await runStage1Analysis(
				{ text: testCase.policyText, title: testCase.title },
				capturing
			);
			record = {
				...base,
				model: result.provider.model,
				durationMs: Math.round(performance.now() - started),
				outcome: result.stageStatus,
				errorCode: null,
				errorMessage: null,
				candidates: result.candidates,
				rawOutput,
				rejectedCandidates: result.rejectedCandidates,
				usage: result.provider.usage,
				estimatedCostUsd: usageCostUsd(result.provider.usage)
			};
		} catch (error) {
			// Failures are part of what this eval measures, so record them and continue.
			// Usage is unavailable for failed calls; a timed-out call may still be billed.
			record = {
				...base,
				durationMs: Math.round(performance.now() - started),
				outcome: 'failed',
				errorCode: isStage1Error(error) ? error.code : 'unexpected_error',
				errorMessage: error instanceof Error ? error.message : String(error),
				candidates: [],
				rawOutput,
				rejectedCandidates: [],
				usage: null,
				estimatedCostUsd: 0
			};
		}

		await appendFile(file, JSON.stringify(record) + '\n');
		records.push(record);
		console.log(
			`${testCase.id}: ${record.errorCode ?? record.outcome} in ${(record.durationMs / 1000).toFixed(1)}s`
		);
	}

	console.log(`\nSaved ${path.relative(process.cwd(), file)}\n`);
	await writeReview(records, cases, [path.relative(process.cwd(), file)]);
	return records;
}

// Writes the Markdown review that people read and score by hand.
async function writeReview(
	records: Stage1EvalRecord[],
	cases: Stage1EvalCase[],
	sources: string[]
) {
	await mkdir(REPORTS, { recursive: true });
	const stamp = path.basename(sources.at(-1)!, '.jsonl');
	const file = path.join(REPORTS, `review-${stamp}.md`);
	await writeFile(file, formatReview(records, cases, sources) + '\n');
	console.log(`Review: ${path.relative(process.cwd(), file)}\n`);
}

async function readRecords(file: string): Promise<Stage1EvalRecord[]> {
	return (await readFile(file, 'utf8'))
		.split('\n')
		.filter(Boolean)
		.map((line) => upgradeRecord(JSON.parse(line) as Stage1EvalRecord));
}

// Combines result files in case order; a later file's record replaces an earlier one for the same case.
async function readMergedRecords(files: string[], cases: Stage1EvalCase[]) {
	const byCase = new Map<string, Stage1EvalRecord>();
	for (const file of files) {
		for (const record of await readRecords(file)) byCase.set(record.caseId, record);
	}
	const order = new Map(cases.map((testCase, index) => [testCase.id, index]));
	return [...byCase.values()].sort(
		(a, b) => (order.get(a.caseId) ?? 0) - (order.get(b.caseId) ?? 0)
	);
}

const fileArgs = (flag: string) =>
	args.slice(args.indexOf(flag) + 1).filter((arg) => !arg.startsWith('--'));

// Re-validates saved provider output with the current pipeline code. No provider calls, so it
// shows for free what a verification change would have done to a past paid run. Records without
// saved output (timeouts), or whose case text has changed since, are kept unchanged.
async function replay(
	records: Stage1EvalRecord[],
	cases: Stage1EvalCase[]
): Promise<Stage1EvalRecord[]> {
	const byId = new Map(cases.map((testCase) => [testCase.id, testCase]));
	const commit = currentCommit();
	const replayed: Stage1EvalRecord[] = [];
	for (const record of records) {
		const testCase = byId.get(record.caseId);
		if (
			record.rawOutput === null ||
			!testCase ||
			testCase.policyText.length !== record.sourceLength
		) {
			console.log(`${record.caseId}: kept as recorded (nothing to replay)`);
			replayed.push(record);
			continue;
		}
		const saved: Stage1Provider = {
			async extract() {
				return {
					output: record.rawOutput,
					model: record.model,
					reasoningEffort: record.reasoningEffort,
					attempts: 1,
					usage: record.usage
				};
			}
		};
		const base = { ...record, commit, replayedFrom: record.replayedFrom ?? record.commit };
		try {
			const result = await runStage1Analysis(
				{ text: testCase.policyText, title: testCase.title },
				saved
			);
			replayed.push({
				...base,
				outcome: result.stageStatus,
				errorCode: null,
				errorMessage: null,
				candidates: result.candidates,
				rejectedCandidates: result.rejectedCandidates
			});
		} catch (error) {
			replayed.push({
				...base,
				outcome: 'failed',
				errorCode: isStage1Error(error) ? error.code : 'unexpected_error',
				errorMessage: error instanceof Error ? error.message : String(error),
				candidates: [],
				rejectedCandidates: []
			});
		}
		console.log(`${record.caseId}: ${replayed.at(-1)!.errorCode ?? replayed.at(-1)!.outcome}`);
	}
	return replayed;
}

function report(records: Stage1EvalRecord[], cases: Stage1EvalCase[]) {
	const byId = new Map(cases.map((testCase) => [testCase.id, testCase]));
	console.log(formatReport(records.map((record) => scoreCase(record, byId.get(record.caseId)))));
}

if (mode === 'score') {
	const file = args[args.indexOf('--score') + 1];
	if (!file) throw new Error('Usage: --score <results.jsonl>');
	report(await readRecords(file), await loadStage1Cases());
} else if (mode === 'review') {
	const files = fileArgs('--review');
	if (files.length === 0) throw new Error('Usage: --review <results.jsonl> [more.jsonl ...]');
	const cases = await loadStage1Cases();
	const records = await readMergedRecords(files, cases);
	report(records, cases);
	await writeReview(
		records,
		cases,
		files.map((file) => path.relative(process.cwd(), path.resolve(file)))
	);
} else if (mode === 'replay') {
	const files = fileArgs('--replay');
	if (files.length === 0) throw new Error('Usage: --replay <results.jsonl> [more.jsonl ...]');
	const cases = await loadStage1Cases();
	const records = await replay(await readMergedRecords(files, cases), cases);
	const file = path.join(RESULTS, `replay-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
	await writeFile(file, records.map((record) => JSON.stringify(record)).join('\n') + '\n');
	console.log(`\nSaved ${path.relative(process.cwd(), file)}\n`);
	report(records, cases);
	await writeReview(records, cases, [path.relative(process.cwd(), file)]);
} else {
	const cases = await selectedCases();
	const plan = await estimate(cases);

	if (mode === 'estimate') {
		console.log(
			JSON.stringify(
				{
					cases: cases.length,
					calls: cases.length,
					model: DEFAULT_OPENAI_MODEL,
					reasoningEffort: DEFAULT_REASONING_EFFORT,
					timeoutMs: OPENAI_TIMEOUT_MS,
					maxOutputTokensPerCall: OPENAI_MAX_OUTPUT_TOKENS,
					perCase: plan.perCase.map((item) => ({
						...item,
						maximumUsd: roundUp(item.maximumUsd, 5)
					})),
					maximumUsd: roundUp(plan.maximumUsd, 4)
				},
				null,
				2
			)
		);
	} else if (mode === 'mock') {
		const records = await runCases(cases, createMockProvider(cases), {
			mode: 'mock',
			model: 'mock-provider',
			reasoningEffort: 'none'
		});
		report(records, cases);
	} else {
		if (process.env.RUN_MODEL_EVALS !== '1') {
			throw new Error('Paid evaluation disabled. Set RUN_MODEL_EVALS=1 explicitly.');
		}
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) throw new Error('OPENAI_API_KEY is required for --run.');
		const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
		if (model !== LUNA.id) {
			throw new Error(`The cost ceiling is priced for ${LUNA.id}; refusing to run ${model}.`);
		}
		const approved = Number(process.env.EVAL_APPROVED_MAX_USD);
		if (!Number.isFinite(approved) || approved < roundUp(plan.maximumUsd, 4)) {
			throw new Error(
				`EVAL_APPROVED_MAX_USD must be at least $${roundUp(plan.maximumUsd, 4)} before paid calls.`
			);
		}
		const reasoningEffort = (process.env.OPENAI_REASONING_EFFORT?.trim() ||
			DEFAULT_REASONING_EFFORT) as ReasoningEffort;
		const provider = createOpenAIStage1Provider({ apiKey, model, reasoningEffort });
		const records = await runCases(cases, provider, { mode: 'run', model, reasoningEffort });
		report(records, cases);
	}
}
