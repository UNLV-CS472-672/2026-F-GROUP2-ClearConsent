import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ locals }) => {
  const { session, user } = await locals.safeGetSession();
  return { session, user };
};
