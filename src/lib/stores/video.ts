import { writable } from 'svelte/store';

export interface ActiveVideoState {
	id: string;
	url: string;
	title: string;
	author: string;
	authorId?: string;
	thumbnailUrl?: string;
	durationSeconds?: number;
}

function createActiveVideoStore() {
	const store = writable<ActiveVideoState | null>(null);

	return {
		subscribe: store.subscribe,
		setActive(video: ActiveVideoState | null) {
			store.set(video);
		},
		clear() {
			store.set(null);
		}
	};
}

export const activeVideo = createActiveVideoStore();
