import type { PageServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { getDb } from '$lib/server/db';
import { getVideosByUserId } from '$lib/server/db/videos';
import { ensureUserForAuth } from '$lib/server/db/users';

export const load: PageServerLoad = async (event) => {
  const supabase = createSupabaseServerClient(event);
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  const databaseUrl = event.platform?.env?.DATABASE_URL ?? process.env.DATABASE_URL;
  let db: ReturnType<typeof getDb> | null = null;
  if (databaseUrl) {
    db = getDb(databaseUrl);
  }
  let appUser = null;
  if (user && db) {
    appUser = await ensureUserForAuth(db, user);
  }
  let userVideos = [];
  if (appUser && db) {
    userVideos = await getVideosByUserId(db, appUser.id);
  }
  return {
    userVideos: userVideos ?? [],
    sessionUser: user ?? null
  };
};

