import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { getDb } from '$lib/server/db';
import { ensureUserForAuth } from '$lib/server/db/users';
import { getVideoById } from '$lib/server/db/videos';
import { videos } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

function resolveEnv(
	platformEnv: Record<string, string | undefined> | undefined,
	key: string
): string | undefined {
	return platformEnv?.[key] ?? process.env[key];
}

export const POST: RequestHandler = async (event) => {
	const { params, platform } = event;
	const videoId = params.slug;
	
	if (!videoId) {
		throw error(400, 'Video ID is required');
	}

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

	// Verify ownership
	const rawVideoRows = await db
		.select()
		.from(videos)
		.where(eq(videos.id, videoId))
		.limit(1)
		.execute();

	if (!rawVideoRows.length) {
		throw error(404, 'Video not found');
	}

	const rawVideo = rawVideoRows[0];
	if (rawVideo.userId !== appUser.id) {
		throw error(403, 'You do not have permission to edit this video');
	}

	// Get the full video to access streamId
	const platformEnv = platform?.env as Record<string, string | undefined> | undefined;
	const cdnHostname = resolveEnv(platformEnv, 'BUNNY_CDN_HOST_NAME');
	const video = await getVideoById(db, videoId, cdnHostname);
	if (!video || !video.streamId) {
		throw error(400, 'Video stream ID not found');
	}

	// Parse request body
	let body;
	try {
		body = await event.request.json();
	} catch (err) {
		console.error('Failed to parse request body:', err);
		throw error(400, 'Invalid request body');
	}

	if (!body || typeof body.thumbnailUrl !== 'string') {
		throw error(400, 'Thumbnail URL is required');
	}

	const thumbnailUrl = body.thumbnailUrl;

	// Call BunnyCDN API to update thumbnail
	const libraryId = resolveEnv(platformEnv, 'BUNNY_VIDEO_LIBRARY_ID');
	const apiKey = resolveEnv(platformEnv, 'BUNNY_API_CODE');

	if (!libraryId || !apiKey) {
		throw error(500, 'Bunny Stream environment variables are not configured');
	}

	try {
		// BunnyCDN expects the thumbnailUrl as a query parameter (percent-encoded)
		const bunnyUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${video.streamId}/thumbnail?thumbnailUrl=${encodeURIComponent(thumbnailUrl)}`;
		
		console.log('Updating thumbnail:', {
			libraryId,
			streamId: video.streamId,
			thumbnailUrl,
			url: bunnyUrl
		});
		
		const response = await fetch(bunnyUrl, {
			method: 'POST',
			headers: {
				'AccessKey': apiKey,
				'Content-Type': 'application/json'
			}
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unknown error');
			console.error('BunnyCDN thumbnail update failed:', {
				status: response.status,
				statusText: response.statusText,
				error: errorText,
				url: bunnyUrl
			});
			
			let errorMessage = errorText || `BunnyCDN returned status ${response.status}`;
			
			// Try to parse JSON error if possible
			try {
				const errorJson = JSON.parse(errorText);
				if (errorJson.Message) {
					errorMessage = errorJson.Message;
				} else if (errorJson.error) {
					errorMessage = errorJson.error;
				}
			} catch {
				// Keep original error message
			}
			
			return json({ error: errorMessage }, { status: response.status });
		}

		return json({ success: true, thumbnailUrl });
	} catch (err) {
		console.error('Thumbnail update error:', err);
		if (err && typeof err === 'object' && 'status' in err && typeof (err as any).status === 'number') {
			throw err;
		}
		const errorMessage = err instanceof Error ? err.message : 'Failed to update thumbnail';
		return json({ error: errorMessage }, { status: 500 });
	}
};

