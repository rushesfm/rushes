// src/lib/server/db/videos.ts

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { users, videos, videoTags, tags } from './schema';
import { desc, eq, inArray, getTableColumns } from 'drizzle-orm';
import type { Video } from '$lib/types/content';

// Define the type for your database instance
type DrizzleDb = PostgresJsDatabase<typeof schema>;

const videoColumns = getTableColumns(videos);

type SelectedVideoRow = typeof videos.$inferSelect & {
	userName: string;
	userSlug: string;
	userAvatar: string | null;
};

// --- Internal Helper Function ---

function mapRowToVideo(row: SelectedVideoRow) {
	const coordinates =
		typeof row.latitude === 'number' && typeof row.longitude === 'number'
			? [
					{
						name: row.title,
						coordinates: [row.longitude, row.latitude] as [number, number], // GeoJSON standard: [lon, lat]
						latitude: row.latitude,
						longitude: row.longitude,
						mapLat: row.latitude,
						mapLon: row.longitude,
						isExterior: 1,
						isDay: 1,
						isGuess: false,
						startTime: 0,
						endTime: 0
					}
				]
			: [];

	const uploadedAt =
		row.uploadedAt instanceof Date ? row.uploadedAt.toISOString() : row.uploadedAt ?? undefined;
	const createdAt =
		row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt ?? undefined;

	return {
		id: row.id,
		title: row.title,
		description: row.description,
		author: row.userName,
		authorId: row.userSlug,
		duration: row.duration ?? 0,
		uploadedAt,
		uploadDate: uploadedAt,
		url: row.videoUrl ?? undefined,
		videoUrl: row.videoUrl ?? undefined,
		thumbnailUrl: row.thumbnailUrl ?? undefined,
		locations: coordinates,
		transcript: row.transcript ?? 'Transcript not available.',
	keywords: [] as string[],
		views: row.views ?? 0,
		likes: row.likes ?? 0,
		timestamp: uploadedAt ?? createdAt
	} satisfies Video;
}

// --- Exported Database Functions ---

export async function getAllVideos(db: DrizzleDb): Promise<Video[]> {
	const rows = (await db
		.select({
			...videoColumns,
			userName: users.name,
			userSlug: users.slug,
			userAvatar: users.avatar
		})
		.from(videos)
		.innerJoin(users, eq(videos.userId, users.id))
		.orderBy(desc(videos.createdAt))
		.execute()) as SelectedVideoRow[];

	const videoIds = rows
		.map((row) => row.id)
		.filter((id): id is string => typeof id === 'string' && id.length > 0);

	const tagRows =
		videoIds.length > 0
			? await db
					.select({
						videoId: videoTags.videoId,
						tag: tags.name
					})
					.from(videoTags)
					.innerJoin(tags, eq(videoTags.tagId, tags.id))
					.where(inArray(videoTags.videoId, videoIds))
					.execute()
			: [];

	const tagsByVideo = new Map<string, string[]>();
	for (const tagRow of tagRows) {
		const list = tagsByVideo.get(tagRow.videoId) ?? [];
		if (typeof tagRow.tag === 'string') {
			list.push(tagRow.tag);
			tagsByVideo.set(tagRow.videoId, list);
		}
	}

	return rows.map((row) => {
		const mapped = mapRowToVideo(row);
		mapped.keywords = tagsByVideo.get(row.id) ?? [];
		return mapped;
	});
}

export async function getVideoById(db: DrizzleDb, id: string): Promise<Video | null> {
	const rows = (await db
		.select({
			...videoColumns,
			userName: users.name,
			userSlug: users.slug,
			userAvatar: users.avatar
		})
		.from(videos)
		.innerJoin(users, eq(videos.userId, users.id))
		.where(eq(videos.id, id))
		.limit(1)
		.execute()) as SelectedVideoRow[];

	if (!rows.length) return null;

	const videoTagsRows = await db
		.select({
			videoId: videoTags.videoId,
			tag: tags.name
		})
		.from(videoTags)
		.innerJoin(tags, eq(videoTags.tagId, tags.id))
		.where(eq(videoTags.videoId, id))
		.execute();

	const video = mapRowToVideo(rows[0] as SelectedVideoRow);
	video.keywords = videoTagsRows.map((row) => row.tag ?? '').filter(Boolean);
	return video;
}

export async function getVideosByUserId(db: DrizzleDb, userId: number): Promise<Video[]> {
	const rows = (await db
		.select({
			...videoColumns,
			userName: users.name,
			userSlug: users.slug,
			userAvatar: users.avatar
		})
		.from(videos)
		.innerJoin(users, eq(videos.userId, users.id))
		.where(eq(videos.userId, userId))
		.orderBy(desc(videos.createdAt))
		.execute()) as SelectedVideoRow[];

	const videoIds = rows
		.map((row) => row.id)
		.filter((videoId): videoId is string => typeof videoId === 'string' && videoId.length > 0);

	const tagRows =
		videoIds.length > 0
			? await db
					.select({
						videoId: videoTags.videoId,
						tag: tags.name
					})
					.from(videoTags)
					.innerJoin(tags, eq(videoTags.tagId, tags.id))
					.where(inArray(videoTags.videoId, videoIds))
					.execute()
			: [];

	const tagsByVideo = new Map<string, string[]>();
	for (const tagRow of tagRows) {
		const list = tagsByVideo.get(tagRow.videoId) ?? [];
		if (typeof tagRow.tag === 'string') {
			list.push(tagRow.tag);
			tagsByVideo.set(tagRow.videoId, list);
		}
	}

	return rows.map((row) => {
		const mapped = mapRowToVideo(row);
		mapped.keywords = tagsByVideo.get(row.id) ?? [];
		return mapped;
	});
}

export async function updateVideo(
	db: DrizzleDb,
	id: string,
	updates: {
		title?: string;
		description?: string;
		latitude?: number | null;
		longitude?: number | null;
		thumbnailUrl?: string | null;
	}
): Promise<void> {
	await db
		.update(videos)
		.set(updates)
		.where(eq(videos.id, id))
		.execute();
}
