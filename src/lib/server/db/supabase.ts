import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

/**
 * Client that runs as an authenticated user, so RLS policies apply to that user.
 * Pass the access token from the verified session.
 * Server-only. Never use the service-role key here: it bypasses RLS.
 */
export function getSupabaseForUser(accessToken: string): SupabaseClient {
	const url = env.SUPABASE_URL;
	const key = env.SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) {
		throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set.');
	}
	return createClient(url, key, {
		global: { headers: { Authorization: `Bearer ${accessToken}` } },
		auth: { persistSession: false, autoRefreshToken: false }
	});
}
