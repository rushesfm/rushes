<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import type mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';

	interface Location {
		mapLat?: number;
		mapLon?: number;
		latitude?: number;
		longitude?: number;
		coordinates?: [number, number];
		setting?: string;
		name?: string;
		videoTitle?: string;
		videoAuthor?: string;
		videoId?: string;
	}

	interface Props {
		locations?: Location[];
		initialCenterLat?: number;
		initialCenterLon?: number;
		initialZoom?: number;
		activeVideoId?: string | null;
	}
  const props = $props() as Props;

  let locations = $state<Location[]>(props.locations ?? []);
  let activeVideoId = $state(props.activeVideoId ?? null);

  $effect(() => {
    locations = props.locations ?? [];
    activeVideoId = props.activeVideoId ?? null;
  });
  
  // Calculate initial center and zoom based on active video location
  const initialCenter = $derived.by(() => {
    const defaultLat = props.initialCenterLat ?? 0;
    const defaultLon = props.initialCenterLon ?? 0;
    const defaultZoom = props.initialZoom ?? 2;
    
    if (activeVideoId) {
      const location = locations.find((loc) => loc.videoId === activeVideoId);
      if (location) {
        const coords = normaliseCoordinates(location);
        if (coords) {
          const [lon, lat] = coords;
          return { lon, lat, zoom: 9 }; // Start zoomed in on the marker
        }
      }
    }
    
    return { lon: defaultLon, lat: defaultLat, zoom: defaultZoom };
  });

	let container = $state<HTMLDivElement | null>(null);
	let map: mapboxgl.Map | null = null;
	let markers: mapboxgl.Marker[] = [];
	let mapError = $state<string | null>(null);
	let mapReady = $state(false);
	let lastFocusedVideoId = $state<string | null>(null);
	let hasInitialZoomed = $state(false);
	let isInitialLoad = $state(true);

	const token =
		import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN ??
		import.meta.env.VITE_MAPBOX_TOKEN ??
		import.meta.env.VITE_PUBLIC_MAPBOX_ACCESS_TOKEN ??
		'';

	const mapStyle =
		import.meta.env.VITE_MAPBOX_STYLE ??
		import.meta.env.PUBLIC_MAPBOX_STYLE ??
		'mapbox://styles/mapbox/dark-v11'; // Fallback to public style

	function normaliseCoordinates(loc: Location): [number, number] | null {
		if (typeof loc.mapLon === 'number' && typeof loc.mapLat === 'number') {
			return [loc.mapLon, loc.mapLat];
		}
		if (typeof loc.longitude === 'number' && typeof loc.latitude === 'number') {
			return [loc.longitude, loc.latitude];
		}
		// Coordinates array is already in GeoJSON standard format: [lon, lat]
		if (Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
			return [loc.coordinates[0], loc.coordinates[1]];
		}
		return null;
	}

	function clearMarkers() {
		markers.forEach((marker) => marker.remove());
		markers = [];
	}

  // Simple HTML sanitization - escapes dangerous characters
  function escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  function syncMarkers(currentLocations: Location[] = []) {
    if (!map) return;
    clearMarkers();
    for (const loc of currentLocations) {
			const coords = normaliseCoordinates(loc);
			if (!coords) continue;
			const [lon, lat] = coords;
			const Mapbox = mapboxModule;
			if (!Mapbox) continue;
			
			// Use different color for active/playing video
			const isActive = activeVideoId && loc.videoId === activeVideoId;
			const markerColor = isActive ? '#fb923c' : '#f59e0b'; // Orange for active, amber for others
			const markerSize = isActive ? 1.5 : 1; // Larger for active
			
			const marker = new Mapbox.Marker({ 
				color: markerColor,
				scale: markerSize
			}).setLngLat([lon, lat]);
			
			const popupContent: string[] = [];
			// Add playing indicator to popup if active
			if (isActive) {
				popupContent.push('<div style="color: #fb923c; font-weight: 600; margin-bottom: 4px;">▶ Now Playing</div>');
			}
			// Sanitize all user-provided content
			if (loc.setting || loc.name) {
				popupContent.push(`<strong>${escapeHtml(loc.setting ?? loc.name ?? '')}</strong>`);
			}
			if (loc.videoTitle) {
				popupContent.push(`<div>${escapeHtml(loc.videoTitle)}</div>`);
			}
			if (loc.videoAuthor) {
				popupContent.push(`<small>${escapeHtml(loc.videoAuthor)}</small>`);
			}
			if (popupContent.length > 0) {
				marker.setPopup(new Mapbox.Popup({ offset: 16 }).setHTML(popupContent.join('')));
			}
			marker.addTo(map);
			markers.push(marker);
		}
	}

	let mapboxModule: typeof mapboxgl | null = null;

	function findLocationByVideoId(videoId: string | null): Location | null {
		if (!videoId) return null;
	return (
		locations.find((loc) => loc.videoId === videoId) ?? null
	);
	}

	function focusOnVideo(
	videoId: string | null,
	{ instant = false, force = false }: { instant?: boolean; force?: boolean } = {}
) {
	if (!map || !mapReady || !videoId) return;
	const location = findLocationByVideoId(videoId);
	if (!location) return;
	const coords = normaliseCoordinates(location);
	if (!coords) return;
	const [lon, lat] = coords;
	// Use a fixed target zoom level (10) to prevent zoom accumulation
	const targetZoom = 10;
	// Always use instant positioning when video changes (no animation)
	map.jumpTo({ center: [lon, lat], zoom: targetZoom });
	lastFocusedVideoId = videoId;
}

	onMount(async () => {
		if (!browser || !container) return;
		if (!token) {
			mapError = 'Missing Mapbox access token. Set PUBLIC_MAPBOX_ACCESS_TOKEN to enable the map view.';
			return;
		}

		// Reset initial zoom flag when component mounts (each time map tab is clicked)
		hasInitialZoomed = false;
		isInitialLoad = true;

		try {
			const module = await import('mapbox-gl');
			mapboxModule = module.default as typeof mapboxgl;
			const Mapbox = mapboxModule;
			if (!Mapbox) {
				mapError = 'Unable to load the Mapbox library.';
				return;
			}
			Mapbox.accessToken = token;
			const center = initialCenter;
			map = new Mapbox.Map({
				container,
				style: mapStyle,
				center: [center.lon, center.lat],
				zoom: center.zoom,
				cooperativeGestures: true
			});
			map.once('load', () => {
				mapReady = true;
				syncMarkers(locations);
				// Map is already positioned correctly from initial center/zoom, no need to jump
				if (activeVideoId) {
					lastFocusedVideoId = activeVideoId;
				}
				
				// Smoothly zoom in 1 level immediately when map shows (each time map tab is clicked)
				if (map && isInitialLoad) {
					const currentZoom = map.getZoom();
					const targetZoom = currentZoom + 1;
					map.easeTo({
						zoom: targetZoom,
						duration: 800,
						easing: (t) => 1 - Math.pow(1 - t, 3)
					});
					// Mark animation as complete after duration
					setTimeout(() => {
						hasInitialZoomed = true;
						isInitialLoad = false;
					}, 800);
				} else {
					hasInitialZoomed = true;
					isInitialLoad = false;
				}
			});
		} catch (error) {
			console.error('Failed to initialise map', error);
			mapError = 'Unable to render the interactive map.';
		}
	});

	$effect(() => {
		if (map && mapboxModule) {
			syncMarkers(locations);
		}
	});

	$effect(() => {
		if (!mapReady || !hasInitialZoomed) return; // Wait for initial zoom to complete
		if (!activeVideoId) {
			lastFocusedVideoId = null;
			syncMarkers(locations); // Update markers when no active video
			return;
		}
		focusOnVideo(activeVideoId);
		syncMarkers(locations); // Update markers when active video changes
	});

	onDestroy(() => {
		clearMarkers();
		map?.remove();
		map = null;
		mapReady = false;
		lastFocusedVideoId = null;
		hasInitialZoomed = false;
		isInitialLoad = true;
	});
</script>

<div class="map-wrapper">
	<div bind:this={container} class="map-container" role="presentation"></div>
	{#if mapError}
		<div class="map-fallback">
			<p>{mapError}</p>
			{#if locations.length > 0}
				<ul>
					{#each locations as loc (loc.setting ?? loc.name ?? `${loc.latitude}-${loc.longitude}`)}
						<li>
							<span>{loc.setting ?? loc.name ?? 'Location'}</span>
							{#if (loc.latitude ?? loc.mapLat) != null && (loc.longitude ?? loc.mapLon) != null}
								<small>
									({loc.latitude ?? loc.mapLat}, {loc.longitude ?? loc.mapLon})
								</small>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	.map-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.map-container {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		overflow: hidden;
	}

	.map-fallback {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		text-align: center;
		background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9));
		color: rgba(248, 250, 252, 0.8);
	}

	.map-fallback ul {
		margin-top: 1rem;
		padding: 0;
		list-style: none;
		width: 100%;
		max-width: 320px;
		text-align: left;
	}

	.map-fallback li {
		display: flex;
		justify-content: space-between;
		padding: 0.25rem 0;
		border-bottom: 1px dashed rgba(148, 163, 184, 0.3);
		font-size: 0.8125rem;
	}

	.map-fallback small {
		opacity: 0.7;
	}
</style>
