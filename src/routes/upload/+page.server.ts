// src/routes/upload/+page.server.ts

import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDb } from '$lib/server/db'; // <-- FIXED: Import getDb factory
import { videos } from '$lib/server/db/schema';
import { getAllUsers } from '$lib/server/db/users';
import { nanoid } from 'nanoid';

export const load: PageServerLoad = async ({ platform }) => {
	// 1. Check for the database binding
	if (!platform?.env.DATABASE_URL) {
		console.error('DATABASE_URL binding not found in load()');
		return { users: [] };
	}

	// 2. Create the db instance
	const db = getDb(platform.env.DATABASE_URL);

	// 3. Pass the db instance to your query function
	const users = await getAllUsers(db);
	return {
		users
	};
};

export const actions: Actions = {
	upload: async ({ request, platform }) => {
		// 1. Check for the database binding
		if (!platform?.env.DATABASE_URL) {
			console.error('DATABASE_URL binding not found in action()');
			return fail(500, { error: 'Database not configured.' });
		}

		// 2. Create the db instance
		const db = getDb(platform.env.DATABASE_URL);

		const formData = await request.formData();

		const title = formData.get('title') as string;
		const description = formData.get('description') as string;
		const userId = formData.get('userId') as string;
		const uploadedAt = formData.get('uploadedAt') as string;
		const latitude = formData.get('latitude') as string;
		const longitude = formData.get('longitude') as string;
		const videoUrl = formData.get('videoUrl') as string;
		const thumbnailUrl = formData.get('thumbnailUrl') as string;
		const duration = formData.get('duration') as string;

		// Validation
		if (!title || title.trim().length === 0) {
			return fail(400, { error: 'Title is required', field: 'title' });
		}

		if (!description || description.trim().length === 0) {
			return fail(400, { error: 'Description is required', field: 'description' });
		}

		// Check word count (max 300 words)
		const wordCount = description.trim().split(/\s+/).length;
		if (wordCount > 300) {
			return fail(400, {
				error: `Description must be 300 words or less (currently ${wordCount} words)`,
				field: 'description'
			});
		}

		if (!userId) {
			return fail(400, { error: 'User selection is required', field: 'userId' });
		}

		if (!videoUrl || videoUrl.trim().length === 0) {
			return fail(400, { error: 'Video URL is required. Please upload a video file first.', field: 'video' });
		}

		try {
			// Generate unique video ID
			const videoId = nanoid(12);

			// Parse numeric values
			const userIdNum = parseInt(userId);
			const durationNum = duration ? parseInt(duration) : 0;
			const lat = latitude ? parseFloat(latitude) : null;
			const lon = longitude ? parseFloat(longitude) : null;

			// Validate userId is valid number
			if (isNaN(userIdNum)) {
				return fail(400, { error: 'Invalid user selection', field: 'userId' });
			}

			// 3. Use the db instance to insert
			await db.insert(videos).values({
				id: videoId,
				title: title.trim(),
				description: description.trim(),
				userId: userIdNum,
				videoUrl: videoUrl.trim(),
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