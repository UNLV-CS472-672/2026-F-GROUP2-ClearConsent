import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { detailLevel } from '$lib/detail-level';
import type { PageServerLoad } from './$types';

// The prepared study result is retired. Old links go to the input page instead of showing a fixed
// example that could be mistaken for a saved analysis.
export const load: PageServerLoad = ({ url }) => {
	redirect(
		307,
		resolve(`/dashboard/overview/extract?detail=${detailLevel(url.searchParams.get('detail'))}`)
	);
};
