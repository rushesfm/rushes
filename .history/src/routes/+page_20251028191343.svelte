<script lang="ts">
	import { actions } from "$lib/stores/appStore";
	import { selectedVideo } from "$lib/stores/selectedVideo";
	import { videosStore } from "$lib/stores/library";
	import type { Video } from "$lib/types/content";

	interface SoundClip {
		id: string;
		title: string;
		recordist: string;
		duration: string;
		capturedOn: string;
		location: string;
		relatedProject: string;
	}

	interface HeroMetric {
		label: string;
		value: string;
	}

	interface LatestVideoItem {
		id: string;
		title: string;
		author: string;
		date: string;
		timestampValue: number;
		location: string;
		thumbnailUrl: string;
	}

	interface LatestSoundItem {
		id: string;
		title: string;
		author: string;
		date: string;
		location: string;
		capturedValue: number;
	}

	const FALLBACK_THUMBNAIL = "https://placehold.co/200x112?text=Rushes";

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

	let videos: Video[] = [];
	$: videos = $videosStore ?? [];

	let totalRuntimeSeconds = 0;
	let uniqueContributors = 0;
	let lastUploadedTimestamp = Number.NEGATIVE_INFINITY;
	let lastUpdated = "—";
	let heroMetrics: HeroMetric[] = [];
	let latestVideos: LatestVideoItem[] = [];
	let latestSounds: LatestSoundItem[] = [];

	function formatDate(iso?: string | null) {
		if (!iso) return "—";
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return iso;
		const day = String(date.getDate()).padStart(2, '0');
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const year = String(date.getFullYear()).slice(-2);
		return `${day}/${month}/${year}`;
	}

	function parseDuration(value?: string | null) {
		if (!value) return 0;
		const parts = value.split(":").map((n) => Number.parseInt(n, 10));
		if (parts.some((n) => Number.isNaN(n))) return 0;
		if (parts.length === 3) {
			const [hours, minutes, seconds] = parts;
			return hours * 3600 + minutes * 60 + seconds;
		}
		if (parts.length === 2) {
			const [minutes, seconds] = parts;
			return minutes * 60 + seconds;
		}
		return parts[0];
	}

	function coerceDurationSeconds(value?: number | string | null) {
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string") return parseDuration(value);
		return 0;
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
		const candidate = video?.timestamp ?? video?.uploadDate ?? video?.uploadedAt ?? null;
		if (typeof candidate === "string") {
			const parsed = Date.parse(candidate);
			if (!Number.isNaN(parsed)) {
				return parsed;
			}
		}
		return Number.NEGATIVE_INFINITY;
	}

	function getPrimaryLocation(video: any) {
		const locations = video?.locations;
		if (Array.isArray(locations) && locations.length > 0) {
			const first = locations[0];
			const label =
				first?.setting ?? first?.name ?? first?.environment ?? first?.city ?? first?.country;
			if (label) return label;
		}
		if (typeof video?.location === "string" && video.location.trim().length > 0) {
			return video.location;
		}
		return "Unspecified location";
	}

	$: totalRuntimeSeconds = videos.reduce(
		(total, video) => total + coerceDurationSeconds(video.duration),
		0,
	);

	$: uniqueContributors = new Set(
		videos
			.map((video) => video.author)
			.filter((author) => Boolean(author)),
	).size;

	$: lastUploadedTimestamp = videos.reduce((latest, video) => {
		const timestampValue = getVideoTimestampValue(video);
		return timestampValue > latest ? timestampValue : latest;
	}, Number.NEGATIVE_INFINITY);

	$: lastUpdated =
		lastUploadedTimestamp !== Number.NEGATIVE_INFINITY
			? formatDate(new Date(lastUploadedTimestamp).toISOString())
			: "—";

	$: heroMetrics = [
		{ label: "VIDEOS", value: videos.length.toString().padStart(2, "0") },
		{ label: "CURATORS", value: uniqueContributors.toString().padStart(2, "0") },
		{ label: "RUNTIME", value: formatRuntime(totalRuntimeSeconds) },
		{ label: "LAST UPDATE", value: lastUpdated },
	];

	$: latestVideos = videos
		.map((video) => {
			const timestampValue = getVideoTimestampValue(video);
			const iso = video?.timestamp ?? video?.uploadDate ?? video?.uploadedAt ?? null;
			return {
				id: video.id,
				title: video.title ?? "Untitled",
				author: video.author ?? "Unknown author",
				date: iso ? formatDate(iso) : "—",
				timestampValue,
				location: getPrimaryLocation(video),
				thumbnailUrl: video.thumbnailUrl ?? FALLBACK_THUMBNAIL,
			};
		})
		.sort((a, b) => b.timestampValue - a.timestampValue)
		.slice(0, 6);

	$: latestSounds = soundLibrary
		.map((clip) => ({
			id: clip.id,
			title: clip.title,
			author: clip.recordist,
			date: formatDate(clip.capturedOn),
			location: clip.location,
			capturedValue: Date.parse(clip.capturedOn),
		}))
		.sort((a, b) => (b.capturedValue || 0) - (a.capturedValue || 0))
		.slice(0, 6);

	function openVideoById(id: string) {
		if (!id) return;
		selectedVideo.selectVideo(id);
		actions.setExpanded(false);
	}
</script>

<svelte:head>
	<title>Media Dashboard — Rushes</title>
	<meta name="description" content="Terminal overview of the Rushes archive." />
</svelte:head>

<div class="h-screen overflow-x-hidden overflow-y-scroll bg-[#05060c] font-sans text-[12px] text-slate-200">
	<div class="mx-auto w-full max-w-7xl space-y-12 px-6 py-12 lg:px-12">
		<header
			class="relative overflow-hidden border border-white/10 bg-white/[0.04] px-6 py-8 shadow-[0_32px_120px_-45px_rgba(15,23,42,0.9)] sm:px-8 sm:py-10"
		>
			<!-- <div class="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl"></div>
			<div class="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-purple-500/10 blur-2xl"></div> -->
			<div class="relative flex min-w-0 flex-col gap-8 md:flex-row md:items-center md:justify-between">
				<div class="min-w-0 ">
					<p class="max-w-xl text-sm leading-relaxed text-slate-300">
						<b>RUSHES</b> est une plateforme collective dédiée aux cinéastes bruxellois. Elle cartographie les rushes — images
						non montées, fragments de tournage — pour nourrir une archive vivante, un espace de rencontre et un laboratoire
						d’expérimentation visuelle.
					</p>
				</div>
				<div class="grid min-w-0 gap-4 sm:grid-cols-2 md:grid-cols-5">
					{#each heroMetrics as metric (metric.label)}
						<div class="border-l border-white/10 bg-black/30 px-4 py-3 text-left shadow-inner">
							<p class="text-[10px] uppercase tracking-[0.3em] text-slate-500">{metric.label}</p>
							<p class="mt-2 text-lg font-semibold text-white">{metric.value}</p>
						</div>
					{/each}
				</div>
			</div>
		</header>

		<section class="grid gap-10 lg:grid-cols-2 lg:gap-0">
			<article class="space-y-4 lg:pr-8">
				<header class="flex items-center justify-between">
					<h2 class="flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-slate-300">
			

						<!-- <svg class="h-4 w-4 text-slate-200/90" fill="none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"> <path d="M4 3H2v18h20V3H4zm16 2v14H4V5h16zm-6 4h-2v2h-2v2H8v2H6v2h2v-2h2v-2h2v-2h2v2h2v2h2v-2h-2v-2h-2V9zM8 7H6v2h2V7z" fill="currentColor"/> </svg> -->
						Latest Videos
					</h2>
				</header>

				{#if latestVideos.length > 0}
					<ul class="space-y-4">
						{#each latestVideos as video (video.id)}
							<li
								class="group flex items-center gap-4 border-b pb-3 border-white/10 "
							>
								<img
									src={video.thumbnailUrl}
									alt={`Thumbnail for ${video.title}`}
									class="h-10 w-10 flex-shrink-0 overflow-hidden border border-white/10 object-cover"
									loading="lazy"
									onerror={(event) => ((event.currentTarget as HTMLImageElement).src = FALLBACK_THUMBNAIL)}
								/>
								<div class="flex flex-1 flex-col gap-1">
									<div class="flex items-center">
								
										<p class="truncate text-sm font-semibold text-white">
											{video.title}
										</p>
									</div>
									<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.25em] text-slate-400">
										<span class="truncate text-slate-300/90 normal-case tracking-normal">{video.author}</span>
										<span aria-hidden="true" class="text-slate-500">
											•
										</span>
										<span class="text-slate-400 normal-case tracking-normal">{video.date}</span>
										<span aria-hidden="true" class="text-slate-500">
											•
										</span>
										<span class="truncate text-slate-400 normal-case tracking-normal">{video.location}</span>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="rounded-lg border border-white/5 bg-black/20 p-6 text-center text-sm text-slate-400">
						No videos available yet.
					</p>
				{/if}
			</article>

			<article class="space-y-4 lg:pl-8">
				<header class="flex items-center justify-between">
					<h2 class="flex items-center gap-3 text-[11px] uppercase tracking-[0.35em] text-slate-300">
						<!-- <svg
							class="h-4 w-4 text-orange"
							aria-hidden="true"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
						>
							<path
								fill="currentColor"
								d="M11 2h2v20h-2v-2H9v-2h2V6H9V4h2zM7 8V6h2v2zm0 8H3V8h4v2H5v4h2zm0 0v2h2v-2zm10-6h-2v4h2zm2-2h2v8h-2zm0 8v2h-4v-2zm0-10v2h-4V6z"
							/>
						</svg> -->
						Latest Sounds
					</h2>
				</header>

				<div class="lg:-ml-8 lg:mt-2 lg:border-l lg:border-[rgba(255,255,255,0.05)] lg:pl-8">
					<ul class="space-y-3">
						{#each latestSounds as sound (sound.id)}
							<li class="group flex items-center">
								<div class="flex flex-1 flex-col gap-2 border-b border-white/10 pb-4">
									<div class="flex items-center gap-3">
										<button
											type="button"
											class="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:border-sky-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
											aria-label={`Play ${sound.title}`}
										>
											<svg class="h-3 w-3" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
												<path d="M2 1.5v11l9-5.5-9-5.5z" />
											</svg>
										</button>
										<div class="flex flex-col">
											<p class="mb-1 truncate text-sm font-semibold text-white">
												{sound.title}
											</p>
											<div class="flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] uppercase tracking-[0.25em] text-slate-400">
												<span class="truncate text-slate-300/90 normal-case tracking-normal">{sound.author}</span>
												<span aria-hidden="true" class="text-slate-500">
													•
												</span>
												<span class="text-slate-400 normal-case tracking-normal">{sound.date}</span>
												<span aria-hidden="true" class="text-slate-500">
													•
												</span>
												<span class="truncate text-slate-400 normal-case tracking-normal">{sound.location}</span>
											</div>
										</div>
									</div>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			</article>
		</section>
	</div>
</div>
