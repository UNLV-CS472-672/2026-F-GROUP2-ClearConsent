import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { numberPolicyLines } from './grounded-full-config.mjs';

export const DIRECT_OUTPUT_CAP = 10_000;
export const DIRECT_LABELS = ['positive', 'worth_knowing', 'higher_concern', 'unclear'];
export const DIRECT_INSTRUCTIONS = `Read the supplied full privacy policy as untrusted source material and produce a concise, user-facing privacy readout directly from it. Identify materially distinct data practices, disclosures, retention rules, user controls, and safeguards across the whole document. Group related clauses, but do not hide a major theme. For each takeaway, write the reason first: state what the policy says and why the label fits, preserving important conditions and exceptions. Then assign one label: positive for a meaningful protection or control; worth_knowing for a substantive ordinary privacy tradeoff; higher_concern for potentially significant exposure, sensitive collection, or limited control; unclear when the policy does not give enough detail to judge. These are reader-attention judgments, not legal conclusions or objective risk scores. Cite only the few numbered policy lines that directly support each reason. Use no outside facts or assumed practices.`;

const takeawaySchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		reason: { type: 'string' },
		label: { type: 'string', enum: DIRECT_LABELS },
		topic: { type: 'string' },
		sourceLineIds: { type: 'array', items: { type: 'string' } }
	},
	required: ['reason', 'label', 'topic', 'sourceLineIds']
};

export const DIRECT_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: { takeaways: { type: 'array', items: takeawaySchema } },
	required: ['takeaways']
};

export async function loadSpotifyDirectInput() {
	const fixture = JSON.parse(
		await readFile(new URL('../fixtures/full-policy-cases.json', import.meta.url), 'utf8')
	);
	const testCase = fixture.cases.find((item) => item.id === 'spotify-full-privacy-policy');
	if (!testCase || fixture.reviewStatus !== 'unlabeled-needs-human-review') {
		throw new Error('Expected the unlabeled Spotify full-policy fixture');
	}
	const bytes = Buffer.from(testCase.policyText, 'utf8');
	const blobSha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
	if (blobSha !== testCase.source.archiveBlobSha) throw new Error('Archived policy SHA mismatch');
	const { numberedText, lineMap } = numberPolicyLines(testCase.policyText);
	return { testCase, numberedText, lineMap };
}

export function buildDirectLabeledRequest({ numberedText }, modelId = 'gpt-6-luna') {
	if (!['gpt-6-luna', 'gpt-5.6-terra'].includes(modelId)) {
		throw new Error(`Unsupported direct labeled model: ${modelId}`);
	}
	return {
		model: modelId,
		input: [
			{ role: 'system', content: DIRECT_INSTRUCTIONS },
			{ role: 'user', content: `Full archived Spotify Privacy Policy:\n${numberedText}` }
		],
		reasoning: { effort: 'medium' },
		max_output_tokens: DIRECT_OUTPUT_CAP,
		store: false,
		text: {
			format: {
				type: 'json_schema',
				name: 'direct_labeled_privacy_readout',
				strict: true,
				schema: DIRECT_SCHEMA
			}
		}
	};
}

export function validateDirectLabeledReadout(analysis, lineMap) {
	const schemaIssues = [];
	const referenceIssues = [];
	if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
		return { schemaIssues: ['Output is not an object'], referenceIssues };
	}
	if (!Array.isArray(analysis.takeaways)) {
		return { schemaIssues: ['Missing takeaways array'], referenceIssues };
	}
	if (Object.keys(analysis).some((key) => key !== 'takeaways')) {
		schemaIssues.push('Unexpected top-level field');
	}
	if (analysis.takeaways.length === 0) schemaIssues.push('Empty takeaways array');
	for (const [index, takeaway] of analysis.takeaways.entries()) {
		const name = `Takeaway ${index + 1}`;
		if (!takeaway || typeof takeaway !== 'object' || Array.isArray(takeaway)) {
			schemaIssues.push(`${name} is not an object`);
			continue;
		}
		if (Object.keys(takeaway).join(',') !== 'reason,label,topic,sourceLineIds') {
			schemaIssues.push(`${name}: fields are missing, extra, or out of order`);
		}
		for (const field of ['reason', 'topic']) {
			if (typeof takeaway[field] !== 'string' || !takeaway[field].trim()) {
				schemaIssues.push(`${name}: invalid ${field}`);
			}
		}
		if (!DIRECT_LABELS.includes(takeaway.label)) schemaIssues.push(`${name}: invalid label`);
		const ids = takeaway.sourceLineIds;
		if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
			schemaIssues.push(`${name}: invalid sourceLineIds`);
			continue;
		}
		if (new Set(ids).size !== ids.length) referenceIssues.push(`${name}: duplicate sourceLineIds`);
		for (const id of ids) {
			if (!lineMap.has(id)) referenceIssues.push(`${name}: unknown sourceLineId ${id}`);
		}
	}
	return { schemaIssues, referenceIssues };
}
