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

    {#if nextVideo}
        <div
            class="up-next-container border-t border-white/10 bg-white/[0.02] p-6 mt-6"
        >
            <div class="flex items-center justify-between mb-4">
                <h3
                    class="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400"
                >
                    Up Next
                </h3>
                <button
                    onclick={handlePlayNext}
                    class="text-xs uppercase tracking-[0.25em] text-sky-400 hover:text-sky-300 transition-colors"
                >
                    Play Now →
                </button>
            </div>

            <button
                onclick={handlePlayNext}
                class="group flex gap-4 w-full text-left rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-200"
            >
                <div
                    class="relative aspect-video w-32 flex-shrink-0 overflow-hidden rounded-xl bg-black"
                >
                    <img
                        src={nextVideo.thumbnailUrl ??
                            "https://placehold.co/640x360?text=Video"}
                        alt={nextVideo.title}
                        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div
                        class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <svg
                            class="h-8 w-8 text-white"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>

                <div class="flex-1 min-w-0">
                    <h4
                        class="text-sm font-medium text-white mb-1 truncate group-hover:text-sky-400 transition-colors"
                    >
                        {nextVideo.title}
                    </h4>
                    <p class="text-xs text-slate-400 mb-2">
                        {nextVideo.author}
                    </p>
                    <div class="flex items-center gap-3 text-xs text-slate-500">
                        {#if nextVideo.duration}
                            <span class="flex items-center gap-1">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="12"
                                    height="12"
                                    fill="currentColor"
                                    viewBox="0 0 16 16"
                                >
                                    <path
                                        d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"
                                    />
                                    <path
                                        d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"
                                    />
                                </svg>
                                {Math.floor(nextVideo.duration / 60)}:{String(
                                    nextVideo.duration % 60,
                                ).padStart(2, "0")}
                            </span>
                        {/if}
                        {#if nextVideo.views}
                            <span>{nextVideo.views} views</span>
                        {/if}
                    </div>
                </div>
            </button>

            <p class="mt-3 text-xs text-slate-500 text-center">
                Auto-play will begin when the current video ends
            </p>
        </div>
    {/if}
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
