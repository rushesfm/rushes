<script lang="ts">
    import { page } from "$app/stores";
    import { videosStore } from "$lib/stores/library";
    import { selectedVideo } from "$lib/stores/selectedVideo";

    const videos = $derived($videosStore);
    const slug = $derived($page.params.slug);

    // Convert slug back to keyword by matching against all keywords
    const keyword = $derived.by(() => {
        const videoList = videos;
        const allKeywordsSet = new Set<string>();
        videoList.forEach((video) => {
            if (video.keywords) {
                video.keywords.forEach((k: string) => allKeywordsSet.add(k));
            }
        });

        const currentSlug = slug;
        // Try to find exact match first (case-insensitive)
        for (const kw of allKeywordsSet) {
            if (
                kw
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-+|-+$/g, "") === currentSlug
            ) {
                return kw;
            }
        }
        return null;
    });

    // Get videos that have this keyword
    const filteredVideos = $derived.by(() => {
        const kw = keyword;
        if (!kw) return [];
        const videoList = videos;
        return videoList.filter(
            (video) => video.keywords && video.keywords.includes(kw),
        );
    });

    // Convert keyword to slug (for consistency)
    function keywordToSlug(kw: string): string {
        return kw
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }
</script>

<div class="min-h-screen p-8">
    <div class="max-w-7xl mx-auto">
        {#if keyword}
            <header class="mb-8">
                <div class="flex items-center gap-3 mb-2">
                    <a
                        href="/browse"
                        class="text-white/60 hover:text-white text-sm transition-colors"
                    >
                        ← Back to Browse
                    </a>
                </div>
                <h1 class="text-3xl font-bold text-white mb-2">{keyword}</h1>
                <p class="text-white/60 text-sm">
                    {filteredVideos.length} video{filteredVideos.length === 1
                        ? ""
                        : "s"} tagged with this keyword
                </p>
            </header>

            {#if filteredVideos.length > 0}
                <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {#each filteredVideos as video (video.id)}
                        {@const vid = video}
                        <a
                            href={`/videos/${vid.id}`}
                            onclick={(e) => {
                                e.preventDefault();
                                selectedVideo.selectVideo(vid.id);
                            }}
                            class="block"
                        >
                            <div
                                class="group relative aspect-video overflow-hidden rounded-lg bg-neutral-900 cursor-pointer"
                            >
                                <img
                                    src={vid.thumbnailUrl ?? "https://placehold.co/400x225?text=Video"}
                                    alt={vid.title}
                                    class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    loading="lazy"
                                />
                                <div
                                    class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                >
                                    <div class="absolute bottom-0 left-0 right-0 p-4">
                                        <h3
                                            class="text-sm font-medium text-white truncate"
                                        >
                                            {vid.title}
                                        </h3>
                                        <p class="text-xs text-neutral-300">
                                            {vid.author}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </a>
                    {/each}
                </div>
            {:else}
                <div
                    class="rounded-lg border border-white/10 bg-white/5 p-12 text-center"
                >
                    <p class="text-white/60">
                        No videos found with this keyword.
                    </p>
                </div>
            {/if}
        {:else}
            <div class="max-w-7xl mx-auto">
                <header class="mb-8">
                    <a
                        href="/browse"
                        class="text-white/60 hover:text-white text-sm transition-colors"
                    >
                        ← Back to Browse
                    </a>
                    <h1 class="text-3xl font-bold text-white mb-2 mt-4">
                        Keyword Not Found
                    </h1>
                </header>
                <div
                    class="rounded-lg border border-white/10 bg-white/5 p-12 text-center"
                >
                    <p class="text-white/60">
                        The keyword you're looking for doesn't exist.
                    </p>
                </div>
            </div>
        {/if}
    </div>
</div>

