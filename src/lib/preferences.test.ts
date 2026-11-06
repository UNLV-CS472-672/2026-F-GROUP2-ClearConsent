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

	it('fills missing fields with the shared defaults', () => {
		expect(preferencesSchema.parse({})).toEqual(defaultPreferences);
	});

	it('fills defaults for older profile-only preferences', () => {
		expect(preferencesSchema.parse({ profile: 'strict' })).toEqual({
			...defaultPreferences,
			profile: 'strict'
		});
	});

	it('adds a default profile to older presentation preferences', () => {
		expect(
			preferencesSchema.parse({
				focusAreas: ['tracking'],
				detail: 'quick',
				style: 'paragraph'
			})
		).toEqual({
			profile: 'balanced',
			focusAreas: ['tracking'],
			detail: 'quick',
			style: 'paragraph'
		});
	});

	it('rejects invalid profiles and unknown fields', () => {
		expect(preferencesSchema.safeParse({ profile: 'unknown' }).success).toBe(false);
		expect(preferencesSchema.safeParse({ unexpected: true }).success).toBe(false);
	});
});
