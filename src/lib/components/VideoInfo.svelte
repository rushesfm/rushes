<script lang="ts">
    import Map from "$lib/components/Map.svelte";
    import { getCommentsByVideoId } from "$lib/data/comments";
    import { videosStore } from "$lib/stores/library";
    import type { Video, Comment } from "$lib/types/content";
    import { goto } from "$app/navigation";

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

    // Row expand states
    let isSummaryOpen = $state(false);
    let isKeywordsOpen = $state(true);
    let isLocationOpen = $state(true);
    let isTranscriptOpen = $state(false);

    // Location name from reverse geocoding
    let locationName = $state<string | null>(null);

    // Get comments for this video
    const comments = getCommentsByVideoId(data.video.id);

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

    // Format full date with time
    function formatFullDateWithTime(date: string): string {
        const uploadDate = new Date(date);
        const dateStr = uploadDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
        const timeStr = uploadDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
        return `${dateStr} at ${timeStr}`;
    }

    // Format date as slug for URL (YYYY-MM-DD)
    function getDateSlug(date: string): string {
        const uploadDate = new Date(date);
        const year = uploadDate.getFullYear();
        const month = String(uploadDate.getMonth() + 1).padStart(2, "0");
        const day = String(uploadDate.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    // Determine if video was created during day or night (6 AM - 6 PM = day)
    function isDayTime(date: string): boolean {
        const uploadDate = new Date(date);
        const hour = uploadDate.getHours();
        return hour >= 6 && hour < 18;
    }

    const uploadDateStr =
        data.video.uploadDate ||
        data.video.timestamp ||
        new Date().toISOString();
    const isDay = isDayTime(uploadDateStr);

    // Convert keyword to URL slug
    function keywordToSlug(keyword: string): string {
        return keyword
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    // Reverse geocoding to get location name
    async function fetchLocationName(lat: number, lon: number) {
        if (!lat || !lon) return;
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
                {
                    headers: {
                        "User-Agent": "Rushes Video App",
                    },
                },
            );
            const data = await response.json();
            if (data.address) {
                // Try to get city, then town, then village, then region
                const city =
                    data.address.city ||
                    data.address.town ||
                    data.address.village ||
                    data.address.municipality;
                const region = data.address.state || data.address.region;
                if (city && region) {
                    locationName = `${city}, ${region}`;
                } else if (city) {
                    locationName = city;
                } else if (region) {
                    locationName = region;
                } else {
                    locationName = data.address.country || "Unknown location";
                }
            }
        } catch (error) {
            console.warn("Failed to fetch location name:", error);
        }
    }

    // Fetch location name when component loads or location changes
    $effect(() => {
        if (dummyLocations.length > 0 && initialCenterLat !== 0 && initialCenterLon !== 0) {
            fetchLocationName(initialCenterLat, initialCenterLon);
        }
    });
</script>

<div class="w-full transition-colors" style="font-family: Arial, Helvetica, sans-serif;">
    <div class=" px-8">
        <div class="space-y-0">
            <!-- Author Row -->
            <div class="border-b border-white/10 py-3">
                <div class="flex items-center gap-2">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        class="text-white/70"
                    >
                        <path
                            d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"
                        />
                    </svg>
                    <span class="text-sm font-medium text-white/90">Author</span>
                    <a
                        href={`/users/${data.video.authorId}`}
                        class="text-sm text-white/70 hover:text-white transition-colors ml-auto"
                    >
                        {data.video.author}
                    </a>
                </div>
            </div>

            <!-- Date Row with Day/Night -->
            <div class="border-b border-white/10 py-3">
                <div class="flex items-center gap-2">
                    <!-- Calendar icon -->
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" class="w-4 h-4" viewBox="0 0 24 24"><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><path fill="currentColor" d="M12 19a1 1 0 0 1 .993.883L13 20v1a1 1 0 0 1-1.993.117L11 21v-1a1 1 0 0 1 1-1m6.313-2.09l.094.083l.7.7a1 1 0 0 1-1.32 1.497l-.094-.083l-.7-.7a1 1 0 0 1 1.218-1.567zm-11.306.083a1 1 0 0 1 .083 1.32l-.083.094l-.7.7a1 1 0 0 1-1.497-1.32l.083-.094l.7-.7a1 1 0 0 1 1.414 0M4 11a1 1 0 0 1 .117 1.993L4 13H3a1 1 0 0 1-.117-1.993L3 11zm17 0a1 1 0 0 1 .117 1.993L21 13h-1a1 1 0 0 1-.117-1.993L20 11zM6.213 4.81l.094.083l.7.7a1 1 0 0 1-1.32 1.497l-.094-.083l-.7-.7A1 1 0 0 1 6.11 4.74zm12.894.083a1 1 0 0 1 .083 1.32l-.083.094l-.7.7a1 1 0 0 1-1.497-1.32l.083-.094l.7-.7a1 1 0 0 1 1.414 0M12 2a1 1 0 0 1 .993.883L13 3v1a1 1 0 0 1-1.993.117L11 4V3a1 1 0 0 1 1-1m0 5a5 5 0 1 1-4.995 5.217L7 12l.005-.217A5 5 0 0 1 12 7"/></svg>
                  
                    <span class="text-sm font-medium text-white/90">Date</span>
                    <a
                        href="/date/{getDateSlug(uploadDateStr)}"
                        class="text-sm text-white/70 hover:text-white transition-colors ml-auto"
                    >
                        {formatFullDateWithTime(uploadDateStr)}
                    </a>
                </div>
            </div>

            <!-- Summary Row -->
            <div class="border-b border-white/10">
                <button
                    onclick={() => (isSummaryOpen = !isSummaryOpen)}
                    class="w-full py-3 flex items-center gap-2 hover:bg-white/5 transition-colors"
                >
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" class="w-4 h-4"   viewBox="0 0 24 24"><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h10M4 18h14"/></svg>
                    <span class="text-sm font-medium text-white/90">Summary</span>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        class="text-white/70 ml-auto transition-transform {isSummaryOpen
                            ? 'rotate-45'
                            : ''}"
                    >
                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                    </svg>
                </button>
                {#if isSummaryOpen}
                    <div class="pb-3 ">
                        {#if data.video.description}
                            <p class="text-sm text-white/70 leading-relaxed">
                                {data.video.description}
                            </p>
                        {:else}
                            <p class="text-sm text-white/50">
                                No description available.
                            </p>
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- Keywords Row -->
            <div class="border-b border-white/10">
                <button
                    onclick={() => (isKeywordsOpen = !isKeywordsOpen)}
                    class="w-full py-3 flex items-center gap-2 hover:bg-white/5 transition-colors"
                >
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" class="w-4 h-4" viewBox="0 0 24 24"><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><g fill="currentColor"><path d="M9.172 5a3 3 0 0 1 2.121.879l5.71 5.71a3.41 3.41 0 0 1 0 4.822l-3.592 3.592a3.41 3.41 0 0 1-4.822 0l-5.71-5.71A3 3 0 0 1 2 12.172V8a3 3 0 0 1 3-3zM7 9h-.01A1 1 0 1 0 7 11a1 1 0 0 0 0-2"/><path d="M14.293 5.293a1 1 0 0 1 1.414 0L20.3 9.885a5.82 5.82 0 0 1 0 8.23l-1.592 1.592a1 1 0 0 1-1.414-1.414l1.592-1.592a3.82 3.82 0 0 0 0-5.402l-4.592-4.592a1 1 0 0 1 0-1.414"/></g></svg>
                    <span class="text-sm font-medium text-white/90">Keywords</span>
                    <div class="flex items-center gap-2 ml-auto">
                        {#if (data.video.keywords ?? []).length > 0}
                            <span class="text-xs text-white/50">
                                {(data.video.keywords ?? []).length} keyword{(data.video.keywords ?? []).length === 1
                                    ? ""
                                    : "s"}
                            </span>
                        {/if}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                            class="text-white/70 transition-transform {isKeywordsOpen
                                ? 'rotate-45'
                                : ''}"
                        >
                            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                        </svg>
                    </div>
                </button>
                {#if isKeywordsOpen}
                    <div class="pb-3 ">
                        {#if (data.video.keywords ?? []).length > 0}
                            <div class="flex flex-wrap gap-2">
                                    {#each data.video.keywords ?? [] as keyword}
                                        <a
                                            href="/browse/{keywordToSlug(keyword)}"
                                            class="px-3 py-1 text-sm border border-white/20 hover:bg-white/20 text-neutral-300 text-xs rounded-full transition-colors"
                                        >
                                        {keyword}
                                    </a>
                                {/each}
                            </div>
                        {:else}
                            <p class="text-sm text-white/50">
                                No keywords available.
                            </p>
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- Location Row -->
            <div class="border-b border-white/10">
                <button
                    onclick={() => (isLocationOpen = !isLocationOpen)}
                    class="w-full py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                        class="text-white/70"
                    >
                        <path
                            d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"
                        />
                    </svg>
                    <span class="text-sm font-medium text-white/90">Location</span>
                    <div class="flex items-center gap-2 ml-auto">
                        {#if dummyLocations.length > 0}
                            <a
                                href={`/map?lat=${initialCenterLat}&lon=${initialCenterLon}&zoom=${initialZoom}`}
                                class="text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
                                onclick={(e) => {
                                    e.stopPropagation();
                                }}
                            >
                                {locationName || `${initialCenterLat.toFixed(4)}, ${initialCenterLon.toFixed(4)}`}
                            </a>
                        {:else}
                            <span class="text-xs text-white/50">No location</span>
                        {/if}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                            class="text-white/70 transition-transform {isLocationOpen
                                ? 'rotate-45'
                                : ''}"
                        >
                            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                        </svg>
                    </div>
                </button>
                {#if isLocationOpen}
                    <div class="pb-3 ">
                        {#if dummyLocations.length > 0}
                            <div
                                class="relative h-[300px] rounded-lg overflow-hidden cursor-pointer"
                                role="button"
                                tabindex="0"
                                onclick={() => {
                                    goto(`/map?lat=${initialCenterLat}&lon=${initialCenterLon}&zoom=${initialZoom}`);
                                }}
                                onkeydown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        goto(`/map?lat=${initialCenterLat}&lon=${initialCenterLon}&zoom=${initialZoom}`);
                                    }
                                }}
                            >
                                <Map
                                    locations={dummyLocations}
                                    {initialCenterLon}
                                    {initialCenterLat}
                                    {initialZoom}
                                />
                            </div>
                        {:else}
                            <p class="text-sm text-white/50">
                                No location data available for this video.
                            </p>
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- Transcript Row -->
            {#if data.video.transcript}
                <div class="border-b border-white/10">
                    <button
                        onclick={() => (isTranscriptOpen = !isTranscriptOpen)}
                        class="w-full py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                            class="text-white/70"
                        >
                            <path
                                d="M5 8.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0-2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5zm0-2a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm0-2a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z"
                            />
                            <path
                                d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H4z"
                            />
                        </svg>
                        <span class="text-sm font-medium text-white/90">Transcript</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            fill="currentColor"
                            viewBox="0 0 16 16"
                            class="text-white/70 ml-auto transition-transform {isTranscriptOpen
                                ? 'rotate-45'
                                : ''}"
                        >
                            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                        </svg>
                    </button>
                    {#if isTranscriptOpen}
                            <div class="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                                {data.video.transcript}
                            </div>
                     
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>
