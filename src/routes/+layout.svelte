<script lang="ts">
    import "../app.css";
    import { browser } from "$app/environment";
    import { theme } from "$lib/stores/theme";
    import { activeVideo } from "$lib/stores/video";
    import { onMount } from "svelte";
    import Header from "$lib/components/Header.svelte";
    import Sidebar from "$lib/components/Sidebar.svelte";
    import PersistentVideoPlayer from "$lib/components/PersistentVideoPlayer.svelte";
    import { page } from "$app/stores";
    import Playing from "$lib/components/Playing.svelte";
    import { selectedVideo } from "$lib/stores/selectedVideo";
    import MuxVideoPlayer from "$lib/components/MuxVideoPlayer.svelte";
    import VideoTimeline from "$lib/components/VideoTimeline.svelte";
    import VideoInfoContainer from "$lib/components/VideoInfoContainer.svelte";
    import type { LayoutData } from "./$types";
    import type { Video } from "$lib/types/content";
    import {
        initialiseLibrary,
        videosStore,
        getVideoById as lookupVideo,
    } from "$lib/stores/library";
    import { uiState, actions } from "$lib/stores/appStore";

    let { children, data } = $props<{
        children: () => any;
        data: LayoutData;
    }>();
    let isMobileSidebarOpen = $state(false);
    const videoLibrary = $derived($videosStore);
    const selectedVideoId = $derived($selectedVideo.id);
    const defaultVideo = $derived(videoLibrary[0] ?? null);

    function resolveVideo(id: string | null) {
        if (!id) return null;
        if (id === "home") {
            return defaultVideo;
        }
        return lookupVideo(id) ?? defaultVideo;
    }

    const currentVideo = $derived(resolveVideo($selectedVideo.id));

    function getVideoDuration(video: Video): number {
        const value = video.duration;
        if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            return value;
        }
        // Fallback to three minutes if duration metadata is missing
        return 180;
    }

    function computeLivePlayback(
        videos: Video[],
        referenceTimestamp: number,
    ): { video: Video; startTime: number } | null {
        if (!videos.length) return null;
        const durations = videos.map(getVideoDuration);
        const totalDuration = durations.reduce((sum, value) => sum + value, 0);
        if (totalDuration <= 0) return null;

        const position = referenceTimestamp % totalDuration;
        let cursor = 0;
        for (let index = 0; index < videos.length; index += 1) {
            const nextCursor = cursor + durations[index];
            if (position < nextCursor) {
                return {
                    video: videos[index],
                    startTime: position - cursor,
                };
            }
            cursor = nextCursor;
        }
        return {
            video: videos[0]!,
            startTime: 0,
        };
    }

    let liveStartTime = $state(0);
    let liveTargetVideoId = $state<string | null>(null);
    let liveSourceSignature = $state("");

    $effect(() => {
        if (!browser) return;
        const videos = videoLibrary;
        if (!videos || videos.length === 0) return;

        const signature = videos
            .map((video) => `${video.id}:${getVideoDuration(video)}`)
            .join("|");
        if (liveSourceSignature === signature && liveTargetVideoId) {
            return;
        }

        const now = Math.floor(Date.now() / 1000);
        const playback = computeLivePlayback(videos, now);
        if (!playback) return;

        liveStartTime = playback.startTime;
        liveTargetVideoId = playback.video.id;
        liveSourceSignature = signature;

        if (selectedVideoId !== playback.video.id) {
            selectedVideo.selectVideo(playback.video.id);
        }
    });

    $effect(() => {
        if (data) {
            initialiseLibrary(data.videos, data.users);
            // Initialize the playback queue with all video IDs
            const videoIds = data.videos.map((v) => v.id);
            selectedVideo.setQueue(videoIds);
        }
    });

    function shouldExpandPath(pathname: string) {
        return (
            pathname === "/live" ||
            (pathname.startsWith("/videos/") && pathname !== "/videos")
        );
    }

    $effect(() => {
        const unsubscribe = uiState.subscribe((state) => {
            selectedVideo.setFullScreen(state.isExpanded);
        });
        return () => unsubscribe();
    });

    onMount(() => {
        theme.init();
        const currentPath = $page.url.pathname;
        if (!currentPath.startsWith("/videos/")) {
            selectedVideo.selectVideo("home");
        }
        const initialExpanded = shouldExpandPath(currentPath);
        uiState.set({ isExpanded: initialExpanded });
        selectedVideo.setFullScreen(initialExpanded);
    });

    $effect(() => {
        const pathname = $page.url.pathname;
        if (pathname === "/live") {
            actions.setExpanded(true);
            return;
        }
        if (pathname.startsWith("/videos/") && pathname !== "/videos") {
            actions.setExpanded(true);
            return;
        }
        // All other routes should minimize the player to sidebar mode
        actions.setExpanded(false);
    });

    function toggleMobileSidebar() {
        isMobileSidebarOpen = !isMobileSidebarOpen;
    }

    function closeMobileSidebar() {
        isMobileSidebarOpen = false;
    }

    // Check if we're on the video page
    const isVideoPage = $derived(
        $page.url.pathname.startsWith("/videos/") ||
            $page.url.pathname === "/live",
    );
    const showPipPlayer = $derived(!isVideoPage && $activeVideo !== null);
</script>

<svelte:head>
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <title>Rushes</title>
    <link
        href="https://fonts.googleapis.com/css2?family=Droid+Serif:ital,wght@0,400;0,700;1,400;1,700&family=Fira+Mono:wght@400;500;700&display=swap"
        rel="stylesheet"
    />
</svelte:head>

<!-- Persistent Video Player
{#if $activeVideo}
	<PersistentVideoPlayer />
{/if} -->

<div class="min-h-screen w-full overflow-x-hidden transition-colors">
    <div class="flex min-h-screen w-full relative overflow-visible">
        <!-- Sidebar -->
        <Sidebar isOpen="true" onclose={closeMobileSidebar} />

        <!-- Desktop Now Playing section, live like function with video queue -->
        <div
            id="scroll-view"
            class="hidden lg:flex h-screen flex-col w-[500px] max-w-[500px] shrink-0 border-l border-r border-gray-200/10 dark:border-neutral-100/10 bg-white dark:bg-white/2"
        >
            <div id="scroll-content" class="flex-1 overflow-y-auto">
                <div class="flex flex-col min-h-full gap-6">
                    <div class="flex-none" id="video-wrapper">
                        <div
                            id="video-aspect-container"
                            class="relative aspect-video w-full border-b border-white/10 bg-black shadow-[0_24px_80px_-48px_rgba(8,47,73,0.85)]"
                        >
                            <MuxVideoPlayer
                                class="h-full w-full"
                                src={currentVideo?.videoUrl}
                                autoplayUserPreference={true}
                                startTime={liveStartTime}
                                playerKey={`sidebar-player-${currentVideo?.id ?? "none"}-${Math.floor(liveStartTime)}`}
                            />
                        </div>
                    </div>

                    <!-- Video Info Container (like Sidebar content in Astro) -->
                    <div id="sidebar-details" class="flex-1">
                        <VideoTimeline />
                        <VideoInfoContainer />
                    </div>
                </div>
            </div>
        </div>

        <!-- Main content wrapper -->
        <div
            class="flex-1 flex flex-col w-full transition-all duration-200 min-h-0 overflow-hidden"
            class:translate-x-64={isMobileSidebarOpen}
        >
            <!-- Header -->
            <!-- <Header ontoggleSidebar={toggleMobileSidebar} /> -->

            <!-- Main content area -->
            <main
                class="flex-1 w-full max-w-full bg-white h-full overflow-scroll dark:bg-black min-h-0"
                style="height: 100vh; overflow-y: scroll;"
                style:view-transition-name="main-content"
            >
                {@render children()}
            </main>
        </div>
    </div>
</div>

<!-- Mobile-only playing overlay -->
<div class="lg:hidden">
    <Playing />
</div>

<style>
    :global(body) {
        font-family: "Droid Serif", serif;
        view-transition-name: none;
    }

    :global(::view-transition-old(main-content)),
    :global(::view-transition-new(main-content)) {
        animation: none;
        mix-blend-mode: normal;
    }

    :global(::view-transition-old(video-player)),
    :global(::view-transition-new(video-player)) {
        animation: none;
        mix-blend-mode: normal;
    }

    /* Player container styles from Astro layout */
    :global(#player-container) {
        will-change: transform;
        transform-style: preserve-3d;
        position: relative;
        width: 100%;
        height: 100%;
        margin: 0 auto;
        overflow: hidden;
        object-fit: cover !important;
        object-position: center center !important;
    }

    :global(#player-container.fullscreen) {
        position: fixed;
        will-change: transform;
        transform-style: preserve-3d;
        z-index: 999999;
        top: 2rem;
        border-radius: 0;
        left: calc(570px + 3rem);
        width: calc(100vw - 660px);
        height: calc(100vh - 3rem);
    }

    /* Collapse the video wrapper when player is fullscreen to remove aspect-ratio gap */
    :global(#video-wrapper:has(#player-container.fullscreen)) {
        height: 0 !important;
        min-height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
    }

    /* Remove aspect ratio and hide the container when player is fullscreen */
    :global(#video-aspect-container:has(#player-container.fullscreen)) {
        aspect-ratio: unset !important;
        height: 0 !important;
        min-height: 0 !important;
        padding: 0 !important;
        border: none !important;
    }

    /* Ensure video element stays above everything */
    :global(#player-container video) {
        width: 100%;
        height: 100%;
        position: relative;
        top: 0;
        left: 0;
    }
</style>
