import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const requestPath = path.resolve('docs/examples/stage1-request.json');
const stage1Path = path.resolve('docs/examples/stage1-response.json');
const consolidatedPath = path.resolve('docs/examples/consolidated-response.json');

describe('committed Stage 2 example', () => {
	it('stays consistent with the Stage 1 example and the Stage 2 rules', async () => {
		const request = JSON.parse(await readFile(requestPath, 'utf8'));
		const stage1 = JSON.parse(await readFile(stage1Path, 'utf8'));
		const response = JSON.parse(await readFile(consolidatedPath, 'utf8'));

		expect(response.extraction).toEqual(stage1);
		expect(response).toMatchObject({
			stage: 'consolidation',
			stageStatus: 'complete',
			analysisStatus: 'complete',
			outcome: 'findings_identified',
			excludedCandidates: [],
			rejectedOutput: []
		});
		const candidateIds = new Set<string>();
		for (const finding of response.findings) {
			for (const id of finding.candidateIds) candidateIds.add(id);
			for (const evidence of finding.evidence) {
				expect(request.text.slice(evidence.startOffset, evidence.endOffset)).toBe(evidence.excerpt);
			}
		}
		// Every Stage 1 candidate is accounted for.
		expect([...candidateIds].sort()).toEqual(
			stage1.candidates.map((candidate: { id: string }) => candidate.id)
		);
	});
});
