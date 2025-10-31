// src/routes/account/new/+page.server.ts

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { videos } from '$lib/server/db/schema';
import { nanoid } from 'nanoid';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { ensureUserForAuth } from '$lib/server/db/users';
import { updateVideoTags } from '$lib/server/db/videos';

function resolveEnv(
	platformEnv: Record<string, string | undefined> | undefined,
	key: string
): string | undefined {
	return platformEnv?.[key] ?? process.env[key];
}

function buildStreamUrl(hostname: string | undefined, videoId: string | undefined): string | null {
	if (!hostname || !videoId) return null;
	const cleanedHost = hostname.replace(/^https?:\/\//, '').replace(/\/+$/, '');
	if (!cleanedHost) return null;
	return `https://${cleanedHost}/${videoId}/playlist.m3u8`;
}

export const load: PageServerLoad = async (event) => {
	const supabase = createSupabaseServerClient(event);
	const {
		data: { user },
		error
	} = await supabase.auth.getUser();

	if (error) {
		console.error('Failed to resolve authenticated user in upload load:', error);
	}

	if (!user) {
		const redirectTo = encodeURIComponent(event.url.pathname);
		throw redirect(303, `/account?redirectTo=${redirectTo}`);
	}

	const databaseUrl = event.platform?.env?.DATABASE_URL;
	if (!databaseUrl) {
		console.error('DATABASE_URL binding not found in load()');
		return {
			uploader: null,
			sessionUser: user
		};
	}

	const db = getDb(databaseUrl);
	const uploader = await ensureUserForAuth(db, user);

	return {
		uploader: {
			id: uploader.id,
			name: uploader.name,
			slug: uploader.slug,
			authId: uploader.authId ?? user.id
		},
		sessionUser: user
	};
};

export const actions: Actions = {
	upload: async (event) => {
		const supabase = createSupabaseServerClient(event);
		const {
			data: { user },
			error
		} = await supabase.auth.getUser();

		if (error) {
			console.error('Failed to resolve authenticated user in upload action:', error);
		}

		if (!user) {
			return fail(401, { error: 'You must be signed in to upload videos.' });
		}

		const databaseUrl = event.platform?.env?.DATABASE_URL;
		if (!databaseUrl) {
			console.error('DATABASE_URL binding not found in action()');
			return fail(500, { error: 'Database not configured.' });
		}

		const db = getDb(databaseUrl);
		const dbUser = await ensureUserForAuth(db, user);

		const formData = await event.request.formData();

		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		const uploadedAt = formData.get('uploadedAt') as string;
		const streamId = (formData.get('streamId') as string | null)?.trim() ?? '';
		const latitude = formData.get('latitude') as string;
		const longitude = formData.get('longitude') as string;
		const videoUrl = formData.get('videoUrl') as string;
		const duration = formData.get('duration') as string;
		const formatValue = (formData.get('format') as string | null)?.trim() ?? '';
		const aspectRatioValue = (formData.get('aspectRatio') as string | null)?.trim() ?? '';
		const keywordsJson = formData.get('keywords') as string;
		
		console.log('[Upload] Received format:', formatValue);
		console.log('[Upload] Received aspectRatio:', aspectRatioValue);
		console.log('[Upload] Received keywords:', keywordsJson);
		
		// If format contains '/' it's a MIME type (e.g., "video/mp4"), keep it as-is
		// Otherwise it's a file extension, uppercase it (e.g., "MP4")
		const normalizedFormat = formatValue && formatValue.length > 0
			? (formatValue.includes('/') ? formatValue : formatValue.toUpperCase())
			: null;
		
		const aspectRatio = aspectRatioValue && aspectRatioValue.length > 0 ? aspectRatioValue : null;
		
		console.log('[Upload] Normalized format:', normalizedFormat);
		console.log('[Upload] Final aspectRatio:', aspectRatio);

		if (!title || title.trim().length === 0) {
			return fail(400, { error: 'Title is required', field: 'title' });
		}

		if (!description || description.trim().length === 0) {
			return fail(400, { error: 'Description is required', field: 'description' });
		}

		const wordCount = description.trim().split(/\s+/).length;
		if (wordCount > 300) {
			return fail(400, {
				error: `Description must be 300 words or less (currently ${wordCount} words)` ,
				field: 'description'
			});
		}

		const platformEnv = event.platform?.env as Record<string, string | undefined> | undefined;
		const cdnHost = resolveEnv(platformEnv, 'BUNNY_CDN_HOST_NAME');

		let finalVideoUrl = videoUrl?.trim();
		if ((!finalVideoUrl || finalVideoUrl.length === 0) && streamId) {
			const streamUrl = buildStreamUrl(cdnHost, streamId);
			if (streamUrl) {
				finalVideoUrl = streamUrl;
			}
		}

		if (!finalVideoUrl || finalVideoUrl.length === 0) {
			return fail(400, {
				error: 'Video stream URL is required. Complete the upload before saving.',
				field: 'video'
			});
		}

		try {
			const videoId = nanoid(12);
			const durationNum = duration ? parseInt(duration) : 0;
			const lat = latitude ? parseFloat(latitude) : null;
			const lon = longitude ? parseFloat(longitude) : null;

			const insertData = {
				id: videoId,
				title: title.trim(),
				description: description.trim(),
				userId: dbUser.id,
				duration: durationNum,
				uploadedAt: uploadedAt ? new Date(uploadedAt) : new Date(),
				latitude: lat,
				longitude: lon,
				views: 0,
				likes: 0,
				transcript: null,
				streamId: streamId || null,
				format: normalizedFormat,
				aspectRatio: aspectRatio
			};
			
			console.log('[Upload] Inserting video with format:', insertData.format);
			console.log('[Upload] Inserting video with aspectRatio:', insertData.aspectRatio);
			
			await db.insert(videos).values(insertData);

			// Parse and save keywords/tags
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

			// Save tags to database
			if (keywordsArray.length > 0) {
				await updateVideoTags(db, videoId, keywordsArray);
			}

			return {
				success: true,
				videoUrl: finalVideoUrl,
				streamId,
				videoId
			};
		} catch (error) {
			console.error('Upload error:', error);
			return fail(500, {
				error: 'Failed to save video. Please try again.',
				details: error instanceof Error ? error.message : 'Unknown error'
			});
		}
	}
};
