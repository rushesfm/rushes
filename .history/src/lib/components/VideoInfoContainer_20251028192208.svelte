<script lang="ts">
    import VideoInfo from "$lib/components/VideoInfo.svelte";
    import { selectedVideo } from "$lib/stores/selectedVideo";
    import {
        getVideoById as lookupVideo,
        videosStore,
    } from "$lib/stores/library";
    import type { Video } from "$lib/types/content";

    interface VideoData {
        video: Video;
    }

    const videosList = $derived($videosStore);

    function resolveVideo(id: string | null): VideoData | null {
        if (!id) return null;
        if (id === "home") {
            const fallback = videosList[0];
            return fallback ? { video: fallback } : null;
        }
        const video = lookupVideo(id);
        return video ? { video } : null;
    }

    let data = $state<VideoData | null>(null);
    let nextVideo = $state<Video | null>(null);

    $effect(() => {
        data = resolveVideo($selectedVideo.id);

        // Resolve next video data
        const nextId = selectedVideo.nextVideoId;
        nextVideo = nextId ? (lookupVideo(nextId) ?? null) : null;
    });

    function handlePlayNext() {
        selectedVideo.playNext();
    }
</script>

{#if data}
    <VideoInfo {data} />

  
{:else}{/if}

<style>
    .placeholder {
        border: 1px dashed rgba(148, 163, 184, 0.3);
        border-radius: 0.75rem;
        padding: 2rem;
        text-align: center;
        color: rgba(71, 85, 105, 0.8);
        background: rgba(15, 23, 42, 0.05);
    }

    .placeholder h2 {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        color: inherit;
    }

    .placeholder p {
        font-size: 0.875rem;
        line-height: 1.4;
        margin: 0;
    }
</style>
