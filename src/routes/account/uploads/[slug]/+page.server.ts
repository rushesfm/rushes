import type { PageServerLoad, Actions } from './$types';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { getDb } from '$lib/server/db';
import { getVideoById, updateVideo, updateVideoTags } from '$lib/server/db/videos';
import { ensureUserForAuth } from '$lib/server/db/users';
import { error, fail, redirect } from '@sveltejs/kit';
import { videos } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

function cleanHost(hostname: string | undefined | null): string | null {
  if (!hostname) return null;
  const cleaned = hostname.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return cleaned.length ? cleaned : null;
}

function buildPlaylistUrl(hostname: string | undefined | null, streamId: string | undefined | null): string | null {
  const host = cleanHost(hostname);
  const id = typeof streamId === 'string' ? streamId.trim() : '';
  if (!host || !id) return null;
  return `https://${host}/${id}/playlist.m3u8`;
}

function buildOriginalUrl(hostname: string | undefined | null, streamId: string | undefined | null): string | null {
  const host = cleanHost(hostname);
  const id = typeof streamId === 'string' ? streamId.trim() : '';
  if (!host || !id) return null;
  return `https://${host}/${id}/original`;
}

function buildThumbnailUrl(hostname: string | undefined | null, streamId: string | undefined | null): string | null {
  const host = cleanHost(hostname);
  const id = typeof streamId === 'string' ? streamId.trim() : '';
  if (!host || !id) return null;
  return `https://${host}/${id}/thumbnail.jpg`;
}

function deriveDownloadUrlFromStreamUrl(streamUrl: string | undefined | null): string {
  if (!streamUrl) return '';
  return streamUrl.replace(/\/playlist\.m3u8(?:\?.*)?$/, '/original');
}

function deriveThumbnailUrlFromStreamUrl(streamUrl: string | undefined | null): string {
  if (!streamUrl) return '';
  return streamUrl.replace(/\/playlist\.m3u8(?:\?.*)?$/, '/thumbnail.jpg');
}

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
      const cdnHostForVideo = cleanHost(platform?.env?.BUNNY_CDN_HOST_NAME ?? process.env.BUNNY_CDN_HOST_NAME);
      const video = await getVideoById(db, videoId, cdnHostForVideo);
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

      const cdnHost = cleanHost(platform?.env?.BUNNY_CDN_HOST_NAME ?? process.env.BUNNY_CDN_HOST_NAME);
      const streamId = video.streamId ?? '';
      const fallbackVideoUrl = video.videoUrl ?? video.url ?? '';
      const computedVideoUrl = buildPlaylistUrl(cdnHost, streamId) ?? fallbackVideoUrl;
      const downloadUrl = buildOriginalUrl(cdnHost, streamId) ?? deriveDownloadUrlFromStreamUrl(fallbackVideoUrl);
      const thumbnailUrl = buildThumbnailUrl(cdnHost, streamId) ?? deriveThumbnailUrlFromStreamUrl(fallbackVideoUrl);

      // Build all available BunnyCDN thumbnails
      const getThumbnailBaseUrl = (): string => {
        if (cdnHost && streamId) {
          return `https://${cdnHost}/${streamId}`;
        }
        // Fallback: derive from video URL
        if (fallbackVideoUrl) {
          return fallbackVideoUrl.replace(/\/playlist\.m3u8(?:\?.*)?$/, '').replace(/\/thumbnail\.jpg$/, '');
        }
        return '';
      };

      const thumbnailBase = getThumbnailBaseUrl();
      const availableThumbnails: string[] = [];
      
      if (thumbnailBase) {
        // Add original thumbnail
        availableThumbnails.push(`${thumbnailBase}/thumbnail.jpg`);
        // Add numbered thumbnails (1-5)
        for (let i = 1; i <= 5; i++) {
          availableThumbnails.push(`${thumbnailBase}/thumbnail_${i}.jpg`);
        }
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
          videoUrl: computedVideoUrl,
          duration: video.duration ?? 0,
          streamId,
          format: video.format ?? '',
          aspectRatio: video.aspectRatio ?? '',
          uploadedAt: video.uploadedAt ?? '',
          createdAt: video.createdAt ?? '',
          downloadUrl,
          thumbnailUrl,
          availableThumbnails
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
    const uploadedAt = formData.get('uploadedAt') as string;
    const keywordsJson = formData.get('keywords') as string;

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

    // Parse uploadedAt
    const uploadDate = uploadedAt && uploadedAt.trim() ? new Date(uploadedAt) : null;

    // Parse keywords
    let keywordsArray: string[] = [];
    if (keywordsJson && keywordsJson.trim()) {
      try {
        keywordsArray = JSON.parse(keywordsJson);
        if (!Array.isArray(keywordsArray)) {
          keywordsArray = [];
        }
      } catch {
        console.error('Failed to parse keywords JSON');
      }
    }

    try {
      // Update the video
      await updateVideo(db, videoId, {
        title: title.trim(),
        description: description.trim(),
        latitude: lat,
        longitude: lon,
        uploadedAt: uploadDate
      });

      // Update tags
      await updateVideoTags(db, videoId, keywordsArray);

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
  },
  deleteVideo: async (event) => {
    const { params, platform } = event;
    const videoId = params.slug;

    const supabase = createSupabaseServerClient(event);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return fail(401, { error: 'You must be signed in to delete videos.' });
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
      return fail(403, { error: 'You do not have permission to delete this video' });
    }

    // Get streamId before deletion for BunnyCDN deletion
    const streamId = rawVideo.streamId;

    // Delete from BunnyCDN if streamId exists
    if (streamId) {
      const platformEnv = platform?.env as Record<string, string | undefined> | undefined;
      const libraryId = platformEnv?.['BUNNY_VIDEO_LIBRARY_ID'] ?? process.env.BUNNY_VIDEO_LIBRARY_ID;
      const apiKey = platformEnv?.['BUNNY_API_CODE'] ?? process.env.BUNNY_API_CODE;

      if (libraryId && apiKey) {
        try {
          const bunnyUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${streamId}`;
          const response = await fetch(bunnyUrl, {
            method: 'DELETE',
            headers: {
              'AccessKey': apiKey
            }
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('BunnyCDN delete failed:', response.status, errorText);
            // Continue with database deletion even if BunnyCDN deletion fails
          }
        } catch (err) {
          console.error('Error deleting video from BunnyCDN:', err);
          // Continue with database deletion even if BunnyCDN deletion fails
        }
      }
    }

    // Delete the video from database
    await db.delete(videos).where(eq(videos.id, videoId)).execute();

    // Redirect to uploads page after delete
    throw redirect(303, '/account/uploads');
  }
};
