import { derived, get, writable } from 'svelte/store';
import type { Video, User } from '$lib/types/content';

export const videosStore = writable<Video[]>([]);
export const usersStore = writable<User[]>([]);

export const videosByIdStore = derived(videosStore, ($videos) => {
	const map = new Map<string, Video>();
	for (const video of $videos) {
		map.set(video.id, video);
	}
	return map;
});

export const usersByIdStore = derived(usersStore, ($users) => {
	const map = new Map<string, User>();
	for (const user of $users) {
		map.set(user.id, user);
	}
	return map;
});

export function initialiseLibrary(videos: Video[], users: User[]) {
	videosStore.set(videos);
	usersStore.set(users);
}

export function getVideoById(id: string): Video | undefined {
	return get(videosByIdStore).get(id);
}

export function getUserById(id: string): User | undefined {
	return get(usersByIdStore).get(id);
}
