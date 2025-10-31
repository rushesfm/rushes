<script lang="ts">
    import { onMount, onDestroy, tick } from "svelte";
    import { browser } from "$app/environment";
    import "media-chrome";
    import "hls-video-element";
    import { uiState, actions } from "../stores/appStore";
    import { selectedVideo } from "$lib/stores/selectedVideo";
    import { getPlayerState } from "$lib/stores/playerStore.svelte";
    import { videosStore } from "$lib/stores/library";
    import VideoTimeline from "./VideoTimeline.svelte";

    const {
        src = "",
        autoplayUserPreference = true,
        startTime = 0,
        playerKey = "",
        title = "",
        duration = 0,
    } = $props();
    const playerState = getPlayerState();

    let player: (HTMLVideoElement & { load?: () => void }) | undefined;
    let isMuted = $state(true);
    let isExpanded = $state(false);
    let isHovering = $state(false);
    let isPaused = $state(true);
    let userUnmutedOnce = $state(false); // Track if user has manually unmuted
    const playlist = $derived($videosStore);
    const currentVideoId = $derived($selectedVideo.id);
    const currentIndex = $derived(
        playlist.findIndex((video) => video.id === currentVideoId),
    );
    const nextVideo = $derived(() => {
        if (currentIndex === -1 || playlist.length === 0) return null;
        const nextIndex = currentIndex === playlist.length - 1 ? 0 : currentIndex + 1;
        return playlist[nextIndex] ?? null;
    });
    const nextVideoSrc = $derived(() => nextVideo()?.videoUrl ?? nextVideo()?.url ?? "");

    $effect(() => {
        const unsubscribe = uiState.subscribe((state) => {
            isExpanded = state.isExpanded;
        });
        return () => unsubscribe();
    });

    function handleVideoEnded() {
        // Advance to the next video in the queue immediately
        // The preload effect will ensure the next video is ready
        selectedVideo.playNext();
        
        // Try to play immediately after src changes
        if (player) {
            tick().then(() => {
                attemptAutoplay();
            });
        }
    }

    function togglePlay(event: MouseEvent) {
        event.stopPropagation();
        if (!player) return;
        if (player.paused) {
            player.play().catch(() => {});
        } else {
            player.pause();
        }
    }

    function stepQueue(offset: number, event: MouseEvent) {
        event.stopPropagation();
        if (!playlist.length) return;
        const length = playlist.length;
        const base =
            currentIndex === -1 ? (offset > 0 ? 0 : length - 1) : currentIndex;
        const next = (base + offset + length) % length;
        const target = playlist[next];
        if (target) {
            selectedVideo.selectVideo(target.id);
            tick().then(() => {
                player?.play().catch((err) => {
                    console.warn("Autoplay was prevented.", err);
                });
            });
        }
    }

    function goPrevious(event: MouseEvent) {
        stepQueue(-1, event);
    }

    function goNext(event: MouseEvent) {
        stepQueue(1, event);
    }

    function toggleFullscreen(event: MouseEvent) {
        event.stopPropagation();
        const next = !isExpanded;
        actions.setExpanded(next);
        selectedVideo.setFullScreen(next);
    }

    async function attemptAutoplay() {
        if (!player || !autoplayUserPreference) return;
        
        // Check user preference from localStorage
        if (browser) {
            const savedPreference = localStorage.getItem('video-autoplay-unmuted');
            if (savedPreference === 'true' && !userUnmutedOnce) {
                isMuted = false;
                player.muted = false;
            }
        }
        
        try {
            // Try to play unmuted first if user preference allows
            if (!isMuted) {
                player.muted = false;
                await player.play();
                return; // Success - playing unmuted
            }
        } catch {
            // Autoplay with sound blocked - fallback to muted
            if (!isMuted) {
                isMuted = true;
                player.muted = true;
            }
        }
        
        // If muted or unmuted play failed, try muted play
        if (isMuted) {
            try {
                player.muted = true;
                await player.play();
            } catch {
                // Autoplay can be blocked silently; no-op fallback
            }
        }
    }

    onMount(() => {
        if (player) {
            // Initialize mute state based on user preference
            if (browser) {
                const savedPreference = localStorage.getItem('video-autoplay-unmuted');
                if (savedPreference === 'true') {
                    isMuted = false;
                    player.muted = false;
                } else {
                    isMuted = true;
                    player.muted = true;
                }
            } else {
                isMuted = true;
                player.muted = true;
            }
            
            if (startTime > 0) {
                player.currentTime = startTime;
            }
            if (autoplayUserPreference) {
                attemptAutoplay();
            }

            // Listen for play/pause events to update state
            player.addEventListener("play", () => {
                isPaused = false;
            });
            player.addEventListener("pause", () => {
                isPaused = true;
            });
            player.addEventListener("ended", handleVideoEnded);
            player.addEventListener("canplay", attemptAutoplay);

            isPaused = player.paused;
        }
    });

    onDestroy(() => {
        if (player) {
            // Clean up event listener
            player.removeEventListener("ended", handleVideoEnded);
            player.removeEventListener("canplay", attemptAutoplay);
            player.pause();
            player.removeAttribute("src");
        }
    });

    function toggleMute() {
        if (!player) return;
        isMuted = !isMuted;
        player.muted = isMuted;
        userUnmutedOnce = !isMuted;
        
        // Save preference to localStorage
        if (browser) {
            localStorage.setItem('video-autoplay-unmuted', String(!isMuted));
        }
        
        if (!isMuted && player.paused) {
            player.play().catch(() => {
                // Play after unmute failed - browser restriction
            });
        }
    }


    // Preload hint for the next video URL (helps browser prepare)
    $effect(() => {
        if (!browser || !nextVideoSrc()) return;
        
        // Add preload hint in the document head
        const linkId = 'next-video-preload';
        let link = document.getElementById(linkId) as HTMLLinkElement;
        if (!link) {
            link = document.createElement('link');
            link.id = linkId;
            link.rel = 'prefetch';
            document.head.appendChild(link);
        }
        link.href = nextVideoSrc();
        
        return () => {
            // Clean up when next video changes or component unmounts
            if (link && link.parentNode) {
                link.parentNode.removeChild(link);
            }
        };
    });

    $effect(() => {
        if (!player) return;

        if (!src) {
            player.removeAttribute("src");
            return;
        }

        const currentSrc = player.getAttribute("src");
        if (currentSrc !== src) {
            // Set source directly - the browser will handle loading
            // Avoid calling load() as it can cause a brief pause
            player.src = src;
            // Start playing immediately if autoplay is enabled
            attemptAutoplay();
        }
    });

    // Listen for seek requests from the player store
    $effect(() => {
        if (!player) return;

        const seekTime = playerState.seekRequested;
        if (seekTime !== null && isFinite(seekTime)) {
            // Only seek if the difference is significant (more than 0.5 seconds)
            if (Math.abs(player.currentTime - seekTime) > 0.5) {
                player.currentTime = seekTime;
            }
        }
    });

    $effect(() => {
        if (!player) return;
        if (!Number.isFinite(startTime)) return;
        const difference = Math.abs(player.currentTime - startTime);
        if (difference > 0.75) {
            player.currentTime = startTime;
        }
    });
</script>

<div
    class="video relative block"
    id="player-container"
    onmouseenter={() => (isHovering = true)}
    onmouseleave={() => (isHovering = false)}
>
    <div class="video-container absolute inset-0 bg-black overflow-hidden">
        <media-controller class="absolute inset-0">
            <hls-video
                slot="media"
                crossorigin="anonymous"
                playsinline
                autoplay
                muted
                bind:this={player}
            ></hls-video>
            <media-loading-indicator slot="centered-chrome" noautohide style="display: none;"
            ></media-loading-indicator>
        </media-controller>
    </div>

    <!-- Hover controls overlay -->
    <!-- Mute button - always visible when muted, visible on hover when unmuted -->
    {#if isMuted || isHovering}
        <div class="absolute top-4 left-4 pointer-events-auto z-20">
            <button
                onclick={toggleMute}
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                class="control-button"
                title={isMuted ? "Unmute video" : "Mute video"}
            >
                {#if isMuted}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                    >
                        <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
                        <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z"/>
                        <path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182L8 5.525A3.489 3.489 0 0 1 9.025 8a3.489 3.489 0 0 1-1.025 2.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/>
                    </svg>
                {:else}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                    >
                        <path d="M13 8c0 .564-.094 1.107-.266 1.613l-.814-.814A4.02 4.02 0 0 0 12 8V7a.5.5 0 0 1 1 0zm-5 4c.818 0 1.578-.245 2.212-.667l.718.719a4.973 4.973 0 0 1-2.43.923V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-1.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 1 0v1a4 4 0 0 0 4 4m3-9v.878l-1-1V3a.5.5 0 0 1 1 0M2.22 2.22L1.188 3.25 5.025 7.088v5.588l-.5.5H1.5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5h2.325L6.717 3.55 7 4v-.5a.5.5 0 0 1 .812-.39l3.848 3.078L14.75 2.22zm11.56 11.56-12-12z"/>
                    </svg>
                {/if}
            </button>
        </div>
    {/if}

    <div
        class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 pointer-events-none {isHovering
            ? 'opacity-100'
            : ''}"
    >
        
        <!-- Previous video button - bottom left on hover -->
        {#if isHovering}
            <div class="absolute bottom-24 left-6 pointer-events-auto z-10">
                <button
                    onclick={goPrevious}
                    aria-label="Previous video"
                    class="control-button"
                    title="Previous video"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M15 18 9 12l6-6v12zm-6 0H7V6h2v12z" />
                    </svg>
                </button>
            </div>
        {/if}

        <!-- Next video button - bottom right on hover -->
        {#if isHovering}
            <div class="absolute bottom-24 right-6 pointer-events-auto z-10">
                <button
                    onclick={goNext}
                    aria-label="Next video"
                    class="control-button"
                    title="Next video"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M9 18l6-6-6-6v12zm6 0h2V6h-2v12z" />
                    </svg>
                </button>
            </div>
        {/if}
        
        <!-- Fullscreen button in top-right corner -->
        <div class="absolute top-4 right-4 pointer-events-auto z-10">
            <button
                onclick={toggleFullscreen}
                aria-label={isExpanded ? "Shrink player" : "Expand player"}
                class="control-button"
                title={isExpanded ? "Shrink player" : "Expand player"}
            >
                {#if !isExpanded}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                    >
                        <path
                            d="M1 1h5v1H2v4H1V1zm9 0h5v5h-1V2h-4V1zm5 9v5h-5v-1h4v-4h1zM6 14v1H1v-5h1v4h4z"
                        />
                    </svg>
                {:else}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                    >
                        <path
                            d="M5.828 10.172a.5.5 0 0 0-.707 0l-4.096 4.096V11.5a.5.5 0 0 0-1 0v3.975a.5.5 0 0 0 .5.5H4.5a.5.5 0 0 0 0-1H1.732l4.096-4.096a.5.5 0 0 0 0-.707zm4.344 0a.5.5 0 0 1 .707 0l4.096 4.096V11.5a.5.5 0 1 1 1 0v3.975a.5.5 0 0 1-.5.5H11.5a.5.5 0 0 1 0-1h2.768l-4.096-4.096a.5.5 0 0 1 0-.707zm0-4.344a.5.5 0 0 0 .707 0l4.096-4.096V4.5a.5.5 0 1 0 1 0V.525a.5.5 0 0 0-.5-.5H11.5a.5.5 0 0 0 0 1h2.768l-4.096 4.096a.5.5 0 0 0 0 .707zm-4.344 0a.5.5 0 0 1-.707 0L1.025 1.732V4.5a.5.5 0 0 1-1 0V.525a.5.5 0 0 1 .5-.5H4.5a.5.5 0 0 1 0 1H1.732l4.096 4.096a.5.5 0 0 1 0 .707z"
                        />
                    </svg>
                {/if}
            </button>
        </div>

        <!-- Bottom controls area with timeline and playback controls -->
        <div class="absolute bottom-0 left-0 right-0 pointer-events-auto">
            <!-- Video title and duration above timeline -->
            {#if title || duration > 0}
                <div class="px-6 pb-2">
                    <div class="flex items-center justify-between gap-4">
                        {#if title}
                            <h3 class="text-sm font-semibold text-white truncate">{title}</h3>
                        {/if}
                        {#if duration > 0}
                            <span class="text-xs text-white/80 font-mono whitespace-nowrap">
                                {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")}
                            </span>
                        {/if}
                    </div>
                </div>
            {/if}
            <!-- Timeline overlay at the bottom -->
            <div class="video-timeline-overlay px-6 pb-6">
                <VideoTimeline />
            </div>

            <!-- Playback controls centered above timeline -->
            <div
                class="flex hidden items-center justify-center gap-4 pb-4 px-6"
            >
                <!-- Previous button -->
                <button
                    onclick={goPrevious}
                    aria-label="Previous video"
                    class="control-button"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M15 18 9 12l6-6v12zm-6 0H7V6h2v12z" />
                    </svg>
                </button>

                <!-- Play/Pause button -->
                <button
                    onclick={togglePlay}
                    aria-label={isPaused ? "Play" : "Pause"}
                    class="control-button-large"
                >
                    {#if isPaused}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    {:else}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="32"
                            height="32"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
                        </svg>
                    {/if}
                </button>

                <!-- Next button -->
                <button
                    onclick={goNext}
                    aria-label="Next video"
                    class="control-button"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="m9 18 6-6-6-6v12zm6 0h2V6h-2v12z" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    .video {
        display: block;
        width: 100%;
        height: 100%;
    }
    .video-container {
        cursor: default;
        object-fit: cover;
        width: 100%;
        height: 100%;
        position: absolute;
        inset: 0;
    }

    .control-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        color: white;
        transition: all 0.2s ease;
        cursor: pointer;
    }

    .control-button:hover {
        background: rgba(0, 0, 0, 0.8);
        transform: scale(1.1);
    }

    .control-button-large {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.3);
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        color: white;
        transition: all 0.2s ease;
        cursor: pointer;
    }

    .control-button-large:hover {
        background: rgba(233, 149, 12, 0.9);
        border-color: rgba(233, 149, 12, 1);
        transform: scale(1.1);
    }

    .video-timeline-overlay {
        background: linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.5) 60%, transparent 100%);
        padding-top: 1rem;
    }

    /* Override VideoTimeline padding when used in overlay */
    .video-timeline-overlay :global(.px-8) {
        padding-left: 0;
        padding-right: 0;
    }

    /* Make timeline text readable on dark overlay */
    .video-timeline-overlay :global(.text-gray-700),
    .video-timeline-overlay :global(.text-gray-200) {
        color: rgba(255, 255, 255, 0.9) !important;
    }
    :global(media-controller) {
        --media-primary-color: lightpink;
        --media-secondary-color: rgb(27 54 93 / 0.85);
        --media-control-hover-background: rgb(128 0 0 / 0.85);
        --media-object-fit: cover;
        --media-object-position: center;
        object-fit: cover;
        width: 100%;
        height: 100%;
    }
    :global(media-controller) {
        position: absolute;
        inset: 0;
    }
    :global(media-controller [slot="media"]),
    :global(hls-video) {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover;
    }
    .mute-toggle-button:hover {
        transform: scale(1.05);
    }
    :global(media-controller) {
        --media-control-background: transparent;
        --media-control-hover-background: rgba(0, 0, 0, 0.5);
        --media-control-active-background: rgba(0, 0, 0, 0.7);
        --media-control-color: white;
        --media-control-hover-color: white;
        --media-control-active-color: white;
        --media-control-border-radius: 4px;
        --media-control-padding: 8px;
        --media-control-margin: 4px;
        --media-control-font-size: 14px;
        --media-control-font-weight: 500;
        --media-control-letter-spacing: 0.5px;
        --media-control-text-transform: none;
        --media-control-text-decoration: none;
        --media-control-text-shadow: none;
        --media-control-box-shadow: none;
        --media-control-transition: all 0.2s ease;
    }
    :global(media-control-bar) {
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
        padding: 8px;
    }
    :global(media-progress-bar) {
        --media-progress-bar-height: 4px;
        --media-progress-bar-background: rgba(255, 255, 255, 0.3);
        --media-progress-bar-fill-background: white;
    }
    :global(media-volume-range) {
        --media-range-track-height: 4px;
        --media-range-track-background: rgba(255, 255, 255, 0.3);
        --media-range-track-fill-background: white;
    }
</style>
