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
}

function sanitise(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
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
			city: sanitise(context.place?.name ?? context.locality?.name)
		};
	} catch (error) {
		console.warn('Reverse geocoding failed:', error);
		return null;
	}
}
