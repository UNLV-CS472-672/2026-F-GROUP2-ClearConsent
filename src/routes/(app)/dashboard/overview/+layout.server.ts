import { getSupabaseForUser } from '$lib/server/db/supabase';
import type { LayoutServerLoad } from './$types';

type RecentSource = { id: string; title: string | null; url: string | null; created_at: string };

// Sources with at least one saved analysis. save_analysis only stores completed analyses, so the
// inner join is enough to filter out sources that were never analyzed or whose analysis failed.
export const load: LayoutServerLoad = async ({ locals, url }) => {
	// Reading the pathname re-runs this on every overview navigation, so returning from an analysis
	// shows it in the list.
	void url.pathname;

	const { session } = await locals.safeGetSession();
	if (!session) return { recentSources: [] as RecentSource[] };

	const { data, error: recentError } = await getSupabaseForUser(session.access_token)
		.from('sources')
		.select('id, title, url, created_at, analyses!inner(id)')
		.order('created_at', { ascending: false })
		.limit(10);

	if (recentError) {
		console.error('Failed to load recent analyses:', recentError.message);
	}

	return {
		recentSources: (data ?? []).map(({ id, title, url, created_at }) => ({
			id,
			title,
			url,
			created_at
		})) as RecentSource[]
	};
};
