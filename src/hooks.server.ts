import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { redirect, type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Server-only client for writing logs. Bypasses RLS, so never send it to the browser.
const admin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { persistSession: false }
});

const CALLBACK_PATH = '/auth/callback'; // callback route

export const handle: Handle = async ({ event, resolve }) => {
	// 0. Log callback hits before anything else can redirect the request
	if (event.url.pathname.startsWith(CALLBACK_PATH)) {
		const time = new Date().toISOString();

		const { error } = await admin.from('callback_logs').insert({
			path: event.url.pathname,
			query: event.url.search,
			ip: event.getClientAddress(),
			user_agent: event.request.headers.get('user-agent'),
			referer: event.request.headers.get('referer'),
			created_at: time
		});
		if (error) console.error('Failed to log callback access:', error);
	}

	// 1. Initialize Typed Supabase Client
	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});

	// 2. Safely capture session details
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) return { session: null, user: null };

		return { session, user };
	};

	const { session } = await event.locals.safeGetSession();

	// The callback must be reachable without a session so it can finish sign-in
	const publicRoutes = ['/', '/login', '/register'];
	const isPublicRoute =
		publicRoutes.includes(event.url.pathname) || event.url.pathname.startsWith(CALLBACK_PATH);

	if (!session && !isPublicRoute) {
		throw redirect(303, '/login');
	}

	return resolve(event);
};
