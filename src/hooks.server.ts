import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Initialize Typed Supabase Client
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' });
        });
      },
    },
  });

  // 2. Safely capture session details
  event.locals.safeGetSession = async () => {
    const { data: { session } } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };

    const { data: { user }, error } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };

    return { session, user };
  };

  const { session } = await event.locals.safeGetSession();

  // 3. Absolute Route Guard rules
  const isAuthRoute = event.url.pathname.startsWith('/login') || event.url.pathname.startsWith('/auth');

  if (!session && !isAuthRoute) {
    throw redirect(303, '/login');
  }

  if (session && event.url.pathname === '/login') {
    throw redirect(303, '/');
  }

  return resolve(event);
};
