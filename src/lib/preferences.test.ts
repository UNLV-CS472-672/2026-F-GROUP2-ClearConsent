import { describe, expect, it } from 'vitest';
import { defaultPreferences, preferencesSchema } from './preferences';

describe('preference validation', () => {
	it('accepts defaults with no privacy interests selected', () => {
		expect(preferencesSchema.safeParse(defaultPreferences).success).toBe(true);
	});

	it('accepts all supported privacy interests', () => {
		const result = preferencesSchema.safeParse({
			focusAreas: ['sharing', 'tracking', 'retention'],
			detail: 'detailed',
			style: 'paragraph'
		});

		expect(result.success).toBe(true);
	});

	it.each([
		{ focusAreas: ['unknown'] },
		{ focusAreas: ['sharing', 'sharing'] },
		{ focusAreas: 'sharing' },
		{ detail: 'unsupported' },
		{ style: 'unsupported' },
		{ detail: null }
	])('rejects invalid choices: %j', (invalid) => {
		const result = preferencesSchema.safeParse({
			...defaultPreferences,
			...invalid
		});

		expect(result.success).toBe(false);
	});

	it('rejects missing preference fields', () => {
		expect(preferencesSchema.safeParse({}).success).toBe(false);
	});
});
