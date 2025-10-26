/**
 * Central player state store using Svelte 5 runes
 * Manages video playback state and seeking operations
 */

let currentTime = $state(0);
let duration = $state(0);
let isPlaying = $state(false);
let seekRequested = $state<number | null>(null);

/**
 * Request a seek to a specific time in the video
 * This will trigger the video player to update its position
 */
export function seekTo(time: number) {
	if (time < 0 || !isFinite(time)) return;
	seekRequested = time;
	currentTime = time;
}

/**
 * Update the current playback time
 * Should be called by the video player as it plays
 */
export function updateCurrentTime(time: number) {
	currentTime = time;
	// Clear seek request after it's been applied
	if (seekRequested !== null && Math.abs(seekRequested - time) < 0.5) {
		seekRequested = null;
	}
}

/**
 * Update the video duration
 * Should be called when video metadata is loaded
 */
export function updateDuration(dur: number) {
	duration = dur;
}

/**
 * Update the playing state
 */
export function updatePlayingState(playing: boolean) {
	isPlaying = playing;
}

/**
 * Clear seek request flag
 * Used internally after seek has been applied
 */
export function clearSeekRequest() {
	seekRequested = null;
}

/**
 * Get the current player state
 * These are reactive getters using Svelte 5 runes
 */
export function getPlayerState() {
	return {
		get currentTime() {
			return currentTime;
		},
		get duration() {
			return duration;
		},
		get isPlaying() {
			return isPlaying;
		},
		get seekRequested() {
			return seekRequested;
		}
	};
}
