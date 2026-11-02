import { z } from 'zod';

export const preferencesSchema = z.object({
	focusAreas: z
		.array(z.enum(['sharing', 'tracking', 'retention']))
		.max(3)
		.refine((values) => new Set(values).size === values.length, {
			message: 'Privacy interests must not contain duplicates.'
		}),
	detail: z.enum(['quick', 'balanced', 'detailed']),
	style: z.enum(['bullets', 'paragraph'])
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const defaultPreferences: Preferences = {
	focusAreas: [],
	detail: 'balanced',
	style: 'bullets'
};
