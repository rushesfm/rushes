<script lang="ts">
    import { slide } from "svelte/transition";
    import { selectedVideo } from "$lib/stores/selectedVideo";

    const queueContext = $derived($selectedVideo.queueContext);
    const currentVideoId = $derived($selectedVideo.id);
    const queue = $derived($selectedVideo.queue);

    const currentIndex = $derived.by(() => {
        const id = currentVideoId;
        const context = queueContext;
        const queueList = queue;
        
        if (!id || !context || !queueList.length) return 0;
        const index = queueList.indexOf(id);
        return index >= 0 ? index + 1 : 0;
    });

    const totalVideos = $derived.by(() => {
        return queueContext?.videoIds.length ?? 0;
    });

    const isLastVideo = $derived.by(() => {
        return currentIndex >= totalVideos;
    });

    const isFirstVideo = $derived.by(() => {
        return currentIndex <= 1;
    });

    function handleSkipForward() {
        if (isLastVideo) {
            // If on last video, skip forward = exit queue and resume live
            selectedVideo.clearQueueContext();
        } else {
            // Otherwise, go to next video in queue
            selectedVideo.playNext();
        }
    }

    function handleSkipBackward() {
        // Go to previous video (playPrevious handles wrapping)
        selectedVideo.playPrevious();
    }

    const contextText = $derived.by(() => {
        const context = queueContext;
        if (!context) return "";
        
        const index = currentIndex;
        const total = totalVideos;
        
        if (context.type === "keyword") {
            return `Playing videos ${index}/${total} from keyword "${context.label}"`;
        } else if (context.type === "date") {
            return `Playing videos ${index}/${total} from ${context.label}`;
        } else if (context.type === "user") {
            return `Playing videos ${index}/${total} from ${context.label}`;
        }
        return "";
    });

    function getContextIcon(): string {
        const context = queueContext;
        if (!context) return "";
        
        if (context.type === "keyword") {
            // Browse/search icon
            return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 15a4 4 0 1 0 8 0a4 4 0 1 0-8 0m7.5 3.5L21 21M4 6h16M4 12h4m-4 6h4"/></svg>`;
        } else if (context.type === "date") {
            // Calendar icon
            return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>`;
        } else if (context.type === "user") {
            // Users icon
            return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0z"/><path d="M6.5 21a5.5 5.5 0 0111 0M19.5 8.25a2.25 2.25 0 110 4.5M21 21a3 3 0 00-4-2.82"/></svg>`;
        }
        return "";
    }

    function handleCancel() {
        selectedVideo.clearQueueContext();
    }
</script>

{#if queueContext}
    <div
        transition:slide={{ duration: 300, axis: 'y', easing: (t) => t * (2 - t) }}
        class="bg-black/40 border-b border-orange-500/10 px-4 py-2.5 flex items-center gap-3 backdrop-blur-sm"
    >
        <span class="text-orange-500/60 flex-shrink-0" aria-hidden="true">
            {@html getContextIcon()}
        </span>
        <p class="text-sm text-white/70 font-medium flex-1">
            {contextText}
        </p>
        <div class="flex items-center gap-1">
            <button
                onclick={handleSkipBackward}
                class="p-1 hover:bg-white/5 rounded transition-colors flex-shrink-0"
                aria-label="Previous video"
                title="Previous video"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    class="text-white/50 hover:text-white/80"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 19l-7-7 7-7"
                    />
                </svg>
            </button>
            <button
                onclick={handleSkipForward}
                class="p-1 hover:bg-white/5 rounded transition-colors flex-shrink-0"
                aria-label={isLastVideo ? "Exit queue and resume live" : "Next video"}
                title={isLastVideo ? "Exit queue and resume live" : "Next video"}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    class="text-white/50 hover:text-white/80"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 5l7 7-7 7"
                    />
                </svg>
            </button>
            <button
                onclick={handleCancel}
                class="p-1 hover:bg-white/5 rounded transition-colors flex-shrink-0"
                aria-label="Cancel queue and resume normal queue"
                title="Cancel queue and resume normal queue"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    class="text-white/50 hover:text-white/80"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>
    </div>
{/if}

