import { describe, expect, it } from 'vitest';
import { STAGE1_INSTRUCTIONS } from './prompt';
import { validateAndResolveCandidates } from './references';
import { createSourceSnapshot } from './source';

describe('Stage 1 prompt example', () => {
	it('shows only output that passes exact quote verification', async () => {
		const passage = JSON.parse(STAGE1_INSTRUCTIONS.match(/^\{"id": "P003".*\}$/m)![0]);
		const start = STAGE1_INSTRUCTIONS.indexOf('{"candidates"');
		const output = JSON.parse(
			STAGE1_INSTRUCTIONS.slice(start, STAGE1_INSTRUCTIONS.indexOf('\n]}') + 3)
		);
		// The example passage stands alone here, so it becomes P001.
		for (const candidate of output.candidates) {
			for (const evidence of candidate.evidence) evidence.passageId = 'P001';
		}

		const { candidates, rejectedCandidates } = validateAndResolveCandidates(
			output,
			await createSourceSnapshot(passage.text)
		);

		expect(rejectedCandidates).toEqual([]);
		expect(candidates).toHaveLength(4);
		for (const candidate of candidates) {
			for (const evidence of candidate.evidence) {
				expect(evidence).toMatchObject({ status: 'verified', match: 'exact' });
			}
		}
	});
});
