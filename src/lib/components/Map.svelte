<script lang="ts">
	import { browser } from '$app/environment';
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import type mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';

	import type { Location as BaseLocation } from '$lib/types/content';
	import { reverseGeocode } from '$lib/utils/mapbox';

	type MapLocation = BaseLocation & {
		videoTitle?: string;
		videoAuthor?: string;
		videoId?: string;
	};

	type AdminContext = {
		country?: string | null;
		region?: string | null;
		city?: string | null;
		fullAddress?: string | null;
	};

	interface Props {
		locations?: MapLocation[];
		initialCenterLat?: number;
		initialCenterLon?: number;
		initialZoom?: number;
		activeVideoId?: string | null;
	}
  const props = $props() as Props;

  let locations = $state<MapLocation[]>(props.locations ?? []);
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
          // Try to get zoom from geocode data if available
          const coordsKey = `${Number(lon).toFixed(3)},${Number(lat).toFixed(3)}`;
          const rawGeocodeResponse = geocodeRawResponseCache.get(coordsKey);
          const zoom = rawGeocodeResponse 
            ? calculateZoomFromGeocode(rawGeocodeResponse)
            : 8.5; // Default to city zoom if no geocode data
          return { lon, lat, zoom };
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
	let skipAutoFocus = $state(false);

	const token =
		import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN ??
		import.meta.env.VITE_MAPBOX_TOKEN ??
		import.meta.env.VITE_PUBLIC_MAPBOX_ACCESS_TOKEN ??
		'';

	const mapStyle =
		import.meta.env.VITE_MAPBOX_STYLE ??
		import.meta.env.PUBLIC_MAPBOX_STYLE ??
		'mapbox://styles/mapbox/dark-v11'; // Fallback to public style

	function normaliseCoordinates(loc: MapLocation): [number, number] | null {
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

	const dispatch = createEventDispatcher<{
		activeLocationChange: {
			location: MapLocation | null;
			center: { lon: number; lat: number };
			admin: AdminContext;
			rawGeocodeResponse?: unknown;
		};
		viewportChange: {
			bounds: { north: number; south: number; east: number; west: number };
		};
		userInteraction: {};
	}>();

	const ACTIVE_LOCATION_THRESHOLD_DEGREES = 1.2;
	const geocodeCache = new Map<string, AdminContext | null>();
	const geocodeRawResponseCache = new Map<string, unknown>();
	const geocodeRequests = new Map<string, Promise<{ admin: AdminContext | null; rawResponse?: unknown } | null>>();

	function getLocationKey(location: MapLocation | null): string | null {
		if (!location) return null;
		const coords = normaliseCoordinates(location);
		const rounded =
			coords?.map((value) => value.toFixed(6)).join(',') ??
			`${location.id ?? ''}:${location.videoId ?? ''}`;
		const label =
			location.videoId ??
			location.name ??
			location.setting ??
			location.city ??
			location.country ??
			location.place ??
			'';
		const key = `${rounded}|${label}`.trim();
		return key.length > 0 ? key : null;
	}

	function sanitiseName(raw: unknown): string | null {
		if (typeof raw === 'string') {
			const trimmed = raw.trim();
			return trimmed.length > 0 ? trimmed : null;
		}
		return null;
	}

	function contextsEqual(a: AdminContext | null | undefined, b: AdminContext | null | undefined) {
		const norm = (value?: string | null) => (value ? value.trim().toLowerCase() : '');
		return (
			norm(a?.country) === norm(b?.country) &&
			norm(a?.region) === norm(b?.region) &&
			norm(a?.city) === norm(b?.city) &&
			norm(a?.fullAddress) === norm(b?.fullAddress)
		);
	}

	function normaliseAdminContext(...contexts: Array<AdminContext | null | undefined>): AdminContext {
		const pick = (selector: keyof AdminContext) => {
			for (const ctx of contexts) {
				const value = ctx ? sanitiseName(ctx[selector]) : null;
				if (value) return value;
			}
			return null;
		};
		return {
			country: pick('country'),
			region: pick('region'),
			city: pick('city'),
			fullAddress: pick('fullAddress')
		};
	}

	function getAdminFromLocation(location: MapLocation | null): AdminContext {
		if (!location) return {};
		return {
			country: sanitiseName(location.country),
			region:
				sanitiseName(location.state) ??
				sanitiseName(location.region) ??
				sanitiseName(location.locality),
			city:
				sanitiseName(location.place) ??
				sanitiseName(location.name) ??
				sanitiseName(location.setting) ??
				sanitiseName(location.city) ??
				sanitiseName(location.environment)
		};
	}

	function buildCoordKey(center: { lon: number; lat: number }) {
		return `${Number(center.lon).toFixed(3)},${Number(center.lat).toFixed(3)}`;
	}

	function calculateZoomFromGeocode(rawGeocodeResponse: unknown): number {
		// Default zoom if we can't determine location type
		const defaultZoom = 8.5;
		
		if (!rawGeocodeResponse || typeof rawGeocodeResponse !== 'object') {
			return defaultZoom;
		}

		try {
			const response = rawGeocodeResponse as {
				features?: Array<{
					properties?: {
						feature_type?: string;
						coordinates?: {
							accuracy?: string;
							longitude?: number;
							latitude?: number;
						};
						context?: {
							neighborhood?: unknown;
							address?: unknown;
							locality?: unknown;
						};
					};
				}>;
			};

			if (!response.features || response.features.length === 0) {
				return defaultZoom;
			}

			const firstFeature = response.features[0];
			const properties = firstFeature?.properties;
			
			if (!properties) {
				return defaultZoom;
			}

			const featureType = properties.feature_type;
			const context = properties.context || {};
			const coordinates = properties.coordinates || {};
			
			// Check if it's a city location using multiple indicators:
			// 1. feature_type is "address" (strongest indicator of city location)
			// 2. feature_type is "address" with rooftop accuracy
			// 3. Has neighborhood in context (cities have neighborhoods)
			// 4. Has locality in context (cities have named localities like Brooklyn)
			const isCity =
				featureType === 'address' ||
				(featureType === 'address' && coordinates.accuracy === 'rooftop') ||
				context.neighborhood !== undefined ||
				(context.locality !== undefined && featureType !== 'street');

			// City locations get zoom level ~8.5 (3rd breadcrumb level - city)
			// Rural locations get zoom level ~6 (2nd breadcrumb level - region)
			const zoom = isCity ? 8.5 : 6;
			console.log(isCity ? 'city' : 'rural');
			console.log('Zoom calculation:', { featureType, hasNeighborhood: !!context.neighborhood, hasLocality: !!context.locality, isCity, zoom });
			return zoom;
		} catch (error) {
			console.warn('Error calculating zoom from geocode data:', error);
			return defaultZoom;
		}
	}

	let activeLocationKey: string | null = null;
	let activeLocation: MapLocation | null = null;
	let lastAdminContext: AdminContext = {};

	async function updateAdminContextAsync(
		location: MapLocation,
		center: { lon: number; lat: number },
		baseContext: AdminContext
	) {
		if (!browser) return;
		const coordsKey = buildCoordKey(center);
		const locationKey = getLocationKey(location);
		if (!locationKey) return;

				const applyContext = (context: AdminContext | null, rawResponse?: unknown) => {
			if (!context) return;
			if (locationKey !== activeLocationKey) return;
			const merged = normaliseAdminContext(context, baseContext);                                                                             
			if (contextsEqual(merged, lastAdminContext)) return;
			lastAdminContext = merged;
			dispatch('activeLocationChange', { location, center, admin: merged, rawGeocodeResponse: rawResponse });                                                                  
		};

		if (geocodeCache.has(coordsKey)) {
			const cachedAdmin = geocodeCache.get(coordsKey) ?? null;
			const cachedRaw = geocodeRawResponseCache.get(coordsKey);
			applyContext(cachedAdmin, cachedRaw);
			return;
		}

		if (geocodeRequests.has(coordsKey)) {
			const pending = geocodeRequests.get(coordsKey);
			const resolved = await pending;
			if (!resolved) return;
			applyContext(resolved.admin, resolved.rawResponse);
			return;
		}

		const request = reverseGeocode(center.lon, center.lat)
			.then((result) => {
				if (!result) {
					geocodeCache.set(coordsKey, null);
					return null;
				}
				const admin: AdminContext = {
					country: result.country,
					region: result.region,
					city: result.city,
					fullAddress: result.fullAddress
				};
				geocodeCache.set(coordsKey, admin);
				if (result.rawResponse) {
					geocodeRawResponseCache.set(coordsKey, result.rawResponse);
				}
				return { admin, rawResponse: result.rawResponse };
			})
			.catch(() => {
				geocodeCache.set(coordsKey, null);
				return null;
			})
			.finally(() => {
				geocodeRequests.delete(coordsKey);
			});

		geocodeRequests.set(coordsKey, request);
		const resolved = await request;
		if (!resolved) return;
		applyContext(resolved.admin, resolved.rawResponse);
	}

		function setActiveLocation(
		location: MapLocation | null,
		center: { lon: number; lat: number },
		options: { force?: boolean } = {}
	) {
		const key = getLocationKey(location);
		const hasChanged = key !== activeLocationKey;
		if (!options.force && !hasChanged) {
			return;
		}
		activeLocationKey = key;
		activeLocation = location;

		const baseAdmin = normaliseAdminContext(getAdminFromLocation(location));                                                                        
		lastAdminContext = baseAdmin;
		const coordsKey = buildCoordKey(center);
		const cachedRaw = geocodeRawResponseCache.get(coordsKey);
		dispatch('activeLocationChange', { location, center, admin: baseAdmin, rawGeocodeResponse: cachedRaw });                                                                       

		if (location) {
			updateAdminContextAsync(location, center, baseAdmin);
		}
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

  function syncMarkers(currentLocations: MapLocation[] = []) {
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

	function findLocationByVideoId(videoId: string | null): MapLocation | null {
		if (!videoId) return null;
	return (
		locations.find((loc) => loc.videoId === videoId) ?? null
	);
	}

	function findNearestLocation(
		center: mapboxgl.LngLat
	): { location: MapLocation; distance: number } | null {
		let best: MapLocation | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const loc of locations) {
			const coords = normaliseCoordinates(loc);
			if (!coords) continue;
			const [lon, lat] = coords;
			const distance = Math.hypot(center.lng - lon, center.lat - lat);
			if (distance < bestDistance) {
				best = loc;
				bestDistance = distance;
			}
		}
		return best ? { location: best, distance: bestDistance } : null;
	}

	function updateActiveLocationFromCenter(options: { force?: boolean } = {}) {
		if (!map) return;
		const center = map.getCenter();
		const nearest = findNearestLocation(center);
		if (!nearest) {
			if (options.force) {
				setActiveLocation(null, { lon: center.lng, lat: center.lat }, { force: true });
			}
			return;
		}
		if (!options.force && nearest.distance > ACTIVE_LOCATION_THRESHOLD_DEGREES) {
			return;
		}
		setActiveLocation(nearest.location, { lon: center.lng, lat: center.lat }, { force: options.force });
	}

		async function focusOnVideo(
		videoId: string | null,
		{ instant = false, force = false }: { instant?: boolean; force?: boolean } = {}                                                                         
) {
		if (!map || !mapReady || !videoId) return;
		const location = findLocationByVideoId(videoId);
		if (!location) return;
		const coords = normaliseCoordinates(location);
		if (!coords) return;
		const [lon, lat] = coords;
		
		// Calculate zoom based on geocode data (rural vs city)
		const coordsKey = buildCoordKey({ lon, lat });
		let rawGeocodeResponse = geocodeRawResponseCache.get(coordsKey);
		
		// If geocode data isn't cached, trigger fetch and wait for it
		if (!rawGeocodeResponse) {
			// Trigger geocode fetch by calling updateAdminContextAsync
			const baseContext = normaliseAdminContext(getAdminFromLocation(location));
			await updateAdminContextAsync(location, { lon, lat }, baseContext);
			// Try to get cached response again after fetch
			rawGeocodeResponse = geocodeRawResponseCache.get(coordsKey);
		}
		
		const targetZoom = rawGeocodeResponse 
			? calculateZoomFromGeocode(rawGeocodeResponse)
			: 8.5; // Default zoom if no geocode data available
		
		console.log('Setting zoom to:', targetZoom);
		
		// Set active location first (before jumping) to ensure context is ready
		setActiveLocation(location, { lon, lat }, { force: true });
		
		// Use a small timeout to ensure any pending map operations complete before setting zoom
		await new Promise(resolve => setTimeout(resolve, 0));
		
		// Always use instant positioning when video changes (no animation)
		map.jumpTo({ center: [lon, lat], zoom: targetZoom });
		
		// Verify zoom was set correctly after a brief delay
		setTimeout(() => {
			const actualZoom = map?.getZoom();
			console.log('Actual zoom after jumpTo:', actualZoom, 'Expected:', targetZoom);
			// If zoom was reset, set it again
			if (actualZoom !== undefined && Math.abs(actualZoom - targetZoom) > 0.5) {
				console.log('Zoom was reset, correcting to:', targetZoom);
				map?.jumpTo({ center: [lon, lat], zoom: targetZoom });
			}
		}, 100);
		
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
			let isUserInteraction = false;

			const markUserInteraction = (event: mapboxgl.EventData) => {
				const mapboxEvent = event as mapboxgl.MapboxEvent<unknown>;
				if (mapboxEvent.originalEvent) {
					isUserInteraction = true;
				}
			};

			map.on('mousedown', markUserInteraction);

			map.on('touchstart', markUserInteraction);

			// Track wheel events (mouse wheel zoom)
			map.on('wheel', markUserInteraction);

			// Track zoomstart for any zoom interaction initiated by the user
			map.on('zoomstart', markUserInteraction);
			
			map.on('moveend', () => {
				updateActiveLocationFromCenter();
				dispatchViewportChange();
				if (isUserInteraction) {
					dispatch('userInteraction', {});
					isUserInteraction = false;
				}
			});
			
			map.on('zoomend', () => {
				dispatchViewportChange();
				if (isUserInteraction) {
					dispatch('userInteraction', {});
					isUserInteraction = false;
				}
			});
			map.once('load', () => {
				mapReady = true;
				syncMarkers(locations);
				dispatchViewportChange();
				// Map is already positioned correctly from initial center/zoom, no need to jump
				if (activeVideoId) {
					lastFocusedVideoId = activeVideoId;
					updateActiveLocationFromCenter({ force: true });
				} else {
					lastFocusedVideoId = null;
					updateActiveLocationFromCenter({ force: true });
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
			updateActiveLocationFromCenter();
		}
	});

	$effect(() => {
		if (!mapReady || !hasInitialZoomed) return; // Wait for initial zoom to complete
		if (skipAutoFocus) return; // Skip if manually recentering with flyToMarker
		if (!activeVideoId) {
			lastFocusedVideoId = null;
			syncMarkers(locations); // Update markers when no active video
			updateActiveLocationFromCenter({ force: true });
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

	export function zoomToWorld() {
		if (!map || !mapboxModule) return;
		const bounds = new mapboxModule.LngLatBounds([-179.9, -70], [179.9, 83]);
		map.fitBounds(bounds, { padding: 48, duration: 800, maxZoom: 3.5 });
		updateActiveLocationFromCenter({ force: true });
	}

	export function zoomToLocation(location: MapLocation, zoom = 10) {
		if (!map) return;
		const coords = normaliseCoordinates(location);
		if (!coords) return;
		map.easeTo({
			center: coords,
			zoom,
			duration: 700,
			easing: (t) => 1 - Math.pow(1 - t, 3)
		});
		setActiveLocation(location, { lon: coords[0], lat: coords[1] }, { force: true });
	}

export function fitToLocations(targetLocations: MapLocation[], options?: { padding?: number; maxZoom?: number }) {
	if (!map || !mapboxModule) return;
	const coords = targetLocations
		.map((loc) => normaliseCoordinates(loc))
		.filter((coord): coord is [number, number] => Array.isArray(coord));
	if (coords.length === 0) return;
	const bounds = coords.slice(1).reduce(
		(acc, coord) => acc.extend(coord),
		new mapboxModule.LngLatBounds(coords[0], coords[0])
	);
	map.fitBounds(bounds, {
		padding: options?.padding ?? 80,
		duration: 700,
		maxZoom: options?.maxZoom ?? 7
	});
	updateActiveLocationFromCenter({ force: true });
}

function dispatchViewportChange() {
	if (!map || !mapboxModule) return;
	try {
		const bounds = map.getBounds();
		dispatch('viewportChange', {
			bounds: {
				north: bounds.getNorth(),
				south: bounds.getSouth(),
				east: bounds.getEast(),
				west: bounds.getWest()
			}
		});
	} catch (error) {
		console.warn('Failed to get map bounds:', error);
	}
}

export function getActiveLocation(): MapLocation | null {
	return activeLocation;
}

export function flyToCoordinates(lon: number, lat: number, options?: { zoom?: number }) {
	if (!map) return;
	const targetZoom = options?.zoom ?? Math.max(map.getZoom(), 6);
	map.easeTo({
		center: [lon, lat],
		zoom: targetZoom,
		duration: 800,
		easing: (t) => 1 - Math.pow(1 - t, 3)
	});
	// Defer active location update until map settles on the new view.
	setTimeout(() => {
		updateActiveLocationFromCenter({ force: true });
	}, 820);
}

export function flyToMarker(lon: number, lat: number, zoom = 10) {
	if (!map || !mapReady) return;
	
	// Temporarily disable auto-focus to prevent focusOnVideo's jumpTo from interrupting
	skipAutoFocus = true;
	
	// Stop any ongoing animations to prevent conflicts
	map.stop();
	
	// Use flyTo for dramatic flying animation from current position to marker
	// Ensure essential: true to override prefers-reduced-motion
	map.flyTo({
		center: [lon, lat],
		zoom: zoom,
		duration: 1500,
		essential: true,
		curve: 1.42, // Creates a more dramatic arc
		speed: 1.2 // Slightly faster for smoother feel
	});
	
	// Re-enable auto-focus after animation completes
	setTimeout(() => {
		skipAutoFocus = false;
		updateActiveLocationFromCenter({ force: true });
	}, 1600);
}
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
