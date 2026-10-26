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
 * Not race-safe: two identical submissions at the same moment can still create two rows.
 */
export async function findOrCreateSource(supabase: SupabaseClient, source: NewSource) {
	const lookup = supabase.from('sources').select().eq('owner_id', source.ownerId);
	const { data: existing, error: lookupError } = await (
		source.url === null
			? lookup.is('url', null).eq('text', source.text)
			: lookup.eq('url', source.url)
	)
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
