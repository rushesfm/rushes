<script lang="ts">
    import { videosStore, usersStore } from "$lib/stores/library";
    import { selectedVideo } from "$lib/stores/selectedVideo";
    import Map from "$lib/components/Map.svelte";
    import MonthCalendar from "$lib/components/MonthCalendar.svelte";
    import { page } from "$app/stores";

    const videos = $derived($videosStore);
    const users = $derived($usersStore);
    let activeTab = $state<"keywords" | "date" | "users" | "search" | "map" | "index">("index");
    let searchQuery = $state("");

    // Filter state for Index tab
    let indexSearchQuery = $state("");
    let selectedMonthYear = $state<number | null>(null); // null means show all
    let selectedMonth = $state<number | null>(null); // null means show all
    let selectedFormat = $state<string>("all"); // "all", "video", "audio"
    let compactView = $state(true); // Default to compact view
    let listView = $state(false);
    let showMonthCalendarPopup = $state(false);
    
    // Track minimized months
    let minimizedMonths = $state<Set<string>>(new Set());
    
    // Toggle month minimized state
    function toggleMonthMinimized(year: number, month: number) {
        const key = `${year}-${month}`;
        const newSet = new Set(minimizedMonths);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        minimizedMonths = newSet;
    }
    
    // Check if month is minimized
    function isMonthMinimized(year: number, month: number): boolean {
        return minimizedMonths.has(`${year}-${month}`);
    }
    
    // Play all videos in a month
    function playAllInMonth(year: number, month: number) {
        const rushes = rushesByYearMonth[year][month] || [];
        if (rushes.length === 0) return;
        
        const videoIds = rushes.map(rush => rush.id);
        const monthName = formatMonth(month);
        
        selectedVideo.setTemporaryQueue(videoIds, {
            type: 'date',
            label: `${monthName} ${year}`,
            videoIds: videoIds
        });
        
        // Select the first video
        if (videoIds.length > 0) {
            selectedVideo.selectVideo(videoIds[0]);
        }
    }
    
    // Get all available months (for navigation)
    const availableMonths = $derived.by(() => {
        const months: Array<{ year: number; month: number }> = [];
        const monthSet = new Set<string>();
        
        videos.forEach((rush) => {
            const dateStr = rush.uploadDate || rush.timestamp || rush.uploadedAt || rush.createdAt;
            if (!dateStr) return;
            
            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return;
                
                const year = date.getFullYear();
                const month = date.getMonth() + 1;
                const key = `${year}-${month}`;
                
                if (!monthSet.has(key)) {
                    monthSet.add(key);
                    months.push({ year, month });
                }
            } catch {
                // Invalid date, skip
            }
        });
        
        // Sort by year (desc) then month (desc)
        return months.sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });
    });
    
    // Initialize to most recent month
    $effect(() => {
        if (availableMonths.length > 0 && selectedMonthYear === null && selectedMonth === null) {
            const latest = availableMonths[0];
            selectedMonthYear = latest.year;
            selectedMonth = latest.month;
        }
    });
    
    // Navigate to previous month
    function previousMonth() {
        if (!selectedMonthYear || !selectedMonth) return;
        
        const currentIndex = availableMonths.findIndex(
            m => m.year === selectedMonthYear && m.month === selectedMonth
        );
        
        if (currentIndex === -1) return;
        
        if (currentIndex < availableMonths.length - 1) {
            const next = availableMonths[currentIndex + 1];
            selectedMonthYear = next.year;
            selectedMonth = next.month;
            scrollToMonth(next.year, next.month);
        }
    }
    
    // Navigate to next month
    function nextMonth() {
        if (!selectedMonthYear || !selectedMonth) return;
        
        const currentIndex = availableMonths.findIndex(
            m => m.year === selectedMonthYear && m.month === selectedMonth
        );
        
        if (currentIndex === -1) return;
        
        if (currentIndex > 0) {
            const next = availableMonths[currentIndex - 1];
            selectedMonthYear = next.year;
            selectedMonth = next.month;
            scrollToMonth(next.year, next.month);
        }
    }
    
    // Scroll to a specific month
    function scrollToMonth(year: number, month: number) {
        // Use a small timeout to ensure the DOM is ready
        setTimeout(() => {
            const monthId = `month-${year}-${month}`;
            const element = document.getElementById(monthId);
            if (element) {
                // scroll-margin-top is set in CSS, so we can use scrollIntoView directly
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
    }

    // Auto-scroll when selected month changes
    $effect(() => {
        if (selectedMonthYear && selectedMonth && activeTab === "index") {
            scrollToMonth(selectedMonthYear, selectedMonth);
        }
    });

    // Map-related logic
    const locations = $derived(
        videos.flatMap((video) =>
            video.locations?.map((loc) => ({
                ...loc,
                videoId: video.id,
                videoTitle: video.title,
                videoAuthor: video.author
            })) ?? []
        )
    );

    const lat = $derived(parseFloat($page.url.searchParams.get('lat') ?? '20'));
    const lon = $derived(parseFloat($page.url.searchParams.get('lon') ?? '0'));
    const zoom = $derived(parseInt($page.url.searchParams.get('zoom') ?? '2', 10));

    const filteredLocations = $derived(
        lat && lon
            ? locations.filter(
                (loc) =>
                    Array.isArray(loc.coordinates) &&
                    Math.abs(loc.coordinates[0] - lat) < 0.1 &&
                    Math.abs(loc.coordinates[1] - lon) < 0.1
            )
            : locations
    );

    const activeVideoId = $derived($selectedVideo.id);

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

    // ===== INDEX TAB LOGIC =====
    // Filter rushes based on filters
    const filteredRushes = $derived.by(() => {
        let filtered = [...videos];

        // Format filter (video vs audio)
        if (selectedFormat !== "all") {
            filtered = filtered.filter((rush) => {
                const format = rush.format?.toLowerCase() || "";
                const url = (rush.url || rush.videoUrl || "").toLowerCase();
                if (selectedFormat === "video") {
                    return format.includes("video") || 
                           format.includes("mp4") || 
                           format.includes("webm") ||
                           url.includes("video") ||
                           url.includes(".mp4") ||
                           url.includes(".webm");
                } else if (selectedFormat === "audio") {
                    return format.includes("audio") || 
                           format.includes("mp3") || 
                           format.includes("wav") ||
                           url.includes("audio") ||
                           url.includes(".mp3") ||
                           url.includes(".wav");
                }
                return true;
            });
        }

        // Month filter (if a month is selected)
        // Note: We don't filter by month here - we show all rushes but scroll to the selected month
        // The month selector is for navigation/scrolling, not filtering

        // Search filter
        if (indexSearchQuery.trim()) {
            const query = indexSearchQuery.trim().toLowerCase();
            const queryTerms = query.split(/\s+/).filter((term) => term.length > 0);
            
            filtered = filtered.filter((rush) => {
                const titleMatch = rush.title?.toLowerCase().includes(query) ||
                    queryTerms.every((term) => rush.title?.toLowerCase().includes(term));
                
                const descMatch = rush.description?.toLowerCase().includes(query) ||
                    (rush.description && queryTerms.every((term) => rush.description.toLowerCase().includes(term))) ||
                    false;

                const authorMatch = rush.author?.toLowerCase().includes(query) ||
                    (rush.author && queryTerms.every((term) => rush.author.toLowerCase().includes(term))) ||
                    false;

                return titleMatch || descMatch || authorMatch;
            });
        }

        return filtered;
    });

    // Group filtered rushes by year and month
    const rushesByYearMonth = $derived.by(() => {
        const grouped: Record<number, Record<number, typeof videos>> = {};
        
        filteredRushes.forEach((rush) => {
            const dateStr = rush.uploadDate || rush.timestamp || rush.uploadedAt || rush.createdAt;
            if (!dateStr) return;

            try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return;

                const year = date.getFullYear();
                const month = date.getMonth() + 1; // 1-12

                if (!grouped[year]) grouped[year] = {};
                if (!grouped[year][month]) grouped[year][month] = [];
                grouped[year][month].push(rush);
            } catch {
                // Invalid date, skip
            }
        });

        // Sort rushes within each month by date (most recent first)
        Object.keys(grouped).forEach((yearStr) => {
            const year = parseInt(yearStr, 10);
            Object.keys(grouped[year]).forEach((monthStr) => {
                const month = parseInt(monthStr, 10);
                grouped[year][month].sort((a, b) => {
                    const aDate = new Date(a.uploadDate || a.timestamp || a.uploadedAt || a.createdAt || "");
                    const bDate = new Date(b.uploadDate || b.timestamp || b.uploadedAt || b.createdAt || "");
                    return bDate.getTime() - aDate.getTime();
                });
            });
        });

        return grouped;
    });

    // Get sorted years (most recent first)
    const indexYears = $derived.by(() => {
        return Object.keys(rushesByYearMonth)
            .map(Number)
            .sort((a, b) => b - a);
    });

    // Get sorted months for a year (most recent first)
    function getMonthsForYear(year: number): number[] {
        const yearData = rushesByYearMonth[year];
        if (!yearData) return [];
        return Object.keys(yearData)
            .map(Number)
            .sort((a, b) => b - a);
    }

    // Get format type for a rush
    function getRushFormat(rush: typeof videos[number]): "video" | "audio" | "unknown" {
        const format = rush.format?.toLowerCase() || "";
        const url = (rush.url || rush.videoUrl || "").toLowerCase();
        
        if (format.includes("video") || format.includes("mp4") || format.includes("webm") ||
            url.includes("video") || url.includes(".mp4") || url.includes(".webm")) {
            return "video";
        }
        
        if (format.includes("audio") || format.includes("mp3") || format.includes("wav") ||
            url.includes("audio") || url.includes(".mp3") || url.includes(".wav")) {
            return "audio";
        }
        
        return "unknown";
    }

    // Format date for display
    function formatRushDate(dateStr: string | undefined): string {
        if (!dateStr) return "";
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return dateStr;
        }
    }
</script>

<div class="browse-container" class:map-active={activeTab === "map"}>
    <div class="browse-content" class:map-view={activeTab === "map"} class:index-view={activeTab === "index"}>
        <header class="browse-header floating">
            <!-- <h1 class="text-3xl font-bold text-white mb-4">
                {activeTab === "keywords"
                    ? "Keywords"
                    : activeTab === "date"
                      ? "Dates"
                      : activeTab === "users"
                        ? "Users"
                        : activeTab === "map"
                          ? "Map"
                          : "Search"}
            </h1> -->

            <!-- Tab Switcher -->
            <div class="flex gap-2 border-b border-white/10 mb-6" class:map-active={activeTab === "map"}>
                <button
                    onclick={() => (activeTab = "index")}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                    "index"
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white"} "
                >
                    Index
                </button>
                <button
                    onclick={() => (activeTab = "map")}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                    "map"
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white"} "
                >
                    Locations
                </button>
                <button
                    onclick={() => (activeTab = "keywords")}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                    "keywords"
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white"} "
                >
                    Keywords
                </button>
                <!-- <button
                    onclick={() => (activeTab = "date")}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                    "date"
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white"} "
                >
                    Dates
                </button> -->
                <button
                    onclick={() => (activeTab = "users")}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                    "users"
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white"} "
                >
                    Users
                </button>
                <!-- <button
                    onclick={() => (activeTab = "search")}
                    class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                    "search"
                        ? "border-white text-white"
                        : "border-transparent text-white/60 hover:text-white"} "
                >
                    Search
                </button> -->
            </div>

            <!-- Filter Bar (shown for Index tab) -->
            {#if activeTab === "index"}
                <div class="filters-container mb-6">
                    <div class="filters-row">
                        <!-- Search -->
                        <div class="filter-item filter-search">
                            <svg class="filter-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                                <circle cx="11" cy="11" r="7" />
                                <line x1="20" y1="20" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                bind:value={indexSearchQuery}
                                placeholder="Search rushes..."
                                class="filter-input"
                            />
                            {#if indexSearchQuery}
                                <button
                                    onclick={() => (indexSearchQuery = "")}
                                    class="filter-clear"
                                    aria-label="Clear search"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            {/if}
                        </div>

                        <!-- Format Filter (Icon Toggles) -->
                        <div class="format-filter-group">
                            <button
                                onclick={() => (selectedFormat = "all")}
                                class="format-toggle-btn {selectedFormat === "all" ? "active" : ""}"
                                aria-label="Show all formats"
                                title="Show all formats"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/>
                                    <path d="M9 2v20M15 2v20"/>
                                    <path d="M2 9h20M2 15h20"/>
                                </svg>
                            </button>
                            <button
                                onclick={() => (selectedFormat = selectedFormat === "video" ? "all" : "video")}
                                class="format-toggle-btn {selectedFormat === "video" ? "active" : ""}"
                                aria-label="Video only"
                                title="Video only"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                                    <polygon points="23 7 16 12 23 17 23 7"/>
                                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                                </svg>
                            </button>
                            <button
                                onclick={() => (selectedFormat = selectedFormat === "audio" ? "all" : "audio")}
                                class="format-toggle-btn {selectedFormat === "audio" ? "active" : ""}"
                                aria-label="Audio only"
                                title="Audio only"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                                </svg>
                            </button>
                        </div>

                        <!-- Month Selector (Pill UI) with Calendar Popup -->
                        {#if availableMonths.length > 0 && selectedMonthYear && selectedMonth}
                            <div 
                                class="month-selector-wrapper"
                                role="group"
                                aria-label="Month selector with calendar popup"
                                onmouseenter={() => (showMonthCalendarPopup = true)}
                                onmouseleave={() => (showMonthCalendarPopup = false)}
                            >
                                <div class="month-selector-pill">
                                    <button
                                        onclick={previousMonth}
                                        class="month-nav-btn"
                                        aria-label="Previous month"
                                        disabled={availableMonths.findIndex(m => m.year === selectedMonthYear && m.month === selectedMonth) === availableMonths.length - 1}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M15 18l-6-6 6-6" />
                                        </svg>
                                    </button>
                                    <div class="month-display">
                                        {formatMonth(selectedMonth)} {selectedMonthYear}
                                    </div>
                                    <button
                                        onclick={nextMonth}
                                        class="month-nav-btn"
                                        aria-label="Next month"
                                        disabled={availableMonths.findIndex(m => m.year === selectedMonthYear && m.month === selectedMonth) === 0}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M9 18l6-6-6-6" />
                                        </svg>
                                    </button>
                                </div>
                                
                                <!-- Calendar Popup -->
                                {#if showMonthCalendarPopup && selectedMonthYear && selectedMonth}
                                    <div 
                                        class="calendar-popup"
                                        onmouseenter={() => (showMonthCalendarPopup = true)}
                                        onmouseleave={() => (showMonthCalendarPopup = false)}
                                    >
                                        <MonthCalendar
                                            year={selectedMonthYear}
                                            month={selectedMonth}
                                            datesWithVideos={datesWithVideos}
                                            onMonthChange={(newYear, newMonth) => {
                                                selectedMonthYear = newYear;
                                                selectedMonth = newMonth;
                                            }}
                                        />
                                    </div>
                                {/if}
                            </div>
                        {/if}

                        <!-- View Mode Toggles -->
                        <div 
                            class="view-toggle-group"
                            data-active-index={listView ? "1" : "0"}
                        >
                            <!-- Compact View Toggle -->
                            <button
                                onclick={() => {
                                    compactView = !compactView;
                                    if (compactView) listView = false;
                                }}
                                class="filter-item view-toggle {compactView && !listView ? 'active' : ''}"
                                aria-label="Toggle compact view"
                                title={compactView ? "Switch to normal view" : "Switch to compact view"}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                                </svg>
                            </button>
                            
                            <!-- List View Toggle -->
                            <button
                                onclick={() => {
                                    listView = !listView;
                                    if (listView) compactView = false;
                                }}
                                class="filter-item view-toggle {listView ? 'active' : ''}"
                                aria-label="Toggle list view"
                                title={listView ? "Switch to grid view" : "Switch to list view"}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="3" y1="12" x2="21" y2="12"/>
                                    <line x1="3" y1="6" x2="21" y2="6"/>
                                    <line x1="3" y1="18" x2="21" y2="18"/>
                                </svg>
                            </button>
                        </div>

                        <!-- Clear Filters -->
                        {#if selectedFormat !== "all" || indexSearchQuery}
                            <button
                                onclick={() => {
                                    selectedFormat = "all";
                                    indexSearchQuery = "";
                                }}
                                class="filter-clear-btn"
                            >
                                Clear Filters
                            </button>
                        {/if}
                    </div>
                </div>
            {/if}

            <p class="text-white/60 text-sm">
                {activeTab === "index"
                    ? "Browse all rushes organized by year and month"
                    : activeTab === "keywords"
                      ? "Browse all keywords organized alphabetically"
                      : activeTab === "date"
                        ? "Browse videos organized by year, month, and day"
                        : activeTab === "users"
                          ? "Browse all users organized alphabetically"
                          : activeTab === "map"
                            ? "Browse videos by location on an interactive map"
                            : "Search videos by title, description, keywords, author, or transcript"}
            </p>
        </header>

        {#if activeTab === "index"}
            <!-- Index View: Rushes by Year and Month -->
            {#if filteredRushes.length > 0}
                <div class="index-container" class:compact={compactView}>
                    {#each indexYears as year}
                        {@const months = getMonthsForYear(year)}
                        <section class="year-section">
                            <h2 class="year-heading">{year}</h2>
                            {#each months as month}
                                {@const rushes = rushesByYearMonth[year][month] || []}
                                {@const isMinimized = isMonthMinimized(year, month)}
                                <div class="month-section" id="month-{year}-{month}">
                                    <div class="month-header">
                                        <h3 class="month-heading">{formatMonth(month)}</h3>
                                        <div class="month-actions">
                                            <button
                                                onclick={() => playAllInMonth(year, month)}
                                                class="month-action-btn play-all-btn"
                                                aria-label="Play all videos in {formatMonth(month)} {year}"
                                                title="Play all videos in this month"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <polygon points="5 3 19 12 5 21 5 3" />
                                                </svg>
                                                <span>Play All</span>
                                            </button>
                                            <button
                                                onclick={() => toggleMonthMinimized(year, month)}
                                                class="month-action-btn minimize-btn {isMinimized ? 'minimized' : ''}"
                                                aria-label={isMinimized ? "Expand month" : "Minimize month"}
                                                title={isMinimized ? "Expand month" : "Minimize month"}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                    <path d="M18 15l-6-6-6 6" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    {#if !isMinimized}
                                        <div class="rushes-grid" class:compact={compactView && !listView} class:list={listView}>
                                        {#each rushes as rush (rush.id)}
                                            {@const format = getRushFormat(rush)}
                                            {@const rushDate = formatRushDate(rush.uploadDate || rush.timestamp || rush.uploadedAt || rush.createdAt)}
                                            <a
                                                href={`/videos/${rush.id}`}
                                                onclick={(e) => {
                                                    e.preventDefault();
                                                    selectedVideo.selectVideo(rush.id);
                                                }}
                                                class="rush-card"
                                            >
                                                <div class="rush-thumbnail">
                                                    {#if rush.thumbnailUrl}
                                                        <img
                                                            src={rush.thumbnailUrl}
                                                            alt={rush.title}
                                                            class="rush-thumbnail-img"
                                                            loading="lazy"
                                                        />
                                                    {:else}
                                                        <div class="rush-thumbnail-placeholder">
                                                            {#if format === "audio"}
                                                                <svg class="rush-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                                                                </svg>
                                                            {:else}
                                                                <svg class="rush-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                                    <polygon points="23 7 16 12 23 17 23 7" />
                                                                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                                                                </svg>
                                                            {/if}
                                                        </div>
                                                    {/if}
                                                    {#if format === "video"}
                                                        <div class="rush-format-badge rush-format-video">Video</div>
                                                    {:else if format === "audio"}
                                                        <div class="rush-format-badge rush-format-audio">Audio</div>
                                                    {/if}
                                                    {#if rush.duration}
                                                        <div class="rush-duration">
                                                            {Math.floor(rush.duration / 60)}:{String(Math.floor(rush.duration % 60)).padStart(2, "0")}
                                                        </div>
                                                    {/if}
                                                </div>
                                                <div class="rush-info">
                                                    <h4 class="rush-title">{rush.title}</h4>
                                                    <div class="rush-meta">
                                                        <span class="rush-author">{rush.author}</span>
                                                        {#if rushDate}
                                                            <span class="rush-date">{rushDate}</span>
                                                        {/if}
                                                    </div>
                                                    {#if rush.description}
                                                        <p class="rush-description">{rush.description}</p>
                                                    {/if}
                                                </div>
                                            </a>
                                        {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </section>
                    {/each}
                </div>
            {:else}
                <div class="rounded-lg border border-white/10 bg-white/5 p-12 text-center">
                    <p class="text-white/60 mb-2">
                        {indexSearchQuery || selectedFormat !== "all"
                            ? "No rushes match your filters"
                            : "No rushes available yet"}
                    </p>
                    {#if indexSearchQuery || selectedFormat !== "all"}
                        <p class="text-sm text-white/40">
                            Try adjusting your filters to see more results
                        </p>
                    {/if}
                </div>
            {/if}
        {:else if activeTab === "keywords"}
            {#if allKeywords.length > 0}
                <div
                    class="grid gap-8"
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
            <div>
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
                    class="grid gap-8"
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
            <div>
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
        {:else if activeTab === "map"}
            <!-- Map View -->
            <div class="map-view-container">
                <Map
                    locations={filteredLocations}
                    initialCenterLon={lon}
                    initialCenterLat={lat}
                    initialZoom={zoom}
                    activeVideoId={activeVideoId}
                />
            </div>
        {/if}
    </div>
</div>

<style>
    .browse-container {
        position: relative;
        height: 100vh;
        width: 100%;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .browse-container.map-active {
        padding: 0;
        height: 100vh;
    }

    .browse-content {
        min-height: 100vh;
        padding: 0;
        padding-left: 2rem;
        padding-right: 2rem;
        padding-bottom: 2rem;
        max-width: 1280px;
        margin: 0 auto;
        position: relative;
    }

    .browse-content.map-view {
        padding: 0;
        padding-top: 0;
        max-width: 100%;
        position: relative;
        min-height: 100vh;
    }

    .browse-header {
        position: sticky;
        top: 0;
        z-index: 30;
        padding: 1.5rem 2rem;
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(18px);
        box-shadow: 0 8px 32px -8px rgba(15, 23, 42, 0.4);
        margin-bottom: 0;
        margin-left: -2rem;
        margin-right: -2rem;
        margin-top: 0;
    }

    .browse-content.map-view .browse-header {
        margin-left: 0;
        margin-right: 0;
        padding-left: 2rem;
        padding-right: 2rem;
    }

    .browse-header.floating h1 {
        margin-bottom: 1rem;
        font-size: 1.75rem;
    }

    .browse-header p {
        display: none;
    }

    .browse-header .flex {
        margin-bottom: 0;
    }

    .browse-header .flex.map-active {
        justify-content: flex-start;
    }

    /* Filter Styles */
    .filters-container {
        margin-top: 1rem;
    }

    .filters-row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        align-items: center;
    }

    .filter-item {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        transition: all 0.2s ease;
        background: rgba(255, 255, 255, 0.08);

    }

    .filter-item:focus-within {
        border-color: rgba(255, 255, 255, 0.2);
        background: rgba(255, 255, 255, 0.08);
    }

    .filter-search {
        flex: 1 1 200px;
        min-width: 200px;
    }

    .filter-icon {
        opacity: 0.6;
        flex-shrink: 0;
    }

    .filter-input,
    .filter-select {
        flex: 1;
        min-width: 0;
        border: none;
        background: transparent;
        color: white;
        font-size: 0.875rem;
        outline: none;
    }

    .filter-input::placeholder {
        color: rgba(255, 255, 255, 0.4);
    }

    .filter-select {
        cursor: pointer;
    }

    .filter-select option {
        background: rgba(15, 18, 24, 0.98);
        color: white;
    }

    /* Format Filter Icon Group */
    .format-filter-group {
        display: inline-flex;
        gap: 0;
        padding: 0.25rem;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        position: relative;
    }

    .format-toggle-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 0.75rem;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        border-radius: 9999px;
        transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        flex-shrink: 0;
        position: relative;
        z-index: 1;
        min-width: 40px;
    }

    .format-toggle-btn:hover {
        color: rgba(255, 255, 255, 0.8);
    }

    .format-toggle-btn.active {
        color: white;
    }

    /* Animated orange highlight background */
    .format-filter-group::before {
        content: '';
        position: absolute;
        top: 0.25rem;
        bottom: 0.25rem;
        left: 0.25rem;
        width: calc(100% / 3);
        background: rgb(251, 146, 60);
        border-radius: 9999px;
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                    width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 0;
        will-change: transform;
    }

    .format-filter-group[data-active-index="0"]::before {
        transform: translateX(0);
    }

    .format-filter-group[data-active-index="1"]::before {
        transform: translateX(calc(100% / 3 * 1));
    }

    .format-filter-group[data-active-index="2"]::before {
        transform: translateX(calc(100% / 3 * 2));
    }

    .format-toggle-btn svg {
        width: 18px;
        height: 18px;
        position: relative;
        z-index: 1;
    }

    /* Month Selector Pill */
    .month-selector-wrapper {
        position: relative;
        display: inline-block;
    }

    .month-selector-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0;
        overflow: hidden;
    }

    .calendar-popup {
        position: absolute;
        top: calc(100% + 0.75rem);
        left: 50%;
        transform: translateX(-50%);
        z-index: 50;
        background: rgba(15, 18, 24, 0.95);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        padding: 1rem;
        box-shadow: 0 12px 48px -12px rgba(0, 0, 0, 0.5);
        min-width: 280px;
        pointer-events: auto;
    }

    .month-nav-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 0.75rem;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
    }

    .month-nav-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
        color: white;
    }

    .month-nav-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .month-display {
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: white;
        white-space: nowrap;
        min-width: 140px;
        text-align: center;
    }

    .filter-clear {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s ease;
    }

    .filter-clear:hover {
        color: white;
        background: rgba(255, 255, 255, 0.1);
    }

    .filter-clear-btn {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: rgba(255, 255, 255, 0.8);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .filter-clear-btn:hover {
        background: rgba(255, 255, 255, 0.15);
        color: white;
        border-color: rgba(255, 255, 255, 0.25);
    }

    .view-toggle-group {
        display: inline-flex;
        gap: 0;
        padding: 0.25rem;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        position: relative;
    }

    .view-toggle {
        padding: 0.5rem 0.75rem;
        cursor: pointer;
        flex-shrink: 0;
        position: relative;
        z-index: 1;
        border-radius: 9999px;
        transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        min-width: 40px;
    }

    .view-toggle:hover {
        color: rgba(255, 255, 255, 0.8);
    }

    .view-toggle.active {
        color: white;
    }

    /* Animated orange highlight background */
    .view-toggle-group::before {
        content: '';
        position: absolute;
        top: 0.25rem;
        bottom: 0.25rem;
        left: 0.25rem;
        width: calc(100% / 2);
        background: rgb(251, 146, 60);
        border-radius: 9999px;
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                    width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 0;
        will-change: transform;
    }

    .view-toggle-group[data-active-index="0"]::before {
        transform: translateX(0);
    }

    .view-toggle-group[data-active-index="1"]::before {
        transform: translateX(100%);
    }

    /* Index View Styles */
    .index-container {
        display: flex;
        flex-direction: column;
        gap: 3rem;
    }

    .year-section {
        display: flex;
        flex-direction: column;
    }

    .year-heading {
        font-size: 1.3rem;
        font-weight: 700;
        color: white;
        border-bottom: 2px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 0.5rem;
    }

    .month-section {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin: 0rem; padding: 1rem 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        scroll-margin-top: 240px; /* Account for floating header */
    }

    .month-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 0.5rem;
    }

    .month-heading {
        font-size: 1.05rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
        margin: 0;
    }

    .month-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .month-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
    }

    .month-action-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
        color: white;
    }

    .play-all-btn {
        background: rgba(251, 146, 60, 0.1);
        border-color: rgba(251, 146, 60, 0.3);
        color: rgb(251, 146, 60);
    }

    .play-all-btn:hover {
        background: rgba(251, 146, 60, 0.2);
        border-color: rgba(251, 146, 60, 0.4);
        color: rgb(251, 146, 60);
    }

    .minimize-btn {
        padding: 0.5rem;
        min-width: auto;
    }

    .minimize-btn.minimized {
        transform: rotate(180deg);
    }

    .month-action-btn svg {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
    }

    .rushes-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1.5rem;
    }

    .rushes-grid.compact {
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 1rem;
    }

    .rushes-grid.list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .rush-card {
        display: flex;
        flex-direction: column;
        border: 1px solid rgba(255, 255, 255, 0.1);
        overflow: hidden;
        transition: all 0.2s ease;
        cursor: pointer;
        text-decoration: none;
        color: inherit;
    }



    .rushes-grid.list .rush-card {
        flex-direction: row;
  
        max-width: 100%;
    }

    .rush-card:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .rush-thumbnail {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: rgba(255, 255, 255, 0.05);
        overflow: hidden;
    }

    .rushes-grid.list .rush-thumbnail {
        width: 160px;
        min-width: 160px;
        aspect-ratio: 16 / 9;
        flex-shrink: 0;
    }

    .rush-thumbnail-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .rush-thumbnail-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.4);
    }

    .rush-icon {
        opacity: 0.5;
    }

    .rush-format-badge {
        position: absolute;
        top: 0.5rem;
        left: 0.5rem;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .rush-format-video {
        background: rgba(59, 130, 246, 0.9);
        color: white;
    }

    .rush-format-audio {
        background: rgba(168, 85, 247, 0.9);
        color: white;
    }

    .rush-duration {
        position: absolute;
        bottom: 0.5rem;
        right: 0.5rem;
        padding: 0.25rem 0.5rem;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
    }

    .rush-info {
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .rushes-grid.compact .rush-info {
        padding: 0.75rem;
        gap: 0.375rem;
    }

    .rushes-grid.list .rush-info {
        padding: 1rem;
        gap: 0.5rem;
        flex: 1;
        min-width: 0;
    }

    .rush-title {
        font-size: 0.9375rem;
        font-weight: 600;
        color: white;
        margin: 0;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .rushes-grid.compact .rush-title {
        font-size: 0.8125rem;
        -webkit-line-clamp: 1;
    }

    .rush-meta {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.8125rem;
    }

    .rushes-grid.compact .rush-meta {
        font-size: 0.75rem;
        gap: 0.125rem;
    }

    .rush-author {
        color: rgba(255, 255, 255, 0.7);
    }

    .rush-date {
        color: rgba(255, 255, 255, 0.5);
        font-size: 0.75rem;
    }

    .rushes-grid.compact .rush-date {
        font-size: 0.6875rem;
    }

    .rush-description {
        font-size: 0.8125rem;
        color: rgba(255, 255, 255, 0.6);
        margin: 0;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .rushes-grid.compact .rush-description {
        font-size: 0.75rem;
        -webkit-line-clamp: 1;
        display: none; /* Hide description in compact view */
    }

    .rushes-grid.list .rush-description {
        font-size: 0.8125rem;
        -webkit-line-clamp: 2;
        display: -webkit-box;
    }

    .rushes-grid.compact .rush-format-badge {
        font-size: 0.6875rem;
        padding: 0.125rem 0.375rem;
    }

    .rushes-grid.compact .rush-duration {
        font-size: 0.6875rem;
        padding: 0.125rem 0.375rem;
    }

    .map-view-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100vh;
        z-index: 10;
    }

    @media (max-width: 768px) {
        .browse-header {
            padding: 1rem;
        }

        .browse-header.floating h1 {
            font-size: 1.5rem;
            margin-bottom: 0.75rem;
        }

        .browse-content {
            padding: 0;
            padding-top: calc(1rem + 1.5rem + 0.75rem + 2.5rem + 1rem);
            /* header padding + h1 height + h1 margin-bottom + tab height + content top padding */
            padding-left: 1rem;
            padding-right: 1rem;
            padding-bottom: 1rem;
        }

        .browse-content.map-view {
            padding: 0;
            padding-top: 0;
        }
    }
</style>

