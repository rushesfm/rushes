// src/lib/server/db/users.ts

import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { users, videos, userFollows } from './schema';
import type { User, UserVideoSummary } from '$lib/types/content';
import { eq } from 'drizzle-orm';

// Define the type for your database instance
type DrizzleDb = PostgresJsDatabase<typeof schema>;

const DEFAULT_AVATAR = 'https://i.pravatar.cc/150?img=15';
const DEFAULT_THUMBNAIL = 'https://placehold.co/400x225?text=Video';

// --- Internal Helper Functions ---

function summariseVideos(rows: Array<{
    id: string;
    title: string;
    thumbnailUrl: string | null;
    duration: number | null;
    userId: number;
}>): Map<number, UserVideoSummary[]> {
    const map = new Map<number, UserVideoSummary[]>();
    for (const row of rows) {
        const entry = map.get(row.userId) ?? [];
        entry.push({
            id: row.id,
            title: row.title,
            thumbnail: row.thumbnailUrl ?? DEFAULT_THUMBNAIL,
            duration: row.duration ?? 0
        });
        map.set(row.userId, entry);
    }
    return map;
}

function computeFollowMaps(rows: Array<{ followerId: number; followingId: number }>) {
    const followers = new Map<number, Set<number>>();
    const following = new Map<number, Set<number>>();

    for (const row of rows) {
        const followersSet = followers.get(row.followingId) ?? new Set<number>();
        followersSet.add(row.followerId);
        followers.set(row.followingId, followersSet);

        const followingSet = following.get(row.followerId) ?? new Set<number>();
        followingSet.add(row.followingId);
        following.set(row.followerId, followingSet);
    }

    return { followers, following };
}

function formatUser(row: typeof users.$inferSelect, options: {
    videos: UserVideoSummary[];
    followers: number;
    following: number;
}): User {
    const { videos, followers, following } = options;
    return {
        id: row.slug,
        name: row.name,
        avatar: row.avatar ?? DEFAULT_AVATAR,
        bio: row.bio ?? '',
        stats: {
            videos: videos.length,
            followers,
            following
        },
        videos,
        recentVideos: videos.slice(0, 3),
        subscribers: followers,
        joinedAt: row.createdAt ?? undefined
    };
}

// --- Exported Database Functions ---

export async function getAllUsers(db: DrizzleDb): Promise<User[]> {
    const userRows = await db.select().from(users).execute();
    const videoRows = await db
        .select({
            id: videos.id,
            title: videos.title,
            thumbnailUrl: videos.thumbnailUrl,
            duration: videos.duration,
            userId: videos.userId
        })
        .from(videos)
        .execute();
    const followRows = await db.select().from(userFollows).execute();

    const videosByUser = summariseVideos(videoRows);
    const { followers, following } = computeFollowMaps(followRows);

    return userRows.map((row) =>
        formatUser(row, {
            videos: videosByUser.get(row.id) ?? [],
            followers: followers.get(row.id)?.size ?? 0,
            following: following.get(row.id)?.size ?? 0
        })
    );
}

export async function getUserBySlug(db: DrizzleDb, slug: string): Promise<User | null> {
    const rows = await db.select().from(users).where(eq(users.slug, slug)).limit(1).execute();
    if (!rows.length) return null;

    const user = rows[0];
    const userVideosRows = await db
        .select({
            id: videos.id,
            title: videos.title,
            thumbnailUrl: videos.thumbnailUrl,
            duration: videos.duration,
            userId: videos.userId
        })
        .from(videos)
        .where(eq(videos.userId, user.id))
        .execute();

    const followerRows = await db
        .select({
            followerId: userFollows.followerId
        })
        .from(userFollows)
        .where(eq(userFollows.followingId, user.id))
        .execute();

    const followingRows = await db
        .select({
            followingId: userFollows.followingId
        })
        .from(userFollows)
        .where(eq(userFollows.followerId, user.id))
        .execute();

    const followersSet = new Set<number>();
    const followingSet = new Set<number>();

    for (const follower of followerRows) {
        if (typeof follower.followerId === 'number') {
            followersSet.add(follower.followerId);
        }
    }

    for (const followee of followingRows) {
        if (typeof followee.followingId === 'number') {
            followingSet.add(followee.followingId);
        }
    }

    return formatUser(user, {
        videos: summariseVideos(userVideosRows).get(user.id) ?? [],
        followers: followersSet.size,
        following: followingSet.size
    });
}