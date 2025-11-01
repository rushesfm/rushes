// src/routes/+layout.server.ts

import type { LayoutServerLoad } from './$types';
import { getAllVideos } from '$lib/server/db/videos';
import { getAllUsers } from '$lib/server/db/users';
import { getDb, getDatabaseUrl } from '$lib/server/db'; // <-- Import your factory function

const DATABASE_TIMEOUT_MS = 10000;

export const load: LayoutServerLoad = async ({ platform }) => {
	console.log('--- LAYOUT SERVER LOAD START ---');

	// Get Hyperdrive connection string or fallback to DATABASE_URL
	const databaseUrl = getDatabaseUrl(platform?.env) ?? process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error('Failed to load: Database binding not found.');
		return { videos: [], users: [], error: 'Database not configured.' };
	}

	// Get CDN hostname from platform environment
	const cdnHostname = platform?.env?.BUNNY_CDN_HOST_NAME ?? process.env.BUNNY_CDN_HOST_NAME ?? null;

	// 1. Create the db instance from the binding
	const db = getDb(databaseUrl);

	console.log('Attempting to fetch videos and users...');

	try {
		// 2. Pass the db instance and CDN hostname to your imported functions
		const [videos, users] = (await Promise.race([
			Promise.all([
				getAllVideos(db, cdnHostname), // <-- Pass CDN hostname
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
		if (error instanceof Error) {
			console.error('Failed to load initial data (details):', {
				message: error.message,
				name: error.name,
				stack: error.stack,
				cause: (error as Error & { cause?: unknown }).cause
			});
			const cause = (error as Error & { cause?: any }).cause;
			if (cause) {
				console.error('Failed to load initial data (cause details):', {
					message: cause?.message,
					name: cause?.name,
					code: cause?.code,
					detail: cause?.detail,
					schema: cause?.schema,
					table: cause?.table,
					column: cause?.column
				});
			}
			try {
				console.error('Failed to load initial data (json):', JSON.stringify({
					message: error.message,
					name: error.name,
					cause
				}));
			} catch {
				// ignore JSON serialization errors
			}
		} else {
			console.error('Failed to load initial data (non-error):', error);
			try {
				console.error('Failed to load initial data (non-error json):', JSON.stringify(error));
			} catch {
				// ignore JSON serialization errors
			}
		}
		return {
			videos: [],
			users: [],
			error: error instanceof Error ? error.message : 'Failed to load content'
		};
	}
};
