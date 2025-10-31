// src/lib/server/db/videos.ts

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { users, videos, videoTags, tags } from './schema';
import { desc, eq, inArray, getTableColumns } from 'drizzle-orm';
import type { Video } from '$lib/types/content';

// Define the type for your database instance
type DrizzleDb = PostgresJsDatabase<typeof schema>;

const videoColumns = getTableColumns(videos);

function cleanHost(hostname: string | null | undefined): string | null {
    if (!hostname) return null;
    const cleaned = hostname.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return cleaned.length ? cleaned : null;
}

function buildStreamUrl(hostname: string | null | undefined, streamId: string | null | undefined): string | undefined {
    const cleanedHost = cleanHost(hostname ?? process.env.BUNNY_CDN_HOST_NAME ?? '');
    const trimmedStream = typeof streamId === 'string' ? streamId.trim() : '';
    if (!cleanedHost || !trimmedStream) return undefined;
    return `https://${cleanedHost}/${trimmedStream}/playlist.m3u8`;
}

function buildThumbnailUrl(hostname: string | null | undefined, streamId: string | null | undefined): string | undefined {
    const cleanedHost = cleanHost(hostname ?? process.env.BUNNY_CDN_HOST_NAME ?? '');
    const trimmedStream = typeof streamId === 'string' ? streamId.trim() : '';
    if (!cleanedHost || !trimmedStream) return undefined;
    return `https://${cleanedHost}/${trimmedStream}/thumbnail.jpg`;
}

type SelectedVideoRow = typeof videos.$inferSelect & {
	userName: string;
	userSlug: string;
	userAvatar: string | null;
};

// --- Internal Helper Function ---

function mapRowToVideo(row: SelectedVideoRow, cdnHostname?: string | null) {
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

    const streamId = typeof row.streamId === 'string' ? row.streamId : undefined;
    const videoUrl = buildStreamUrl(cdnHostname ?? process.env.BUNNY_CDN_HOST_NAME, streamId) ?? undefined;
    const thumbnailUrl = buildThumbnailUrl(cdnHostname ?? process.env.BUNNY_CDN_HOST_NAME, streamId);

    return {
        id: row.id,
        title: row.title,
        description: row.description,
        author: row.userName,
        authorId: row.userSlug,
        duration: row.duration ?? 0,
        uploadedAt,
        uploadDate: uploadedAt,
        createdAt,
        url: videoUrl,
        videoUrl,
        thumbnailUrl,
        streamId,
        format: row.format ?? undefined,
        aspectRatio: row.aspectRatio ?? undefined,
		locations: coordinates,
		transcript: row.transcript ?? 'Transcript not available.',
		keywords: [] as string[],
		views: row.views ?? 0,
		likes: row.likes ?? 0,
		timestamp: uploadedAt ?? createdAt
	} satisfies Video;
}

// --- Exported Database Functions ---

export async function getAllVideos(db: DrizzleDb, cdnHostname?: string | null): Promise<Video[]> {
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
		const mapped = mapRowToVideo(row, cdnHostname);
		mapped.keywords = tagsByVideo.get(row.id) ?? [];
		return mapped;
	});
}

export async function getVideoById(db: DrizzleDb, id: string, cdnHostname?: string | null): Promise<Video | null> {
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

	const video = mapRowToVideo(rows[0] as SelectedVideoRow, cdnHostname);
	video.keywords = videoTagsRows.map((row) => row.tag ?? '').filter(Boolean);
	return video;
}

export async function getVideosByUserId(db: DrizzleDb, userId: number, cdnHostname?: string | null): Promise<Video[]> {
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
		const mapped = mapRowToVideo(row, cdnHostname);
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
		uploadedAt?: Date | null;
		duration?: number | null;
		streamId?: string | null;
		format?: string | null;
		aspectRatio?: string | null;
	}
): Promise<void> {
	await db
		.update(videos)
		.set(updates)
		.where(eq(videos.id, id))
		.execute();
}

export async function updateVideoTags(
	db: DrizzleDb,
	videoId: string,
	tagNames: string[]
): Promise<void> {
	// First, delete all existing tags for this video
	await db
		.delete(videoTags)
		.where(eq(videoTags.videoId, videoId))
		.execute();

	if (tagNames.length === 0) {
		return;
	}

	// Get or create tags
	const tagIds: number[] = [];
	for (const tagName of tagNames) {
		const trimmedTag = tagName.trim();
		if (!trimmedTag) continue;

		// Try to find existing tag
		const existingTags = await db
			.select()
			.from(tags)
			.where(eq(tags.name, trimmedTag))
			.limit(1)
			.execute();

		let tagId: number;
		if (existingTags.length > 0) {
			tagId = existingTags[0].id;
		} else {
			// Create new tag
			const newTags = await db
				.insert(tags)
				.values({ name: trimmedTag })
				.returning({ id: tags.id })
				.execute();
			tagId = newTags[0].id;
		}
		tagIds.push(tagId);
	}

	// Create video-tag associations
	if (tagIds.length > 0) {
		await db
			.insert(videoTags)
			.values(tagIds.map(tagId => ({ videoId, tagId })))
			.execute();
	}
}
