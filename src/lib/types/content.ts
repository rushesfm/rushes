export interface Location {
	setting?: string;
	environment?: string;
	startTime?: number;
	endTime?: number;
	isExterior?: number;
	isDay?: number;
	longitude?: number;
	latitude?: number;
	mapLat?: number;
	mapLon?: number;
	isGuess?: boolean;
	id?: number;
	name?: string;
	coordinates?: [number, number];
}

export interface Video {
	id: string;
	title: string;
	description: string;
	author: string;
	authorId: string;
	duration?: number;
	uploadedAt?: string;
	url?: string;
	videoUrl?: string;
	thumbnailUrl?: string;
	streamId?: string;
	format?: string;
	aspectRatio?: string;
	locations?: Location[];
	keywords?: string[];
	transcript?: string;
	views?: number;
	likes?: number;
	gcs_uri?: string;
	source_url?: string;
	timestamp?: string;
	raw_response_json?: unknown;
	uploadDate?: string;
	createdAt?: string;
}

export interface UserVideoSummary {
	id: string;
	title: string;
	thumbnail: string;
	duration?: number;
}

export interface UserStats {
	videos: number;
	followers: number;
	following: number;
}

export interface User {
	id: string;
	name: string;
	avatar: string;
	bio: string;
	stats: UserStats;
	videos: UserVideoSummary[];
	email?: string;
	subscribers?: number;
	joinedAt?: string;
	verified?: boolean;
	recentVideos?: UserVideoSummary[];
}

export interface Comment {
	id: number;
	user: string;
	avatar: string;
	content: string;
	timestamp: string;
	likes: number;
}
