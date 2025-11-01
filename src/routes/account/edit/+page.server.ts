import type { PageServerLoad, Actions } from './$types';
import { createSupabaseServerClient } from '$lib/supabase/server';
import { getDb, getDatabaseUrl } from '$lib/server/db';
import { ensureUserForAuth } from '$lib/server/db/users';
import { users, videos } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail, redirect, error } from '@sveltejs/kit';
function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
}

function sanitizeString(value: FormDataEntryValue | null): string {
	if (typeof value !== 'string') return '';
	return value.trim();
}

export const load: PageServerLoad = async (event) => {
	const supabase = createSupabaseServerClient(event);
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser();

	if (authError || !user) {
		throw redirect(303, '/account?redirectTo=/account/edit');
	}

	const databaseUrl = getDatabaseUrl(event.platform?.env) ?? process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw error(500, 'Database not configured');
	}

	const db = getDb(databaseUrl);
	const appUser = await ensureUserForAuth(db, user);

	return {
		user: {
			id: appUser.id,
			name: appUser.name,
			slug: appUser.slug,
			avatar: appUser.avatar,
			bio: appUser.bio,
			email: user.email ?? '',
			authId: appUser.authId
		}
	};
};

export const actions: Actions = {
	updateProfile: async (event) => {
		const supabase = createSupabaseServerClient(event);
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return fail(401, { error: 'You must be signed in to update your profile' });
		}

		const databaseUrl = getDatabaseUrl(event.platform?.env) ?? process.env.DATABASE_URL;
		if (!databaseUrl) {
			return fail(500, { error: 'Database not configured' });
		}

		const db = getDb(databaseUrl);
		const appUser = await ensureUserForAuth(db, user);

		const formData = await event.request.formData();
		const name = sanitizeString(formData.get('name'));
		const slugInput = sanitizeString(formData.get('slug'));
		const bio = sanitizeString(formData.get('bio'));
		const avatarFile = formData.get('avatar') as File | null;

		if (!name || name.length === 0) {
			return fail(400, { error: 'Name is required' });
		}

		if (name.length > 100) {
			return fail(400, { error: 'Name must be 100 characters or less' });
		}

		// Handle slug validation and uniqueness
		let slug = slugify(slugInput || name);
		if (slug.length === 0) {
			slug = `user-${appUser.id}`;
		}

		// Check if slug is taken by another user
		if (slug !== appUser.slug) {
			const [existing] = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.slug, slug))
				.limit(1)
				.execute();

			if (existing && existing.id !== appUser.id) {
				return fail(400, { error: 'This username is already taken' });
			}
		}

		// Handle avatar upload if provided
		let avatarUrl = appUser.avatar;
		if (avatarFile && avatarFile.size > 0 && avatarFile instanceof File) {
			// Validate file type
			if (!avatarFile.type.startsWith('image/')) {
				return fail(400, { error: 'File must be an image' });
			}

			// Validate file size (max 5MB)
			const MAX_SIZE = 5 * 1024 * 1024; // 5MB
			if (avatarFile.size > MAX_SIZE) {
				return fail(400, { error: 'Image must be smaller than 5MB' });
			}

			try {
				// Delete old avatar if exists
				if (appUser.avatar && appUser.avatar.includes('/storage/')) {
					try {
						const oldPath = appUser.avatar.split('/storage/v1/object/public/avatars/')[1];
						if (oldPath) {
							await supabase.storage.from('avatars').remove([oldPath]);
						}
					} catch (err) {
						console.error('Failed to delete old avatar:', err);
						// Continue with upload
					}
				}

				// Upload to Supabase storage
				const fileExt = avatarFile.name.split('.').pop() || 'jpg';
				const fileName = `${user.id}-${Date.now()}.${fileExt}`;
				const filePath = fileName;

				const { data: uploadData, error: uploadError } = await supabase.storage
					.from('avatars')
					.upload(filePath, avatarFile, {
						cacheControl: '3600',
						upsert: false,
						contentType: avatarFile.type
					});

				if (uploadError) {
					console.error('Avatar upload error:', uploadError);
					return fail(500, { error: 'Failed to upload avatar: ' + uploadError.message });
				}

				// Get public URL
				const {
					data: { publicUrl }
				} = supabase.storage.from('avatars').getPublicUrl(filePath);

				avatarUrl = publicUrl;

				// Update Supabase auth user metadata
				await supabase.auth.updateUser({
					data: { avatar: publicUrl }
				});
			} catch (err) {
				console.error('Avatar update error:', err);
				return fail(500, { error: 'Failed to update avatar' });
			}
		}

		// Update user in database
		await db
			.update(users)
			.set({
				name,
				slug,
				bio: bio || null,
				avatar: avatarUrl
			})
			.where(eq(users.id, appUser.id))
			.execute();

		return { success: true, message: 'Profile updated successfully' };
	},

	updateEmail: async (event) => {
		const supabase = createSupabaseServerClient(event);
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return fail(401, { error: 'You must be signed in to update your email' });
		}

		const formData = await event.request.formData();
		const newEmail = sanitizeString(formData.get('email')).toLowerCase();

		if (!newEmail || newEmail.length === 0) {
			return fail(400, { error: 'Email is required' });
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(newEmail)) {
			return fail(400, { error: 'Please enter a valid email address' });
		}

		if (newEmail === user.email) {
			return fail(400, { error: 'New email must be different from current email' });
		}

		try {
			const { error: updateError } = await supabase.auth.updateUser({
				email: newEmail
			});

			if (updateError) {
				console.error('Email update error:', updateError);
				return fail(400, { error: updateError.message || 'Failed to update email' });
			}

			return {
				success: true,
				message: 'Email update confirmation sent. Please check your new email inbox to confirm the change.'
			};
		} catch (err) {
			console.error('Email update error:', err);
			return fail(500, { error: 'Failed to update email' });
		}
	},

	updatePassword: async (event) => {
		const supabase = createSupabaseServerClient(event);
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return fail(401, { error: 'You must be signed in to update your password' });
		}

		const formData = await event.request.formData();
		const currentPassword = sanitizeString(formData.get('currentPassword'));
		const newPassword = sanitizeString(formData.get('newPassword'));
		const confirmPassword = sanitizeString(formData.get('confirmPassword'));

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { error: 'All password fields are required' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { error: 'New passwords do not match' });
		}

		if (newPassword.length < 6) {
			return fail(400, { error: 'Password must be at least 6 characters long' });
		}

		try {
			// Verify current password by attempting to sign in
			const { error: signInError } = await supabase.auth.signInWithPassword({
				email: user.email!,
				password: currentPassword
			});

			if (signInError) {
				return fail(400, { error: 'Current password is incorrect' });
			}

			// Update password
			const { error: updateError } = await supabase.auth.updateUser({
				password: newPassword
			});

			if (updateError) {
				console.error('Password update error:', updateError);
				return fail(400, { error: updateError.message || 'Failed to update password' });
			}

			return { success: true, message: 'Password updated successfully' };
		} catch (err) {
			console.error('Password update error:', err);
			return fail(500, { error: 'Failed to update password' });
		}
	},

	deleteAccount: async (event) => {
		const supabase = createSupabaseServerClient(event);
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return fail(401, { error: 'You must be signed in to delete your account' });
		}

		const databaseUrl = getDatabaseUrl(event.platform?.env) ?? process.env.DATABASE_URL;
		if (!databaseUrl) {
			return fail(500, { error: 'Database not configured' });
		}

		const db = getDb(databaseUrl);
		const appUser = await ensureUserForAuth(db, user);

		const formData = await event.request.formData();
		const confirmText = sanitizeString(formData.get('confirmText'));

		if (confirmText !== 'DELETE') {
			return fail(400, { error: 'Please type DELETE to confirm account deletion' });
		}

		try {
			// Get all user's videos to delete from BunnyCDN
			const userVideos = await db
				.select({ id: videos.id, streamId: videos.streamId })
				.from(videos)
				.where(eq(videos.userId, appUser.id))
				.execute();

			// Delete videos from BunnyCDN
			const platformEnv = event.platform?.env as Record<string, string | undefined> | undefined;
			const libraryId = platformEnv?.['BUNNY_VIDEO_LIBRARY_ID'] ?? process.env.BUNNY_VIDEO_LIBRARY_ID;
			const apiKey = platformEnv?.['BUNNY_API_CODE'] ?? process.env.BUNNY_API_CODE;

			if (libraryId && apiKey) {
				for (const video of userVideos) {
					if (video.streamId) {
						try {
							await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${video.streamId}`, {
								method: 'DELETE',
								headers: { AccessKey: apiKey }
							});
						} catch (err) {
							console.error(`Failed to delete video ${video.id} from BunnyCDN:`, err);
							// Continue with deletion even if BunnyCDN deletion fails
						}
					}
				}
			}

			// Delete user's avatar from storage if it exists
			if (appUser.avatar && appUser.avatar.includes('supabase.co/storage')) {
				try {
					const avatarPath = appUser.avatar.split('/storage/v1/object/public/avatars/')[1];
					if (avatarPath) {
						await supabase.storage.from('avatars').remove([avatarPath]);
					}
				} catch (err) {
					console.error('Failed to delete avatar from storage:', err);
					// Continue with account deletion
				}
			}

			// Delete user record (videos will cascade delete)
			await db.delete(users).where(eq(users.id, appUser.id)).execute();

			// Sign out - auth user deletion will be handled by cascade or manual cleanup
			await supabase.auth.signOut();

			throw redirect(303, '/');
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && err.status === 303) {
				throw err; // Re-throw redirect
			}
			console.error('Account deletion error:', err);
			return fail(500, { error: 'Failed to delete account. Please try again.' });
		}
	}
};

