import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { getDb } from '$lib/server/db';
import { ensureUserForAuth } from '$lib/server/db/users';
import { updateVideo } from '$lib/server/db/videos';
import { videos } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async (event) => {
	const { params, platform } = event;
	const videoId = params.slug;

	const supabase = createSupabaseServerClient(event);
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user) {
		throw error(401, 'You must be signed in to update videos.');
	}

	const databaseUrl = platform?.env?.DATABASE_URL ?? process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw error(500, 'Database not configured.');
	}

	const db = getDb(databaseUrl);
	const appUser = await ensureUserForAuth(db, user);

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

	let payload: unknown;
	try {
		payload = await event.request.json();
	} catch (err) {
		console.error('Failed to parse replace request body:', err);
		throw error(400, 'Invalid request payload');
	}

	if (!payload || typeof payload !== 'object') {
		throw error(400, 'Invalid request payload');
	}

	const { videoUrl, duration, streamId: newStreamId, format: formatValue, aspectRatio } = payload as {
		videoUrl?: string;
		duration?: number;
		streamId?: string;
		format?: string;
		aspectRatio?: string;
	};

	if (typeof videoUrl !== 'string' || videoUrl.trim().length === 0) {
		throw error(400, 'New stream URL is required.');
	}

	const normalizedStreamUrl = videoUrl.trim();

	const updates: {
		duration?: number | null;
		streamId?: string | null;
		format?: string | null;
		aspectRatio?: string | null;
	} = {};

	if (typeof duration === 'number' && Number.isFinite(duration) && duration >= 0) {
		updates.duration = Math.round(duration);
	}

	if (typeof newStreamId === 'string' && newStreamId.trim().length > 0) {
		updates.streamId = newStreamId.trim();
	}

	if (typeof formatValue === 'string' && formatValue.trim().length > 0) {
		updates.format = formatValue.trim().toUpperCase();
	}

	if (typeof aspectRatio === 'string' && aspectRatio.trim().length > 0) {
		updates.aspectRatio = aspectRatio.trim();
	}

	if (!updates.streamId) {
		const match = normalizedStreamUrl.match(/\/([^\/]+)\/playlist\.m3u8/);
		if (match && match[1]) {
		updates.streamId = match[1].trim();
	}
	}

	try {
		await updateVideo(db, videoId, updates);
		return json({
			success: true,
			videoUrl: normalizedStreamUrl,
			duration: updates.duration ?? undefined,
			streamId: updates.streamId ?? undefined,
			format: updates.format ?? undefined,
			aspectRatio: updates.aspectRatio ?? undefined
		});
	} catch (err) {
		console.error('Replace video error:', err);
		throw error(500, 'Failed to update stream URL. Please try again.');
	}
};
