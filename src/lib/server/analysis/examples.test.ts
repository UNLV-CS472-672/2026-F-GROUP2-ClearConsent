import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSourceSnapshot } from './source';

const requestPath = path.resolve('docs/examples/stage1-request.json');
const responsePath = path.resolve('docs/examples/stage1-response.json');

describe('committed Stage 1 examples', () => {
	it('keeps every response excerpt reconstructable from the synthetic request', async () => {
		const request = JSON.parse(await readFile(requestPath, 'utf8'));
		const response = JSON.parse(await readFile(responsePath, 'utf8'));
		const snapshot = await createSourceSnapshot(request.text, {
			title: request.title,
			url: request.url
		});

		expect(response.source).toEqual(snapshot);
		for (const candidate of response.candidates) {
			for (const evidence of candidate.evidence) {
				expect(request.text.slice(evidence.startOffset, evidence.endOffset)).toBe(evidence.excerpt);
				expect(evidence.passageId).toBe('P001');
			}
		}
		expect(response.analysisStatus).toBe('in_progress');
	});
});
