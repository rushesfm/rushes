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
    import VideoInfo from "$lib/components/VideoInfo.svelte";
    import QueueBanner from "$lib/components/QueueBanner.svelte";
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

    // Calculate aspect ratio from video's aspectRatio string (e.g., "16:9")
    function parseAspectRatio(aspectRatio?: string): number | null {
        if (!aspectRatio) return null;
        const parts = aspectRatio.split(':');
        if (parts.length !== 2) return null;
        const width = parseFloat(parts[0]);
        const height = parseFloat(parts[1]);
        if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) return null;
        return width / height;
    }

    const videoAspectRatio = $derived(parseAspectRatio(currentVideo?.aspectRatio));
    // Use a default 16:9 ratio if no aspect ratio is available to prevent jumping
    const effectiveAspectRatio = $derived(videoAspectRatio ?? 16/9);
    const aspectRatioStyle = $derived(
        `aspect-ratio: ${effectiveAspectRatio}; padding-bottom: ${(1 / effectiveAspectRatio) * 100}%`
    );

    // VideoInfo data logic (from VideoInfoContainer)
    interface VideoData {
        video: Video;
    }

    function resolveVideoData(id: string | null): VideoData | null {
        if (!id) return null;
        if (id === "home") {
            const fallback = videoLibrary[0];
            return fallback ? { video: fallback } : null;
        }
        const video = lookupVideo(id);
        return video ? { video } : null;
    }

    let videoInfoData = $state<VideoData | null>(null);
    let nextVideo = $state<Video | null>(null);

    $effect(() => {
        videoInfoData = resolveVideoData($selectedVideo.id);

        // Resolve next video data
        const nextId = selectedVideo.nextVideoId;
        nextVideo = nextId ? (lookupVideo(nextId) ?? null) : null;
    });

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

    // Track previous queue context state to detect when it's cleared
    let previousQueueContext = $state(false);
    
    $effect(() => {
        if (!browser) return;
        const videos = videoLibrary;
        if (!videos || videos.length === 0) return;
        
        const queueContext = $selectedVideo.queueContext;
        const queueContextWasCleared = previousQueueContext && !queueContext;
        previousQueueContext = !!queueContext;
        
        // Only compute live playback if there's no active queue context
        if (queueContext) {
            // When a queue context exists, don't compute live playback
            return;
        }

        const signature = videos
            .map((video) => `${video.id}:${getVideoDuration(video)}`)
            .join("|");
        
        // Always recompute if:
        // 1. Queue context was just cleared (force fresh timestamp)
        // 2. Signature doesn't match (video library changed)
        // 3. No target video set yet
        const shouldRecompute = queueContextWasCleared || 
                                liveSourceSignature !== signature || 
                                !liveTargetVideoId;

        if (shouldRecompute) {
            const now = Math.floor(Date.now() / 1000);
            const playback = computeLivePlayback(videos, now);
            if (!playback) return;

            liveStartTime = playback.startTime;
            liveTargetVideoId = playback.video.id;
            liveSourceSignature = signature;

            if (selectedVideoId !== playback.video.id) {
                selectedVideo.selectVideo(playback.video.id);
            }
        }
    });

    $effect(() => {
        if (data) {
            initialiseLibrary(data.videos, data.users);
            // Initialize the playback queue with all video IDs
            const videoIds = data.videos.map((v: Video) => v.id);
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
    
    // Use startTime = 0 when a temporary queue is active, otherwise use live timestamp
    const videoStartTime = $derived(
        $selectedVideo.queueContext ? 0 : liveStartTime
    );

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
        <Sidebar isOpen={true} onclose={closeMobileSidebar} />

        <!-- Desktop Now Playing section, live like function with video queue -->
        <div
            id="scroll-view"
            class="hidden lg:flex h-screen flex-col w-[500px] max-w-[500px] shrink-0 border-l border-r border-gray-200/10 dark:border-neutral-100/10 bg-white dark:bg-white/2"
        >
            <div id="scroll-content" class="flex-1 overflow-y-auto">
                <div class="flex flex-col min-h-full gap-6">
                    <div class="flex-none" id="video-wrapper">
                        <QueueBanner />
                        <div
                            id="video-aspect-container"
                            class="relative w-full border-b border-white/10 bg-black shadow-[0_24px_80px_-48px_rgba(8,47,73,0.85)]"
                            style={aspectRatioStyle || undefined}
                        >
                            <div class="absolute inset-0 w-full h-full overflow-hidden">
                                <MuxVideoPlayer
                                    src={currentVideo?.videoUrl}
                                    autoplayUserPreference={true}
                                    startTime={videoStartTime}
                                    playerKey={`sidebar-player-${currentVideo?.id ?? "none"}-${Math.floor(videoStartTime)}-${$selectedVideo.queueContext ? 'queue' : 'live'}`}
                                    title={currentVideo?.title ?? ""}
                                    duration={currentVideo?.duration ?? 0}
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Video Info Container (like Sidebar content in Astro) -->
                    <div id="sidebar-details" class="flex-1">
                        {#if videoInfoData}
                            <VideoInfo data={videoInfoData} />
                        {/if}
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
    
    /* Prevent video from showing at natural size during transitions */
    :global(#video-aspect-container) {
        min-height: 0;
        contain: layout style paint;
        overflow: hidden;
        transition: padding-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform: translateZ(0);
        will-change: padding-bottom;
    }
    
    :global(#video-aspect-container .video-container) {
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: relative;
    }
    
    :global(#video-aspect-container media-controller) {
        width: 100%;
        height: 100%;
        display: block;
        overflow: hidden;
    }
    
    :global(#video-aspect-container hls-video),
    :global(#video-aspect-container video) {
        width: 100% !important;
        height: 100% !important;
        display: block;
        position: relative;
        margin: 0;
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
