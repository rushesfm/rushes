<script lang="ts">
    import { videosStore, usersStore } from "$lib/stores/library";
    import { selectedVideo } from "$lib/stores/selectedVideo";

    const videos = $derived($videosStore);
    const users = $derived($usersStore);
    let activeTab = $state<"keywords" | "date" | "users" | "search">("keywords");
    let searchQuery = $state("");

    // ===== KEYWORDS LOGIC =====
    // Extract all unique keywords from videos
    const allKeywords = $derived.by(() => {
        const keywordSet = new Set<string>();
        videos.forEach((video) => {
            if (video.keywords) {
                video.keywords.forEach((keyword: string) => {
                    keywordSet.add(keyword);
                });
            }
        });
        return Array.from(keywordSet).sort();
    });

    // Group keywords by first letter
    const keywordsByLetter = $derived.by(() => {
        const grouped: Record<string, string[]> = {};
        const keywords = allKeywords;
        keywords.forEach((keyword: string) => {
            const firstLetter = keyword.charAt(0).toUpperCase();
            if (!/[A-Z]/.test(firstLetter)) {
                // If not a letter, group under "#"
                if (!grouped["#"]) grouped["#"] = [];
                grouped["#"].push(keyword);
            } else {
                if (!grouped[firstLetter]) grouped[firstLetter] = [];
                grouped[firstLetter].push(keyword);
            }
        });
        return grouped;
    });

    // Get all letters that have keywords
    const letters = $derived.by(() => {
        const grouped = keywordsByLetter;
        const allLetters = Object.keys(grouped).sort();
        // Put # at the end
        const hashIndex = allLetters.indexOf("#");
        if (hashIndex > -1) {
            allLetters.splice(hashIndex, 1);
            allLetters.push("#");
        }
        return allLetters;
    });

    // Convert keyword to URL slug
    function keywordToSlug(keyword: string): string {
        return keyword
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    // Calculate number of columns based on available letters
    const keywordColumns = $derived.by(() => {
        const letterCount = letters.length;
        if (letterCount <= 3) return 1;
        if (letterCount <= 6) return 2;
        if (letterCount <= 12) return 3;
        return 4;
    });

    // Distribute letters across columns
    const lettersByColumn = $derived.by(() => {
        const cols = keywordColumns;
        const letterList = letters;
        const result: string[][] = Array.from({ length: cols }, () => []);
        letterList.forEach((letter: string, index: number) => {
            result[index % cols].push(letter);
        });
        return result;
    });

    // ===== DATE LOGIC =====
    // Extract all unique dates from videos
    const allDates = $derived.by(() => {
        const dateSet = new Set<string>();
        const videoList = videos;
        videoList.forEach((video) => {
            const dateStr = video.uploadDate || video.timestamp || video.uploadedAt;
            if (dateStr) {
                try {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        // Format as YYYY-MM-DD
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, "0");
                        const day = String(date.getDate()).padStart(2, "0");
                        dateSet.add(`${year}-${month}-${day}`);
                    }
                } catch {
                    // Invalid date, skip
                }
            }
        });
        return Array.from(dateSet).sort().reverse(); // Most recent first
    });

    // Set of dates that have videos (for quick lookup)
    const datesWithVideos = $derived.by(() => {
        return new Set(allDates);
    });

    // Group dates by year > month > day
    const datesByYear = $derived.by(() => {
        const datesList = allDates;
        const grouped: Record<
            number,
            Record<number, Record<number, string>>
        > = {};

        datesList.forEach((dateStr: string) => {
            const [yearStr, monthStr, dayStr] = dateStr.split("-");
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10);
            const day = parseInt(dayStr, 10);

            if (!grouped[year]) grouped[year] = {};
            if (!grouped[year][month]) grouped[year][month] = {};
            grouped[year][month][day] = dateStr;
        });

        return grouped;
    });

    // Get sorted years
    const years = $derived.by(() => {
        return Object.keys(datesByYear)
            .map(Number)
            .sort((a, b) => b - a); // Most recent first
    });

    // Current year being viewed (initialize to current year, will be set properly when years are available)
    let currentYear = $state<number>(new Date().getFullYear());
    
    // Update currentYear to the most recent year with videos when available
    $effect(() => {
        if (years.length > 0 && !years.includes(currentYear)) {
            currentYear = years[0];
        }
    });

    // Check if a date has videos
    function hasVideos(year: number, month: number, day: number): boolean {
        const dateStr = getDateStr(year, month, day);
        return datesWithVideos.has(dateStr);
    }

    // Get calendar days for a month (returns array of day numbers, with null for days outside the month)
    function getCalendarDays(year: number, month: number): (number | null)[] {
        const firstDay = new Date(year, month - 1, 1);
        const lastDay = new Date(year, month, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

        const days: (number | null)[] = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }

        // Add all days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }

        return days;
    }


    // Get date string for year/month/day
    function getDateStr(year: number, month: number, day: number): string {
        return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }

    // Format date for display
    function formatDate(year: number, month: number, day: number): string {
        const dayStr = String(day).padStart(2, "0");
        const monthStr = String(month).padStart(2, "0");
        return `${dayStr}/${monthStr}/${year}`;
    }

    function formatMonth(month: number): string {
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
        return monthNames[month - 1] || String(month);
    }

    // Get months that have videos for the current year
    const monthsWithVideos = $derived.by(() => {
        const year = currentYear;
        const yearData = datesByYear[year];
        if (!yearData) return [];
        
        return Object.keys(yearData)
            .map(Number)
            .sort((a, b) => a - b); // Sort chronologically
    });


    // ===== USERS LOGIC =====
    // Get all users sorted alphabetically
    const allUsers = $derived.by(() => {
        const userList = users;
        return [...userList].sort((a, b) => a.name.localeCompare(b.name));
    });

    // Group users by first letter
    const usersByLetter = $derived.by(() => {
        const grouped: Record<string, Array<(typeof users)[number]>> = {};
        const userList = allUsers;
        userList.forEach((user) => {
            const firstLetter = user.name.charAt(0).toUpperCase();
            if (!/[A-Z]/.test(firstLetter)) {
                // If not a letter, group under "#"
                if (!grouped["#"]) grouped["#"] = [];
                grouped["#"].push(user);
            } else {
                if (!grouped[firstLetter]) grouped[firstLetter] = [];
                grouped[firstLetter].push(user);
            }
        });
        return grouped;
    });

    // Get all letters that have users
    const userLetters = $derived.by(() => {
        const grouped = usersByLetter;
        const allLetters = Object.keys(grouped).sort();
        // Put # at the end
        const hashIndex = allLetters.indexOf("#");
        if (hashIndex > -1) {
            allLetters.splice(hashIndex, 1);
            allLetters.push("#");
        }
        return allLetters;
    });

    // Calculate number of columns based on available letters
    const userColumns = $derived.by(() => {
        const letterCount = userLetters.length;
        if (letterCount <= 3) return 1;
        if (letterCount <= 6) return 2;
        if (letterCount <= 12) return 3;
        return 4;
    });

    // Distribute letters across columns
    const userLettersByColumn = $derived.by(() => {
        const cols = userColumns;
        const letterList = userLetters;
        const result: string[][] = Array.from({ length: cols }, () => []);
        letterList.forEach((letter: string, index: number) => {
            result[index % cols].push(letter);
        });
        return result;
    });

    // ===== SEARCH LOGIC =====
    // Natural language search across multiple fields
    const searchResults = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return [];

        const videoList = videos;
        const queryTerms = query.split(/\s+/).filter((term) => term.length > 0);

        return videoList.filter((video) => {
            // Search in title
            const titleMatch = video.title.toLowerCase().includes(query) ||
                queryTerms.every((term) => video.title.toLowerCase().includes(term));

            // Search in description
            const descMatch = video.description?.toLowerCase().includes(query) ||
                (video.description && queryTerms.every((term) => video.description.toLowerCase().includes(term))) ||
                false;

            // Search in keywords
            const keywordMatch = video.keywords?.some((keyword) =>
                keyword.toLowerCase().includes(query) ||
                queryTerms.some((term) => keyword.toLowerCase().includes(term))
            ) || false;

            // Search in author
            const authorMatch = video.author?.toLowerCase().includes(query) ||
                (video.author && queryTerms.every((term) => video.author.toLowerCase().includes(term))) ||
                false;

            // Search in transcript
            const transcriptMatch = video.transcript?.toLowerCase().includes(query) ||
                (video.transcript && queryTerms.some((term) => video.transcript?.toLowerCase().includes(term))) ||
                false;

            return titleMatch || descMatch || keywordMatch || authorMatch || transcriptMatch;
        });
    });

    // Sort search results by relevance (title matches first, then other fields)
    const sortedSearchResults = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return [];
        const results = searchResults;

        return [...results].sort((a, b) => {
            const aTitleMatch = a.title.toLowerCase().includes(query);
            const bTitleMatch = b.title.toLowerCase().includes(query);

            // Prioritize title matches
            if (aTitleMatch && !bTitleMatch) return -1;
            if (!aTitleMatch && bTitleMatch) return 1;

            // Then by date (most recent first)
            const aDate = a.uploadDate || a.timestamp || a.uploadedAt;
            const bDate = b.uploadDate || b.timestamp || b.uploadedAt;
            if (aDate && bDate) {
                return new Date(bDate).getTime() - new Date(aDate).getTime();
            }
            return 0;
        });
    });
</script>

<div class="min-h-screen p-8">
    <div class="max-w-7xl mx-auto">
        <header class="mb-8">
            <h1 class="text-3xl font-bold text-white mb-4">
                {activeTab === "keywords"
                    ? "Keywords"
                    : activeTab === "date"
                      ? "Dates"
                      : activeTab === "users"
                        ? "Users"
                        : "Search"}
            </h1>

            <!-- Tab Switcher -->
            <div class="flex gap-2 border-b border-white/10 mb-6">
                <button
                    onclick={() => (activeTab = "keywords")}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                    "keywords"
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white"} "
                >
                    Keywords
                </button>
                <button
                    onclick={() => (activeTab = "date")}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                    "date"
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white"} "
                >
                    Dates
                </button>
                <button
                    onclick={() => (activeTab = "users")}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                    "users"
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white"} "
                >
                    Users
                </button>
                <button
                    onclick={() => (activeTab = "search")}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                    "search"
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white"} "
                >
                    Search
                </button>
            </div>

            <p class="text-white/60 text-sm">
                {activeTab === "keywords"
                    ? "Browse all keywords organized alphabetically"
                    : activeTab === "date"
                      ? "Browse videos organized by year, month, and day"
                      : activeTab === "users"
                        ? "Browse all users organized alphabetically"
                        : "Search videos by title, description, keywords, author, or transcript"}
            </p>
        </header>

        {#if activeTab === "keywords"}
            {#if allKeywords.length > 0}
                <div
                    class="grid gap-8 mt-8"
                    style="grid-template-columns: repeat({keywordColumns}, 1fr);"
                >
                    {#each lettersByColumn as columnLetters}
                        <div class="space-y-6">
                            {#each columnLetters as letter}
                                {@const keywordList = keywordsByLetter[letter] || []}
                                <section>
                                    <h2
                                        class="text-xl font-semibold text-white/90 mb-3 pb-2 border-b border-white/10"
                                    >
                                        {letter === "#" ? "Symbols" : letter}
                                    </h2>
                                    <ul class="space-y-1">
                                        {#each keywordList as keyword}
                                            <li>
                                                <a
                                                    href="/browse/{keywordToSlug(keyword)}"
                                                    class="block py-1.5 px-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded transition-colors"
                                                >
                                                    {keyword}
                                                </a>
                                            </li>
                                        {/each}
                                    </ul>
                                </section>
                            {/each}
                        </div>
                    {/each}
                </div>
            {:else}
                <div
                    class="rounded-lg border border-white/10 bg-white/5 p-12 text-center"
                >
                    <p class="text-white/60">No keywords available yet.</p>
                </div>
            {/if}
        {:else if activeTab === "date"}
            <!-- Calendar View -->
            <div class="mt-8">
                <!-- Year Navigation Header -->
                <div class="flex items-center gap-3 mb-6 pb-2 border-b border-white/10">
                    <button
                        onclick={() => currentYear--}
                        class="p-1 hover:bg-white/10 transition-colors rounded"
                        aria-label="Previous year"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            class="text-white/70 hover:text-white"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 19l-7-7 7-7"
                            />
                        </svg>
                    </button>
                    <h2 class="text-xl font-semibold text-white/90">
                        {currentYear}
                    </h2>
                    <button
                        onclick={() => currentYear++}
                        class="p-1 hover:bg-white/10 transition-colors rounded"
                        aria-label="Next year"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            class="text-white/70 hover:text-white"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </button>
                </div>

                <!-- Calendar Grid -->
                {#if monthsWithVideos.length > 0}
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {#each monthsWithVideos as month}
                            {@const monthName = formatMonth(month)}
                            {@const calendarDays = getCalendarDays(currentYear, month)}
                            {@const monthSlug = `${currentYear}-${String(month).padStart(2, "0")}`}
                            {@const monthIndex = monthsWithVideos.indexOf(month)}
                            {@const totalMonths = monthsWithVideos.length}
                            {@const isLastItem = monthIndex === totalMonths - 1}
                            {@const showBorderMd = !isLastItem && (monthIndex + 1) % 2 !== 0}
                            {@const showBorderLg = !isLastItem && (monthIndex + 1) % 3 !== 0}
                            {@const showBorderXl = !isLastItem && (monthIndex + 1) % 4 !== 0}
                            <div class="p-4 {showBorderMd ? 'md:border-r' : ''} {showBorderLg ? 'lg:border-r' : ''} {showBorderXl ? 'xl:border-r' : ''} border-white/10">
                            <h3 class="text-lg font-semibold text-white/90 mb-3 pb-2 border-b border-white/10">
                                <a
                                    href="/date/{monthSlug}"
                                    class="hover:text-white transition-colors"
                                >
                                    {monthName}
                                </a>
                            </h3>
                            
                            <!-- Calendar Header (Day names) -->
                            <div class="grid grid-cols-7 gap-1 mb-2">
                                {#each ["S", "M", "T", "W", "T", "F", "S"] as dayName}
                                    <div class="text-xs text-center text-white/50 font-medium py-1">
                                        {dayName}
                                    </div>
                                {/each}
                            </div>

                            <!-- Calendar Days Grid -->
                            <div class="grid grid-cols-7 gap-1">
                                {#each calendarDays as day}
                                    {#if day === null}
                                        <div class="aspect-square"></div>
                                    {:else}
                                        {@const dateStr = getDateStr(currentYear, month, day)}
                                        {@const hasVideo = hasVideos(currentYear, month, day)}
                                        <a
                                            href="/date/{dateStr}"
                                            class="aspect-square flex items-center justify-center text-sm transition-colors {hasVideo
                                                ? "bg-orange-500/20 text-orange-400 border border-orange-500/40 hover:bg-orange-500/30"
                                                : "text-white/40 hover:text-white/60 hover:bg-white/5"} "
                                            title={hasVideo ? `Videos available on ${formatDate(currentYear, month, day)}` : formatDate(currentYear, month, day)}
                                        >
                                            {day}
                                        </a>
                                    {/if}
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
                {:else}
                    <div
                        class="rounded-lg border border-white/10 bg-white/5 p-12 text-center"
                    >
                        <p class="text-white/60">No videos available for {currentYear}.</p>
                    </div>
                {/if}
            </div>
        {:else if activeTab === "users"}
            <!-- Users View -->
            {#if allUsers.length > 0}
                <div
                    class="grid gap-8 mt-8"
                    style="grid-template-columns: repeat({userColumns}, 1fr);"
                >
                    {#each userLettersByColumn as columnLetters}
                        <div class="space-y-6">
                            {#each columnLetters as letter}
                                {@const userList = usersByLetter[letter] || []}
                                <section>
                                    <h2
                                        class="text-xl font-semibold text-white/90 mb-3 pb-2 border-b border-white/10"
                                    >
                                        {letter === "#" ? "Symbols" : letter}
                                    </h2>
                                    <ul class="space-y-1">
                                        {#each userList as user}
                                            <li>
                                                <a
                                                    href="/users/{user.id}"
                                                    class="block py-1.5 px-2 text-sm text-white/70 hover:text-white hover:bg-white/5 rounded transition-colors flex items-center gap-2"
                                                >
                                                    {#if user.avatar}
                                                        <img
                                                            src={user.avatar}
                                                            alt={user.name}
                                                            class="w-6 h-6 rounded-full object-cover"
                                                        />
                                                    {/if}
                                                    <span>{user.name}</span>
                                                </a>
                                            </li>
                                        {/each}
                                    </ul>
                                </section>
                            {/each}
                        </div>
                    {/each}
                </div>
            {:else}
                <div
                    class="rounded-lg border border-white/10 bg-white/5 p-12 text-center"
                >
                    <p class="text-white/60">No users available yet.</p>
                </div>
            {/if}
        {:else if activeTab === "search"}
            <!-- Search View -->
            <div class="mt-8">
                <!-- Search Input -->
                <div class="mb-8">
                    <div class="relative">
                        <input
                            type="text"
                            bind:value={searchQuery}
                            placeholder="Search videos by title, description, keywords, author, or transcript..."
                            class="w-full px-4 py-3 pl-12 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 transition-all"
                            autofocus
                        />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        {#if searchQuery}
                            <button
                                onclick={() => (searchQuery = "")}
                                class="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                                aria-label="Clear search"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        {/if}
                    </div>
                </div>

                <!-- Search Results -->
                {#if searchQuery.trim()}
                    {#if sortedSearchResults.length > 0}
                        <div class="mb-4 text-sm text-white/60">
                            Found {sortedSearchResults.length} result{sortedSearchResults.length === 1
                                ? ""
                                : "s"} for "{searchQuery}"
                        </div>
                        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {#each sortedSearchResults as video (video.id)}
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
                                                    class="text-sm font-medium text-white truncate mb-1"
                                                >
                                                    {vid.title}
                                                </h3>
                                                <p class="text-xs text-neutral-300 mb-1">
                                                    {vid.author}
                                                </p>
                                                {#if vid.description}
                                                    <p
                                                        class="text-xs text-neutral-400 line-clamp-2 mt-1"
                                                    >
                                                        {vid.description}
                                                    </p>
                                                {/if}
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
                            <p class="text-white/60 mb-2">
                                No videos found for "{searchQuery}"
                            </p>
                            <p class="text-sm text-white/40">
                                Try searching with different keywords or terms
                            </p>
                        </div>
                    {/if}
                {:else}
                    <div
                        class="rounded-lg border border-white/10 bg-white/5 p-12 text-center"
                    >
                        <p class="text-white/60 mb-2">
                            Enter a search query to find videos
                        </p>
                        <p class="text-sm text-white/40">
                            Search across titles, descriptions, keywords, authors, and transcripts
                        </p>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

