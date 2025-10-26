// src/routes/+layout.server.ts

import type { LayoutServerLoad } from './$types';
import { getAllVideos } from '$lib/server/db/videos';
import { getAllUsers } from '$lib/server/db/users';
import { getDb } from '$lib/server/db'; // <-- Import your factory function

const DATABASE_TIMEOUT_MS = 10000;

export const load: LayoutServerLoad = async ({ platform }) => {
	console.log('--- LAYOUT SERVER LOAD START ---');

	if (!platform?.env.DATABASE_URL) {
		console.error('Failed to load: DATABASE_URL binding not found.');
		return { videos: [], users: [], error: 'Database not configured.' };
	}

	// 1. Create the db instance from the binding
	const db = getDb(platform.env.DATABASE_URL);

	console.log('Attempting to fetch videos and users...');

	try {
		// 2. Pass the db instance to your imported functions
		const [videos, users] = (await Promise.race([
			Promise.all([
				getAllVideos(db), // <-- Use the imported function
				getAllUsers(db) // <-- Use the imported function
			]),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Database query timeout')), DATABASE_TIMEOUT_MS)
			)
		])) as [Awaited<ReturnType<typeof getAllVideos>>, Awaited<ReturnType<typeof getAllUsers>>];

		console.log(`Successfully fetched ${videos.length} videos and ${users.length} users.`);

		return {
			videos,
			users
		};
	} catch (error) {
		console.error('Failed to load initial data:', error);
		return {
			videos: [],
			users: [],
			error: error instanceof Error ? error.message : 'Failed to load content'
		};
	}
};
