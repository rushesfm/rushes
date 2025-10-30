import type { PageServerLoad, Actions } from './$types';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { getDb } from '$lib/server/db';
import { getVideoById, updateVideo } from '$lib/server/db/videos';
import { ensureUserForAuth } from '$lib/server/db/users';
import { error, fail } from '@sveltejs/kit';
import { videos } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
  try {
    const { params, platform } = event;
    const videoId = params.slug; // using ID in the route param

    console.log('[Edit Page Load] Video ID:', videoId);

    const supabase = createSupabaseServerClient(event);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Edit Page Load] Auth error:', authError);
      throw error(401, 'Authentication error: ' + authError.message);
    }

    if (!user) {
      console.error('[Edit Page Load] No user found');
      throw error(401, 'Not authenticated');
    }

    console.log('[Edit Page Load] User authenticated:', user.id);

    const databaseUrl = platform?.env?.DATABASE_URL ?? process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('[Edit Page Load] Database URL not configured');
      throw error(500, 'Database not configured');
    }

    const db = getDb(databaseUrl);

    try {
      const appUser = await ensureUserForAuth(db, user);
      console.log('[Edit Page Load] App user:', appUser.id, appUser.slug);

      // Get the raw video data directly from database to check ownership
      const rawVideoRows = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1)
        .execute();

      if (!rawVideoRows.length) {
        console.error('[Edit Page Load] Video not found:', videoId);
        throw error(404, 'Video not found');
      }

      const rawVideo = rawVideoRows[0];
      console.log('[Edit Page Load] Video found:', rawVideo.id, 'userId:', rawVideo.userId);

      // Check if user owns this video
      if (rawVideo.userId !== appUser.id) {
        console.error('[Edit Page Load] User does not own video. Video userId:', rawVideo.userId, 'App user id:', appUser.id);
        throw error(403, 'You do not have permission to edit this video');
      }

      console.log('[Edit Page Load] Ownership verified');

      // Now get the full video object with all the mapped data
      const video = await getVideoById(db, videoId);
      if (!video) {
        throw error(500, 'Failed to load video data');
      }

      // Extract latitude and longitude from locations array if available
      let latitude: number | undefined = undefined;
      let longitude: number | undefined = undefined;

      if (video.locations && video.locations.length > 0) {
        const location = video.locations[0];
        latitude = location.latitude;
        longitude = location.longitude;
      }

      // Return only what the editor needs
      return {
        data: {
          id: video.id,
          title: video.title ?? '',
          description: video.description ?? '',
          tags: Array.isArray(video.keywords) ? video.keywords : [],
          latitude,
          longitude,
          videoUrl: video.videoUrl ?? video.url ?? '',
          thumbnailUrl: video.thumbnailUrl ?? '',
          duration: video.duration ?? 0
        }
      };
    } catch (dbError) {
      console.error('[Edit Page Load] Database error:', dbError);
      throw error(500, 'Database error: ' + (dbError instanceof Error ? dbError.message : 'Unknown error'));
    }
  } catch (err) {
    console.error('[Edit Page Load] Unexpected error:', err);
    // Re-throw if it's already a SvelteKit error
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    throw error(500, 'Internal server error: ' + (err instanceof Error ? err.message : 'Unknown error'));
  }
};

export const actions: Actions = {
  update: async (event) => {
    const { params, platform } = event;
    const videoId = params.slug;

    const supabase = createSupabaseServerClient(event);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail(401, { error: 'You must be signed in to update videos.' });
    }

    const databaseUrl = platform?.env?.DATABASE_URL ?? process.env.DATABASE_URL;
    if (!databaseUrl) {
      return fail(500, { error: 'Database not configured.' });
    }

    const db = getDb(databaseUrl);
    const appUser = await ensureUserForAuth(db, user);

    // Verify ownership - check raw video data
    const rawVideoRows = await db
      .select()
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1)
      .execute();

    if (!rawVideoRows.length) {
      return fail(404, { error: 'Video not found' });
    }

    const rawVideo = rawVideoRows[0];
    if (rawVideo.userId !== appUser.id) {
      return fail(403, { error: 'You do not have permission to edit this video' });
    }

    // Parse form data
    const formData = await event.request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const latitude = formData.get('latitude') as string;
    const longitude = formData.get('longitude') as string;
    const thumbnailUrl = formData.get('thumbnailUrl') as string;

    // Validation
    if (!title || title.trim().length === 0) {
      return fail(400, { error: 'Title is required' });
    }

    if (!description || description.trim().length === 0) {
      return fail(400, { error: 'Description is required' });
    }

    const wordCount = description.trim().split(/\s+/).length;
    if (wordCount > 300) {
      return fail(400, {
        error: `Description must be 300 words or less (currently ${wordCount} words)`
      });
    }

    // Parse coordinates
    const lat = latitude && latitude.trim() ? parseFloat(latitude) : null;
    const lon = longitude && longitude.trim() ? parseFloat(longitude) : null;

    try {
      // Update the video
      await updateVideo(db, videoId, {
        title: title.trim(),
        description: description.trim(),
        latitude: lat,
        longitude: lon,
        thumbnailUrl: thumbnailUrl?.trim() || null
      });

      return {
        success: true,
        videoId
      };
    } catch (err) {
      console.error('Update error:', err);
      return fail(500, {
        error: 'Failed to update video. Please try again.',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }
};
