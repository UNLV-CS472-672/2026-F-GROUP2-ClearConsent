import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { redirect, type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { env } from '$env/dynamic/private';

const CALLBACK_PATH = '/auth/callback'; // callback route

export const handle: Handle = async ({ event, resolve }) => {
	// Optional diagnostics must never prevent normal authentication.
	if (event.url.pathname === CALLBACK_PATH) {
		try {
			const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
			if (serviceKey && PUBLIC_SUPABASE_URL) {
				// Create the server-only logger inside the request, only when configured.
				const admin = createClient(PUBLIC_SUPABASE_URL, serviceKey, {
					auth: { persistSession: false }
				});
				const { error } = await admin.from('callback_logs').insert({
					path: CALLBACK_PATH,
					// Never retain auth codes or URLs that may contain credentials.
					query: '',
					ip: event.getClientAddress(),
					user_agent: event.request.headers.get('user-agent'),
					referer: null,
					created_at: new Date().toISOString()
				});
				if (error) console.warn('Callback logging unavailable');
			}
		} catch {
			console.warn('Callback logging unavailable');
		}
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

	const publicRoutes = ['/', '/login', '/register', '/auth/callback'];
	const isPublicRoute = publicRoutes.includes(event.url.pathname);

	if (!session && !isPublicRoute) {
		throw redirect(303, '/login');
	}

	return resolve(event);
};
