import type { PageServerLoad, Actions } from './$types';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { getDb } from '$lib/server/db';
import { getVideosByUserId, getVideoById } from '$lib/server/db/videos';
import { ensureUserForAuth } from '$lib/server/db/users';
import { fail, redirect } from '@sveltejs/kit';
import { videos } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

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
		const cdnHostname = event.platform?.env?.BUNNY_CDN_HOST_NAME ?? process.env.BUNNY_CDN_HOST_NAME ?? null;
		userVideos = await getVideosByUserId(db, appUser.id, cdnHostname);
	}
	return {
		userVideos: userVideos ?? [],
		sessionUser: user ?? null
	};
};

export const actions: Actions = {
	deleteVideo: async (event) => {
		const formData = await event.request.formData();
		const videoId = formData.get('videoId')?.toString();
		
		if (!videoId) {
			return fail(400, { error: 'No video ID provided' });
		}

		const supabase = createSupabaseServerClient(event);
		const { data: { user } } = await supabase.auth.getUser();
		
		if (!user) {
			return fail(401, { error: 'You must be signed in to delete videos.' });
		}

		const databaseUrl = event.platform?.env?.DATABASE_URL ?? process.env.DATABASE_URL;
		if (!databaseUrl) {
			return fail(500, { error: 'Database not configured.' });
		}

		const db = getDb(databaseUrl);
		const appUser = await ensureUserForAuth(db, user);

		// Get video to check ownership
		const cdnHostname = event.platform?.env?.BUNNY_CDN_HOST_NAME ?? process.env.BUNNY_CDN_HOST_NAME ?? null;
		const video = await getVideoById(db, videoId, cdnHostname);
		
		if (!video) {
			return fail(404, { error: 'Video not found' });
		}

		// Check ownership - verify userId matches
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
			const platformEnv = event.platform?.env as Record<string, string | undefined> | undefined;
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
