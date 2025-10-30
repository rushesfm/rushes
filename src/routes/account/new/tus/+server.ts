import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload';

function resolveEnv(
	platformEnv: Record<string, string | undefined> | undefined,
	key: string
): string | undefined {
	return platformEnv?.[key] ?? process.env[key];
}

function buildStreamHost(hostname: string | undefined): string | null {
	if (!hostname) return null;
	const cleaned = hostname.replace(/^https?:\/\//, '').replace(/\/+$/, '');
	return cleaned.length ? cleaned : null;
}

async function sha256Hex(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const cryptoApi = globalThis.crypto?.subtle;
	if (!cryptoApi) {
		throw new Error('Web Crypto API is not available in this environment.');
	}
	const digest = await cryptoApi.digest('SHA-256', data);
	const bytes = Array.from(new Uint8Array(digest));
	return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const POST: RequestHandler = async ({ request, platform, fetch }) => {
	const body = await request.json().catch(() => null);

	if (!body || typeof body !== 'object') {
		throw error(400, 'Invalid request payload');
	}

	const title = typeof body.title === 'string' && body.title.trim().length > 0 ? body.title.trim() : null;
	const collection =
		typeof body.collection === 'string' && body.collection.trim().length > 0 ? body.collection.trim() : undefined;
	const thumbnailTime =
		typeof body.thumbnailTime === 'number' && Number.isFinite(body.thumbnailTime)
			? Math.max(0, Math.floor(body.thumbnailTime))
			: undefined;

	if (!title) {
		throw error(400, 'Video title is required.');
	}

	const platformEnv = platform?.env as Record<string, string | undefined> | undefined;
	const libraryId = resolveEnv(platformEnv, 'BUNNY_VIDEO_LIBRARY_ID');
	const apiKey = resolveEnv(platformEnv, 'BUNNY_API_CODE');
	const cdnHost = buildStreamHost(resolveEnv(platformEnv, 'BUNNY_CDN_HOST_NAME'));

	if (!libraryId || !apiKey) {
		throw error(500, 'Bunny Stream environment variables are not configured.');
	}

	const createVideoResponse = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			AccessKey: apiKey
		},
		body: JSON.stringify({
			title,
			collection,
			thumbnailTime
		})
	});

	if (!createVideoResponse.ok) {
		const message = await createVideoResponse
			.json()
			.catch(() => ({ message: createVideoResponse.statusText || 'Failed to create Bunny video.' }));
		console.error('Bunny create video failed:', message);
		throw error(502, 'Failed to create video on Bunny Stream.');
	}

	const createdVideo = (await createVideoResponse.json()) as {
		guid?: string;
		videoLibraryId?: number;
		id?: number;
	};

	const videoId = createdVideo?.guid;
	if (!videoId) {
		console.error('Unexpected Bunny create video response:', createdVideo);
		throw error(502, 'Bunny Stream did not return a video identifier.');
	}

	const expirationSeconds = Math.floor(Date.now() / 1000) + 60 * 60; // Allow uploads for 1 hour
	const signatureSource = `${libraryId}${apiKey}${expirationSeconds}${videoId}`;
	const signature = await sha256Hex(signatureSource);

	return json({
		videoId,
		expires: expirationSeconds,
		signature,
		libraryId,
		uploadUrl: TUS_ENDPOINT,
		cdnHost
	});
};
