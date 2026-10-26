// Shared synthetic fixtures for Stage 2 tests. Not imported by production code.
import { vi } from 'vitest';
import type { Stage1Provider } from '../provider';
import { runStage1Analysis } from '../pipeline';
import type { Stage1Result } from '../schemas';
import type { ConsolidationProvider } from './provider';
import type { ModelFinding } from './schemas';

// The issue #12 fitness example, written as one synthetic policy.
export const FITNESS_POLICY = [
	'We share card numbers with our payment processor to complete purchases.',
	'We share your location with advertising partners only if you turn on personalized ads.',
	'You cannot delete your workout history.',
	'We encrypt your data in transit.',
	'We keep your messages as long as necessary.',
	'We collect your email address to create your account.',
	'Advertising partners get your location only when personalized ads are on.'
].join('\n');

export function sentence(index: number): string {
	return FITNESS_POLICY.split('\n')[index];
}

export function stage1Candidate(
	claim: string,
	excerpts: string[],
	overrides: Record<string, unknown> = {}
) {
	return {
		category: 'privacy',
		practice: 'practice',
		claim,
		explanation: 'The excerpt states it.',
		qualifiers: [],
		uncertainty: null,
		dataCategories: [],
		purposes: [],
		recipients: [],
		evidence: excerpts.map((excerpt) => ({ passageId: 'P001', excerpt })),
		...overrides
	};
}

// Seven candidates, C001-C007, one per sentence. C007 repeats C002.
export function fitnessCandidates() {
	return [0, 1, 2, 3, 4, 5, 6].map((index) => stage1Candidate(sentence(index), [sentence(index)]));
}

export async function extractionResult(
	candidates: unknown[],
	preferences?: Record<string, unknown>,
	text = FITNESS_POLICY
): Promise<Stage1Result> {
	const provider: Stage1Provider = {
		extract: vi.fn().mockResolvedValue({
			output: { candidates },
			model: 'mock-model',
			reasoningEffort: 'medium',
			attempts: 1,
			usage: null
		})
	};
	return runStage1Analysis({ text, ...(preferences && { preferences }) }, provider);
}

export function modelFinding(overrides: Partial<ModelFinding> = {}): ModelFinding {
	return {
		candidateIds: ['C001'],
		category: 'sharing',
		description: 'Card numbers are shared with a payment processor to complete purchases.',
		effect: 'exposes',
		conditional: false,
		conditionNote: null,
		ambiguous: false,
		uncertaintyNote: null,
		dataCategories: ['card numbers'],
		purposes: ['complete purchases'],
		recipients: ['payment processor'],
		purposeTypes: ['service'],
		recipientTypes: ['service_provider'],
		relevantPreferences: [],
		...overrides
	};
}

// A correct consolidation of fitnessCandidates(): six findings, C002 and C007 merged.
export function fitnessFindings(): ModelFinding[] {
	return [
		modelFinding(),
		modelFinding({
			candidateIds: ['C002', 'C007'],
			description: 'Location is shared with advertising partners only if personalized ads are on.',
			conditional: true,
			conditionNote: 'Only when personalized ads are turned on.',
			dataCategories: ['location'],
			purposes: ['personalized ads'],
			recipients: ['advertising partners'],
			purposeTypes: ['advertising'],
			recipientTypes: ['advertiser']
		}),
		modelFinding({
			candidateIds: ['C003'],
			category: 'user_rights',
			description: 'You cannot delete your workout history.',
			dataCategories: ['workout history'],
			purposes: [],
			recipients: [],
			purposeTypes: [],
			recipientTypes: []
		}),
		modelFinding({
			candidateIds: ['C004'],
			category: 'security_practices',
			description: 'Data is encrypted in transit.',
			effect: 'protects',
			dataCategories: [],
			purposes: [],
			recipients: [],
			purposeTypes: [],
			recipientTypes: []
		}),
		modelFinding({
			candidateIds: ['C005'],
			category: 'retention',
			description: 'Messages are kept as long as necessary.',
			ambiguous: true,
			uncertaintyNote: 'No period is given; "as long as necessary" is undefined.',
			dataCategories: ['messages'],
			purposes: [],
			recipients: [],
			purposeTypes: [],
			recipientTypes: []
		}),
		modelFinding({
			candidateIds: ['C006'],
			category: 'collection',
			description: 'Your email address is collected to create your account.',
			dataCategories: ['email address'],
			purposes: ['create your account'],
			recipients: [],
			purposeTypes: ['service'],
			recipientTypes: []
		})
	];
}

export function consolidationProviderWith(output: unknown): ConsolidationProvider {
	return {
		consolidate: vi.fn().mockResolvedValue({
			output,
			model: 'mock-model',
			reasoningEffort: 'medium',
			attempts: 1,
			usage: { inputTokens: 10, outputTokens: 5, reasoningTokens: 0, totalTokens: 15 }
		})
	};
}

export const SUMMARY =
	'The policy shares data with a payment processor and, if enabled, ad partners.';
