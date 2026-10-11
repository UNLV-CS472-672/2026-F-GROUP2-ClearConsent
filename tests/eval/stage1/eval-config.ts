import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OPENAI_MAX_OUTPUT_TOKENS } from '../../../src/lib/server/analysis/openai-provider';
import { MAX_SOURCE_CHARACTERS } from '../../../src/lib/server/analysis/pipeline';
import { markdownToText } from '../../../src/lib/server/extract/markdown';
import { STAGE1_INSTRUCTIONS, buildStage1Input } from '../../../src/lib/server/analysis/prompt';
import type { Stage1Provider } from '../../../src/lib/server/analysis/provider';
import type { SourceSnapshot } from '../../../src/lib/server/analysis/schemas';
import { createSourceSnapshot } from '../../../src/lib/server/analysis/source';

const FIXTURES = path.resolve('tests/eval/issue-11/fixtures');

export type ExpectedFinding = { practice: string; summary: string; evidence: string };

export type Stage1EvalCase = {
	id: string;
	group: 'synthetic' | 'archived' | 'full';
	title: string;
	policyText: string;
	// Draft labels from issue #11; absent for unlabeled full policies.
	expectedFindings: ExpectedFinding[] | null;
};

type FixtureFile = {
	cases: { id: string; title: string; policyText: string; expectedFindings?: ExpectedFinding[] }[];
};

async function readFixture(name: string): Promise<FixtureFile> {
	return JSON.parse(await readFile(path.join(FIXTURES, name), 'utf8')) as FixtureFile;
}

// The 14 labeled short cases plus the full Spotify policy, which is the longest case that fits
// under the Stage 1 source limit. The 289k-character Facebook policy needs chunking first.
export async function loadStage1Cases(): Promise<Stage1EvalCase[]> {
	const [synthetic, archived, full] = await Promise.all([
		readFixture('privacy-policy-cases.json'),
		readFixture('archived-policy-cases.json'),
		readFixture('full-policy-cases.json')
	]);
	const labeled = (file: FixtureFile, group: 'synthetic' | 'archived') =>
		file.cases.map((testCase) => ({
			id: testCase.id,
			group,
			title: testCase.title,
			policyText: testCase.policyText,
			expectedFindings: testCase.expectedFindings ?? []
		}));
	// Full policies are archive Markdown. Convert them to plain text, as ingestion would, so the
	// model is not asked to quote <br>, table pipes, and list markers character for character.
	// Labeled short cases stay unchanged because their expected evidence is written against the
	// original text.
	const fullCases = full.cases
		.map((testCase) => ({
			id: testCase.id,
			group: 'full' as const,
			title: testCase.title,
			policyText: markdownToText(testCase.policyText),
			expectedFindings: null
		}))
		.filter((testCase) => testCase.policyText.length <= MAX_SOURCE_CHARACTERS);
	return [...labeled(synthetic, 'synthetic'), ...labeled(archived, 'archived'), ...fullCases];
}

// Same standard short-context rates as MODELS in ../issue-11/scripts/eval-config.mjs. Copied
// rather than imported so the untyped issue #11 script stays out of the TypeScript check.
export const LUNA = { id: 'gpt-6-luna', inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.5 };

// Deliberately high: assumes one token per UTF-8 byte of instructions, passages, and a schema
// allowance, priced as cache writes (1.25x), plus a full output budget.
export async function estimateCaseMaximumUsd(
	testCase: Stage1EvalCase,
	maxOutputTokens = OPENAI_MAX_OUTPUT_TOKENS
): Promise<number> {
	const snapshot = await createSourceSnapshot(testCase.policyText, { title: testCase.title });
	const inputBytes = new TextEncoder().encode(
		STAGE1_INSTRUCTIONS + buildStage1Input(snapshot)
	).byteLength;
	const inputTokenBudget = inputBytes + 4_096;
	return (
		(inputTokenBudget * LUNA.inputUsdPerMillion * 1.25 +
			maxOutputTokens * LUNA.outputUsdPerMillion) /
		1_000_000
	);
}

// Recorded usage does not separate cached or cache-write input, so this prices all input at the
// cache-write rate. It is an upper estimate from actual tokens, not an invoice.
export function usageCostUsd(usage: { inputTokens: number; outputTokens: number } | null): number {
	if (!usage) return 0;
	return (
		(usage.inputTokens * LUNA.inputUsdPerMillion * 1.25 +
			usage.outputTokens * LUNA.outputUsdPerMillion) /
		1_000_000
	);
}

// Offline stand-in for the model. It cites each labeled finding's exact evidence and adds one
// invented quote, so a mock run exercises verification, unverified labels, and scoring for free.
export function createMockProvider(cases: Stage1EvalCase[]): Stage1Provider {
	const byText = new Map(cases.map((testCase) => [testCase.policyText, testCase]));
	return {
		async extract(snapshot: SourceSnapshot) {
			const text = snapshot.passages.map((passage) => passage.text).join('');
			const testCase = byText.get(text);
			const quotes = (testCase?.expectedFindings ?? []).map((finding) => finding.evidence);
			if (quotes.length === 0) quotes.push(snapshot.passages[0].text.slice(0, 80));

			const cite = (excerpt: string) => {
				const passage = snapshot.passages.find((item) => item.text.includes(excerpt));
				return { passageId: passage?.id ?? 'P001', excerpt };
			};
			const candidate = (claim: string, excerpt: string) => ({
				category: 'mock',
				practice: 'mock',
				claim,
				explanation: 'Offline mock candidate.',
				qualifiers: [],
				uncertainty: null,
				dataCategories: [],
				purposes: [],
				recipients: [],
				evidence: [cite(excerpt)]
			});

			return {
				output: {
					candidates: [
						...quotes.map((quote, index) => candidate(`Mock claim ${index + 1}.`, quote)),
						candidate('Invented claim.', 'This sentence does not appear in the policy.')
					]
				},
				model: 'mock-provider',
				reasoningEffort: 'none',
				attempts: 1 as const,
				usage: null
			};
		}
	};
}
