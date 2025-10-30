/// <reference lib="webworker" />

declare const self: DedicatedWorkerGlobalScope;

type IncomingMessage =
	| {
			type: 'extract-metadata';
			buffer: ArrayBuffer;
			lastModified?: number;
	  };

interface MetadataResult {
	date?: string;
	latitude?: number;
	longitude?: number;
	source?: string;
}

interface CoordinateMatch {
	lat: number;
	lon: number;
	source: string;
}

const decoder = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true });
const MAX_SAMPLE_BYTES = 8 * 1024 * 1024; // Scan 8MB from start and end

self.onmessage = (event: MessageEvent<IncomingMessage>) => {
	const message = event.data;
	if (!message) return;

	if (message.type === 'extract-metadata') {
		try {
			const metadata = extractMetadata(message.buffer, message.lastModified);
			self.postMessage({ type: 'metadata-result', metadata });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Unknown metadata extraction error';
			self.postMessage({ type: 'error', error: message });
		}
	}
};

function extractMetadata(buffer: ArrayBuffer, lastModified?: number): MetadataResult {
	const bytes = new Uint8Array(buffer);
	const sampledText = buildSampledText(bytes);
	const metadata: MetadataResult = {};

	const date = findDate(sampledText) ?? (lastModified ? new Date(lastModified).toISOString() : undefined);
	if (date) {
		metadata.date = date;
	}

	const coords = findCoordinates(sampledText);
	if (coords) {
		metadata.latitude = coords.lat;
		metadata.longitude = coords.lon;
		metadata.source = coords.source;
	}

	return metadata;
}

function buildSampledText(bytes: Uint8Array): string {
	if (bytes.length === 0) return '';

	const segments: string[] = [];
	const headLength = Math.min(bytes.length, MAX_SAMPLE_BYTES);
	segments.push(
		decoder.decode(bytes.subarray(0, headLength)).replace(/\u0000/g, ' ')
	);

	if (bytes.length > MAX_SAMPLE_BYTES) {
		const tailStart = Math.max(0, bytes.length - MAX_SAMPLE_BYTES);
		segments.push(
			decoder.decode(bytes.subarray(tailStart)).replace(/\u0000/g, ' ')
		);
	}

	return segments.join('\n');
}

function findDate(text: string): string | undefined {
	const patterns: RegExp[] = [
		/com\.apple\.quicktime\.creationdate[^0-9]*([0-9]{4}[-:][0-9]{2}[-:][0-9]{2}(?:[ T][0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.\d+)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?)/i,
		/creation_time[^0-9]*([0-9]{4}[-:][0-9]{2}[-:][0-9]{2}(?:[ T][0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.\d+)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?)/i,
		/date_recorded[^0-9]*([0-9]{4}[-:][0-9]{2}[-:][0-9]{2}(?:[ T][0-9]{2}:[0-9]{2}:[0-9]{2})?)/i
	];

	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (match && match[1]) {
			const iso = toIso(match[1]);
			if (iso) return iso;
		}
	}
	return undefined;
}

function toIso(value: string): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	const normalised = trimmed.replace(/(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
	const withT = normalised.includes('T')
		? normalised
		: normalised.replace(' ', 'T');

	const date = new Date(withT);
	if (!Number.isNaN(date.getTime())) {
		return date.toISOString();
	}

	// Attempt to coerce missing timezone (assume UTC)
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(withT)) {
		const utc = new Date(`${withT}Z`);
		if (!Number.isNaN(utc.getTime())) {
			return utc.toISOString();
		}
	}

	if (/^\d{4}-\d{2}-\d{2}$/.test(withT)) {
		return `${withT}T00:00:00.000Z`;
	}

	return undefined;
}

function findCoordinates(text: string): CoordinateMatch | null {
	const candidates = [
		{ term: 'com.apple.quicktime.location.iso6709', window: 160 },
		{ term: 'com.apple.quicktime.location', window: 160 },
		{ term: 'com.apple.quicktime.latitude', window: 200 },
		{ term: 'com.apple.quicktime.longitude', window: 200 },
		{ term: 'ISO6709', window: 160 },
		{ term: '©xyz', window: 120 },
		{ term: 'gps', window: 200 },
		{ term: 'location', window: 200 }
	];

	for (const candidate of candidates) {
		const coords = scanForTerm(text, candidate.term, candidate.window);
		if (coords) return coords;
	}

	const generalIso = scanIsoSequences(text);
	if (generalIso) return generalIso;

	const latLonPair = scanLatLonPairs(text);
	if (latLonPair) return latLonPair;

	return null;
}

function scanForTerm(text: string, term: string, window: number): CoordinateMatch | null {
	const lowerText = text.toLowerCase();
	const lowerTerm = term.toLowerCase();
	let index = lowerText.indexOf(lowerTerm);

	while (index !== -1) {
		const snippet = text.slice(index, Math.min(text.length, index + lowerTerm.length + window));
		const coords = parseCoordinates(snippet);
		if (coords) {
			return { ...coords, source: term };
		}
		index = lowerText.indexOf(lowerTerm, index + lowerTerm.length);
	}

	return null;
}

function scanIsoSequences(text: string): CoordinateMatch | null {
	const isoPattern =
		/([+-]\d{1,3}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)(?:[+-]\d{1,3}(?:\.\d+)?\/?)?/g;

	let match: RegExpExecArray | null;
	// eslint-disable-next-line no-cond-assign
	while ((match = isoPattern.exec(text))) {
		const coords = parseIsoMatch(match);
		if (coords) {
			return { ...coords, source: 'iso-sequence' };
		}
	}
	return null;
}

function scanLatLonPairs(text: string): CoordinateMatch | null {
	const latPattern = /(latitude|gps_latitude)[^+\-0-9]*([+\-]?\d{1,3}(?:\.\d+)?)/i;
	const lonPattern = /(longitude|gps_longitude)[^+\-0-9]*([+\-]?\d{1,3}(?:\.\d+)?)/i;

	const latMatch = text.match(latPattern);
	const lonMatch = text.match(lonPattern);

	if (latMatch && lonMatch) {
		const lat = Number.parseFloat(latMatch[2]);
		const lon = Number.parseFloat(lonMatch[2]);
		if (isValidCoordinate(lat, lon)) {
			return { lat, lon, source: `${latMatch[1]}/${lonMatch[1]}` };
		}
	}

	return null;
}

function parseCoordinates(snippet: string): Omit<CoordinateMatch, 'source'> | null {
	const iso = parseIsoLike(snippet);
	if (iso) {
		return iso;
	}
	return null;
}

function parseIsoLike(value: string): Omit<CoordinateMatch, 'source'> | null {
	const isoMatch = value.match(/([+-]\d{1,3}(?:\.\d+)?)([+-]\d{1,3}(?:\.\d+)?)/);
	if (isoMatch) {
		const coords = parseIsoMatch(isoMatch);
		if (coords) return coords;
	}

	const delimited = value.match(/([+\-]?\d{1,3}(?:\.\d+)?)[,\s\/]+([+\-]?\d{1,3}(?:\.\d+)?)/);
	if (delimited) {
		const lat = Number.parseFloat(delimited[1]);
		const lon = Number.parseFloat(delimited[2]);
		if (isValidCoordinate(lat, lon)) {
			return { lat, lon };
		}
	}

	return null;
}

function parseIsoMatch(match: RegExpMatchArray): Omit<CoordinateMatch, 'source'> | null {
	if (match.length < 3) return null;
	const lat = Number.parseFloat(match[1]);
	const lon = Number.parseFloat(match[2]);
	if (!isValidCoordinate(lat, lon)) return null;
	return { lat, lon };
}

function isValidCoordinate(lat: number, lon: number): boolean {
	return (
		Number.isFinite(lat) &&
		Number.isFinite(lon) &&
		Math.abs(lat) <= 90 &&
		Math.abs(lon) <= 180
	);
}

export {};
