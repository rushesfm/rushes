import { writable } from 'svelte/store';

export interface SelectedVideoState {
	id: string | null;
	queue: string[];
	isFullScreen: boolean;
	history: string[];
}

const initialState: SelectedVideoState = {
	id: null,
	queue: [],
	isFullScreen: false,
	history: []
};

function resolveNext(state: SelectedVideoState): string | null {
	if (!state.id || state.queue.length === 0) return null;

	const index = state.queue.indexOf(state.id);
	if (index === -1) return state.queue[0] ?? null;
	if (index === state.queue.length - 1) return state.queue[0] ?? null;
	return state.queue[index + 1] ?? null;
}

function resolvePrevious(state: SelectedVideoState): string | null {
	if (!state.id || state.queue.length === 0) return null;

	const index = state.queue.indexOf(state.id);
	if (index === -1) return state.queue[state.queue.length - 1] ?? null;
	if (index === 0) return state.queue[state.queue.length - 1] ?? null;
	return state.queue[index - 1] ?? null;
}

function createSelectedVideoStore() {
	const store = writable<SelectedVideoState>({ ...initialState });
	let snapshot = initialState;

	store.subscribe((value) => {
		snapshot = value;
	});

	function setQueue(videoIds: string[]) {
		store.update((current) => ({
			...current,
			queue: [...videoIds]
		}));
	}

	function selectVideo(id: string | null) {
		store.update((current) => {
			if (current.id === id) return current;
			const history = current.id ? [...current.history, current.id] : [...current.history];
			return {
				...current,
				id,
				isFullScreen: false,
				history
			};
		});
	}

	function playNext() {
		const next = resolveNext(snapshot);
		if (next) {
			selectVideo(next);
		}
	}

	function playPrevious() {
		const previous = resolvePrevious(snapshot);
		if (previous) {
			selectVideo(previous);
		}
	}

	function toggleFullScreen(force?: boolean) {
		store.update((current) => {
			const nextValue = typeof force === 'boolean' ? force : !current.isFullScreen;
			if (current.isFullScreen === nextValue) return current;
			return { ...current, isFullScreen: nextValue };
		});
	}

	function setFullScreen(value: boolean) {
		store.update((current) => {
			if (current.isFullScreen === value) return current;
			return { ...current, isFullScreen: value };
		});
	}

	function reset() {
		store.set({ ...initialState });
	}

	return {
		subscribe: store.subscribe,
		selectVideo,
		setQueue,
		playNext,
		playPrevious,
		toggleFullScreen,
		setFullScreen,
		reset,
		get id() {
			return snapshot.id;
		},
		get queue() {
			return [...snapshot.queue];
		},
		get isFullScreen() {
			return snapshot.isFullScreen;
		},
		get history() {
			return [...snapshot.history];
		},
		get nextVideoId() {
			return resolveNext(snapshot);
		},
		get previousVideoId() {
			return resolvePrevious(snapshot);
		}
	};
}

export const selectedVideo = createSelectedVideoStore();
