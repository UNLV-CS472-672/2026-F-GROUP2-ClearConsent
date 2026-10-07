import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { numberPolicyLines } from './grounded-full-config.mjs';

const resultsPaths = process.argv.slice(2);
if (resultsPaths.length !== 2) throw new Error('Pass the Spotify and Facebook result log paths');
const fixture = JSON.parse(
	await readFile(new URL('../fixtures/full-policy-cases.json', import.meta.url), 'utf8')
);
const records = (
	await Promise.all(
		resultsPaths.map(async (path) =>
			(await readFile(path, 'utf8')).trim().split('\n').map(JSON.parse)
		)
	)
).flat();
const completed = records.filter(
	(record) => record.type === 'result' && record.responseStatus === 'completed'
);
if (completed.length !== 15) throw new Error('Expected 15 completed section calls');
const from = Number(process.env.REVIEW_FROM ?? 1);
const to = Number(process.env.REVIEW_TO ?? 15);
if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 15 || from > to) {
	throw new Error('REVIEW_FROM and REVIEW_TO must define a valid call range');
}

for (const [callIndex, record] of completed.entries()) {
	if (callIndex + 1 < from || callIndex + 1 > to) continue;
	const testCase = fixture.cases.find((item) => item.id === record.caseId);
	const { lineMap } = numberPolicyLines(testCase.policyText);
	const selected = record.analysis.findings
		.map((finding, index) => ({
			finding,
			index,
			hash: createHash('sha256')
				.update(`${record.caseId}:${record.sectionIndex}:${index}`)
				.digest('hex')
		}))
		.sort((left, right) => left.hash.localeCompare(right.hash))
		.slice(0, 2)
		.sort((left, right) => left.index - right.index);
	for (const { finding, index } of selected) {
		const ids = [
			...finding.sourceLineIds,
			...finding.qualifications.flatMap((qualification) => qualification.sourceLineIds)
		];
		console.log(
			`\n${testCase.source.service} section ${record.sectionIndex + 1} finding ${index + 1}: ${finding.practice}`
		);
		console.log(`Summary: ${finding.summary}`);
		console.log(`Categories: ${finding.dataCategories.join('; ')}`);
		console.log(`Purposes: ${finding.purposes.join('; ')}`);
		console.log(`Recipients: ${finding.recipients.join('; ')}`);
		for (const qualification of finding.qualifications) {
			console.log(
				`Qualification: ${qualification.summary} (${qualification.sourceLineIds.join(', ')})`
			);
		}
		for (const id of new Set(ids)) {
			const line = lineMap.get(id);
			console.log(`Source ${id}: ${line === undefined ? '[INVALID]' : line.slice(0, 900)}`);
		}
	}
}
