import type { SupabaseClient } from '@supabase/supabase-js';

type NewSource = {
	ownerId: string;
	title: string | null;
	text: string;
	url: string | null;
};

/**
 * Returns the owner's existing source for the same URL (or, for pasted text, the same text),
 * or inserts a new one.
 * Pasted text uses an owner-scoped RPC with a transaction lock; URL behavior is unchanged.
 */
export async function findOrCreateSource(supabase: SupabaseClient, source: NewSource) {
	if (source.url === null) {
		return supabase
			.rpc('find_or_create_pasted_source', { p_text: source.text, p_title: source.title })
			.single();
	}

	const { data: existing, error: lookupError } = await supabase
		.from('sources')
		.select()
		.eq('owner_id', source.ownerId)
		.eq('url', source.url)
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (lookupError) return { data: null, error: lookupError };
	if (existing) return { data: existing, error: null };

	return supabase
		.from('sources')
		.insert({ owner_id: source.ownerId, title: source.title, text: source.text, url: source.url })
		.select()
		.single();
}
