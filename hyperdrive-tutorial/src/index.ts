import { Client } from "pg";

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Headers": "content-type",
	"Access-Control-Allow-Methods": "GET,POST,OPTIONS"
} as const;

const DEFAULT_AVATAR = "https://i.pravatar.cc/150?img=15";
const DEFAULT_THUMBNAIL = "https://placehold.co/400x225?text=Video";

interface HyperdriveBinding {
	connectionString: string;
}

export interface Env {
	HYPERDRIVE: HyperdriveBinding;
}

type VideoRow = {
	id: string;
	title: string;
	description: string;
	user_id: number;
	video_url: string | null;
	thumbnail_url: string | null;
	duration: number | null;
	uploaded_at: string | Date | null;
	created_at: string | Date | null;
	views: number | null;
	likes: number | null;
	latitude: string | number | null;
	longitude: string | number | null;
	transcript: string | null;
	user_name: string;
	user_slug: string;
	user_avatar: string | null;
};

type VideoTagRow = {
	video_id: string;
	tag: string | null;
};

type VideoListResponse = Video[];

type UserRow = {
	id: number;
	slug: string;
	name: string;
	avatar: string | null;
	bio: string | null;
	created_at: string | Date | null;
};

type FollowRow = {
	follower_id: number;
	following_id: number;
};

type UserVideoRow = {
	id: string;
	title: string;
	thumbnail_url: string | null;
	duration: number | null;
	user_id: number;
};

export interface Location {
	setting?: string;
	environment?: string;
	startTime?: number;
	endTime?: number;
	isExterior?: number;
	isDay?: number;
	longitude?: number;
	latitude?: number;
	mapLat?: number;
	mapLon?: number;
	isGuess?: boolean;
	id?: number;
	name?: string;
	coordinates?: [number, number];
}

export interface Video {
	id: string;
	title: string;
	description: string;
	author: string;
	authorId: string;
	duration: number;
	uploadedAt?: string;
	uploadDate?: string;
	url?: string;
	videoUrl?: string;
	thumbnailUrl?: string;
	locations: Location[];
	keywords: string[];
	transcript?: string;
	views: number;
	likes: number;
	timestamp?: string;
}

export interface UserVideoSummary {
	id: string;
	title: string;
	thumbnail: string;
	duration: number;
}

export interface UserStats {
	videos: number;
	followers: number;
	following: number;
}

export interface User {
	id: string;
	name: string;
	avatar: string;
	bio: string;
	stats: UserStats;
	videos: UserVideoSummary[];
	email?: string;
	subscribers: number;
	joinedAt?: string;
	verified?: boolean;
	recentVideos: UserVideoSummary[];
}

interface CreateVideoPayload {
	id?: string;
	title: string;
	description: string;
	userId: number | string;
	videoUrl?: string;
	thumbnailUrl?: string;
	duration?: number;
	uploadedAt?: string;
	latitude?: number;
	longitude?: number;
	transcript?: string | null;
	views?: number;
	likes?: number;
	tags?: string[];
}

function toIsoString(value: unknown): string | undefined {
	if (!value) return undefined;
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === "string" && value.length > 0) {
		const date = new Date(value);
		if (!Number.isNaN(date.getTime())) {
			return date.toISOString();
		}
	}
	return undefined;
}

function toNumber(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}
	if (typeof value === "string" && value.trim().length) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function createVideoFromRow(row: VideoRow, tags: string[]): Video {
	const latitude = toNumber(row.latitude);
	const longitude = toNumber(row.longitude);
	const uploadedAt = toIsoString(row.uploaded_at);
	const createdAt = toIsoString(row.created_at);
	const locations =
		latitude !== null && longitude !== null
			? [
					{
						name: row.title,
						coordinates: [longitude, latitude] as [number, number],
						latitude,
						longitude,
						mapLat: latitude,
						mapLon: longitude,
						isExterior: 1,
						isDay: 1,
						isGuess: false,
						startTime: 0,
						endTime: 0
					}
				]
			: [];

	return {
		id: row.id,
		title: row.title,
		description: row.description,
		author: row.user_name,
		authorId: row.user_slug,
		duration: toNumber(row.duration) ?? 0,
		uploadedAt,
		uploadDate: uploadedAt,
		url: row.video_url ?? undefined,
		videoUrl: row.video_url ?? undefined,
		thumbnailUrl: row.thumbnail_url ?? undefined,
		locations,
		keywords: tags,
		transcript: row.transcript ?? "Transcript not available.",
		views: toNumber(row.views) ?? 0,
		likes: toNumber(row.likes) ?? 0,
		timestamp: uploadedAt ?? createdAt
	};
}

function createUserSummaryRows(rows: UserVideoRow[]): Map<number, UserVideoSummary[]> {
	const summaries = new Map<number, UserVideoSummary[]>();
	for (const row of rows) {
		const list = summaries.get(row.user_id) ?? [];
		list.push({
			id: row.id,
			title: row.title,
			thumbnail: row.thumbnail_url ?? DEFAULT_THUMBNAIL,
			duration: toNumber(row.duration) ?? 0
		});
		summaries.set(row.user_id, list);
	}
	return summaries;
}

function createFollowMaps(rows: FollowRow[]) {
	const followers = new Map<number, Set<number>>();
	const following = new Map<number, Set<number>>();

	for (const row of rows) {
		const followersSet = followers.get(row.following_id) ?? new Set<number>();
		followersSet.add(row.follower_id);
		followers.set(row.following_id, followersSet);

		const followingSet = following.get(row.follower_id) ?? new Set<number>();
		followingSet.add(row.following_id);
		following.set(row.follower_id, followingSet);
	}

	return { followers, following };
}

function mapUserRow(
	row: UserRow,
	options: { videos: UserVideoSummary[]; followers: number; following: number }
): User {
	const joinedAt = toIsoString(row.created_at);
	const { videos, followers, following } = options;

	return {
		id: row.slug,
		name: row.name,
		avatar: row.avatar ?? DEFAULT_AVATAR,
		bio: row.bio ?? "",
		stats: {
			videos: videos.length,
			followers,
			following
		},
		videos,
		recentVideos: videos.slice(0, 3),
		subscribers: followers,
		joinedAt
	};
}

async function getPgClient(env: Env) {
	const client = new Client({ connectionString: env.HYPERDRIVE.connectionString });
	await client.connect();
	return client;
}

async function listVideos(client: Client): Promise<VideoListResponse> {
	const { rows } = await client.query<VideoRow>(
		`SELECT
			v.id,
			v.title,
			v.description,
			v.user_id,
			v.video_url,
			v.thumbnail_url,
			v.duration,
			v.uploaded_at,
			v.created_at,
			v.views,
			v.likes,
			v.latitude,
			v.longitude,
			v.transcript,
			u.name AS user_name,
			u.slug AS user_slug,
			u.avatar AS user_avatar
		FROM videos v
		INNER JOIN users u ON u.id = v.user_id
		ORDER BY v.created_at DESC`
	);

	if (rows.length === 0) {
		return [];
	}

	const ids = rows.map((row) => row.id);
	const tagRows = await client.query<VideoTagRow>(
		`SELECT vt.video_id, t.name AS tag
		 FROM video_tags vt
		 INNER JOIN tags t ON t.id = vt.tag_id
		 WHERE vt.video_id = ANY($1::text[])`,
		[ids]
	);

	const tagsByVideo = new Map<string, string[]>();
	for (const tag of tagRows.rows) {
		const list = tagsByVideo.get(tag.video_id) ?? [];
		if (typeof tag.tag === "string" && tag.tag.length) {
			list.push(tag.tag);
			tagsByVideo.set(tag.video_id, list);
		}
	}

	return rows.map((row) => createVideoFromRow(row, tagsByVideo.get(row.id) ?? []));
}

async function getVideo(client: Client, id: string): Promise<Video | null> {
	const { rows } = await client.query<VideoRow>(
		`SELECT
			v.id,
			v.title,
			v.description,
			v.user_id,
			v.video_url,
			v.thumbnail_url,
			v.duration,
			v.uploaded_at,
			v.created_at,
			v.views,
			v.likes,
			v.latitude,
			v.longitude,
			v.transcript,
			u.name AS user_name,
			u.slug AS user_slug,
			u.avatar AS user_avatar
		FROM videos v
		INNER JOIN users u ON u.id = v.user_id
		WHERE v.id = $1
		LIMIT 1`,
		[id]
	);

	if (!rows.length) return null;

	const tagRows = await client.query<VideoTagRow>(
		`SELECT vt.video_id, t.name AS tag
		 FROM video_tags vt
		 INNER JOIN tags t ON t.id = vt.tag_id
		 WHERE vt.video_id = $1`,
		[id]
	);

	const tags = tagRows.rows
		.map((row) => (typeof row.tag === "string" ? row.tag : null))
		.filter((tag): tag is string => Boolean(tag));

	return createVideoFromRow(rows[0]!, tags);
}

async function listUsers(client: Client): Promise<User[]> {
	const [userResult, videoResult, followResult] = await Promise.all([
		client.query<UserRow>(`SELECT id, slug, name, avatar, bio, created_at FROM users`),
		client.query<UserVideoRow>(
			`SELECT id, title, thumbnail_url, duration, user_id
			 FROM videos
			 ORDER BY created_at DESC`
		),
		client.query<FollowRow>(`SELECT follower_id, following_id FROM user_follows`)
	]);

	const videosByUser = createUserSummaryRows(videoResult.rows);
	const { followers, following } = createFollowMaps(followResult.rows);

	return userResult.rows.map((row) => {
		const videoSummaries = videosByUser.get(row.id) ?? [];
		const followerCount = followers.get(row.id)?.size ?? 0;
		const followingCount = following.get(row.id)?.size ?? 0;

		return mapUserRow(row, {
			videos: videoSummaries,
			followers: followerCount,
			following: followingCount
		});
	});
}

async function getUserBySlug(client: Client, slug: string): Promise<User | null> {
	const { rows } = await client.query<UserRow>(
		`SELECT id, slug, name, avatar, bio, created_at
		 FROM users
		 WHERE slug = $1
		 LIMIT 1`,
		[slug]
	);

	if (!rows.length) {
		return null;
	}

	const userId = rows[0]!.id;

	const [videoResult, followerResult, followingResult] = await Promise.all([
		client.query<UserVideoRow>(
			`SELECT id, title, thumbnail_url, duration, user_id
			 FROM videos
			 WHERE user_id = $1
			 ORDER BY created_at DESC`,
			[userId]
		),
		client.query<FollowRow>(
			`SELECT follower_id, following_id
			 FROM user_follows
			 WHERE following_id = $1`,
			[userId]
		),
		client.query<FollowRow>(
			`SELECT follower_id, following_id
			 FROM user_follows
			 WHERE follower_id = $1`,
			[userId]
		)
	]);

	const videos = createUserSummaryRows(videoResult.rows).get(userId) ?? [];
	const followerCount = new Set(followerResult.rows.map((row) => row.follower_id)).size;
	const followingCount = new Set(followingResult.rows.map((row) => row.following_id)).size;

	return mapUserRow(rows[0]!, {
		videos,
		followers: followerCount,
		following: followingCount
	});
}

async function ensureTagIds(client: Client, tags: string[]): Promise<number[]> {
	const ids: number[] = [];

	for (const tag of tags) {
		const normalized = tag.trim();
		if (!normalized.length) continue;

		const result = await client.query<{ id: number }>(
			`INSERT INTO tags (name)
			 VALUES ($1)
			 ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
			 RETURNING id`,
			[normalized]
		);

		if (result.rows[0]?.id) {
			ids.push(result.rows[0].id);
		}
	}

	return ids;
}

async function createVideo(client: Client, payload: CreateVideoPayload): Promise<Video> {
	const userId = Number(payload.userId);
	if (!Number.isInteger(userId)) {
		throw new Error("Invalid userId. Expecting a numeric identifier.");
	}

	const id =
		(typeof payload.id === "string" && payload.id.length > 0
			? payload.id
			: crypto.randomUUID().replace(/-/g, "").slice(0, 12));

	const uploadedAt = payload.uploadedAt ? new Date(payload.uploadedAt) : new Date();
	if (Number.isNaN(uploadedAt.getTime())) {
		throw new Error("uploadedAt is not a valid date.");
	}

	const latitude = payload.latitude ?? null;
	const longitude = payload.longitude ?? null;
	const duration = payload.duration ?? 0;
	const transcript = payload.transcript ?? null;
	const views = payload.views ?? 0;
	const likes = payload.likes ?? 0;

	await client.query("BEGIN");
	try {
		await client.query(
			`INSERT INTO videos (
				id,
				title,
				description,
				user_id,
				video_url,
				thumbnail_url,
				duration,
				uploaded_at,
				latitude,
				longitude,
				transcript,
				views,
				likes
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			ON CONFLICT (id) DO UPDATE SET
				title = EXCLUDED.title,
				description = EXCLUDED.description,
				user_id = EXCLUDED.user_id,
				video_url = EXCLUDED.video_url,
				thumbnail_url = EXCLUDED.thumbnail_url,
				duration = EXCLUDED.duration,
				uploaded_at = EXCLUDED.uploaded_at,
				latitude = EXCLUDED.latitude,
				longitude = EXCLUDED.longitude,
				transcript = EXCLUDED.transcript,
				views = EXCLUDED.views,
				likes = EXCLUDED.likes`,
			[
				id,
				payload.title,
				payload.description,
				userId,
				payload.videoUrl ?? null,
				payload.thumbnailUrl ?? null,
				duration,
				uploadedAt.toISOString(),
				latitude,
				longitude,
				transcript,
				views,
				likes
			]
		);

		const tags = payload.tags ?? [];
		if (tags.length) {
			const tagIds = await ensureTagIds(client, tags);
			for (const tagId of tagIds) {
				await client.query(
					`INSERT INTO video_tags (video_id, tag_id)
					 VALUES ($1, $2)
					 ON CONFLICT DO NOTHING`,
					[id, tagId]
				);
			}
		}

		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}

	const video = await getVideo(client, id);
	if (!video) {
		throw new Error("Video insert succeeded but the record could not be fetched.");
	}
	return video;
}

function json<T>(data: T, init?: ResponseInit): Response {
	return Response.json(data, {
		...init,
		headers: {
			"content-type": "application/json",
			...CORS_HEADERS,
			...(init?.headers ?? {})
		}
	});
}

function errorResponse(message: string, status = 500): Response {
	return json({ error: message }, { status });
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname.replace(/\/+$/, "") || "/";

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}

		if (request.method === "GET" && pathname === "/health") {
			try {
				const client = await getPgClient(env);
				const result = await client.query<{ now: string }>("SELECT NOW()");
				await client.end();
				return json({ ok: true, time: result.rows[0]?.now ?? null });
			} catch (error) {
				console.error("Health check failed", error);
				return errorResponse("Database unreachable", 503);
			}
		}

		if (request.method === "GET" && pathname === "/") {
			return json({
				service: "rushes-hyperdrive",
				endpoints: ["/videos", "/videos/:id", "/users", "/users/:slug"],
				ok: true
			});
		}

		let client: Client | null = null;
		try {
			client = await getPgClient(env);

			if (request.method === "GET" && pathname === "/videos") {
				const videos = await listVideos(client);
				return json({ videos });
			}

			if (request.method === "GET" && pathname.startsWith("/videos/")) {
				const id = pathname.split("/")[2];
				if (!id) {
					return errorResponse("Video id is required.", 400);
				}
				const video = await getVideo(client, id);
				if (!video) {
					return errorResponse("Video not found.", 404);
				}
				return json({ video });
			}

			if (request.method === "GET" && pathname === "/users") {
				const users = await listUsers(client);
				return json({ users });
			}

			if (request.method === "GET" && pathname.startsWith("/users/")) {
				const slug = pathname.split("/")[2];
				if (!slug) {
					return errorResponse("User slug is required.", 400);
				}
				const user = await getUserBySlug(client, slug);
				if (!user) {
					return errorResponse("User not found.", 404);
				}
				return json({ user });
			}

			if (request.method === "POST" && pathname === "/videos") {
				const contentType = request.headers.get("content-type") ?? "";
				let payload: CreateVideoPayload;

				if (contentType.includes("application/json")) {
					payload = (await request.json()) as CreateVideoPayload;
				} else {
					return errorResponse("Unsupported content type. Use application/json.", 415);
				}

				if (!payload.title || !payload.description || payload.userId === undefined) {
					return errorResponse(
						"Missing required fields: title, description and userId are required.",
						400
					);
				}

				const video = await createVideo(client, payload);
				return json({ video }, { status: 201 });
			}

			return errorResponse("Not found.", 404);
		} catch (error) {
			console.error("Worker error:", error);
			const message = error instanceof Error ? error.message : "Internal error";
			return errorResponse(message, 500);
		} finally {
			if (client) {
				try {
					await client.end();
				} catch (endError) {
					console.error("Failed to close database connection:", endError);
				}
			}
		}
	}
} satisfies ExportedHandler<Env>;
