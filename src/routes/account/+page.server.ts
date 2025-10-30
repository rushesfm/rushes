import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { inviteCodesEnabled, validateInviteCode } from '$lib/server/invite-codes';
import { getDb } from '$lib/server/db';
import { getVideoById, getVideosByUserId } from '$lib/server/db/videos';
import { ensureUserForAuth } from '$lib/server/db/users';

const FALLBACK_REDIRECT = '/';

function sanitizeString(value: FormDataEntryValue | null): string {
	if (typeof value !== 'string') return '';
	return value.trim();
}

function resolveRedirectTarget(url: URL, candidate: string | null | undefined): string {
	if (!candidate || typeof candidate !== 'string') return FALLBACK_REDIRECT;
	if (!candidate.startsWith('/')) return FALLBACK_REDIRECT;
	try {
		const normalised = new URL(candidate, url.origin);
		if (normalised.origin !== url.origin) return FALLBACK_REDIRECT;
		return normalised.pathname + normalised.search + normalised.hash;
	} catch {
		return FALLBACK_REDIRECT;
	}
}

export const load: PageServerLoad = async (event) => {
	const supabase = createSupabaseServerClient(event);
	const {
		data: { user },
		error
	} = await supabase.auth.getUser();

	if (error) {
		console.error('Failed to resolve authenticated user on account load:', error);
	}

const requestUrl = event.url;
const redirectTo = resolveRedirectTarget(requestUrl, requestUrl.searchParams.get('redirectTo'));
const highlightedVideoId = requestUrl.searchParams.get('uploaded');

const databaseUrl = event.platform?.env?.DATABASE_URL ?? process.env.DATABASE_URL;
let db: ReturnType<typeof getDb> | null = null;
if (databaseUrl) {
	try {
		db = getDb(databaseUrl);
	} catch (error) {
        console.error('Failed to initialise database client for account page:', error);
    }
}

let appUser = null;
if (user && db) {
	try {
		appUser = await ensureUserForAuth(db, user);
	} catch (error) {
		console.error('Failed to ensure account user record:', error);
	}
}

let uploadedVideo = null;
if (highlightedVideoId && db) {
    try {
        uploadedVideo = await getVideoById(db, highlightedVideoId);
    } catch (error) {
        console.error('Failed to resolve uploaded video for account page:', error);
    }
}

let userVideos = null;
if (appUser && db) {
    try {
        userVideos = await getVideosByUserId(db, appUser.id);
    } catch (error) {
        console.error('Failed to fetch user videos for account page:', error);
    }
}

	return {
		inviteRequired: inviteCodesEnabled(event),
		redirectTo,
		sessionUser: user ?? null,
		uploadedVideo,
		appUser: appUser,
		userVideos: userVideos
	};
};

export const actions: Actions = {
	login: async (event) => {
		const formData = await event.request.formData();
		const email = sanitizeString(formData.get('email'));
		const password = sanitizeString(formData.get('password'));
		const redirectTo = resolveRedirectTarget(event.url, sanitizeString(formData.get('redirectTo')));

		if (!email || !password) {
			return fail(400, {
				login: {
					message: 'Email and password are required.',
					email
				}
			});
		}

		const supabase = createSupabaseServerClient(event);
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (error) {
			return fail(400, {
				login: {
					message: error.message ?? 'Unable to sign in with those credentials.',
					email
				}
			});
		}

		throw redirect(303, redirectTo);
	},
	signup: async (event) => {
		const formData = await event.request.formData();
		const name = sanitizeString(formData.get('name'));
		const email = sanitizeString(formData.get('email'));
		const password = sanitizeString(formData.get('password'));
		const inviteCode = sanitizeString(formData.get('inviteCode'));
		const redirectTo = resolveRedirectTarget(event.url, sanitizeString(formData.get('redirectTo')));

		if (!email || !password) {
			return fail(400, {
				signup: {
					message: 'Email and password are required.',
					fields: {
						name,
						email
					}
				}
			});
		}

		const inviteValidation = validateInviteCode(event, inviteCode);
		if (!inviteValidation.valid) {
			return fail(400, {
				signup: {
					message: inviteValidation.error ?? 'Invalid invite code.',
					fields: {
						name,
						email
					}
				}
			});
		}

		const supabase = createSupabaseServerClient(event);
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				data: {
					name,
					inviteCode
				},
				emailRedirectTo: new URL(redirectTo, event.url).toString()
			}
		});

		if (error) {
			return fail(400, {
				signup: {
					message: error.message ?? 'Unable to create account.',
					fields: {
						name,
						email
					}
				}
			});
		}

		if (data.session) {
			throw redirect(303, redirectTo);
		}

		return {
			signup: {
				success: true,
				message:
					'Thanks for signing up! Please check your email inbox to confirm your account before signing in.',
				fields: {
					name,
					email
				}
			}
		};
	},
	logout: async (event) => {
		const formData = await event.request.formData();
		const redirectTo = resolveRedirectTarget(event.url, sanitizeString(formData.get('redirectTo')));

		const supabase = createSupabaseServerClient(event);
		const { error } = await supabase.auth.signOut();

		if (error) {
			return fail(500, {
				logout: {
					message: error.message ?? 'Unable to sign out right now.'
				}
			});
		}

		throw redirect(303, redirectTo);
	},
	deleteVideo: async (event) => {
		const formData = await event.request.formData();
		const videoId = formData.get('videoId')?.toString();
		if (!videoId) return fail(400, { delete: { message: 'No video ID provided' } });
		const supabase = createSupabaseServerClient(event);
		const { data: { user } } = await supabase.auth.getUser();
		const databaseUrl = event.platform?.env?.DATABASE_URL ?? process.env.DATABASE_URL;
		if (!databaseUrl) return fail(500, { delete: { message: 'No DB connection' } });
		const db = getDb(databaseUrl);
		const video = await getVideoById(db, videoId);
		if (!video) return fail(404, { delete: { message: 'Video not found' } });
		// Only allow if the video is yours (authorId = user.slug or id)
		// Here we check authorId == user.id, this may need tune-up if slug is used
		if (!user || (video.authorId !== user.id && video.authorId !== user.slug)) {
			return fail(403, { delete: { message: 'No permission to delete this video' }});
		}
		// Perform the deletion
		await db.deleteFrom('videos').where(({ id }) => id.eq(videoId)).execute();
		// Redirect to /account after delete
		throw redirect(303, '/account');
	}
};
