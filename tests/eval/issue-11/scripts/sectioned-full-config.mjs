import {
	GROUNDED_INSTRUCTIONS,
	GROUNDED_SCHEMA,
	numberPolicyLines
} from './grounded-full-config.mjs';

export const MAX_CORE_BYTES = 25_000;
export const SECTION_OUTPUT_CAP = 5_000;
export const SECTION_INSTRUCTIONS = `${GROUNDED_INSTRUCTIONS} This is one bounded slice of a longer policy and may span multiple headings. Analyze every material practice in the CORE lines, including explicit statements that a practice does not occur and individual privacy rights. Nearby CONTEXT lines may explain or qualify a core claim; cite them when relevant. Do not create a finding based only on context outside the core. Do not assume this excerpt is the entire policy.`;

function topLevelStarts(lines, service) {
	const starts = [0];
	for (let index = 0; index < lines.length - 1; index++) {
		const spotifyHeading = service === 'Spotify' && /^\d+\\\.\s/.test(lines[index]);
		const facebookHeading = service === 'Facebook' && /^={3,}\s*$/.test(lines[index + 1]);
		if ((spotifyHeading && /^-{3,}\s*$/.test(lines[index + 1])) || facebookHeading) {
			if (!starts.includes(index)) starts.push(index);
		}
	}
	return starts;
}

export function splitPolicyIntoSections(testCase, maxCoreBytes = MAX_CORE_BYTES) {
	if (!Number.isInteger(maxCoreBytes) || maxCoreBytes <= 0) {
		throw new Error('maxCoreBytes must be a positive integer');
	}
	const lines = testCase.policyText.split('\n');
	const starts = topLevelStarts(lines, testCase.source.service);
	const sections = [];
	let coreStart = 0;
	while (coreStart < lines.length) {
		let coreEnd = coreStart;
		let bytes = 0;
		let lastBlankBoundary = -1;
		while (coreEnd < lines.length) {
			const nextBytes = Buffer.byteLength(lines[coreEnd], 'utf8') + 1;
			if (coreEnd > coreStart && bytes + nextBytes > maxCoreBytes) break;
			bytes += nextBytes;
			coreEnd++;
			if (!lines[coreEnd - 1].trim()) lastBlankBoundary = coreEnd;
		}
		if (coreEnd < lines.length) {
			const headingBoundary = starts
				.filter((start) => start > coreStart + (coreEnd - coreStart) / 2 && start <= coreEnd)
				.at(-1);
			if (headingBoundary) coreEnd = headingBoundary;
			else if (lastBlankBoundary > coreStart + (coreEnd - coreStart) / 2) {
				coreEnd = lastBlankBoundary;
			}
		}
		const currentHeading = starts.filter((start) => start <= coreStart).at(-1);
		sections.push({
			caseId: testCase.id,
			sectionTitle: lines[currentHeading].trim(),
			coreStart,
			coreEnd,
			contextStart: Math.max(0, coreStart - 3),
			contextEnd: Math.min(lines.length, coreEnd + 3)
		});
		coreStart = coreEnd;
	}
	return sections;
}

export function buildSectionRequest(testCase, section, maxOutputTokens = SECTION_OUTPUT_CAP) {
	const { lineMap } = numberPolicyLines(testCase.policyText);
	const lines = testCase.policyText.split('\n');
	const numbered = (start, end) =>
		lines
			.slice(start, end)
			.map((line, offset) => {
				if (!line.trim()) return line;
				return `L${String(start + offset + 1).padStart(4, '0')} ${line}`;
			})
			.join('\n');
	const before = numbered(section.contextStart, section.coreStart);
	const core = numbered(section.coreStart, section.coreEnd);
	const after = numbered(section.coreEnd, section.contextEnd);
	const content = [
		`Policy: ${testCase.source.service}. Section: ${section.sectionTitle}.`,
		`Core line range: L${String(section.coreStart + 1).padStart(4, '0')}-L${String(section.coreEnd).padStart(4, '0')}.`,
		before ? `CONTEXT BEFORE (for qualification only):\n${before}` : '',
		`CORE:\n${core}`,
		after ? `CONTEXT AFTER (for qualification only):\n${after}` : ''
	]
		.filter(Boolean)
		.join('\n\n');
	return {
		request: {
			model: 'gpt-6-luna',
			input: [
				{ role: 'system', content: SECTION_INSTRUCTIONS },
				{ role: 'user', content }
			],
			reasoning: { effort: 'medium' },
			max_output_tokens: maxOutputTokens,
			store: false,
			text: {
				format: {
					type: 'json_schema',
					name: 'sectioned_privacy_policy_findings',
					strict: true,
					schema: GROUNDED_SCHEMA
				}
			}
		},
		lineMap
	};
}
