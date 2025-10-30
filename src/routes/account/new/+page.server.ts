// src/routes/account/new/+page.server.ts

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db';
import { videos } from '$lib/server/db/schema';
import { nanoid } from 'nanoid';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { ensureUserForAuth } from '$lib/server/db/users';

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
		const bunnyVideoId = (formData.get('bunnyVideoId') as string | null)?.trim() ?? '';
		const latitude = formData.get('latitude') as string;
		const longitude = formData.get('longitude') as string;
		const videoUrl = formData.get('videoUrl') as string;
		const thumbnailUrl = formData.get('thumbnailUrl') as string;
		const duration = formData.get('duration') as string;

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
		if ((!finalVideoUrl || finalVideoUrl.length === 0) && bunnyVideoId) {
			const streamUrl = buildStreamUrl(cdnHost, bunnyVideoId);
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

			await db.insert(videos).values({
				id: videoId,
				title: title.trim(),
				description: description.trim(),
				userId: dbUser.id,
				videoUrl: finalVideoUrl,
				thumbnailUrl: thumbnailUrl?.trim() || null,
				duration: durationNum,
				uploadedAt: uploadedAt ? new Date(uploadedAt) : new Date(),
				latitude: lat,
				longitude: lon,
				views: 0,
				likes: 0,
				transcript: null
			});

			return {
				success: true,
				videoUrl: finalVideoUrl,
				bunnyVideoId,
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
