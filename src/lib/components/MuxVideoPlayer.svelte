<script lang="ts">
    import { onMount, onDestroy, tick } from "svelte";
    import "media-chrome";
    import "hls-video-element";
    import { uiState, actions } from "../stores/appStore";
    import { selectedVideo } from "$lib/stores/selectedVideo";
    import { getPlayerState } from "$lib/stores/playerStore.svelte";
    import { videosStore } from "$lib/stores/library";

    const {
        src = "",
        autoplayUserPreference = true,
        startTime = 0,
        playerKey = "",
    } = $props();
    const playerState = getPlayerState();

    let player: (HTMLVideoElement & { load?: () => void }) | undefined;
    let isMuted = true;
    let isExpanded = $state(false);
    let isHovering = $state(false);
    let isPaused = $state(true);
    const playlist = $derived($videosStore);
    const currentVideoId = $derived($selectedVideo.id);
    const currentIndex = $derived(
        playlist.findIndex((video) => video.id === currentVideoId),
    );

    $effect(() => {
        const unsubscribe = uiState.subscribe((state) => {
            isExpanded = state.isExpanded;
        });
        return () => unsubscribe();
    });

    function handleVideoEnded() {
        // Advance to the next video in the queue
        selectedVideo.playNext();
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
        try {
            await player.play();
        } catch {
            // Autoplay can be blocked silently; no-op fallback
        }
    }

    onMount(() => {
        if (player) {
            player.muted = isMuted;
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
        if (!isMuted && player.paused) {
            player.play().catch(() => {
                // Play after unmute failed - browser restriction
            });
        }
    }

    $effect(() => {
        if (!player) return;

        if (!src) {
            player.removeAttribute("src");
            return;
        }

        const currentSrc = player.getAttribute("src");
        if (currentSrc !== src) {
            player.src = src;
            player.load?.();
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
    on:mouseenter={() => (isHovering = true)}
    on:mouseleave={() => (isHovering = false)}
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
            <media-loading-indicator slot="centered-chrome" noautohide
            ></media-loading-indicator>
        </media-controller>
    </div>

    <!-- Hover controls overlay -->
    <div
        class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 pointer-events-none {isHovering
            ? 'opacity-100'
            : ''}"
    >
        <div
            class="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 pointer-events-auto"
        >
            <!-- Previous button -->
            <button
                on:click={goPrevious}
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
                on:click={togglePlay}
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
                on:click={goNext}
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

        <!-- Fullscreen button in top-right corner -->
        <div class="absolute top-4 right-4 pointer-events-auto">
            <button
                on:click={toggleFullscreen}
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
