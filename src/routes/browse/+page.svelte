<script lang="ts">
    import { videosStore, usersStore } from "$lib/stores/library";
    import { selectedVideo } from "$lib/stores/selectedVideo";
    import MapComponent from "$lib/components/Map.svelte";
    import MonthCalendar from "$lib/components/MonthCalendar.svelte";
    import TogglePill from "$lib/components/TogglePill.svelte";
    import { page } from "$app/stores";
    import type { Location as BaseLocation } from "$lib/types/content";
    import type { SearchPlaceResult } from "$lib/utils/mapbox";
    import { searchPlaces } from "$lib/utils/mapbox";

    type MapLocation = BaseLocation & {
        videoTitle?: string;
        videoAuthor?: string;
        videoId?: string;
    };

    type MapBreadcrumb = {
        label: string;
        level: "global" | "country" | "region" | "place";
        country?: string;
        region?: string;
        location?: MapLocation | null;
    };
    type MapSearchResult = SearchPlaceResult & { 
        hasVideos: boolean;
        videoCount?: number;
        thumbnails?: string[];
        usernames?: string[];
    };
    const videos = $derived($videosStore);
    const users = $derived($usersStore);
    type TabKey = "keywords" | "date" | "users" | "search" | "map" | "index";
    let activeTab = $state<TabKey>("index");
    let searchQuery = $state("");
    let previousActiveTab = $state<TabKey>("index");

    // Filter state for Index tab
    let indexSearchQuery = $state("");
    let selectedMonthYear = $state<number | null>(null); // null means show all
    let selectedMonth = $state<number | null>(null); // null means show all
    let selectedFormat = $state<string>("all"); // "all", "video", "audio"
    let compactView = $state(true); // Default to compact view
    let listView = $state(false);
    let showMonthCalendarPopup = $state(false);
    
    // Filter state for Map tab
    let mapSearchQuery = $state("");
    let mapSearchResults = $state<MapSearchResult[]>([]);
    let showMapSearchResults = $state(false);
    let mapSearchLoading = $state(false);
    let mapSearchDebounce: ReturnType<typeof setTimeout> | null = null;
    let mapSearchRequestId = 0;
    let mapActiveLocation = $state<MapLocation | null>(null);
    let mapAdminContext = $state<{
        country?: string | null;
        region?: string | null;
        city?: string | null;
        fullAddress?: string | null;
    } | null>(null);
    let mapRef: MapComponent | null = null;
    let activeBreadcrumbLevel = $state<"global" | "country" | "region" | "place" | null>(null);
    let mapCarouselContainer = $state<HTMLElement | null>(null);
    let canScrollLeft = $state(false);
    let canScrollRight = $state(false);
    let mapViewportBounds = $state<{ north: number; south: number; east: number; west: number } | null>(null);
    let tooltipVideo = $state<typeof videos[0] | null>(null);
    let tooltipPosition = $state({ x: 0, y: 0 });
    let tooltipVisible = $state(false);
    let tooltipImageLoaded = $state(false);
    let userHasInteractedWithMap = $state(false);
    let shouldAutoCenterOnVideo = $state(true);
    
    $effect(() => {
        if (activeTab === "map" && previousActiveTab !== "map") {
            shouldAutoCenterOnVideo = true;
        }
        previousActiveTab = activeTab;
    });
    
    // Cache for preview URLs to avoid recalculating
    const previewUrlCache = new Map<string, string>();
    
    function getPreviewThumbnailUrl(video: typeof videos[0]): string | null {
        if (!video.streamId) return null;
        
        // Return cached URL if available (for better caching behavior)
        const cacheKey = video.streamId;
        if (previewUrlCache.has(cacheKey)) {
            return previewUrlCache.get(cacheKey)!;
        }
        
        // Extract CDN hostname from videoUrl or url (like the working example)
        const url = video.videoUrl || video.url || '';
        const match = url.match(/https?:\/\/([^\/]+)/);
        if (match && match[1]) {
            const cdnHost = match[1];
            // Build preview URL without timestamp for better browser caching
            // The browser will cache this and only revalidate if needed
            const previewUrl = `https://${cdnHost}/${video.streamId}/preview.webp`;
            previewUrlCache.set(cacheKey, previewUrl);
            return previewUrl;
        }
        // Fallback to env variable if URL extraction fails
        const cdnHost = import.meta.env.PUBLIC_BUNNY_CDN_HOST_NAME || import.meta.env.VITE_BUNNY_CDN_HOST_NAME || '';
        if (cdnHost) {
            const previewUrl = `https://${cdnHost}/${video.streamId}/preview.webp`;
            previewUrlCache.set(cacheKey, previewUrl);
            return previewUrl;
        }
        return null;
    }
    
    // Preload preview images for videos currently visible in carousel
    function preloadPreviewImage(video: typeof videos[0]) {
        const url = getPreviewThumbnailUrl(video);
        if (url) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = url;
            document.head.appendChild(link);
        }
    }
    
    function formatVideoDate(dateString?: string | null): string {
        if (!dateString) return 'Unknown date';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return 'Unknown date';
        }
    }
    
    function handleCarouselCardMouseEnter(event: MouseEvent, video: typeof videos[0]) {
        tooltipVideo = video;
        tooltipImageLoaded = false; // Reset loading state
        updateTooltipPosition(event);
        tooltipVisible = true;
    }
    
    function handleCarouselCardMouseMove(event: MouseEvent) {
        if (tooltipVisible) {
            updateTooltipPosition(event);
        }
    }
    
    function handleCarouselCardMouseLeave() {
        tooltipVisible = false;
        tooltipVideo = null;
        tooltipImageLoaded = false;
    }
    
    function handleTooltipImageLoad() {
        tooltipImageLoaded = true;
    }
    
    function handleTooltipImageError() {
        tooltipImageLoaded = true; // Hide spinner even on error
    }
    
    function updateTooltipPosition(event: MouseEvent) {
        tooltipPosition = { x: event.clientX, y: event.clientY };
    }
    
    function updateCarouselScrollState() {
        if (!mapCarouselContainer) {
            canScrollLeft = false;
            canScrollRight = false;
            return;
        }
        canScrollLeft = mapCarouselContainer.scrollLeft > 0;
        canScrollRight = mapCarouselContainer.scrollLeft < mapCarouselContainer.scrollWidth - mapCarouselContainer.clientWidth - 1;
    }

    function normaliseText(value?: string | null) {
        return value?.trim() ? value.trim() : null;
    }

    function equalsIgnoreCase(a?: string | null, b?: string | null) {
        const left = normaliseText(a)?.toLowerCase();
        const right = normaliseText(b)?.toLowerCase();
        if (!left || !right) return false;
        return left === right;
    }

    function extractLocationParts(location: MapLocation | null) {
        if (!location) {
            return { country: null as string | null, region: null as string | null, place: null as string | null };
        }
        let country = normaliseText(location.country);
        let region = normaliseText(location.state ?? location.region ?? location.locality);
        let place = normaliseText(
            location.place ?? location.name ?? location.setting ?? location.city ?? location.environment
        );

        const labelSource = normaliseText(location.setting ?? location.name ?? location.place);
        if (labelSource) {
            const tokens = labelSource
                .split(",")
                .map((token) => token.trim())
                .filter(Boolean);
            if (!place && tokens.length > 0) {
                place = tokens[0];
            }
            if (!country && tokens.length > 1) {
                country = tokens[tokens.length - 1];
            }
            if (!region && tokens.length > 2) {
                region = tokens.slice(1, -1).join(", ");
            }
        }

        if (region && country && equalsIgnoreCase(region, country)) {
            region = null;
        }
        if (place && region && equalsIgnoreCase(place, region)) {
            region = null;
        }

        return { country, region, place };
    }

    function resultHasVideos(result: SearchPlaceResult): boolean {
        const resultName = normaliseText(result.name)?.toLowerCase() ?? null;
        const contextNames = result.context
            ? result.context
                  .split(",")
                  .map((part) => normaliseText(part)?.toLowerCase())
                  .filter(Boolean)
            : [];
        const candidateNames = new Set<string>();
        if (resultName) candidateNames.add(resultName);
        for (const ctxName of contextNames) {
            if (ctxName) candidateNames.add(ctxName);
        }

        const lon = result.longitude;
        const lat = result.latitude;

        return locations.some((loc) => {
            const parts = extractLocationParts(loc);
            const locationNames = [
                parts.country,
                parts.region,
                parts.place,
                loc.setting,
                loc.name,
                loc.place,
                loc.city,
                loc.region,
                loc.country,
                loc.environment
            ]
                .map((value) => normaliseText(value)?.toLowerCase())
                .filter(Boolean);

            let matched = false;
            for (const candidate of candidateNames) {
                if (candidate && locationNames.includes(candidate)) {
                    matched = true;
                    break;
                }
            }

            const coords =
                (typeof loc.mapLon === "number" && typeof loc.mapLat === "number"
                    ? [loc.mapLon, loc.mapLat]
                    : typeof loc.longitude === "number" && typeof loc.latitude === "number"
                      ? [loc.longitude, loc.latitude]
                      : Array.isArray(loc.coordinates) && loc.coordinates.length === 2
                        ? [loc.coordinates[0], loc.coordinates[1]]
                        : null) as [number, number] | null;

            if (!matched && coords && Number.isFinite(lon) && Number.isFinite(lat)) {
                const dLon = Math.abs(coords[0] - lon);
                const dLat = Math.abs(coords[1] - lat);
                if (dLon <= 1.5 && dLat <= 1.5) {
                    matched = true;
                }
            }

            if (matched) {
                return true;
            }

            return false;
        });
    }

    function getLocationVideoDetails(result: SearchPlaceResult): {
        videoCount: number;
        thumbnails: string[];
        usernames: string[];
    } {
        const resultName = normaliseText(result.name)?.toLowerCase() ?? null;
        const contextNames = result.context
            ? result.context
                  .split(",")
                  .map((part) => normaliseText(part)?.toLowerCase())
                  .filter(Boolean)
            : [];
        const candidateNames = new Set<string>();
        if (resultName) candidateNames.add(resultName);
        for (const ctxName of contextNames) {
            if (ctxName) candidateNames.add(ctxName);
        }

        const lon = result.longitude;
        const lat = result.latitude;

        const matchingLocations: MapLocation[] = [];
        
        for (const loc of locations) {
            const parts = extractLocationParts(loc);
            const locationNames = [
                parts.country,
                parts.region,
                parts.place,
                loc.setting,
                loc.name,
                loc.place,
                loc.city,
                loc.region,
                loc.country,
                loc.environment
            ]
                .map((value) => normaliseText(value)?.toLowerCase())
                .filter(Boolean);

            let matched = false;
            for (const candidate of candidateNames) {
                if (candidate && locationNames.includes(candidate)) {
                    matched = true;
                    break;
                }
            }

            const coords =
                (typeof loc.mapLon === "number" && typeof loc.mapLat === "number"
                    ? [loc.mapLon, loc.mapLat]
                    : typeof loc.longitude === "number" && typeof loc.latitude === "number"
                      ? [loc.longitude, loc.latitude]
                      : Array.isArray(loc.coordinates) && loc.coordinates.length === 2
                        ? [loc.coordinates[0], loc.coordinates[1]]
                        : null) as [number, number] | null;

            if (!matched && coords && Number.isFinite(lon) && Number.isFinite(lat)) {
                const dLon = Math.abs(coords[0] - lon);
                const dLat = Math.abs(coords[1] - lat);
                if (dLon <= 1.5 && dLat <= 1.5) {
                    matched = true;
                }
            }

            if (matched) {
                matchingLocations.push(loc);
            }
        }

        // Get unique video IDs
        const uniqueVideoIds = new Set<string>();
        const videoData = new Map<string, { thumbnail?: string; author?: string }>();
        
        for (const loc of matchingLocations) {
            if (loc.videoId) {
                uniqueVideoIds.add(loc.videoId);
                const video = videos.find(v => v.id === loc.videoId);
                if (video && !videoData.has(loc.videoId)) {
                    videoData.set(loc.videoId, {
                        thumbnail: video.thumbnailUrl,
                        author: loc.videoAuthor ?? video.author
                    });
                }
            }
        }

        const thumbnails: string[] = [];
        const usernames = new Set<string>();
        
        for (const [videoId, data] of videoData.entries()) {
            if (data.thumbnail && thumbnails.length < 4) {
                thumbnails.push(data.thumbnail);
            }
            if (data.author) {
                usernames.add(data.author);
            }
        }

        return {
            videoCount: uniqueVideoIds.size,
            thumbnails,
            usernames: Array.from(usernames).slice(0, 5) // Limit to 5 usernames
        };
    }
    
    // Format filter options
    const formatOptions = [
        {
            value: "all",
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><path d="M9 2v20M15 2v20"/><path d="M2 9h20M2 15h20"/></svg>`,
            label: "All formats",
            ariaLabel: "Show all formats"
        },
        {
            value: "video",
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
            label: "Video only",
            ariaLabel: "Video only"
        },
        {
            value: "audio",
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
            label: "Audio only",
            ariaLabel: "Audio only"
        }
    ];
    
    function handleFormatChange(value: string) {
        selectedFormat = value;
    }
    
    // View mode toggle value
    const viewMode = $derived(listView ? "list" : "compact");
    
    const viewModeOptions = [
        {
            value: "compact",
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
            label: "Compact view",
            ariaLabel: "Toggle compact view"
        },
        {
            value: "list",
            icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
            label: "List view",
            ariaLabel: "Toggle list view"
        }
    ];
    
    function handleViewModeChange(value: string) {
        if (value === "list") {
            listView = true;
            compactView = false;
        } else {
            listView = false;
            compactView = true;
        }
    }
    
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
            (video.locations?.map((loc): MapLocation => ({
                ...loc,
                videoId: video.id,
                videoTitle: video.title,
                videoAuthor: video.author
            })) ?? [])
        ) as MapLocation[]
    );

    const lat = $derived(parseFloat($page.url.searchParams.get('lat') ?? '20'));
    const lon = $derived(parseFloat($page.url.searchParams.get('lon') ?? '0'));
    const zoom = $derived(parseInt($page.url.searchParams.get('zoom') ?? '9', 10)); // Start more zoomed in

    // Filter locations based on URL params and search query
    const filteredLocations = $derived.by<MapLocation[]>(() => {
        let filtered: MapLocation[] = locations;
        
        // First filter by URL params if present
        if (lat && lon) {
            filtered = filtered.filter(
                (loc) => {
                    const coords = loc.coordinates || 
                        (loc.longitude !== undefined && loc.latitude !== undefined 
                            ? [loc.longitude, loc.latitude] 
                            : null) ||
                        (loc.mapLon !== undefined && loc.mapLat !== undefined 
                            ? [loc.mapLon, loc.mapLat] 
                            : null);
                    
                    if (!Array.isArray(coords) || coords.length !== 2) return false;
                    
                    return Math.abs(coords[0] - lon) < 0.1 && 
                           Math.abs(coords[1] - lat) < 0.1;
                }
            );
        }
        
        return filtered;
    });

    const mapBreadcrumbs = $derived.by(() => {
        const crumbs: MapBreadcrumb[] = [{ label: "global", level: "global" }];
        const location = mapActiveLocation;
        const adminCountry = normaliseText(mapAdminContext?.country ?? undefined);
        const adminRegion = normaliseText(mapAdminContext?.region ?? undefined);
        const adminCity = normaliseText(mapAdminContext?.city ?? undefined);
        if (!location) {
            return crumbs;
        }
        const { country, region, place } = extractLocationParts(location);
        const resolvedCountry = adminCountry ?? country;
        let resolvedRegion = adminRegion ?? region;
        let resolvedPlace = adminCity ?? place;
        if (resolvedCountry && resolvedRegion && equalsIgnoreCase(resolvedRegion, resolvedCountry)) {
            resolvedRegion = null;
        }
        if (resolvedRegion && resolvedPlace && equalsIgnoreCase(resolvedPlace, resolvedRegion)) {
            resolvedPlace = null;
        }
        if (resolvedCountry && resolvedPlace && equalsIgnoreCase(resolvedPlace, resolvedCountry)) {
            resolvedPlace = null;
        }
        if (resolvedCountry) {
            crumbs.push({ label: resolvedCountry, level: "country", country: resolvedCountry });
        }
        if (resolvedRegion) {
            crumbs.push({
                label: resolvedRegion,
                level: "region",
                country: resolvedCountry ?? undefined,
                region: resolvedRegion
            });
        }
        if (resolvedPlace) {
            crumbs.push({ label: resolvedPlace, level: "place", location });
        }
        return crumbs;
    });

    function handleActiveLocationChange(
        event: CustomEvent<{
            location: MapLocation | null;
            center: { lon: number; lat: number };
            admin: { country?: string | null; region?: string | null; city?: string | null; fullAddress?: string | null };
        }>
    ) {
        const location = event.detail.location ?? null;
        mapActiveLocation = location;
        if (!location) {
            mapAdminContext = null;
            return;
        }
        const admin = event.detail.admin ?? null;
        if (!admin) {
            mapAdminContext = null;
            return;
        }
        const hasInfo =
            normaliseText(admin.country ?? undefined) ||
            normaliseText(admin.region ?? undefined) ||
            normaliseText(admin.city ?? undefined) ||
            normaliseText(admin.fullAddress ?? undefined);
        mapAdminContext = hasInfo ? admin : null;
    }

    function scheduleMapSearch(query: string) {
        if (mapSearchDebounce) {
            clearTimeout(mapSearchDebounce);
            mapSearchDebounce = null;
        }
        if (!query.trim() || query.trim().length < 2) {
            mapSearchRequestId++;
            mapSearchResults = [] as MapSearchResult[];
            mapSearchLoading = false;
            showMapSearchResults = false;
            return;
        }
        mapSearchLoading = true;
        const requestToken = ++mapSearchRequestId;
        mapSearchDebounce = setTimeout(async () => {
            try {
                const results = await searchPlaces(query, { limit: 8 });
                if (requestToken !== mapSearchRequestId) return;
                const enriched = results
                    .map((result) => {
                        const hasVideos = resultHasVideos(result);
                        if (hasVideos) {
                            const details = getLocationVideoDetails(result);
                            return {
                                ...result,
                                hasVideos,
                                ...details
                            };
                        }
                        return {
                            ...result,
                            hasVideos,
                            videoCount: 0,
                            thumbnails: [],
                            usernames: []
                        };
                    })
                    .sort((a, b) => Number(b.hasVideos) - Number(a.hasVideos));

                mapSearchResults = enriched;
                showMapSearchResults = enriched.length > 0;
            } catch (error) {
                console.warn("Map place search failed:", error);
                if (requestToken === mapSearchRequestId) {
                    mapSearchResults = [] as MapSearchResult[];
                    showMapSearchResults = false;
                }
            } finally {
                if (requestToken === mapSearchRequestId) {
                    mapSearchLoading = false;
                }
                mapSearchDebounce = null;
            }
        }, 250);
    }

    function handleMapSearchInput(event: Event) {
        const target = event.currentTarget as HTMLInputElement;
        const value = target.value;
        mapSearchQuery = value;
        showMapSearchResults = true;
        scheduleMapSearch(value);
    }

    function handleMapSearchSelect(result: MapSearchResult) {
        mapSearchQuery = result.name;
        showMapSearchResults = false;
        mapSearchResults = [] as MapSearchResult[];
        mapSearchLoading = false;
        mapSearchRequestId++;
        if (mapRef && typeof result.longitude === "number" && typeof result.latitude === "number") {
            mapRef.flyToCoordinates(result.longitude, result.latitude, { zoom: result.zoom ?? 6 });
        }
    }

    function filterLocationsByCountry(targetCountry?: string | null) {
        if (!targetCountry) return [] as MapLocation[];
        return filteredLocations.filter((loc) => {
            const parts = extractLocationParts(loc);
            if (equalsIgnoreCase(parts.country, targetCountry)) return true;
            const region = parts.region;
            if (equalsIgnoreCase(region, targetCountry)) return true;
            const label = normaliseText(
                loc.setting ?? loc.name ?? loc.place ?? loc.city ?? loc.region ?? loc.country ?? undefined
            );
            return equalsIgnoreCase(label, targetCountry);
        });
    }

    function filterLocationsByRegion(targetCountry: string | null, targetRegion?: string | null) {
        if (!targetRegion) return [] as MapLocation[];
        return filteredLocations.filter((loc) => {
            const parts = extractLocationParts(loc);
            const sameCountry = targetCountry ? equalsIgnoreCase(parts.country, targetCountry) : true;
            if (!sameCountry) return false;
            if (equalsIgnoreCase(parts.region, targetRegion)) return true;
            if (equalsIgnoreCase(parts.place, targetRegion)) return true;
            const label = normaliseText(loc.setting ?? loc.name ?? loc.place ?? loc.city ?? undefined);
            return equalsIgnoreCase(label, targetRegion);
        });
    }

    // Helper function to map zoom level to breadcrumb level
    // Based on zoom levels used in breadcrumb clicks:
    // - global: zoom ~3.5 (zoomToWorld maxZoom: 3.5)
    // - country: zoom 4.5-5.5
    // - region: zoom 6.5
    // - place: zoom 10
    // At zoom 10, if there are only 3 breadcrumbs (no place), region (3rd) should be active
    function getBreadcrumbLevelFromZoom(zoom: number): "global" | "country" | "region" | "place" {
        if (zoom <= 4) return "global";
        if (zoom <= 6) return "country";
        if (zoom <= 10) return "region"; // Region covers up to zoom 10
        return "place"; // Place only for zoom > 10
    }

    function handleBreadcrumbClick(crumb: MapBreadcrumb) {
        const instance = mapRef;
        if (!instance) return;

        // Turn off auto-center when user interacts via breadcrumbs
        shouldAutoCenterOnVideo = false;

        // Set the active breadcrumb level
        activeBreadcrumbLevel = crumb.level;

        if (crumb.level === "global") {
            instance.zoomToWorld();
            return;
        }

        const activeLocation = mapActiveLocation;
        if (!activeLocation) return;

        if (crumb.level === "country") {
            let matches = filterLocationsByCountry(crumb.country ?? null);
            if (matches.length === 0 && activeLocation) {
                matches = [activeLocation];
            }
            if (matches.length > 1) {
                instance.fitToLocations(matches, { padding: 96, maxZoom: 5.5 });
            } else {
                instance.zoomToLocation(activeLocation, 4.5);
            }
            return;
        }

        if (crumb.level === "region") {
            let matches = filterLocationsByRegion(crumb.country ?? null, crumb.region ?? null);
            if (matches.length === 0 && activeLocation) {
                matches = [activeLocation];
            }
            if (matches.length > 1) {
                instance.fitToLocations(matches, { padding: 96, maxZoom: 6.5 });
            } else {
                instance.zoomToLocation(activeLocation, 6.5);
            }
            return;
        }

        if (crumb.level === "place") {
            const target = crumb.location ?? activeLocation;
            instance.zoomToLocation(target, 10);
        }
    }

    const activeVideoId = $derived($selectedVideo.id);

    // Helper function to get coordinates from location
    function getLocationCoords(loc: MapLocation): [number, number] | null {
        if (typeof loc.mapLon === 'number' && typeof loc.mapLat === 'number') {
            return [loc.mapLon, loc.mapLat];
        }
        if (typeof loc.longitude === 'number' && typeof loc.latitude === 'number') {
            return [loc.longitude, loc.latitude];
        }
        if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
            return [loc.coordinates[0], loc.coordinates[1]];
        }
        return null;
    }

    // Check if location is within viewport bounds
    function isLocationInViewport(loc: MapLocation, bounds: { north: number; south: number; east: number; west: number } | null): boolean {
        if (!bounds) return true; // If no bounds, show all
        const coords = getLocationCoords(loc);
        if (!coords) return false;
        const [lon, lat] = coords;
        // Handle longitude wrapping (if bounds cross -180/180)
        if (bounds.west > bounds.east) {
            return lat >= bounds.south && lat <= bounds.north && (lon >= bounds.west || lon <= bounds.east);
        }
        return lat >= bounds.south && lat <= bounds.north && lon >= bounds.west && lon <= bounds.east;
    }

    // Get unique videos from locations within viewport for carousel
    const mapViewVideos = $derived.by(() => {
        const videoMap = new Map<string, { video: typeof videos[0]; location: MapLocation }>();
        const locationsToUse = mapViewportBounds ? locations.filter(loc => isLocationInViewport(loc, mapViewportBounds)) : locations;
        
        for (const loc of locationsToUse) {
            if (loc.videoId) {
                const video = videos.find(v => v.id === loc.videoId);
                if (video && !videoMap.has(loc.videoId)) {
                    videoMap.set(loc.videoId, { video, location: loc });
                }
            }
        }
        return Array.from(videoMap.values());
    });

    function scrollCarousel(direction: 'left' | 'right') {
        if (!mapCarouselContainer) return;
        const scrollAmount = 400;
        const currentScroll = mapCarouselContainer.scrollLeft;
        const newScroll = direction === 'left' 
            ? currentScroll - scrollAmount 
            : currentScroll + scrollAmount;
        mapCarouselContainer.scrollTo({ left: newScroll, behavior: 'smooth' });
        setTimeout(updateCarouselScrollState, 100);
    }
    
    $effect(() => {
        if (mapCarouselContainer && mapViewVideos.length > 0) {
            updateCarouselScrollState();
            const handleScroll = () => updateCarouselScrollState();
            mapCarouselContainer.addEventListener('scroll', handleScroll);
            const resizeObserver = new ResizeObserver(() => updateCarouselScrollState());
            resizeObserver.observe(mapCarouselContainer);
            
            // Preload preview images for first few visible videos
            const preloadCount = Math.min(5, mapViewVideos.length);
            for (let i = 0; i < preloadCount; i++) {
                const video = mapViewVideos[i];
                if (video) {
                    preloadPreviewImage(video.video);
                }
            }
            
            return () => {
                mapCarouselContainer?.removeEventListener('scroll', handleScroll);
                resizeObserver.disconnect();
            };
        }
    });

    function handleMapVideoClick(video: typeof videos[0], location: MapLocation) {
        // Play the video
        selectedVideo.selectVideo(video.id);
        
        // Enable auto-center and center map on location when clicking from carousel
        shouldAutoCenterOnVideo = true;
        if (mapRef) {
            mapRef.zoomToLocation(location, 10);
        }
        // Breadcrumb will be updated automatically via viewportChange event based on zoom level
    }
    
    function toggleAutoCenterOnVideo() {
        if (!mapRef || !activeVideoId) return;
        
        // Toggle the auto-center state
        shouldAutoCenterOnVideo = !shouldAutoCenterOnVideo;
        
        // If toggling ON, also fly to the marker
        if (shouldAutoCenterOnVideo) {
            const video = videos.find(v => v.id === activeVideoId);
            if (!video || !video.locations || video.locations.length === 0) return;
            
            const location = filteredLocations.find(loc => loc.videoId === activeVideoId);
            if (location && mapRef) {
                // Use special fly animation for recenter button
                const coords = getLocationCoords(location);
                if (coords) {
                    const [lon, lat] = coords;
                    mapRef.flyToMarker(lon, lat, 10);
                } else {
                    // Fallback to zoomToLocation if coordinates aren't available
                    mapRef.zoomToLocation(location, 10);
                }
            }
            
            // Breadcrumb will be updated automatically via viewportChange event based on zoom level
        }
    }

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
            <div class="tabs-container flex gap-2 border-b border-white/10" class:map-active={activeTab === "map"}>
          
           
                <button
                onclick={() => (activeTab = "index")}
                class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
                "index"
                    ? "border-white text-white"
                    : "border-transparent text-white/60 hover:text-white"} "
            >
                Dates
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
            <div class="filters-container ">
                <div class="filters-row border-b border-white/10">
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
                        <TogglePill 
                            options={formatOptions}
                            value={selectedFormat}
                            onValueChange={handleFormatChange}
                        />

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
                        <TogglePill 
                            options={viewModeOptions}
                            value={viewMode}
                            onValueChange={handleViewModeChange}
                        />

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

            <!-- Filter Bar (shown for Map tab) -->
            {#if activeTab === "map"}
                <div class="filters-container ">
                    <div class="filters-row">
                        <!-- Map Breadcrumbs -->



  
                        <nav class="breadcrumbs" aria-label="Map location breadcrumbs">
                            {#each mapBreadcrumbs as crumb, index (crumb.label)}
                                {@const isActive = crumb.level === activeBreadcrumbLevel}
                                {@const isGlobal = crumb.level === "global"}
                                <button
                                    type="button"
                                    class="breadcrumbs__item {index === 0 ? 'first' : ''}"
                                    class:is-active={isActive}
                                    onclick={() => handleBreadcrumbClick(crumb)}
                                    aria-current={isActive ? "page" : undefined}
                                    aria-label={isGlobal ? "Global view" : crumb.label}
                                >
                                    {#if isGlobal}
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                                            <path d="M2 12h20"></path>
                                        </svg>
                                    {:else}
                                        {crumb.label}
                                    {/if}
                                </button>
                            {/each}
                        </nav>

                        <!-- Auto-center on Active Video Toggle Button -->
                        {#if activeVideoId}
                            <button
                                type="button"
                                class="filter-item recenter-button"
                                class:active={shouldAutoCenterOnVideo}
                                onclick={toggleAutoCenterOnVideo}
                                aria-label={shouldAutoCenterOnVideo ? "Auto-center on currently playing video (enabled)" : "Auto-center on currently playing video (disabled)"}
                                title={shouldAutoCenterOnVideo ? "Auto-center on currently playing video (enabled)" : "Auto-center on currently playing video (disabled)"}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M12 1v6m0 6v6M1 12h6m6 0h6"></path>
                                </svg>
                            </button>
                        {/if}

                        <!-- Map Search -->
                        <div
                            class="filter-item filter-search map-places-search"
                            class:loading={mapSearchLoading}
                            aria-live="polite"
                        >
                            <svg class="filter-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                                <circle cx="11" cy="11" r="7" />
                                <line x1="20" y1="20" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                bind:value={mapSearchQuery}
                                placeholder="Search places..."
                                class="filter-input"
                                oninput={handleMapSearchInput}
                                onfocus={() => (showMapSearchResults = true)}
                                onblur={() => {
                                    setTimeout(() => (showMapSearchResults = false), 120);
                                }}
                                aria-autocomplete="list"
                                aria-controls="map-search-results"
                                aria-expanded={showMapSearchResults}
                            />
                            {#if mapSearchQuery}
                                <button
                                    onclick={() => {
                                        mapSearchQuery = "";
                                        mapSearchResults = [] as MapSearchResult[];
                                        showMapSearchResults = false;
                                        mapSearchLoading = false;
                                        mapSearchRequestId++;
                                    }}
                                    class="filter-clear"
                                    aria-label="Clear search"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            {/if}

                            {#if showMapSearchResults && mapSearchResults.length > 0}
                                <ul class="map-search-results" role="listbox" id="map-search-results">
                                    {#each mapSearchResults as result (result.id)}
                                        <li>
                                            <button type="button" onclick={() => handleMapSearchSelect(result)}>
                                                <div class="result-header">
                                                    <span class="result-title">{result.name}</span>
                                                    {#if result.hasVideos && result.videoCount}
                                                        <span class="result-badge">{result.videoCount} {result.videoCount === 1 ? 'video' : 'videos'}</span>
                                                    {/if}
                                                </div>
                                                {#if result.context}
                                                    <span class="result-context">{result.context}</span>
                                                {/if}
                                                {#if result.hasVideos && (result.thumbnails && result.thumbnails.length > 0 || result.usernames && result.usernames.length > 0)}
                                                    <div class="result-details">
                                                        {#if result.thumbnails && result.thumbnails.length > 0}
                                                            <div class="result-thumbnails">
                                                                {#each result.thumbnails.slice(0, 4) as thumbnail}
                                                                    <img src={thumbnail} alt="" class="result-thumbnail" loading="lazy" />
                                                                {/each}
                                                            </div>
                                                        {/if}
                                                        {#if result.usernames && result.usernames.length > 0}
                                                            <div class="result-users">
                                                                <svg class="result-users-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                                                    <circle cx="9" cy="7" r="4"></circle>
                                                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                                                </svg>
                                                                <span class="result-users-text">
                                                                    {result.usernames.slice(0, 3).join(', ')}
                                                                    {#if result.usernames.length > 3}
                                                                        <span class="result-users-more"> +{result.usernames.length - 3} more</span>
                                                                    {/if}
                                                                </span>
                                                            </div>
                                                        {/if}
                                                    </div>
                                                {/if}
                                            </button>
                                        </li>
                                    {/each}
                                </ul>
                            {/if}
                        </div>
                        
                      
                    </div>
                    
                    <!-- Map Video Carousel -->
                    {#if mapViewVideos.length > 0}
                        <div class="map-video-carousel-wrapper">
                            {#if canScrollLeft}
                                <button
                                    type="button"
                                    class="carousel-nav carousel-nav-left"
                                    onclick={() => scrollCarousel('left')}
                                    aria-label="Scroll left"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M15 18l-6-6 6-6"></path>
                                    </svg>
                                </button>
                            {/if}
                            <div 
                                class="map-video-carousel"
                                bind:this={mapCarouselContainer}
                            >
                                {#each mapViewVideos as item (item.video.id)}
                                    {@const isPlaying = item.video.id === activeVideoId}
                                    <button
                                        type="button"
                                        class="carousel-video-card"
                                        class:is-playing={isPlaying}
                                        onclick={() => handleMapVideoClick(item.video, item.location)}
                                        onmouseenter={(e) => handleCarouselCardMouseEnter(e, item.video)}
                                        onmousemove={handleCarouselCardMouseMove}
                                        onmouseleave={handleCarouselCardMouseLeave}
                                    >
                                        <div class="carousel-video-thumbnail">
                                            {#if item.video.thumbnailUrl}
                                                <img 
                                                    src={item.video.thumbnailUrl} 
                                                    alt={item.video.title}
                                                    loading="lazy"
                                                />
                                            {:else}
                                                <div class="carousel-video-placeholder">
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                                    </svg>
                                                </div>
                                            {/if}
                                            {#if isPlaying}
                                                <div class="carousel-video-playing-overlay">
                                                    <span class="carousel-logo-mark">
                                                        <span class="carousel-logo-bar carousel-logo-bar--long"></span>
                                                        <span class="carousel-logo-bar carousel-logo-bar--medium"></span>
                                                        <span class="carousel-logo-bar carousel-logo-bar--short"></span>
                                                    </span>
                                                </div>
                                            {/if}
                                        </div>
                                        <!-- <div class="carousel-video-info">
                                            <div class="carousel-video-title">{item.video.title}</div>
                                            <div class="carousel-video-author">{item.video.author}</div>
                                        </div> -->
                                    </button>
                                {/each}
                            </div>
                            {#if canScrollRight}
                                <button
                                    type="button"
                                    class="carousel-nav carousel-nav-right"
                                    onclick={() => scrollCarousel('right')}
                                    aria-label="Scroll right"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M9 18l6-6-6-6"></path>
                                    </svg>
                                </button>
                            {/if}
                        </div>
                    {/if}
                    
                    <!-- Video Tooltip -->
                    {#if tooltipVisible && tooltipVideo}
                        <div 
                            class="carousel-video-tooltip"
                            style={`left: ${tooltipPosition.x - 580}px; top: ${tooltipPosition.y - 10 }px;`}
                        >
                            <div class="carousel-tooltip-thumbnail">
                                {#if getPreviewThumbnailUrl(tooltipVideo)}
                                    {#if !tooltipImageLoaded}
                                        <div class="carousel-tooltip-spinner">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinner-icon">
                                                <circle cx="12" cy="12" r="10"></circle>
                                                <path d="M12 2a10 10 0 0 0-10 10"></path>
                                            </svg>
                                        </div>
                                    {/if}
                                    <img 
                                        src={getPreviewThumbnailUrl(tooltipVideo)!} 
                                        alt={tooltipVideo.title}
                                        loading="lazy"
                                        onload={handleTooltipImageLoad}
                                        onerror={handleTooltipImageError}
                                        style="width: 100%; height: 100%; object-fit: cover;"
                                        class:tooltip-image-loaded={tooltipImageLoaded}
                                    />
                                {:else}
                                    <div class="carousel-tooltip-placeholder">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                        </svg>
                                    </div>
                                {/if}
                            </div>
                            <div class="carousel-tooltip-info">
                                <div class="carousel-tooltip-title">{tooltipVideo.title}</div>
                                <div class="carousel-tooltip-meta">
                                    <span class="carousel-tooltip-author">{tooltipVideo.author}</span>
                                    <span class="carousel-tooltip-date">{formatVideoDate(tooltipVideo.uploadedAt)}</span>
                                </div>
                            </div>
                        </div>
                    {/if}
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
        <div class="index-container">
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
            </div>
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
        <div class="index-container">

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

            </div>

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
                <MapComponent
                    bind:this={mapRef}
                    locations={filteredLocations}
                    initialCenterLon={lon}
                    initialCenterLat={lat}
                    initialZoom={zoom}
                    activeVideoId={shouldAutoCenterOnVideo ? activeVideoId : null}
                    on:activeLocationChange={handleActiveLocationChange}
                    on:viewportChange={(e) => {
                        mapViewportBounds = e.detail.bounds;
                        // When autocenter is on, update breadcrumb active state based on zoom level
                        if (shouldAutoCenterOnVideo && e.detail.zoom !== undefined) {
                            const zoomLevel = getBreadcrumbLevelFromZoom(e.detail.zoom);
                            // Only update if we have breadcrumbs for this level
                            const breadcrumbs = mapBreadcrumbs;
                            const hasLevel = breadcrumbs.some(crumb => crumb.level === zoomLevel);
                            if (hasLevel) {
                                activeBreadcrumbLevel = zoomLevel;
                            }
                        }
                    }}
                    on:userInteraction={() => {
                        userHasInteractedWithMap = true;
                        shouldAutoCenterOnVideo = false;
                    }}
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
      
        background: rgba(0, 0, 0, 0.78);
        backdrop-filter: blur(18px);
        box-shadow: 0 8px 32px -8px rgba(15, 23, 42, 0.4);
        margin-bottom: 0;
     
        margin-top: 0;
    }

    .browse-content.map-view .browse-header {
        margin-left: 0;
        margin-right: 0;
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
       
    }

    .filters-row {
        display: flex;
        margin: .1rem 2rem;
  height: 4.2rem;
        gap: 0.75rem;
        flex-wrap: wrap;
        align-items: center;
    }

    .tabs-container {
        padding: 1.5rem 0 0;
        margin: 0rem 2rem;
    }

    .map-video-carousel-wrapper {
        position: relative;
        background: rgba(255,255,255,0.02);
        border-top: 1px solid rgba(255,255,255,0.05);
        border-bottom: 1px solid rgba(255,255,255,0.05);
        width: 100%;
        padding: .7rem 2rem;
     
    }


    .filter-item {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        
        transition: all 0.2s ease;
        background: rgba(255, 255, 255, 0.08);
   
        border: 1px solid rgba(255, 255, 255, 0.1);
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
        width: 40px;
        display: flex;
        justify-content: center;
        align-items: center; 
border-right: 1px solid rgba(255, 255, 255, 0.1);        
    }

 

    .recenter-button {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 0.75rem;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 0.5rem;
        color: rgba(255, 255, 255, 0.7);
        cursor: pointer;
        transition: all 0.2s ease;
        flex-shrink: 0;
        height: 2.5rem;
    }

    .recenter-button:hover {
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.9);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .recenter-button.active {
        background: #d76b1e;
        border-color: #d76b1e;
        color: #ffffff;
    }

    .recenter-button.active:hover {
        background: #e87928;
        border-color: #e87928;
    }

    .recenter-button svg {
        width: 18px;
        height: 18px;
    }

    :global(.tooltip-content) {
        background: rgba(255, 255, 255, 0.2);
        font-family: sans-serif;
        color: #f8fafc;
        padding: 0.35rem 0.6rem;
        border-radius: 0.55rem;
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        white-space: nowrap;
        box-shadow: 0 18px 35px -24px rgba(15, 23, 42, 0.88);
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        z-index: 9999999;
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

    /* --- Your Original CSS Variables --- */
    .breadcrumbs {
  border: 1px solid #303030;
  border-radius: .5rem;
  display: inline-flex;
  overflow: hidden;
}

.breadcrumbs__item {
  background: rgb(22, 22, 22);  /* breadcrumb background color */
  color: #fff;  /* breadcrumb text color  */
  outline: none;
  padding: .8em 1em .8em 1.7em;
  position: relative;
  font-size: .74rem;
  text-decoration: none;
  transition: background 0.2s linear;
}

.breadcrumbs__item.first {
    padding-left: .9em;
    padding-right: .6em;
}

.breadcrumbs__item:hover:after,
.breadcrumbs__item:hover {
  background: rgb(51, 51, 51);  /* breadcrumb background color on hover */
  cursor: pointer;
}

.breadcrumbs__item:focus:after,
.breadcrumbs__item:focus,
.breadcrumbs__item.is-active:focus {
  background: #0b0b0b;  /* breadcrumb background color on active */
  color: #fff;
}

.breadcrumbs__item:after,
.breadcrumbs__item:before {
  background: rgb(22, 22, 22);  /* chevron background color must match the background color of the item */
  bottom: -1px;
  clip-path: polygon(50% 50%, -50% -50%, 0 100%);
  content: "";
  left: 100%;
  position: absolute;
  top: -1px;
  transition: background 0.2s linear;
  width: 1em;
  z-index: 1;
}

.breadcrumbs__item:before {
  background: rgba(255,255,255,0.2);  /* chevron border color */
  margin-left: 1px;
}

.breadcrumbs__item:last-child {
  border-right: none;
}   

.breadcrumbs__item.is-active, .breadcrumbs__item.is-active:after, .breadcrumbs__item.is-active:before {
  background: #d76b1e;  /* breadcrumb background color on active */
}

    .map-places-search {
        position: relative;
        width: 400px;
        min-width: 400px;
        max-width: 400px;
        flex: 0 0 400px;
        border-radius: 0 !important;
        border: none !important;
    }
    
    .map-places-search:focus-within {
        border: none !important;
    }



    .map-video-carousel {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-behavior: smooth;
        scrollbar-width: none;
        -ms-overflow-style: none;
       
    }

    .map-video-carousel::-webkit-scrollbar {
        display: none;
    }

    .carousel-nav {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        cursor: pointer;
        transition: all 0.2s ease;
        outline: none;
    }

    .carousel-nav:hover {
        background: rgba(0, 0, 0, 0.95);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .carousel-nav svg {
        width: 16px;
        height: 16px;
    }

    .carousel-nav-left {
        left: 0.5rem;
    }

    .carousel-nav-right {
        right: 0.5rem;
    }

    .carousel-video-card {
        flex-shrink: 0;
        width: 50px;
        border-radius: 10px;
        border: 2px solid rgb(19, 19, 19);
        overflow: hidden;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        flex-direction: column;
        outline: none;
        text-align: left;
    }

    .carousel-video-card:hover {
        border-color: rgba(255, 255, 255, 0.2);
        
    }

    .carousel-video-card.is-playing {
        border: 2px solid #d76b1e;
    }

    .carousel-video-thumbnail {
        width: 100%;
        aspect-ratio: 1;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        position: relative;
    
    }

    .carousel-video-thumbnail img {
        width: 110%;
        height: 110%;
        object-fit: cover !important;
        object-position: center center !important;
    }

    .carousel-video-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.4);
    }

    .carousel-video-placeholder svg {
        width: 16px;
        height: 16px;
    }

    .carousel-video-playing-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #d76b1e;
        pointer-events: none;
        z-index: 1;
    }

    .carousel-logo-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        width: 1.5rem;
        height: 1.5rem;
    }

    .carousel-logo-bar {
        width: 0.2rem;
        border-radius: 9999px;
        background: #d76b1e;
        transform-origin: bottom center;
    }

    .carousel-logo-bar--long {
        height: 1.15rem;
        animation: waveform-long 1.2s ease-in-out infinite;
        animation-delay: 0s;
    }

    .carousel-logo-bar--medium {
        height: 0.8rem;
        animation: waveform-medium 1.2s ease-in-out infinite;
        animation-delay: 0.2s;
    }

    .carousel-logo-bar--short {
        height: 0.5rem;
        animation: waveform-short 1.2s ease-in-out infinite;
        animation-delay: 0.4s;
    }

    @keyframes waveform-long {
        0%, 100% {
            height: 1.15rem;
        }
        50% {
            height: 0.4rem;
        }
    }

    @keyframes waveform-medium {
        0%, 100% {
            height: 0.8rem;
        }
        50% {
            height: 1.25rem;
        }
    }

    @keyframes waveform-short {
        0%, 100% {
            height: 0.5rem;
        }
        50% {
            height: 1.1rem;
        }
    }

    .carousel-video-tooltip {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        width: 300px;
        background: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5);
        transform: translate(15px, 15px);
        animation: tooltip-fade-in 0.2s ease-out;
    }

    @keyframes tooltip-fade-in {
        from {
            opacity: 0;
            transform: translate(15px, 15px) scale(0.95);
        }
        to {
            opacity: 1;
            transform: translate(15px, 15px) scale(1);
        }
    }

    .carousel-tooltip-thumbnail {
        width: 100%;
        height: 169px; /* Fixed height: 300px * (9/16) = ~169px */
        background: rgba(0, 0, 0, 0.5);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .carousel-tooltip-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity 0.2s ease-in;
    }

    .carousel-tooltip-thumbnail img.tooltip-image-loaded {
        opacity: 1;
    }

    .carousel-tooltip-spinner {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: rgba(255, 255, 255, 0.6);
        z-index: 1;
    }

    .carousel-tooltip-spinner .spinner-icon {
        animation: tooltip-spin 0.8s linear infinite;
    }

    @keyframes tooltip-spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .carousel-tooltip-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.4);
    }

    .carousel-tooltip-info {
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .carousel-tooltip-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: white;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .carousel-tooltip-meta {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.7);
    }

    .carousel-tooltip-author {
        font-weight: 500;
    }

    .carousel-tooltip-date {
        color: rgba(255, 255, 255, 0.5);
    }

    .carousel-video-info {
        padding: 0.4rem 0.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
    }

    .carousel-video-title {
        font-size: 0.7rem;
        font-weight: 600;
        color: white;
        line-height: 1.2;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .carousel-video-author {
        font-size: 0.65rem;
        color: rgba(255, 255, 255, 0.6);
    }

    .map-places-search.loading::after {
        content: '';
        position: absolute;
        top: 50%;
        right: 2rem;
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        border: 2px solid rgba(255, 255, 255, 0.4);
        border-top-color: transparent;
        animation: map-search-spin 0.8s linear infinite;
        transform: translateY(-50%);
    }

    @keyframes map-search-spin {
        from {
            transform: translateY(-50%) rotate(0deg);
        }
        to {
            transform: translateY(-50%) rotate(360deg);
        }
    }

    .map-search-results {
        position: absolute;
        top: calc(100% + 0.5rem);
        left: 0;
        right: 0;
        z-index: 40;
        background: rgba(15, 18, 24, 0.95);
        border-radius: 12px;
        box-shadow: 0 18px 40px -20px rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.08);
        list-style: none;
        margin: 0;
        padding: 0.35rem;
        max-height: 420px;
        overflow-y: auto;
    }

    .map-search-results li + li {
        margin-top: 0.25rem;
    }

    .map-search-results button {
        width: 100%;
        text-align: left;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.85);
        padding: 0.5rem 0.6rem;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.15s ease;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }

    .map-search-results button:hover,
    .map-search-results button:focus-visible {
        background: rgba(255, 255, 255, 0.08);
        outline: none;
    }

    .map-search-results .result-title {
        font-size: 0.875rem;
        font-weight: 600;
    }

    .map-search-results .result-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .map-search-results .result-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.65rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 0.125rem 0.4rem;
        border-radius: 9999px;
        background: rgba(251, 146, 60, 0.18);
        color: rgb(251, 191, 84);
        border: 1px solid rgba(251, 146, 60, 0.45);
    }

    .map-search-results .result-context {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.55);
    }

    .map-search-results .result-details {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.25rem;
    }

    .map-search-results .result-thumbnails {
        display: flex;
        gap: 0.25rem;
        align-items: center;
    }

    .map-search-results .result-thumbnail {
        width: 36px;
        height: 36px;
        border-radius: 6px;
        object-fit: cover;
        border: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
    }

    .map-search-results .result-users {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .map-search-results .result-users-icon {
        width: 14px;
        height: 14px;
        color: rgba(255, 255, 255, 0.4);
        flex-shrink: 0;
    }

    .map-search-results .result-users-text {
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.65);
        line-height: 1.4;
    }

    .map-search-results .result-users-more {
        color: rgba(255, 255, 255, 0.45);
        font-weight: 500;
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
        padding: 1.5rem 3rem;
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
