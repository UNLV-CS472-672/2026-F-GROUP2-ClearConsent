import { describe, expect, it, vi } from 'vitest';
import { load } from './+page.server';

vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));

function redirectFrom(search: string) {
	try {
		load({ url: new URL(`https://example.test/dashboard/overview/result${search}`) } as any);
	} catch (thrown) {
		return thrown as { status: number; location: string };
	}
	throw new Error('Expected a redirect');
}

describe('retired prepared-result route', () => {
	it('redirects old links to the input page instead of showing a prepared result', () => {
		expect(redirectFrom('')).toMatchObject({
			status: 307,
			location: '/dashboard/overview/extract?detail=balanced'
		});
	});

	it('keeps a valid detail level and normalizes an invalid one', () => {
		expect(redirectFrom('?detail=quick')).toMatchObject({
			location: '/dashboard/overview/extract?detail=quick'
		});
		expect(redirectFrom('?detail=invalid')).toMatchObject({
			location: '/dashboard/overview/extract?detail=balanced'
		});
	});
});
