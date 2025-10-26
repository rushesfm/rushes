<script lang="ts">
  import Map from '$lib/components/Map.svelte';
  import { page } from '$app/stores';
  import { videosStore } from '$lib/stores/library';
  import { selectedVideo } from '$lib/stores/selectedVideo';

  const videos = $derived($videosStore);

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

  // Toolbar UI state (visual only)
  let searchValue = $state('');
</script>


  <div class="relative w-full h-full w-full overflow-hidden">
 
      <Map
        locations={filteredLocations}
        initialCenterLon={lon}
        initialCenterLat={lat}
        initialZoom={zoom}
        activeVideoId={activeVideoId}
      />

      <aside class="map-toolbar" aria-label="Map tools">
        <div class="toolbar-row">
          <label class="sr-only" for="map-search">Search map</label>
          <div class="toolbar-item search">
            <span class="toolbar-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <line x1="20" y1="20" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              id="map-search"
              class="toolbar-input"
              type="search"
              placeholder="Search map"
              bind:value={searchValue}
            />
          </div>

          <button type="button" class="toolbar-item" aria-label="Filters">
            <span class="toolbar-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 6h16" />
                <path d="M7 12h10" />
                <path d="M10 18h4" />
              </svg>
            </span>
          </button>

          <button type="button" class="toolbar-item" aria-label="Timeline">
            <span class="toolbar-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
          </button>

          <button type="button" class="toolbar-item" aria-label="Keywords">
            <span class="toolbar-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <path d="m3 7 5 5-5 5" />
                <path d="m13 7 5 5-5 5" />
              </svg>
            </span>
          </button>
        </div>
      </aside>


    <!-- Mobile Menu Overlay Button -->
    <!-- <div class="pointer-events-none absolute top-4 left-4 md:hidden">
      <button
        class="pointer-events-auto rounded-lg bg-white/90 dark:bg-gray-800/90 p-2 shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur"
        aria-label="Open navigation menu"
        onclick={() => {
          const event = new CustomEvent('toggle-sidebar');
          window.dispatchEvent(event);
        }}
      >
        <svg class="h-5 w-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>
    </div> -->

    <!-- Map Controls -->
    <!-- <div class="pointer-events-none absolute top-4 right-4 flex flex-col gap-2">
      <div class="pointer-events-auto rounded-lg bg-white/90 dark:bg-gray-900/90 p-3 shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur">
        <div class="text-sm font-medium text-gray-900 dark:text-white">
          {filteredLocations.length} locations
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {videos.length} videos archived
        </div>
      </div>

      <a
        href="/videos"
        class="pointer-events-auto rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg"
      >
        Browse Videos
      </a>
    </div> -->

</div>

<style>
  :global(body) {
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  }

  .map-page {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .map-toolbar {
    position: absolute;
    top: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    width: min(960px, calc(100% - 3rem));
    padding: 0.85rem 1rem;
    border-radius: 18px;
    background: rgba(15, 18, 24, 0.78);
    backdrop-filter: blur(18px);
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow:
      0 24px 70px -35px rgba(15, 23, 42, 0.6),
      inset 0 0 0 0.5px rgba(255, 255, 255, 0.12);
    color: #e9eef6;
    z-index: 20;
    pointer-events: auto;
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .toolbar-item {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.5rem 0.7rem;
    border-radius: 12px;
    background: rgba(13, 17, 23, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.08);
    min-height: 42px;
    color: inherit;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .toolbar-item:hover,
  .toolbar-item:focus-visible {
    border-color: rgba(255, 255, 255, 0.22);
    background: rgba(15, 18, 24, 0.6);
    outline: none;
  }

  .toolbar-item.search {
    flex: 1 1 260px;
  }

  .toolbar-icon {
    display: inline-flex;
    width: 18px;
    height: 18px;
    opacity: 0.85;
  }

  .toolbar-icon svg {
    width: 100%;
    height: 100%;
    stroke: currentColor;
  }

  .toolbar-input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    color: inherit;
    font-size: 0.92rem;
  }

  .toolbar-input::placeholder {
    color: rgba(233, 238, 246, 0.55);
  }

  .toolbar-input:focus {
    outline: none;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 720px) {
    .map-toolbar {
      top: 1rem;
      width: calc(100% - 2rem);
      padding: 0.75rem;
    }

    .toolbar-item {
      flex: 1 1 100%;
    }
  }
</style>
