import type { PageServerLoad, Actions } from './$types';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { getDb } from '$lib/server/db';
import { getVideoById, updateVideo } from '$lib/server/db/videos';
import { ensureUserForAuth } from '$lib/server/db/users';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
  const { params, platform } = event;
  const videoId = params.slug; // using ID in the route param

  const supabase = createSupabaseServerClient(event);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw error(401, 'Not authenticated');
  }

  const databaseUrl = platform?.env?.DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw error(500, 'Database not configured');
  }

  const db = getDb(databaseUrl);
  const appUser = await ensureUserForAuth(db, user);

  const video = await getVideoById(db, videoId);
  if (!video) {
    throw error(404, 'Video not found');
  }

  // Flexible ownership check: compare against several possible identifiers
  const identifiers = new Set<string>([
    String(appUser.id),
    String(appUser.slug ?? ''),
    String(appUser.authId ?? ''),
    String(user.id)
  ]);
  const candidateFields = [
    video.userId,
    (video as any).authorId,
    (video as any).uploaderId,
    (video as any).ownerId,
    (video as any).userSlug,
    (video as any).authorSlug
  ];
  const ownsVideo = candidateFields.some((v) => v != null && identifiers.has(String(v)));

  if (!ownsVideo) {
    throw error(403, 'You do not have permission to edit this video');
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

    // Verify ownership
    const video = await getVideoById(db, videoId);
    if (!video) {
      return fail(404, { error: 'Video not found' });
    }

    const identifiers = new Set<string>([
      String(appUser.id),
      String(appUser.slug ?? ''),
      String(appUser.authId ?? ''),
      String(user.id)
    ]);
    const candidateFields = [
      video.userId,
      (video as any).authorId,
      (video as any).uploaderId,
      (video as any).ownerId,
      (video as any).userSlug,
      (video as any).authorSlug
    ];
    const ownsVideo = candidateFields.some((v) => v != null && identifiers.has(String(v)));

    if (!ownsVideo) {
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
