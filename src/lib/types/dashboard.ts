export type DashboardComponentKey =
	| 'videos'
	| 'profile'
	| 'activity'
	| 'sounds'
	| 'members'
	| 'keywords'
	| 'locations';

export type DashboardItem = {
	id: number;
	component: DashboardComponentKey;
	[key: string]: unknown;
};

export type SortDirection = 'asc' | 'desc';
export type TableKey = 'videos' | 'sounds' | 'members' | 'keywords';

export interface TableColumn {
	key: string;
	label: string;
	align?: 'left' | 'right';
}

export interface TableState {
	key: TableKey;
	label: string;
	sortKey: string;
	sortDirection: SortDirection;
	defaultSort: { key: string; direction: SortDirection };
	columns: TableColumn[];
}

export interface LatestLocationPin {
	id: string;
	videoId: string;
	videoTitle: string;
	videoAuthor?: string;
	uploadedLabel: string;
	timestampValue: number;
	lat: number;
	lon: number;
	setting?: string;
	thumbnailUrl?: string;
}

export interface LocationCenter {
	lat: number;
	lon: number;
	zoom: number;
}
