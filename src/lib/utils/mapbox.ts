const MAPBOX_ACCESS_TOKEN =
	import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN ??
	import.meta.env.VITE_MAPBOX_TOKEN ??
	import.meta.env.VITE_PUBLIC_MAPBOX_ACCESS_TOKEN ??
	null;

export interface ReverseGeocodeResult {
        fullAddress: string | null;
        country: string | null;
        region: string | null;
        city: string | null;
        rawResponse?: unknown; // Raw JSON response from the API
}

export interface SearchPlaceResult {
	id: string;
	name: string;
	context: string | null;
	longitude: number;
	latitude: number;
	zoom?: number;
}

function sanitise(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export async function searchPlaces(query: string, options?: { limit?: number }): Promise<SearchPlaceResult[]> {
	if (!MAPBOX_ACCESS_TOKEN) return [];
	const trimmed = query.trim();
	if (trimmed.length === 0) return [];

	const params = new URLSearchParams({
		access_token: MAPBOX_ACCESS_TOKEN,
		language: 'en',
		types: 'country,region,place,locality',
		limit: String(options?.limit ?? 5)
	});

	const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?${params.toString()}`;

	try {
		const response = await fetch(endpoint);
		if (!response.ok) {
			throw new Error(`Mapbox place search failed with status ${response.status}`);
		}
		const data = (await response.json()) as {
			features?: Array<{
				id?: unknown;
				text?: unknown;
				place_name?: unknown;
				context?: Array<{ text?: unknown }>;
				place_type?: unknown;
				geometry?: { coordinates?: [number, number] };
			}>;
		};
		if (!Array.isArray(data.features)) return [];

		return data.features
			.map((feature) => {
				const coords = feature.geometry?.coordinates;
				if (!Array.isArray(coords) || coords.length < 2) return null;
				const contextNames = (feature.context ?? [])
					.map((ctx) => sanitise(ctx.text))
					.filter((value): value is string => Boolean(value));
				const uniqueContext = Array.from(new Set(contextNames));
				const placeTypes = Array.isArray(feature.place_type)
					? feature.place_type.map((type) => String(type).toLowerCase())
					: [];
				let zoom: number | undefined;
				if (placeTypes.includes('country')) zoom = 3.5;
				else if (placeTypes.includes('region')) zoom = 5.5;
				else if (placeTypes.includes('district')) zoom = 6.5;
				else if (placeTypes.includes('place')) zoom = 7.5;
				else if (placeTypes.includes('locality')) zoom = 9;
				if (!zoom) zoom = uniqueContext.length > 1 ? 7.5 : 6.5;

				return {
					id: typeof feature.id === 'string' ? feature.id : `${coords[0]}-${coords[1]}-${feature.text ?? ''}`,
					name: sanitise(feature.text) ?? sanitise(feature.place_name) ?? 'Unknown place',
					context: uniqueContext.length > 0 ? uniqueContext.join(', ') : null,
					longitude: coords[0],
					latitude: coords[1],
					zoom
				} as SearchPlaceResult;
			})
			.filter((value): value is SearchPlaceResult => value !== null);
	} catch (error) {
		console.warn('Place search failed:', error);
		return [];
	}
}

export async function reverseGeocode(
	longitude: number,
	latitude: number
): Promise<ReverseGeocodeResult | null> {
	if (!MAPBOX_ACCESS_TOKEN || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
		return null;
	}

	const lon = Number(longitude.toFixed(6));
	const lat = Number(latitude.toFixed(6));
	const params = new URLSearchParams({
		longitude: lon.toString(),
		latitude: lat.toString(),
		access_token: MAPBOX_ACCESS_TOKEN,
		language: 'en'
	});

	const endpoint = `https://api.mapbox.com/search/geocode/v6/reverse?${params.toString()}`;

	try {
		const response = await fetch(endpoint);
		if (!response.ok) {
			throw new Error(`Mapbox reverse geocoding failed with status ${response.status}`);
		}

		const data = (await response.json()) as {
			features?: Array<{
				properties?: {
					full_address?: unknown;
					context?: {
						country?: { name?: unknown };
						region?: { name?: unknown };
						place?: { name?: unknown };
						locality?: { name?: unknown };
					};
				};
			}>;
		};

		if (!Array.isArray(data.features) || data.features.length === 0) {
			return null;
		}

		const main = data.features[0]?.properties;
		if (!main) return null;

		                const context = main.context ?? {};

                return {
                        fullAddress: sanitise(main.full_address),
                        country: sanitise(context.country?.name),
                        region: sanitise(context.region?.name ?? context.place?.name ?? context.locality?.name),                                                
                        city: sanitise(context.place?.name ?? context.locality?.name),
                        rawResponse: data // Include the raw JSON response
                };
	} catch (error) {
		console.warn('Reverse geocoding failed:', error);
		return null;
	}
}
