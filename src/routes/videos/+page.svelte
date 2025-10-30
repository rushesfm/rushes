<script lang="ts">
	import { goto } from "$app/navigation";
	import { actions } from "$lib/stores/appStore";
	import { selectedVideo } from "$lib/stores/selectedVideo";
	import { slide } from "svelte/transition";
	import {
		dndzone,
		type DndEvent,
		SHADOW_ITEM_MARKER_PROPERTY_NAME,
	} from "svelte-dnd-action";
	import DashboardPanel from "$lib/components/dashboard/DashboardPanel.svelte";
	import type {
		DashboardComponentKey,
		DashboardItem,
		LatestLocationPin,
		LocationCenter,
		SortDirection,
		TableColumn,
		TableKey,
		TableState,
	} from "$lib/types/dashboard";
import { videosStore, usersStore } from "$lib/stores/library";

	const boardDndType = "dashboard-panels";
	const boardDropTargetClasses = ["dashboard-drop-target"];
	const boardFlipDurationMs = 200;

	const videos = $derived($videosStore);
	const users = $derived($usersStore);

	// State for draggable items in each column
	let itemsLeft = $state<DashboardItem[]>([{ id: 1, component: "videos" }, { id: 2, component: "sounds" }]);

let itemsRight = $state<DashboardItem[]>([
	{ id: 5, component: "profile" },
	{ id: 6, component: "activity" },
	{ id: 7, component: "locations" },
	{ id: 3, component: "members" },
	{ id: 4, component: "keywords" },
]);

	const sectionLabels: Record<DashboardComponentKey, string> = {
		videos: "Queue overview",
		profile: "Profile summary",
		activity: "Live activity",
		sounds: "Sounds",
		members: "Members",
		keywords: "Keywords",
		locations: "Latest locations",
	};

	function getSectionLabel(item: DashboardItem) {
		return sectionLabels[item.component] ?? "Dashboard section";
	}

	function updateLeftColumn(event: CustomEvent<DndEvent<DashboardItem>>) {
		itemsLeft = event.detail.items as DashboardItem[];
	}

	function updateRightColumn(event: CustomEvent<DndEvent<DashboardItem>>) {
		itemsRight = event.detail.items as DashboardItem[];
	}

	const liveActivity = $state([
		{
			id: "act-1",
			user: "Inès Duarte",
			action: "liked",
			content: "Canal Footbridge Atmos",
			type: "like",
			time: "2m ago",
		},
		{
			id: "act-2",
			user: "Luca Van Eyck",
			action: "commented on",
			content: "Metro Brakes – Line 6",
			type: "comment",
			time: "5m ago",
		},
		{
			id: "act-3",
			user: "Aya Kakei",
			action: "liked",
			content: "Night Rain On Skylight",
			type: "like",
			time: "1h ago",
		},
		{
			id: "act-4",
			user: "Tom Schurr",
			action: "commented on",
			content: "Textile Rustle Layers",
			type: "comment",
			time: "3h ago",
		},
	]);

	interface SoundClip {
		id: string;
		title: string;
		recordist: string;
		duration: string;
		capturedOn: string;
		location: string;
		relatedProject: string;
	}

	let collapsed = $state<Record<DashboardComponentKey, boolean>>({
		videos: false,
		profile: false,
		activity: false,
		sounds: false,
		members: false,
		keywords: false,
		locations: false,
	});

	function toggleCollapse(component: DashboardComponentKey) {
		collapsed[component] = !collapsed[component];
	}

	const soundLibrary: SoundClip[] = [
		{
			id: "amb-001",
			title: "Canal Footbridge Atmos",
			recordist: "Inès Duarte",
			duration: "01:22",
			capturedOn: "2024-03-12",
			location: "Quai des Péniches, Brussels",
			relatedProject: "Portrait of an Unknown Artist",
		},
		{
			id: "fx-014",
			title: "Metro Brakes – Line 6",
			recordist: "Luca Van Eyck",
			duration: "00:47",
			capturedOn: "2024-02-04",
			location: "Ribaucourt Station",
			relatedProject: "Urban Exploration",
		},
		{
			id: "amb-019",
			title: "Night Rain On Skylight",
			recordist: "Aya Kakei",
			duration: "02:08",
			capturedOn: "2024-01-23",
			location: "Ixelles Rooftop",
			relatedProject: "Neon Dreams",
		},
		{
			id: "vox-006",
			title: "Voice Memo — “Golden Hour”",
			recordist: "Leonie Saerens",
			duration: "00:36",
			capturedOn: "2023-12-17",
			location: "Signal de Botrange",
			relatedProject: "Sunset Timelapse",
		},
		{
			id: "foley-011",
			title: "Textile Rustle Layers",
			recordist: "Tom Schurr",
			duration: "01:04",
			capturedOn: "2024-03-04",
			location: "Studio 12B, Molenbeek",
			relatedProject: "Portrait of an Unknown Artist",
		},
	];

	const initialTableState: Record<TableKey, TableState> = {
		videos: {
			key: "videos",
			label: "Queue",
			sortKey: "uploaded",
			sortDirection: "desc",
			defaultSort: { key: "uploaded", direction: "desc" },
			columns: [] as TableColumn[],
		},
		sounds: {
			key: "sounds",
			label: "Sounds",
			sortKey: "captured",
			sortDirection: "desc",
			defaultSort: { key: "captured", direction: "desc" },
			columns: [
				{ key: "title", label: "CLIP" },
				{ key: "recordist", label: "CAPTURED_BY" },
				{ key: "captured", label: "CAPTURED", align: "right" },
				{ key: "duration", label: "DURATION", align: "right" },
			] as TableColumn[],
		},
		members: {
			key: "members",
			label: "MEMBERS",
			sortKey: "name",
			sortDirection: "asc",
			defaultSort: { key: "name", direction: "asc" },
			columns: [
				{ key: "name", label: "NAME" },
				{ key: "videos", label: "VIDEOS", align: "right" },
				{ key: "followers", label: "FOLLOWERS", align: "right" },
				{ key: "following", label: "FOLLOWING", align: "right" },
				{ key: "joined", label: "JOINED", align: "right" },
			] as TableColumn[],
		},
		keywords: {
			key: "keywords",
			label: "KEYWORDS",
			sortKey: "keyword",
			sortDirection: "asc",
			defaultSort: { key: "keyword", direction: "asc" },
			columns: [
				{ key: "keyword", label: "TERM" },
				{ key: "usage", label: "USAGE", align: "right" },
				{ key: "related", label: "RELATED_PROJECTS" },
			] as TableColumn[],
		},
	};

	let tableState = $state<Record<TableKey, TableState>>({
		...initialTableState,
	});

	function formatDate(iso?: string) {
		if (!iso) return "—";
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return iso;
		return date.toISOString().split("T")[0];
	}

	function parseDuration(value?: string) {
		if (!value) return 0;
		const parts = value.split(":").map((n) => Number.parseInt(n, 10));
		if (parts.some((n) => Number.isNaN(n))) return 0;
		if (parts.length === 3) {
			const [h, m, s] = parts;
			return h * 3600 + m * 60 + s;
		}
		if (parts.length === 2) {
			const [m, s] = parts;
			return m * 60 + s;
		}
		return parts[0];
	}

	function formatViews(views?: number) {
		if (typeof views !== "number" || Number.isNaN(views)) return "—";
		if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
		if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
		return `${views}`;
	}

	function formatStat(num: number) {
		if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
		return num.toString();
	}

	function formatRuntime(totalSeconds: number) {
		if (!totalSeconds || Number.isNaN(totalSeconds)) return "0m";
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		if (hours > 0) {
			return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
		}
		return `${minutes}m`;
	}

	function getVideoTimestampValue(video: any) {
		const candidate = video?.timestamp ?? video?.uploadDate ?? null;
		if (typeof candidate === "string") {
			const parsed = Date.parse(candidate);
			if (!Number.isNaN(parsed)) {
				return parsed;
			}
		}
		return 0;
	}

	function getLocationCoordinates(
		location: any,
	): { lat: number; lon: number } | null {
		if (
			typeof location?.mapLat === "number" &&
			typeof location?.mapLon === "number"
		) {
			return { lat: location.mapLat, lon: location.mapLon };
		}
		if (
			typeof location?.latitude === "number" &&
			typeof location?.longitude === "number"
		) {
			return { lat: location.latitude, lon: location.longitude };
		}
		if (
			Array.isArray(location?.coordinates) &&
			location.coordinates.length === 2
		) {
			const [lat, lon] = location.coordinates;
			if (typeof lat === "number" && typeof lon === "number") {
				return { lat, lon };
			}
		}
		return null;
	}

	function getKeywordsSummary() {
		const keywordMap = new Map<
			string,
			{ usage: number; related: Set<string> }
		>();
		for (const video of videos) {
			for (const key of video.keywords ?? []) {
				const entry = keywordMap.get(key) ?? {
					usage: 0,
					related: new Set<string>(),
				};
				entry.usage += 1;
				entry.related.add(video.title);
				keywordMap.set(key, entry);
			}
		}
		return Array.from(keywordMap.entries()).map(([keyword, info]) => ({
			keyword,
			usage: info.usage,
			related: Array.from(info.related).join(", "),
		}));
	}

	const tableData = $derived({
		videos: videos.map((video) => {
			const iso = video.timestamp ?? video.uploadDate ?? null;
			const uploadedLabel = iso
				? formatDate(iso)
				: (video.uploadedAt ?? "—");
			return {
				id: video.id,
				title: video.title,
				author: video.author,
				duration: video.duration ?? "0:00",
				durationValue: video.duration,
				uploaded: uploadedLabel,
				uploadedValue: iso ? Date.parse(iso) : Number.NEGATIVE_INFINITY,
				views: formatViews(video.views),
				viewsValue:
					typeof video.views === "number" ? video.views : null,
				original: video,
			};
		}),
		sounds: soundLibrary.map((clip) => ({
			id: clip.id,
			title: clip.title,
			location: clip.location,
			recordist: clip.recordist,
			project: clip.relatedProject,
			captured: formatDate(clip.capturedOn),
			capturedValue: Date.parse(clip.capturedOn),
			duration: clip.duration,
			durationValue: clip.duration,
		})),
		members: users.map((user) => ({
			id: user.id,
			name: user.name,
			videos: user.stats?.videos ?? 0,
			followers: user.stats?.followers ?? 0,
			following: user.stats?.following ?? 0,
			joined: user.joinedAt ? formatDate(user.joinedAt) : "—",
			joinedValue: user.joinedAt
				? Date.parse(user.joinedAt)
				: Number.NEGATIVE_INFINITY,
		})),
		keywords: getKeywordsSummary(),
	});

	const totalRuntimeSeconds = $derived(
		tableData.videos.reduce(
			(total, video) =>
				total +
				(typeof video.durationValue === "number"
					? video.durationValue
					: 0),
			0,
		),
	);
	const uniqueContributors = $derived(
		new Set(
			tableData.videos
				.map((video) => video.author)
				.filter((author) => Boolean(author)),
		).size,
	);
	const lastUploadedTimestamp = $derived(
		tableData.videos.reduce((latest, video) => {
			if (Number.isFinite(video.uploadedValue)) {
				return Math.max(latest, video.uploadedValue);
			}
			return latest;
		}, Number.NEGATIVE_INFINITY),
	);

	const lastUpdated = $derived(
		lastUploadedTimestamp !== Number.NEGATIVE_INFINITY
			? formatDate(new Date(lastUploadedTimestamp).toISOString())
			: "—",
	);
	const averageDurationLabel = $derived(() => {
		if (tableData.videos.length === 0) return "0m";
		const averageSeconds = Math.round(
			totalRuntimeSeconds / tableData.videos.length,
		);
		return formatRuntime(averageSeconds);
	});

	const latestLocations = $derived(
		((): LatestLocationPin[] => {
			const pins: LatestLocationPin[] = [];
			for (const video of videos) {
				const locations = video.locations ?? [];
				if (!Array.isArray(locations) || locations.length === 0) continue;
				const timestampValue = getVideoTimestampValue(video);
				const isoCandidate =
					typeof (video.timestamp ?? video.uploadDate) === "string"
						? (video.timestamp ?? video.uploadDate)
						: null;
				const uploadedLabel =
					isoCandidate && !Number.isNaN(Date.parse(isoCandidate))
						? formatDate(isoCandidate)
						: typeof video.uploadedAt === "string"
							? video.uploadedAt
							: "—";
				locations.forEach((location, index) => {
					const coords = getLocationCoordinates(location);
					if (!coords) return;
					pins.push({
						id: `${video.id}-${index}`,
						videoId: video.id,
						videoTitle: video.title,
						videoAuthor: video.author,
						uploadedLabel,
						timestampValue,
						lat: coords.lat,
						lon: coords.lon,
						setting: location.setting ?? location.name,
						thumbnailUrl: video.thumbnailUrl,
					});
				});
			}
			return pins
				.sort((a, b) => b.timestampValue - a.timestampValue)
				.slice(0, 6);
		})(),
	);

	const locationCenter = $derived(
		((): LocationCenter => {
			if (latestLocations.length === 0) {
				return { lat: 20, lon: 0, zoom: 1.6 };
			}
			const totals = latestLocations.reduce(
				(acc, loc) => {
					acc.lat += loc.lat;
					acc.lon += loc.lon;
					return acc;
				},
				{ lat: 0, lon: 0 },
			);
			const lat = totals.lat / latestLocations.length;
			const lon = totals.lon / latestLocations.length;
			const zoom =
				latestLocations.length === 1
					? 5.5
					: latestLocations.length <= 3
						? 3.2
						: 2.4;
			return { lat, lon, zoom };
		})(),
	);

	const heroMetrics = $derived([
		{
			label: "VIDEOS",
			value: tableData.videos.length.toString().padStart(2, "0"),
		},
		{
			label: "CURATORS",
			value: uniqueContributors.toString().padStart(2, "0"),
		},
		{ label: "RUNTIME", value: formatRuntime(totalRuntimeSeconds) },
		{ label: "LAST UPDATE", value: lastUpdated },
	]);

	const totalLikes = $derived(
		tableData.videos.reduce(
			(sum, video) => sum + (video.original.likes ?? 0),
			0,
		),
	);

	const profileStats = $derived({
		videos: tableData.videos.length,
		sounds: tableData.sounds.length,
		duration: formatRuntime(totalRuntimeSeconds),
		likes: totalLikes,
	});

	function getSortValue(
		row: any,
		tableKey: TableKey,
		key: string,
	): string | number {
		if (tableKey === "videos") {
			switch (key) {
				case "title":
					return row.title;
				case "author":
					return row.author;
				case "duration":
					return row.durationValue;
				case "uploaded":
					return row.uploadedValue;
				case "views":
					return row.viewsValue ?? -1;
				default:
					return "";
			}
		}
		if (tableKey === "sounds") {
			switch (key) {
				case "title":
					return row.title;
				case "recordist":
					return row.recordist;
				case "project":
					return row.project;
				case "captured":
					return row.capturedValue;
				case "duration":
					return row.durationValue;
				default:
					return "";
			}
		}
		if (tableKey === "members") {
			switch (key) {
				case "name":
					return row.name;
				case "videos":
					return row.videos;
				case "followers":
					return row.followers;
				case "following":
					return row.following;
				case "joined":
					return row.joinedValue;
				default:
					return "";
			}
		}
		if (tableKey === "keywords") {
			switch (key) {
				case "keyword":
					return row.keyword;
				case "usage":
					return row.usage;
				case "related":
					return row.related;
				default:
					return "";
			}
		}
		return "";
	}

	function sortRows(tableKey: TableKey) {
		const state = tableState[tableKey];
		if (!state) return [];
		const rows = [...(tableData[tableKey] as any[])];
		const direction = state.sortDirection === "asc" ? 1 : -1;

		return rows.sort((a, b) => {
			const aValue = getSortValue(a, tableKey, state.sortKey);
			const bValue = getSortValue(b, tableKey, state.sortKey);
			if (typeof aValue === "number" && typeof bValue === "number") {
				return (aValue - bValue) * direction;
			}
			const aStr = `${aValue ?? ""}`.toLowerCase();
			const bStr = `${bValue ?? ""}`.toLowerCase();
			return (
				aStr.localeCompare(bStr, undefined, {
					numeric: true,
					sensitivity: "base",
				}) * direction
			);
		});
	}

	function toggleSort(tableKey: TableKey, columnKey: string) {
		const current = tableState[tableKey];
		if (!current) return;
		if (current.sortKey === columnKey) {
			current.sortDirection =
				current.sortDirection === "asc" ? "desc" : "asc";
		} else {
			current.sortKey = columnKey;
			current.sortDirection = "asc";
		}
	}

	function openVideo(video: any, event?: MouseEvent) {
		if (event) {
			if (
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.button !== 0
			)
				return;
			event.preventDefault();
		}
		selectedVideo.selectVideo(video.id);
		actions.setExpanded(false);
		goto("/");
	}

	function handleVideoRowKey(event: KeyboardEvent, video: any) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			openVideo(video);
		}
	}

	const sortedVideoRows = $derived(sortRows("videos"));
	const sortedSoundRows = $derived(sortRows("sounds"));
	const sortedMemberRows = $derived(sortRows("members"));
	const sortedKeywordRows = $derived(sortRows("keywords"));
</script>

<svelte:head>
	<title>Media Dashboard — Rushes</title>
	<meta
		name="description"
		content="Terminal overview of the Rushes archive."
	/>
</svelte:head>

<div
	class="h-screen overflow-x-hidden overflow-y-scroll bg-[#05060c] font-sans text-[12px] text-slate-200"
>
	<div class="mx-auto w-full max-w-7xl space-y-12 px-6 py-12 lg:px-12">
		<header
			class="relative overflow-hidden border border-white/10 bg-white/[0.04] px-6 py-8 shadow-[0_32px_120px_-45px_rgba(15,23,42,0.9)] sm:px-8 sm:py-10"
		>
			<div
				class="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl"
			></div>
			<div
				class="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-purple-500/10 blur-2xl"
			></div>
			<div
				class="relative flex min-w-0 flex-col gap-8 md:flex-row md:items-end md:justify-between"
			>
				<div class="min-w-0 space-y-3">
					<p
						class="text-[11px] uppercase tracking-[0.35em] text-slate-500"
					>
						Rushes.fm
					</p>
					<!-- <h1 class="text-2xl font-semibold text-white">
						Channel Overview
					</h1> -->
					<p class="max-w-xl text-sm leading-relaxed text-slate-300">
						RUSHES.BE est une plateforme collective dédiée aux cinéastes bruxellois. Elle cartographie les rushes — images non montées, fragments de tournage — pour nourrir une archive vivante, un espace de rencontre et un laboratoire d’expérimentation visuelle.

					</p>
				</div>
				<div class="grid min-w-0 gap-4 sm:grid-cols-2 md:grid-cols-5">
					{#each heroMetrics as metric (metric.label)}
						<div
							class="border-l border-white/10 bg-black/30 px-4 py-3 text-left shadow-inner"
						>
							<p
								class="text-[10px] uppercase tracking-[0.3em] text-slate-500"
							>
								{metric.label}
							</p>
							<p class="mt-2 text-lg font-semibold text-white">
								{metric.value}
							</p>
						</div>
					{/each}
				</div>
			</div>
		</header>

		<div class="grid gap-8 lg:grid-cols-2">
			<div
				class="column-container space-y-8"
				aria-label="Primary dashboard column"
				use:dndzone={{
					items: itemsLeft,
					type: boardDndType,
					dropTargetClasses: boardDropTargetClasses,
					flipDurationMs: boardFlipDurationMs,
				}}
				onconsider={updateLeftColumn}
				onfinalize={updateLeftColumn}
			>
				{#each itemsLeft as item (item.id + (item[SHADOW_ITEM_MARKER_PROPERTY_NAME] ? "-shadow" : ""))}
					{@const isShadow = Boolean(
						item[SHADOW_ITEM_MARKER_PROPERTY_NAME],
					)}
					<div
						class="draggable-item"
						data-is-dnd-shadow-item-hint={isShadow
							? "true"
							: undefined}
						aria-label={isShadow
							? undefined
							: getSectionLabel(item)}
					>
						<DashboardPanel
							{item}
							{collapsed}
							{toggleCollapse}
							{tableState}
							{sortedVideoRows}
							{sortedSoundRows}
							{sortedMemberRows}
							{sortedKeywordRows}
							{toggleSort}
							{openVideo}
							{handleVideoRowKey}
							{liveActivity}
							{formatStat}
							{latestLocations}
							{locationCenter}
							{profileStats}
						/>
					</div>
				{/each}
			</div>

			<div
				class="column-container space-y-8"
				aria-label="Secondary dashboard column"
				use:dndzone={{
					items: itemsRight,
					type: boardDndType,
					dropTargetClasses: boardDropTargetClasses,
					flipDurationMs: boardFlipDurationMs,
				}}
				onconsider={updateRightColumn}
				onfinalize={updateRightColumn}
			>
				{#each itemsRight as item (item.id + (item[SHADOW_ITEM_MARKER_PROPERTY_NAME] ? "-shadow" : ""))}
					{@const isShadow = Boolean(
						item[SHADOW_ITEM_MARKER_PROPERTY_NAME],
					)}
					<div
						class="draggable-item"
						data-is-dnd-shadow-item-hint={isShadow
							? "true"
							: undefined}
						aria-label={isShadow
							? undefined
							: getSectionLabel(item)}
					>
						<DashboardPanel
							{item}
							{collapsed}
							{toggleCollapse}
							{tableState}
							{sortedVideoRows}
							{sortedSoundRows}
							{sortedMemberRows}
							{sortedKeywordRows}
							{toggleSort}
							{openVideo}
							{handleVideoRowKey}
							{liveActivity}
							{formatStat}
							{latestLocations}
							{locationCenter}
							{profileStats}
						/>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.column-container {
		transition:
			background-color 0.2s ease,
			border-color 0.2s ease;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		min-height: min-content;
	}
	:global(.dashboard-drop-target) {
		background-color: rgba(56, 189, 248, 0.05);
		border-color: rgba(56, 189, 248, 0.2);
	}
	.draggable-item[data-is-dnd-shadow-item-hint="true"] {
		opacity: 0.65;
	}
</style>
