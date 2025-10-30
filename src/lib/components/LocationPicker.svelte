<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import type mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';

	interface Props {
		latitude?: number;
		longitude?: number;
		onLocationChange?: (lat: number, lon: number) => void;
	}

	let { latitude, longitude, onLocationChange }: Props = $props();

	let container = $state<HTMLDivElement | null>(null);
	let map: mapboxgl.Map | null = null;
	let marker: mapboxgl.Marker | null = null;
	let mapError = $state<string | null>(null);
	const initialLat = typeof latitude === 'number' ? latitude : null;
	const initialLon = typeof longitude === 'number' ? longitude : null;
	const initialHasCoords =
		initialLat != null &&
		initialLon != null &&
		coordinatesInRange(initialLat, initialLon);
	let currentLat = $state<number | null>(initialHasCoords ? initialLat : null);
	let currentLon = $state<number | null>(initialHasCoords ? initialLon : null);

	const token =
		import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN ??
		import.meta.env.VITE_MAPBOX_TOKEN ??
		import.meta.env.VITE_PUBLIC_MAPBOX_ACCESS_TOKEN ??
		'';

	const mapStyle =
		import.meta.env.VITE_MAPBOX_STYLE ??
		import.meta.env.PUBLIC_MAPBOX_STYLE ??
		'mapbox://styles/mapbox/dark-v11';

	let mapboxModule: typeof mapboxgl | null = null;

	function coordinatesInRange(lat: number, lon: number): boolean {
		return (
			Number.isFinite(lat) &&
			Number.isFinite(lon) &&
			Math.abs(lat) <= 90 &&
			Math.abs(lon) <= 180
		);
	}

	function updateMarker(
		lat: number,
		lon: number,
		options: { notify?: boolean; animate?: boolean } = {}
	) {
		const mapInstance = map;
		const mapbox = mapboxModule;
		if (!mapInstance || !mapbox) return;
		if (!coordinatesInRange(lat, lon)) return;

		currentLat = lat;
		currentLon = lon;

		if (marker) {
			marker.setLngLat([lon, lat]);
		} else {
			marker = new mapbox.Marker({ color: '#f59e0b', draggable: true })
				.setLngLat([lon, lat])
				.addTo(mapInstance);

			marker.on('dragend', () => {
				if (!marker) return;
				const lngLat = marker.getLngLat();
				updateMarker(lngLat.lat, lngLat.lng, { animate: false, notify: true });
			});
		}

		const animate = options.animate ?? true;
		const zoom = mapInstance.getZoom ? Math.max(mapInstance.getZoom(), 12) : 12;
		const move = () => {
			if (animate) {
				mapInstance.easeTo({ center: [lon, lat], zoom, duration: 800 });
			} else {
				mapInstance.jumpTo({ center: [lon, lat], zoom });
			}
		};

		if (mapInstance.isStyleLoaded()) {
			move();
		} else {
			mapInstance.once('load', move);
		}

		if (options.notify ?? true) {
			onLocationChange?.(lat, lon);
		}
	}

	onMount(async () => {
		if (!browser || !container) return;
		if (!token) {
			mapError = 'Missing Mapbox access token';
			return;
		}

		try {
			const module = await import('mapbox-gl');
			mapboxModule = module.default as typeof mapboxgl;
			const Mapbox = mapboxModule;

			if (!Mapbox) {
				mapError = 'Unable to load Mapbox library';
				return;
			}

			Mapbox.accessToken = token;
			const lat = typeof latitude === 'number' ? latitude : null;
			const lon = typeof longitude === 'number' ? longitude : null;
			const hasCoords = lat != null && lon != null && coordinatesInRange(lat, lon);
			const startLat = hasCoords && lat != null ? lat : 0;
			const startLon = hasCoords && lon != null ? lon : 0;
			map = new Mapbox.Map({
					container,
					style: mapStyle,
					center: [startLon, startLat],
					zoom: hasCoords ? 12 : 2,
					cooperativeGestures: false
				});

			map.once('load', () => {
					const loadLat = typeof latitude === 'number' ? latitude : null;
					const loadLon = typeof longitude === 'number' ? longitude : null;
					if (loadLat != null && loadLon != null && coordinatesInRange(loadLat, loadLon)) {
						updateMarker(loadLat, loadLon, { notify: false });
					}
				});

			// Add click handler to place/move marker
			map.on('click', (e) => {
				updateMarker(e.lngLat.lat, e.lngLat.lng);
			});

			// Add geolocation control
			const geolocate = new Mapbox.GeolocateControl({
				positionOptions: {
					enableHighAccuracy: true
				},
				trackUserLocation: false,
				showUserHeading: false
			});

			map.addControl(geolocate);

			// Listen for geolocation success
			geolocate.on('geolocate', (e: any) => {
				updateMarker(e.coords.latitude, e.coords.longitude);
			});

			// Add navigation controls
			map.addControl(new Mapbox.NavigationControl(), 'top-right');

		} catch (error) {
			console.error('Failed to initialize map:', error);
			mapError = 'Unable to render the interactive map';
		}
	});

	// Update marker when props change
	$effect(() => {
		const lat = typeof latitude === 'number' ? latitude : null;
		const lon = typeof longitude === 'number' ? longitude : null;

		if (lat != null && lon != null && coordinatesInRange(lat, lon)) {
			currentLat = lat;
			currentLon = lon;

			if (map && mapboxModule) {
				updateMarker(lat, lon, { notify: false });
			}
		} else if (latitude == null || longitude == null) {
			currentLat = null;
			currentLon = null;
			if (marker) {
				marker.remove();
				marker = null;
			}
		}
	});

	onDestroy(() => {
		marker?.remove();
		map?.remove();
		map = null;
		marker = null;
	});
</script>

<div class="location-picker">
	<div bind:this={container} class="map-container" role="presentation"></div>
	{#if mapError}
		<div class="map-error">
			<p>{mapError}</p>
		</div>
	{/if}
	<div class="coordinates">
		{#if currentLat != null && currentLon != null}
			<span class="coord-label">Location:</span>
			<span class="coord-value">{currentLat?.toFixed(6)}, {currentLon?.toFixed(6)}</span>
		{:else}
			<span class="coord-label">Click on the map to set a location</span>
		{/if}
	</div>
</div>

<style>
	.location-picker {
		position: relative;
		width: 100%;
		height: 400px;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.map-container {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
	}

	.map-error {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.95);
		color: #fca5a5;
		padding: 1.5rem;
		text-align: center;
		z-index: 10;
	}

	.coordinates {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(15, 23, 42, 0.95);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 9999px;
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		color: #e2e8f0;
		backdrop-filter: blur(8px);
		display: flex;
		gap: 0.5rem;
		align-items: center;
		z-index: 5;
		pointer-events: none;
	}

	.coord-label {
		color: rgba(226, 232, 240, 0.7);
	}

	.coord-value {
		color: #5eead4;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	@media (max-width: 640px) {
		.location-picker {
			height: 300px;
		}

		.coordinates {
			font-size: 0.75rem;
			padding: 0.375rem 0.75rem;
		}
	}
</style>
