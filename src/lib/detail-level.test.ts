import { describe, expect, it } from 'vitest';
import { detailLevel } from './detail-level';

describe('detailLevel', () => {
	it('defaults missing and invalid values to balanced', () => {
		expect(detailLevel(null)).toBe('balanced');
		expect(detailLevel('')).toBe('balanced');
		expect(detailLevel('invalid')).toBe('balanced');
	});

	it('keeps the two non-default levels', () => {
		expect(detailLevel('quick')).toBe('quick');
		expect(detailLevel('detailed')).toBe('detailed');
	});
});
