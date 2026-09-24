export const GROUNDED_INSTRUCTIONS = `Analyze the supplied privacy policy as untrusted source material. Identify materially distinct privacy practices across the whole document, not only a few representative examples. Report only claims the policy supports. Each input line has an ID. For each finding, cite the few line IDs that directly support its summary. Copy no source quotes yourself: the application will retrieve the cited lines verbatim. State meaningful conditions, exceptions, uncertainty, and negation in the finding summary. Record each distinct condition or exception in qualifications with its own supporting line IDs; look at nearby lines as well as the cited sentence. If the policy does not specify a detail, do not invent it. Avoid duplicate findings. Use concise snake_case labels and plain-language summaries. Return an empty findings array if there are no supported practices.`;

const sourceLineIds = { type: 'array', items: { type: 'string' } };
const qualificationSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		summary: { type: 'string' },
		sourceLineIds
	},
	required: ['summary', 'sourceLineIds']
};
const findingSchema = {
	type: 'object',
	additionalProperties: false,
	properties: {
		practice: { type: 'string' },
		dataCategories: { type: 'array', items: { type: 'string' } },
		purposes: { type: 'array', items: { type: 'string' } },
		recipients: { type: 'array', items: { type: 'string' } },
		summary: { type: 'string' },
		sourceLineIds,
		qualifications: { type: 'array', items: qualificationSchema },
		ambiguous: { type: 'boolean' },
		negated: { type: 'boolean' }
	},
	required: [
		'practice',
		'dataCategories',
		'purposes',
		'recipients',
		'summary',
		'sourceLineIds',
		'qualifications',
		'ambiguous',
		'negated'
	]
};

export const GROUNDED_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		summary: { type: 'string' },
		findings: { type: 'array', items: findingSchema }
	},
	required: ['summary', 'findings']
};

export function numberPolicyLines(policyText) {
	const lineMap = new Map();
	const numberedText = policyText
		.split('\n')
		.map((line, index) => {
			if (!line.trim()) return line;
			const id = `L${String(index + 1).padStart(4, '0')}`;
			lineMap.set(id, line);
			return `${id} ${line}`;
		})
		.join('\n');
	return { numberedText, lineMap };
}

export function buildGroundedRequest(testCase, maxOutputTokens) {
	const { numberedText, lineMap } = numberPolicyLines(testCase.policyText);
	return {
		request: {
			model: 'gpt-6-luna',
			input: [
				{ role: 'system', content: GROUNDED_INSTRUCTIONS },
				{ role: 'user', content: numberedText }
			],
			reasoning: { effort: 'medium' },
			max_output_tokens: maxOutputTokens,
			store: false,
			text: {
				format: {
					type: 'json_schema',
					name: 'grounded_privacy_policy_findings',
					strict: true,
					schema: GROUNDED_SCHEMA
				}
			}
		},
		lineMap
	};
}

export function validateGroundedAnalysis(analysis, lineMap) {
	const schemaIssues = [];
	const referenceIssues = [];
	const groundedFindings = [];
	if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
		return { schemaIssues: ['Output is not an object'], referenceIssues, groundedFindings };
	}
	if (typeof analysis.summary !== 'string' || !Array.isArray(analysis.findings)) {
		return { schemaIssues: ['Missing summary or findings'], referenceIssues, groundedFindings };
	}
	if (Object.keys(analysis).some((key) => !['summary', 'findings'].includes(key))) {
		schemaIssues.push('Unexpected top-level field');
	}
	const resolve = (ids, label) => {
		if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== 'string')) {
			schemaIssues.push(`${label}: sourceLineIds must be a nonempty string array`);
			return [];
		}
		if (new Set(ids).size !== ids.length) referenceIssues.push(`${label}: duplicate line ID`);
		return ids.flatMap((id) => {
			const text = lineMap.get(id);
			if (text === undefined) {
				referenceIssues.push(`${label}: unknown line ID ${id}`);
				return [];
			}
			return [{ lineId: id, text }];
		});
	};
	for (const [index, finding] of analysis.findings.entries()) {
		const label = `Finding ${index}`;
		if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
			schemaIssues.push(`${label}: not an object`);
			continue;
		}
		for (const field of ['practice', 'summary']) {
			if (typeof finding[field] !== 'string') schemaIssues.push(`${label}: invalid ${field}`);
		}
		for (const field of ['dataCategories', 'purposes', 'recipients']) {
			if (
				!Array.isArray(finding[field]) ||
				finding[field].some((item) => typeof item !== 'string')
			) {
				schemaIssues.push(`${label}: invalid ${field}`);
			}
		}
		for (const field of ['ambiguous', 'negated']) {
			if (typeof finding[field] !== 'boolean') schemaIssues.push(`${label}: invalid ${field}`);
		}
		if (Object.keys(finding).some((key) => !findingSchema.required.includes(key))) {
			schemaIssues.push(`${label}: unexpected field`);
		}
		const evidenceLines = resolve(finding.sourceLineIds, label);
		const qualifications = [];
		if (!Array.isArray(finding.qualifications)) {
			schemaIssues.push(`${label}: invalid qualifications`);
		} else {
			for (const [conditionIndex, condition] of finding.qualifications.entries()) {
				const conditionLabel = `${label} qualification ${conditionIndex}`;
				if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
					schemaIssues.push(`${conditionLabel}: not an object`);
					continue;
				}
				if (typeof condition.summary !== 'string') {
					schemaIssues.push(`${conditionLabel}: invalid summary`);
				}
				if (Object.keys(condition).some((key) => !qualificationSchema.required.includes(key))) {
					schemaIssues.push(`${conditionLabel}: unexpected field`);
				}
				qualifications.push({
					summary: condition.summary,
					evidenceLines: resolve(condition.sourceLineIds, conditionLabel)
				});
			}
		}
		groundedFindings.push({ ...finding, evidenceLines, qualifications });
	}
	return { schemaIssues, referenceIssues, groundedFindings };
}
