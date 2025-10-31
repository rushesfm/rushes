<script lang="ts">
    import { onMount, onDestroy, tick } from "svelte";
    import { browser } from "$app/environment";
    import { activeVideo } from "$lib/stores/video";
    import { selectedVideo } from "$lib/stores/selectedVideo";
    import { videosStore } from "$lib/stores/library";
    import {
        seekTo,
        updateCurrentTime,
        updateDuration,
        updatePlayingState,
        getPlayerState,
    } from "$lib/stores/playerStore.svelte";
    import {
        generateMockWaveform,
        type WaveformData,
    } from "$lib/utils/waveform";

    let videoEl: HTMLVideoElement | null = null;
    let duration = $state(0);
    let currentTime = $state(0);
    let playing = $state(false);
    let rafId: number | null = null;
    let trackEl: HTMLDivElement | null = null;
    let isDragging = $state(false);
    let isScrubbing = $state(false);
    let isHovering = $state(false);
    let hoverTime = $state(0);
    let hoverX = $state(0);
    let waveformData = $state<WaveformData | null>(null);

    // Store event listeners in component scope to avoid memory leaks
    let currentListeners: {
        onTime: () => void;
        onPlay: () => void;
        onPause: () => void;
        onLoaded: () => void;
        onDurationChange: () => void;
    } | null = null;

    const playlist = $derived($videosStore);
    const currentVideoId = $derived($selectedVideo.id);
    const currentIndex = $derived(
        playlist.findIndex((video) => video.id === currentVideoId),
    );
    const currentVideo = $derived(playlist[currentIndex]);

    // Use actual video element duration when available, fall back to database duration
    const effectiveDuration = $derived(
        videoEl && videoEl.duration > 0
            ? Math.floor(videoEl.duration)
            : (currentVideo?.duration ?? 0),
    );

    // Reset and re-attach video when video ID changes
    $effect(() => {
        const videoId = currentVideoId;
        // Reset duration and current time when video ID changes
        duration = 0;
        currentTime = 0;
        updateDuration(0);
        updateCurrentTime(0);
        
        // Give the DOM time to update, then find and attach new video element
        if (browser) {
            tick().then(() => {
                const found = findVideo();
                if (found !== videoEl) {
                    attachVideo(found);
                }
            });
        }
    });

    // Update waveform when effective duration changes (use actual video duration)
    $effect(() => {
        const dur = effectiveDuration;
        if (dur > 0) {
            // Generate waveform based on actual video duration, not database duration
            waveformData = generateMockWaveform(60, dur);
        }
    });

    function stepQueue(offset: number) {
        if (!playlist.length) return;
        const length = playlist.length;
        const base =
            currentIndex === -1 ? (offset > 0 ? 0 : length - 1) : currentIndex;
        const next = (base + offset + length) % length;
        const target = playlist[next];
        if (target) {
            selectedVideo.selectVideo(target.id);
            activeVideo.setActive({
                id: target.id,
                url: target.videoUrl ?? target.url ?? "",
                title: target.title,
                author: target.author,
                authorId: target.authorId,
                duration: target.duration,
            });
            tick().then(() => {
                videoEl?.play().catch((err) => {
                    console.warn("Autoplay was prevented.", err);
                });
            });
        }
    }

    function goPrevious(event: MouseEvent) {
        event.stopPropagation();
        stepQueue(-1);
    }

    function goNext(event: MouseEvent) {
        event.stopPropagation();
        stepQueue(1);
    }

    // Type definition for HLS video element
    interface HLSVideoElement extends HTMLElement {
        video?: HTMLVideoElement;
        shadowRoot?: ShadowRoot;
    }

    // helper to find the underlying video element in the sidebar player
    function findVideo(): HTMLVideoElement | null {
        // looks for #player-container inside desktop sidebar (it exists in +layout.svelte)
        const container = document.querySelector("#player-container");
        if (!container) return null;

        // 1) direct query for video in light DOM (works if video is not in shadow DOM)
        const directVideo = container.querySelector("video");
        if (directVideo instanceof HTMLVideoElement) return directVideo;

        // 2) try to find a nested hls-video or hls-video-element and read its internal video (best effort)
        const hls =
            container.querySelector("hls-video") ||
            container.querySelector("hls-video-element");
        if (hls) {
            const hlsElement = hls as HLSVideoElement;

            // Try to access the video property if it exists
            if (hlsElement.video instanceof HTMLVideoElement) {
                return hlsElement.video;
            }

            // Attempt to access shadow root
            if (hlsElement.shadowRoot) {
                const shadowVideo =
                    hlsElement.shadowRoot.querySelector("video");
                if (shadowVideo instanceof HTMLVideoElement) {
                    return shadowVideo;
                }
            }
        }

        return null;
    }

    function attachVideo(v: HTMLVideoElement | null) {
        detachVideo();
        if (!v) return;
        videoEl = v;

        // Reset duration and current time when attaching a new video element
        duration = 0;
        currentTime = 0;
        updateDuration(0);
        updateCurrentTime(0);

        // Create listener functions
        const onTime = () => {
            // when not dragging or scrubbing, update currentTime so UI reflects playback
            if (!isDragging && !isScrubbing) {
                const time = videoEl?.currentTime || 0;
                currentTime = time;
                updateCurrentTime(time);
            }
            // Update duration from video element (source of truth)
            if (videoEl && videoEl.duration > 0 && isFinite(videoEl.duration)) {
                const dur = Math.floor(videoEl.duration);
                // Always update duration when video element reports it (even if close to current)
                if (Math.abs(duration - dur) > 0.5 || duration === 0) {
                    duration = dur;
                    updateDuration(dur);
                }
            }
        };

        const onPlay = () => {
            playing = true;
            updatePlayingState(true);
            startRafLoop();
        };

        const onPause = () => {
            playing = false;
            updatePlayingState(false);
            stopRafLoop();
        };

        const onLoaded = () => {
            // Update duration from video element when metadata loads (source of truth)
            if (videoEl && videoEl.duration > 0 && isFinite(videoEl.duration)) {
                const dur = Math.floor(videoEl.duration);
                duration = dur;
                updateDuration(dur);
            }
        };

        const onDurationChange = () => {
            // Update duration when duration changes (e.g., HLS stream updates)
            if (videoEl && videoEl.duration > 0 && isFinite(videoEl.duration)) {
                const dur = Math.floor(videoEl.duration);
                duration = dur;
                updateDuration(dur);
            }
        };

        // Store listeners in component scope
        currentListeners = { onTime, onPlay, onPause, onLoaded, onDurationChange };

        videoEl.addEventListener("timeupdate", onTime);
        videoEl.addEventListener("play", onPlay);
        videoEl.addEventListener("pause", onPause);
        videoEl.addEventListener("loadedmetadata", onLoaded);
        videoEl.addEventListener("durationchange", onDurationChange);

        // initialize state
        const time = videoEl.currentTime || 0;
        currentTime = time;
        updateCurrentTime(time);
        // Initialize duration from video element (source of truth)
        if (videoEl && videoEl.duration > 0 && isFinite(videoEl.duration)) {
            const dur = Math.floor(videoEl.duration);
            duration = dur;
            updateDuration(dur);
        }
        playing = !videoEl.paused;
        updatePlayingState(playing);

        if (playing) startRafLoop();
    }

    function detachVideo() {
        if (!videoEl || !currentListeners) return;

        videoEl.removeEventListener("timeupdate", currentListeners.onTime);
        videoEl.removeEventListener("play", currentListeners.onPlay);
        videoEl.removeEventListener("pause", currentListeners.onPause);
        videoEl.removeEventListener(
            "loadedmetadata",
            currentListeners.onLoaded,
        );
        videoEl.removeEventListener("durationchange", currentListeners.onDurationChange);

        stopRafLoop();
        currentListeners = null;
        videoEl = null;
        
        // Reset duration and current time when detaching
        duration = 0;
        currentTime = 0;
        updateDuration(0);
        updateCurrentTime(0);
    }

    function startRafLoop() {
        if (rafId != null) return;
        const loop = () => {
            if (videoEl && !isDragging && !isScrubbing) {
                const time = videoEl.currentTime;
                currentTime = time;
                updateCurrentTime(time);
                // Always use video element's actual duration when available
                if (videoEl.duration > 0) {
                    const dur = Math.floor(videoEl.duration);
                    // Only update if duration changed significantly (to avoid constant updates)
                    if (Math.abs(duration - dur) > 1) {
                        duration = dur;
                        updateDuration(dur);
                    }
                }
            }
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
    }

    function stopRafLoop() {
        if (rafId != null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    function togglePlay() {
        if (!videoEl) return;
        if (videoEl.paused) videoEl.play().catch(() => {});
        else videoEl.pause();
    }

    function onSeekInput(e: Event) {
        if (!videoEl) return;
        const input = e.target as HTMLInputElement;
        const val = parseFloat(input.value) || 0;
        currentTime = val;
    }

    function onSeekChange(e: Event) {
        if (!videoEl) return;
        const input = e.target as HTMLInputElement;
        const val = parseFloat(input.value) || 0;
        videoEl.currentTime = val;
    }

    // Calculate time from mouse position
    function calculateTimeFromPosition(e: MouseEvent): number {
        if (!trackEl) return 0;
        const rect = trackEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        return effectiveDuration * pct;
    }

    // Click to seek
    function onTrackClick(e: MouseEvent) {
        if (!trackEl) return;
        const newTime = calculateTimeFromPosition(e);
        seekTo(newTime);
        currentTime = newTime;
    }

    // Mouse down to start scrubbing
    function onTrackMouseDown(e: MouseEvent) {
        if (!browser || e.button !== 0) return; // Only left click in browser
        isScrubbing = true;
        const newTime = calculateTimeFromPosition(e);
        seekTo(newTime);
        currentTime = newTime;

        // Add global mouse event listeners
        window.addEventListener("mousemove", onTrackMouseMove);
        window.addEventListener("mouseup", onTrackMouseUp);
    }

    // Mouse move while scrubbing
    function onTrackMouseMove(e: MouseEvent) {
        if (!isScrubbing || !trackEl) return;
        const newTime = calculateTimeFromPosition(e);
        seekTo(newTime);
        currentTime = newTime;
    }

    // Mouse up to stop scrubbing
    function onTrackMouseUp() {
        if (!browser || !isScrubbing) return;
        isScrubbing = false;

        // Remove global mouse event listeners
        window.removeEventListener("mousemove", onTrackMouseMove);
        window.removeEventListener("mouseup", onTrackMouseUp);
    }

    // Handle mouse enter on timeline
    function onTrackMouseEnter() {
        isHovering = true;
    }

    // Handle mouse leave on timeline
    function onTrackMouseLeave() {
        isHovering = false;
    }

    // Handle mouse move for hover preview
    function onTrackHover(e: MouseEvent) {
        if (!trackEl) return;
        const rect = trackEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        hoverTime = effectiveDuration * pct;
        hoverX = pct * 100;
    }

    function formatTime(t: number) {
        if (!isFinite(t) || t <= 0) return "0:00";
        const min = Math.floor(t / 60);
        const sec = Math.floor(t % 60);
        return `${min}:${sec.toString().padStart(2, "0")}`;
    }

    let observer: MutationObserver | null = null;

    onMount(() => {
        // initial find
        attachVideo(findVideo());

        // Watch for DOM changes only in the player container, not the entire document
        const container = document.querySelector("#player-container");
        if (container) {
            observer = new MutationObserver(() => {
                const found = findVideo();
                if (found !== videoEl) {
                    // Video element changed - reset and attach new one
                    attachVideo(found);
                }
            });
            // Observe subtree to catch video element changes
            observer.observe(container, { childList: true, subtree: true });
        }

    });

    onDestroy(() => {
        detachVideo();
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        // Clean up scrubbing event listeners (only in browser)
        if (browser) {
            window.removeEventListener("mousemove", onTrackMouseMove);
            window.removeEventListener("mouseup", onTrackMouseUp);
        }
    });
</script>

<div class="px-8">
    <div class="flex items-center">
        <div class="flex-1 relative">
            <!-- visual track with playhead overlay -->
            <div
                bind:this={trackEl}
                class="relative cursor-pointer py-3 group"
                on:mousedown={onTrackMouseDown}
                on:mouseenter={onTrackMouseEnter}
                on:mouseleave={onTrackMouseLeave}
                on:mousemove={onTrackHover}
                role="slider"
                aria-label="Video timeline"
                aria-valuemin="0"
                aria-valuemax={effectiveDuration}
                aria-valuenow={currentTime}
                tabindex="0"
            >
                <!-- Waveform visualization -->
                {#if waveformData && waveformData.peaks.length > 0}
                    <div
                        class="absolute left-0 right-0 top-1/2 -translate-y-1/2 flex items-center gap-[2px] h-8"
                    >
                        {#each waveformData.peaks as peak, i}
                            {@const barWidth = 100 / waveformData.peaks.length}
                            {@const barHeight = Math.max(peak * 100, 20)}
                            {@const isPlayed =
                                i / waveformData.peaks.length <=
                                currentTime / effectiveDuration}
                            <div
                                class="flex-1 self-center rounded-sm transition-all duration-100"
                                style="height: {barHeight}%; background-color: {isPlayed
                                    ? 'rgb(233, 149, 12)'
                                    : 'rgba(156, 163, 175, 0.4)'}; min-width: 2px;"
                            ></div>
                        {/each}
                    </div>
                {:else}
                    <!-- Fallback to simple bar if no waveform -->
                    <div
                        class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 bg-gray-700/50 dark:bg-gray-600/50 rounded-full transition-all duration-200 {isHovering
                            ? 'h-3'
                            : 'h-2'}"
                    ></div>
                    <div
                        class="absolute left-0 top-1/2 -translate-y-1/2 h-2 rounded-full transition-all duration-200 {isHovering
                            ? 'h-3'
                            : 'h-2'}"
                        style="width: {effectiveDuration
                            ? (currentTime / effectiveDuration) * 100
                            : 0}%; background: rgb(233, 149, 12)"
                    ></div>
                {/if}

                <!-- Hover preview indicator -->
                {#if isHovering && !isScrubbing}
                    <div
                        class="absolute inset-y-0 -translate-x-1/2 transform pointer-events-none flex items-center"
                        style="left: {hoverX}%"
                    >
                        <div
                            class="w-px h-full bg-[rgb(233,149,12)] shadow-[0_0_8px_rgba(233,149,12,0.45)]"
                        ></div>
                        <div
                            class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded-sm bg-gray-900/90 text-white text-[10px] tracking-tight shadow-lg backdrop-blur-sm"
                        >
                            {formatTime(hoverTime)}
                        </div>
                    </div>
                {/if}

                <!-- Playhead indicator -->
                <div
                    class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-orange-500 rounded-full shadow-lg pointer-events-none transition-transform duration-200 {isScrubbing ||
                    isHovering
                        ? 'scale-125'
                        : 'scale-100'} transform"
                    style="left: {effectiveDuration
                        ? (currentTime / effectiveDuration) * 100
                        : 0}%;"
                ></div>
            </div>

            <!-- accessible range input (keeps in sync) -->
            <input
                type="range"
                min="0"
                max={effectiveDuration || 0}
                step="0.1"
                value={currentTime}
                on:input={onSeekInput}
                on:change={onSeekChange}
                class="timeline-accessible-range"
                on:mousedown={() => (isDragging = true)}
                on:mouseup={() => (isDragging = false)}
            />
        </div>

        <div
            class="text-xs tabular-nums text-gray-700 dark:text-gray-200 w-10 bg text-right"
        >
            {formatTime(Math.max(0, effectiveDuration - (currentTime || 0)))}
        </div>
    </div>
</div>

<style>
    /* small tweaks for the inline playhead and track */
    :global(.dark) .bg-gray-200 {
        background-color: rgba(255, 255, 255, 0.06);
    }
    input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 0;
        height: 0;
    }
    input[type="range"]::-moz-range-thumb {
        width: 0;
        height: 0;
        border: none;
    }
    .timeline-accessible-range {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        pointer-events: none;
        background: transparent;
    }
    .timeline-accessible-range:focus-visible {
        opacity: 1;
        pointer-events: auto;
        outline: 2px solid rgb(233, 149, 12);
        outline-offset: 4px;
    }
    .timeline-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 9999px;
        border: none;
        background: rgba(255, 255, 255, 0.1);
        color: white;
        transition:
            background 0.2s ease,
            transform 0.2s ease;
    }

    .timeline-button:hover {
        transform: scale(1.05);
        background: rgba(255, 255, 255, 0.2);
    }

    .timeline-button svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
    }
</style>
