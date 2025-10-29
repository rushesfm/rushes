<script lang="ts">
    import Map from "$lib/components/Map.svelte";
    import CollapsibleHeading from "$lib/components/CollapsibleHeading.svelte";
    import { getCommentsByVideoId } from "$lib/data/comments";
    import { videosStore } from "$lib/stores/library";
    import type { Video, Comment } from "$lib/types/content";

    interface VideoData {
        video: Video;
    }

    let { data } = $props<{ data: VideoData }>();

    // Use locations provided by the video record
    const dummyLocations = data.video.locations ?? [];

    const primaryLocation = dummyLocations[0];
    const initialCenterLat =
        primaryLocation?.latitude ??
        primaryLocation?.mapLat ??
        (Array.isArray(primaryLocation?.coordinates)
            ? primaryLocation?.coordinates[0]
            : undefined) ??
        0;
    const initialCenterLon =
        primaryLocation?.longitude ??
        primaryLocation?.mapLon ??
        (Array.isArray(primaryLocation?.coordinates)
            ? primaryLocation?.coordinates[1]
            : undefined) ??
        0;
    const initialZoom = primaryLocation ? 8 : 2;

    // Section states
    let isLocationOpen = $state(true);
    let isMoreVideosOpen = $state(true);
    let isTranscriptOpen = $state(true);
    let isKeywordsOpen = $state(true);
    let isNotesOpen = $state(true);

    // Get comments for this video
    const comments = getCommentsByVideoId(data.video.id);

    const relatedVideos = $derived(
        $videosStore
            .filter(
                (video) =>
                    video.authorId === data.video.authorId &&
                    video.id !== data.video.id,
            )
            .slice(0, 4),
    );

    let newComment = $state("");

    // Map icon path
    const mapIcon =
        "M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M4.5 7.5a.5.5 0 0 1 0 1H3a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1.5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a.5.5 0 0 1 .5-.5z";

    // Format views count
    function formatViews(views: number): string {
        if (views >= 1000000) {
            return `${(views / 1000000).toFixed(1)}M`;
        } else if (views >= 1000) {
            return `${(views / 1000).toFixed(1)}K`;
        }
        return views.toString();
    }

    // Format upload date
    function formatUploadDate(date: string): string {
        const uploadDate = new Date(date);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - uploadDate.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }
</script>

<div
    class="w-full transition-colors"
    style="font-family: Arial, Helvetica, sans-serif;"
>
    <div class="pt-6 px-8">
        <!-- Video Metadata -->
        <!-- <div class="flex items-center gap-4 text-sm text-neutral-400 mb-4">
      <div class="flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
          <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
        </svg>
        <span>{data.video.duration}</span>
      </div>


    </div> -->

        <div
            class="description mb-6"
        >
            <div
                class="flex items-center pb-2 justify-between border-b border-white/10 mb-2 pb-4"
            >
                <a
                    class="text-white text-xs"
                    href={`/users/${data.video.authorId}`}
                    >{data.video.author}</a
                >

                <div class="flex items-center gap-1 text-white">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
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
                    <span class="text-xs"
                        >Uploaded {formatUploadDate(
                            data.video.uploadDate ||
                                data.video.timestamp ||
                                new Date().toISOString(),
                        )}</span
                    >
                </div>
            </div>

            <p class="text-sm dark:text-neutral-400 leading-relaxed">
                {data.video.description}
            </p>
        </div>

        <!-- Location Section -->
        <div
            class="location border-b border-white/10 mb-6"
        >
            <CollapsibleHeading
                title="Location"
                bind:isOpen={isLocationOpen}
                actionButton={{
                    text: "View on map",
                    icon: mapIcon,
                    href: `/map?lat=${initialCenterLat}&lon=${initialCenterLon}&zoom=${initialZoom}`,
                }}
            >
                {#if dummyLocations.length}
                    <div class="h-[400px] rounded-lg overflow-hidden mb-3">
                        <Map
                            locations={dummyLocations}
                            {initialCenterLon}
                            {initialCenterLat}
                            {initialZoom}
                        />
                    </div>
                    <div
                        class="flex items-center gap-2 text-sm text-neutral-400"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                        >
                            <path d={mapIcon} />
                        </svg>
                        <span>[{initialCenterLat}, {initialCenterLon}]</span>
                    </div>
                {:else}
                    <p class="text-sm text-neutral-400">
                        No location data available for this video.
                    </p>
                {/if}
            </CollapsibleHeading>

            <!-- More Videos Section -->
            <CollapsibleHeading
                title={`More from ${data.video.author}`}
                bind:isOpen={isMoreVideosOpen}
                actionButton={{
                    text: "View all",
                }}
            >
                {#if relatedVideos.length}
                    <div class="grid grid-cols-2 gap-3">
                        {#each relatedVideos as related}
                            <a
                                class="relative aspect-video rounded-lg overflow-hidden bg-white/10 group"
                                href={`/videos/${related.id}`}
                            >
                                <img
                                    src={related.thumbnailUrl ??
                                        "https://placehold.co/400x225?text=Video"}
                                    alt={related.title}
                                    class="w-full h-full object-cover"
                                />
                                <div
                                    class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent"
                                >
                                    <p class="text-xs text-white">
                                        {related.title}
                                    </p>
                                    <p class="text-xs text-neutral-400">
                                        {related.duration ?? "0:00"}
                                    </p>
                                </div>
                            </a>
                        {/each}
                    </div>
                {:else}
                    <p class="text-sm text-neutral-400">
                        No additional videos from this creator yet.
                    </p>
                {/if}
            </CollapsibleHeading>

            <!-- Transcript Section -->
            <CollapsibleHeading
                title="Transcript"
                bind:isOpen={isTranscriptOpen}
                actionButton={{
                    text: "Copy",
                }}
            >
                <div class="text-sm text-neutral-400 leading-relaxed">
                    <p>
                        {data.video.transcript ?? "Transcript not available."}
                    </p>
                </div>
            </CollapsibleHeading>

            <!-- Keywords Section -->

            <CollapsibleHeading
                title="Keywords"
                bind:isOpen={isKeywordsOpen}
                actionButton={{
                    text: "View all",
                }}
            >
                <div class="flex flex-wrap gap-2">
                    {#each data.video.keywords ?? [] as keyword}
                        <a
                            href="/keywords/{keyword}"
                            class="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 text-neutral-300 rounded-full transition-colors"
                        >
                            {keyword}
                        </a>
                    {/each}
                </div>
            </CollapsibleHeading>

            <!-- Notes Section -->

            <CollapsibleHeading title="Notes" bind:isOpen={isNotesOpen}>
                <!-- Comment Input -->
                <div class="mb-6">
                    <div class="flex gap-3">
                        <img
                            src="https://i.pravatar.cc/150?img=4"
                            alt="Your avatar"
                            class="w-8 h-8 rounded-full"
                        />
                        <div class="flex-1">
                            <textarea
                                bind:value={newComment}
                                placeholder="Add a note..."
                                class="w-full p-3 bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-sm text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10 resize-none"
                                rows="2"
                            ></textarea>
                            <div class="flex justify-end mt-2">
                                <button
                                    class="px-4 py-1.5 text-sm bg-black dark:bg-white text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
                                    disabled={!newComment.trim()}
                                >
                                    Post
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-4">
                        {#each comments as comment}
                            <div class="flex gap-3">
                                <img
                                    src={comment.avatar}
                                    alt={comment.user}
                                    class="w-8 h-8 rounded-full"
                                />
                                <div class="flex-1">
                                    <div class="flex items-center gap-2 mb-1">
                                        <span
                                            class="text-sm font-medium dark:text-neutral-200"
                                            >{comment.user}</span
                                        >
                                        <span class="text-xs text-neutral-400"
                                            >{comment.timestamp}</span
                                        >
                                    </div>
                                    <p
                                        class="text-sm text-neutral-800 dark:text-neutral-200 mb-2"
                                    >
                                        {comment.content}
                                    </p>
                                    <div class="flex items-center gap-4">
                                        <button
                                            class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 flex items-center gap-1"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="14"
                                                height="14"
                                                fill="currentColor"
                                                viewBox="0 0 16 16"
                                            >
                                                <path
                                                    d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M4.5 7.5a.5.5 0 0 1 0 1H3a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1.5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a.5.5 0 0 1 .5-.5z"
                                                />
                                            </svg>
                                            {comment.likes}
                                        </button>
                                        <button
                                            class="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                                        >
                                            Reply
                                        </button>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div></CollapsibleHeading
            >
        </div>
    </div>
</div>
