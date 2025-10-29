<script lang="ts">
    import { page } from "$app/stores";
    import { videosStore } from "$lib/stores/library";
    import { selectedVideo } from "$lib/stores/selectedVideo";

    const videos = $derived($videosStore);
    const slug = $derived($page.params.slug);

    // Parse the date slug - handles YYYY, YYYY-MM, or YYYY-MM-DD format
    const parsedDate = $derived.by(() => {
        const dateStr = slug;
        if (!dateStr) return null;

        // Try YYYY-MM-DD format (day)
        const dayMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dayMatch) {
            const [, yearStr, monthStr, dayStr] = dayMatch;
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const day = parseInt(dayStr, 10);

            // Validate date
            const date = new Date(year, month - 1, day);
            if (
                date.getFullYear() === year &&
                date.getMonth() === month - 1 &&
                date.getDate() === day
            ) {
                return { type: "day" as const, year, month, day };
            }
            return null;
        }

        // Try YYYY-MM format (month)
        const monthMatch = dateStr.match(/^(\d{4})-(\d{2})$/);
        if (monthMatch) {
            const [, yearStr, monthStr] = monthMatch;
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);

            // Validate month (1-12)
            if (month >= 1 && month <= 12) {
                return { type: "month" as const, year, month };
            }
            return null;
        }

        // Try YYYY format (year)
        const yearMatch = dateStr.match(/^(\d{4})$/);
        if (yearMatch) {
            const [, yearStr] = yearMatch;
            const year = parseInt(yearStr, 10);
            // Validate year (reasonable range)
            if (year >= 1900 && year <= 2100) {
                return { type: "year" as const, year };
            }
            return null;
        }

        return null;
    });

    // Get videos based on the date type
    const filteredVideos = $derived.by(() => {
        const date = parsedDate;
        if (!date) return [];

        const videoList = videos;
        return videoList.filter((video) => {
            const videoDateStr = video.uploadDate || video.timestamp || video.uploadedAt;
            if (!videoDateStr) return false;

            try {
                const videoDate = new Date(videoDateStr);
                if (isNaN(videoDate.getTime())) return false;

                const videoYear = videoDate.getFullYear();
                const videoMonth = videoDate.getMonth() + 1;
                const videoDay = videoDate.getDate();

                if (date.type === "day") {
                    return (
                        videoYear === date.year &&
                        videoMonth === date.month &&
                        videoDay === date.day
                    );
                } else if (date.type === "month") {
                    return videoYear === date.year && videoMonth === date.month;
                } else if (date.type === "year") {
                    return videoYear === date.year;
                }
                return false;
            } catch {
                return false;
            }
        });
    });

    // Format date for display
    function formatDay(year: number, month: number, day: number): string {
        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        return `${monthNames[month - 1]} ${day}, ${year}`;
    }

    function formatMonth(year: number, month: number): string {
        const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ];
        return `${monthNames[month - 1]} ${year}`;
    }

    function getDateTitle(): string {
        const date = parsedDate;
        if (!date) return "Invalid Date";
        if (date.type === "day") {
            return formatDay(date.year, date.month, date.day);
        } else if (date.type === "month") {
            return formatMonth(date.year, date.month);
        } else if (date.type === "year") {
            return String(date.year);
        }
        return "Invalid Date";
    }

    function getDateDescription(): string {
        const date = parsedDate;
        if (!date) return "";
        const count = filteredVideos.length;
        if (date.type === "day") {
            return `${count} video${count === 1 ? "" : "s"} from this day`;
        } else if (date.type === "month") {
            return `${count} video${count === 1 ? "" : "s"} from this month`;
        } else if (date.type === "year") {
            return `${count} video${count === 1 ? "" : "s"} from this year`;
        }
        return "";
    }
</script>

<div class="min-h-screen p-8">
    <div class="max-w-7xl mx-auto">
        {#if parsedDate}
            <header class="mb-8">
                <div class="flex items-center gap-3 mb-2">
                    <a
                        href="/browse"
                        class="text-white/60 hover:text-white text-sm transition-colors"
                    >
                        ← Back to Browse
                    </a>
                </div>
                <h1 class="text-3xl font-bold text-white mb-2">
                    {getDateTitle()}
                </h1>
                <p class="text-white/60 text-sm">
                    {getDateDescription()}
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
                                    src={vid.thumbnailUrl ??
                                        "https://placehold.co/400x225?text=Video"}
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
                        No videos found for this {parsedDate?.type || "period"}.
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
                        Invalid Date
                    </h1>
                </header>
                <div
                    class="rounded-lg border border-white/10 bg-white/5 p-12 text-center"
                >
                    <p class="text-white/60">
                        The date you're looking for is invalid.
                    </p>
                </div>
            </div>
        {/if}
    </div>
</div>
