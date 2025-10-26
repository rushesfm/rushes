<script lang="ts">
    import { activeVideo } from "$lib/stores/video";
    import { selectedVideo } from "$lib/stores/selectedVideo";
    import { page } from "$app/stores";
    import { onMount } from "svelte";
    import VideoInfo from "./VideoInfo.svelte";
    import VideoPlayer from "./VideoPlayer.svelte";
    import { afterNavigate, goto } from "$app/navigation";
    import {
        getVideoById as lookupVideo,
        videosStore,
    } from "$lib/stores/library";

    import type { Video } from "$lib/types/content";

    interface VideoData {
        video: Video;
    }

    let videoData = $state<VideoData | null>(null);
    let isFullscreenRoute = $derived(
        $page.url.pathname.startsWith("/videos/") &&
            $page.url.pathname !== "/videos",
    );

    async function fetchVideoData(id: string) {
        try {
            let video = lookupVideo(id);
            if (!video && id === "home") {
                video = $videosStore[0];
            }
            if (!video) throw new Error("Video not found");

            videoData = { video };

            activeVideo.setActive({
                id: video.id,
                url: video.videoUrl ?? video.url ?? "",
                title: video.title,
                author: video.author,
                authorId: video.authorId,
            });
        } catch (error) {
            console.error("Error fetching video data:", error);
        }
    }

    function expandToFullscreen() {
        if ($selectedVideo.id) {
            selectedVideo.toggleFullScreen();
            goto(`/videos/${$selectedVideo.id}`);
        }
    }

    onMount(() => {
        if ($selectedVideo.id) {
            let video = lookupVideo($selectedVideo.id);
            if (!video && $selectedVideo.id === "home") {
                video = $videosStore[0];
            }
            if (video) {
                videoData = { video };
            }
        }

        afterNavigate(() => {
            // no-op, reactive $derived handles isFullscreenRoute
        });
    });

    $effect(() => {
        if ($selectedVideo.id) {
            fetchVideoData($selectedVideo.id);
        }
    });
</script>

// place files you want to import through the `$lib` alias in this folder.
{#if $selectedVideo.id && !isFullscreenRoute}
    <!-- Desktop-only column next to Sidebar -->
    <div
        class="hidden lg:flex flex-col w-[500px] shrink-0 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-black h-full overflow-scroll top-0"
    >
        <!-- Video at top -->
        <button
            class="relative aspect-video bg-black w-full"
            onclick={expandToFullscreen}
            aria-label="Expand video to fullscreen"
        >
            {#if $activeVideo?.url}
                <div>
                    <VideoPlayer videoUrl={$activeVideo.url} />
                </div>
            {/if}
        </button>

        <!-- Video information underneath -->
        {#if videoData}
            <div class="flex-1 overflow-y-auto">
                <VideoInfo data={videoData} />
            </div>
        {/if}
    </div>
{/if}
