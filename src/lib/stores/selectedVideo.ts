import { writable } from 'svelte/store';

export type QueueContextType = 'keyword' | 'date' | 'user' | null;

export interface QueueContext {
	type: QueueContextType;
	label: string;
	videoIds: string[];
}

export interface SelectedVideoState {
	id: string | null;
	queue: string[];
	isFullScreen: boolean;
	history: string[];
	queueContext: QueueContext | null;
	originalQueue: string[];
	defaultLiveQueue: string[];
}

const initialState: SelectedVideoState = {
	id: null,
	queue: [],
	isFullScreen: false,
	history: [],
	queueContext: null,
	originalQueue: [],
	defaultLiveQueue: []
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
			queue: [...videoIds],
			// If we're setting the queue and there's no active queue context, update default live queue
			defaultLiveQueue: !current.queueContext ? [...videoIds] : current.defaultLiveQueue
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
		} else {
			// If no next video in current queue and we have a queue context,
			// restore the original queue
			if (snapshot.queueContext) {
				clearQueueContext();
			}
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

	function setTemporaryQueue(videoIds: string[], context: QueueContext) {
		store.update((current) => {
			// Always use the default live queue as the original queue to restore to
			// If defaultLiveQueue is empty, use current.queue as fallback
			const defaultQueue = current.defaultLiveQueue.length > 0 
				? current.defaultLiveQueue 
				: current.queue;
			
			// Set the temporary queue
			const firstVideoId = videoIds[0] ?? null;
			
			return {
				...current,
				queue: [...videoIds],
				queueContext: context,
				originalQueue: [...defaultQueue],
				id: firstVideoId
			};
		});
	}

	function clearQueueContext() {
		store.update((current) => {
			// Always restore to the default live queue (full video library)
			// Prefer originalQueue if it was saved, otherwise use defaultLiveQueue, fallback to current.queue
			const restoreQueue = current.originalQueue.length > 0 
				? current.originalQueue 
				: (current.defaultLiveQueue.length > 0 ? current.defaultLiveQueue : current.queue);
			
			// Restore the queue and set ID to "home" to trigger live playback computation
			// The layout will compute the correct live video based on current timestamp
			return {
				...current,
				queue: [...restoreQueue],
				queueContext: null,
				originalQueue: [],
				id: "home"
			};
		});
	}

	function reset() {
		store.set({ ...initialState });
	}

	return {
		subscribe: store.subscribe,
		selectVideo,
		setQueue,
		setTemporaryQueue,
		clearQueueContext,
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
		get queueContext() {
			return snapshot.queueContext;
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
