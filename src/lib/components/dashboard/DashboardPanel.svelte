<script lang="ts">
	import { slide } from 'svelte/transition';
	import { SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
	import { selectedVideo } from '$lib/stores/selectedVideo';
	import Map from '$lib/components/Map.svelte';
	import { authStore } from '$lib/stores/auth';
	import type {
		DashboardComponentKey,
		DashboardItem,
		LatestLocationPin,
		LocationCenter,
		TableKey,
		TableState
	} from '$lib/types/dashboard';

	interface ProfileMetrics {
		videos: number;
		sounds: number;
		duration: string;
		likes: number;
	}

	interface ActivityItem {
		id: string;
		user: string;
		action: string;
		content: string;
		type: 'like' | 'comment' | string;
		time: string;
	}

	const {
		item,
		collapsed,
		toggleCollapse,
		tableState,
		sortedVideoRows,
		sortedSoundRows,
		sortedMemberRows,
		sortedKeywordRows,
		toggleSort,
		openVideo,
		handleVideoRowKey,
		liveActivity,
		formatStat,
		latestLocations,
		locationCenter,
		profileStats
	} = $props<{
		item: DashboardItem;
		collapsed: Record<DashboardComponentKey, boolean>;
		toggleCollapse: (component: DashboardComponentKey) => void;
		tableState: Record<TableKey, TableState>;
		sortedVideoRows: any[];
		sortedSoundRows: any[];
		sortedMemberRows: any[];
		sortedKeywordRows: any[];
		toggleSort: (table: TableKey, columnKey: string) => void;
		openVideo: (video: any, event?: MouseEvent) => void;
		handleVideoRowKey: (event: KeyboardEvent, video: any) => void;
		liveActivity: ActivityItem[];
		formatStat: (num: number) => string;
		latestLocations: LatestLocationPin[];
		locationCenter: LocationCenter;
		profileStats: ProfileMetrics;
	}>();

	const isShadow = $derived(Boolean(item[SHADOW_ITEM_MARKER_PROPERTY_NAME]));

const mapPins = $derived(
	(() =>
		latestLocations.map((loc: LatestLocationPin) => ({
			mapLat: loc.lat,
			mapLon: loc.lon,
			setting: loc.setting,
			name: loc.setting,
			videoTitle: loc.videoTitle,
			videoAuthor: loc.videoAuthor
		}))
	)()
);

	const auth = $derived($authStore);

	function createUserId() {
		if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
			return crypto.randomUUID();
		}
		return `user-${Math.random().toString(36).slice(2, 10)}`;
	}

	function resolveAvatar(email: string, avatarUrl?: string) {
		if (avatarUrl) return avatarUrl;
		return `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`;
	}

	let displayName = $state('');
	let email = $state('');
	let isSubmitting = $state(false);
	let errorMessage = $state<string | null>(null);

	const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const MAX_NAME_LENGTH = 100;
	const MAX_EMAIL_LENGTH = 254; // RFC 5321

	function handleAuthSubmit(event: Event) {
		event.preventDefault();
		const nameValue = displayName.trim();
		const emailValue = email.trim().toLowerCase();
		errorMessage = null;

		// Validate name
		if (!nameValue) {
			errorMessage = 'Please enter your name.';
			return;
		}

		if (nameValue.length > MAX_NAME_LENGTH) {
			errorMessage = `Name must be ${MAX_NAME_LENGTH} characters or less.`;
			return;
		}

		// Validate email
		if (!emailValue) {
			errorMessage = 'Please enter your email address.';
			return;
		}

		if (emailValue.length > MAX_EMAIL_LENGTH) {
			errorMessage = 'Email address is too long.';
			return;
		}

		if (!EMAIL_REGEX.test(emailValue)) {
			errorMessage = 'Please enter a valid email address.';
			return;
		}

		isSubmitting = true;
		try {
			authStore.login({
				id: createUserId(),
				name: nameValue,
				email: emailValue,
				avatarUrl: resolveAvatar(emailValue)
			});
			displayName = '';
			email = '';
		} finally {
			isSubmitting = false;
		}
	}

	function handleLogout() {
		authStore.logout();
	}
</script>

{#if isShadow}
	<div class="panel-placeholder" />
{:else if item.component === 'videos'}
	<section class="min-w-0 border border-white/10 bg-white/[0.04] p-6">
		<header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-4">
				<button class="cursor-grab" aria-label="Drag panel">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" class="text-slate-500">
						<path d="M6 4h1v1H6V4zm3 0h1v1H9V4zM6 7h1v1H6V7zm3 0h1v1H9V7zm-3 3h1v1H6v-1zm3 3h1v1H9v-1zm0-3h1v1H9v-1z" fill="currentColor"></path>
					</svg>
				</button>
				<div>
					<p class="text-[10px] uppercase tracking-[0.35em] text-slate-500">{$selectedVideo.id ? 'Next in Queue' : 'Suggested Rushes'}</p>
				</div>
			</div>
			<div class="flex items-center gap-4">
				<span class="text-[11px] text-slate-500">SORT {tableState.videos.sortKey.toUpperCase()} [{tableState.videos.sortDirection.toUpperCase()}]</span>
				<button onclick={() => toggleCollapse('videos')}>{collapsed.videos ? '+' : '-'}</button>
			</div>
		</header>
		{#if !collapsed.videos}
			<div transition:slide>
				{#if sortedVideoRows.length === 0}
					<p class="mt-6 text-[11px] text-slate-500">The queue is clear—add new rushes to keep production moving.</p>
				{:else}
					{@const next = sortedVideoRows[0]}
					<div class="mt-6 min-w-0 rounded-2xl overflow-hidden border border-white/10 bg-black/30">
						<div class="flex w-full flex-col gap-5 ">
							<img
								src={next.original.thumbnailUrl ?? 'https://placehold.co/640x360?text=Rushes'}
								alt={next.title}
								class="h-30 w-full object-cover transition duration-300 group-hover:scale-105"
								loading="lazy"
							/>
							<div class="flex min-w-0 flex-1 flex-col justify-between pb-4 px-4">
								<h3 class=" text-lg font-medium text-white">{next.title}</h3>

								<div class="grid min-w-0 mt-0 gap-2 text-[11px] text-slate-300 sm:grid-cols-2">
									<span class="flex items-center gap-2"><span class="h-1.5 w-1.5 rounded-full bg-sky-400"></span> By {next.author}</span>
									<span>{next.uploaded}</span>
								</div>
							</div>
						</div>
					</div>
					<div class="mt-6 min-w-0 space-y-4">
						<div class="grid min-w-0 gap-3 sm:grid-cols-2">
							{#each sortedVideoRows.slice(1, 5) as row, index (row.id)}
									<button
										type="button"
										class="group flex min-w-0 items-center gap-4 rounded-lg overflow-hidden border border-white/5 bg-white/[0.06] text-left transition hover:border-white/15 hover:bg-white/[0.1]"
										onclick={(event) => openVideo(row.original, event)}
										onkeydown={(event) => handleVideoRowKey(event, row.original)}
									>
								<div class="flex flex-col items-center">
										<img
											src={row.original.thumbnailUrl ?? 'https://placehold.co/160x90?text=Rushes'}
											alt={row.title}
											class="h-20 w-full object-cover transition duration-300 group-hover:scale-105"
											loading="lazy"
										/>
										
									<div class="flex flex-col w-full p-3">
										<p class="text-sm font-medium m-0 text-white">{row.title}</p>
										<div class="flex flex-col text-[11px] text-slate-400">
											<span>{row.author}</span>
										</div>
									</div>
									</div>

								</button>
							{/each}
						</div>
						{#if sortedVideoRows.length <= 1}<p class="text-[11px] text-slate-500">No additional items in the queue.</p>{/if}
					</div>
				{/if}
			</div>
		{/if}
	</section>
{:else if item.component === 'profile'}
	<section class="min-w-0  border border-white/10 bg-white/[0.06] p-6 shadow-[0_24px_80px_-48px_rgba(8,47,73,0.85)] backdrop-blur-md">
		{#if auth.user}
			<div class="space-y-6">
				<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-center gap-4">
						<img
							src={resolveAvatar(auth.user.email, auth.user.avatarUrl)}
							alt="User avatar"
							class="h-16 w-16 rounded-full border-2 border-white/20 object-cover shadow-[0_12px_32px_-18px_rgba(56,189,248,0.65)]"
						/>
						<div>
							<h3 class="text-lg font-semibold text-white">Welcome back, {auth.user.name}</h3>
							<p class="text-sm text-slate-400">{auth.user.email}</p>
						</div>
					</div>
					<button
						class="rounded-full border border-white/15 bg-white/[0.08] px-5 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-200 transition hover:border-white/30 hover:bg-white/[0.14] hover:text-white"
						type="button"
						onclick={handleLogout}
					>
						Sign out
					</button>
				</div>

				<div class="grid grid-cols-2 gap-4">
					{#each [
						{ label: 'VIDEOS', value: formatStat(profileStats.videos) },
						{ label: 'SOUNDS', value: formatStat(profileStats.sounds) },
						{ label: 'TOTAL DURATION', value: profileStats.duration },
						{ label: 'LIKES', value: formatStat(profileStats.likes) }
					] as metric (metric.label)}
						<div class="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left shadow-[0_12px_48px_-36px_rgba(56,189,248,0.45)]">
							<p class="text-[10px] uppercase tracking-[0.3em] text-slate-400">{metric.label}</p>
							<p class="mt-2 text-lg font-semibold text-white">{metric.value}</p>
						</div>
					{/each}
				</div>

				<p class="text-[11px] uppercase tracking-[0.3em] text-slate-500">Account controls coming soon.</p>
			</div>
		{:else}
			<div class="space-y-6">
				<div>
					<h3 class="text-lg font-semibold text-white">Join Rushes</h3>
					<p class="mt-1 text-sm text-slate-400">Create an account to sync playlists, follow curators, and save notes.</p>
				</div>
		<form
			class="space-y-4"
			onsubmit={(event) => {
				event.preventDefault();
				handleAuthSubmit(event);
			}}
		>
					<div class="space-y-2">
						<label class="text-[10px] uppercase tracking-[0.3em] text-slate-500" for="dashboard-name">Name</label>
						<input
							id="dashboard-name"
							name="name"
							type="text"
							bind:value={displayName}
							placeholder="Alex Rivera"
							class="w-full rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-transparent"
						/>
					</div>
					<div class="space-y-2">
						<label class="text-[10px] uppercase tracking-[0.3em] text-slate-500" for="dashboard-email">Email</label>
						<input
							id="dashboard-email"
							name="email"
							type="email"
							bind:value={email}
							placeholder="alex@rushes.fm"
							class="w-full rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-transparent"
						/>
					</div>
					{#if errorMessage}
						<p class="text-xs text-rose-400">{errorMessage}</p>
					{/if}
					<button
						type="submit"
						class="w-full rounded-full bg-gradient-to-r from-sky-500 to-purple-500 px-5 py-2 text-[11px] uppercase tracking-[0.35em] text-white shadow-[0_18px_48px_-24px_rgba(56,189,248,0.8)] transition hover:opacity-90 disabled:opacity-50"
						disabled={isSubmitting}
					>
						{isSubmitting ? "Creating account…" : "Create account"}
					</button>
				</form>
				<p class="text-xs text-slate-500">
					We’ll remember your session in this workspace. No actual emails are sent—this is a mock authentication flow.
				</p>
			</div>
		{/if}
	</section>
{:else if item.component === 'activity'}
	<section class="min-w-0 border border-white/10 bg-white/[0.04] p-6">
		<header class="flex items-center justify-between">
			<div class="flex items-center gap-4">
		<button class="cursor-grab" aria-label="Drag panel">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" class="text-slate-500">
						<path d="M6 4h1v1H6V4zm3 0h1v1H9V4zM6 7h1v1H6V7zm3 0h1v1H9V7zm-3 3h1v1H6v-1zm3 3h1v1H9v-1zm0-3h1v1H9v-1z" fill="currentColor"></path>
					</svg>
				</button>
				<p class="text-[10px] uppercase tracking-[0.35em] text-slate-500">Live Activity</p>
			</div>
			<button onclick={() => toggleCollapse('activity')}>{collapsed.activity ? '+' : '-'}</button>
		</header>
		{#if !collapsed.activity}
			<div class="mt-4 space-y-3" transition:slide>
				{#each liveActivity as event (event.id)}
					<div class="flex items-center gap-4 rounded-xl bg-black/20 p-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-white/5">
							{#if event.type === 'like'}
								<svg class="h-4 w-4 text-pink-400" viewBox="0 0 20 20" fill="currentColor">
									<path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9 22.045 22.045 0 01-2.582-1.9A20.759 20.759 0 013 12.311l-.01-.019a1.002 1.002 0 010-1.415l.006-.006a1 1 0 011.414 0l.006.006a6.67 6.67 0 001.036.634 8.67 8.67 0 005.188 0 6.67 6.67 0 001.036-.634l.006-.006a1 1 0 011.414 0l.006.006a1.002 1.002 0 010 1.415l-.01.019a20.759 20.759 0 01-1.162.682 22.045 22.045 0 01-2.582 1.9 22.045 22.045 0 01-2.582 1.9 20.759 20.759 0 01-1.162.682zM10 11.973a8.67 8.67 0 00-5.188 0 6.67 6.67 0 00-1.036.634l-.006.006a1 1 0 01-1.414 0l-.006-.006a1.002 1.002 0 010-1.415l.01-.019a20.759 20.759 0 011.162-.682 22.045 22.045 0 012.582-1.9 22.045 22.045 0 012.582-1.9A20.759 20.759 0 0110 3.689a1 1 0 011.415 0l.01.01a20.759 20.759 0 011.162.682 22.045 22.045 0 012.582 1.9 22.045 22.045 0 012.582 1.9 20.759 20.759 0 011.162.682l.01.019a1.002 1.002 0 010 1.415l-.006.006a1 1 0 01-1.414 0l-.006-.006a6.67 6.67 0 00-1.036-.634 8.67 8.67 0 00-5.188 0z" />
								</svg>
							{:else}
								<svg class="h-4 w-4 text-sky-400" viewBox="0 0 20 20" fill="currentColor">
									<path fill-rule="evenodd" d="M10 2c-4.418 0-8 3.134-8 7 0 2.033.944 3.863 2.451 5.116a.75.75 0 00.916-1.185A6.47 6.47 0 014.5 9c0-2.899 2.529-5.25 5.5-5.25s5.5 2.351 5.5 5.25c0 1.258-.468 2.404-1.255 3.284a.75.75 0 101.185.916A7.962 7.962 0 0018 9c0-3.866-3.582-7-8-7z" clip-rule="evenodd" />
									<path d="M12.249 14.126a.75.75 0 01.393.972l-1.5 3a.75.75 0 01-1.284-.64l1.5-3a.75.75 0 01.891-.332z" />
									<path d="M14 11.25a.75.75 0 01.75.75v2.5a.75.75 0 01-1.5 0v-2.5a.75.75 0 01.75-.75z" />
									<path d="M8.25 15.126a.75.75 0 01.891.332l1.5 3a.75.75 0 11-1.284.64l-1.5-3a.75.75 0 01.393-.972z" />
									<path d="M6.25 12a.75.75 0 011.5 0v2.5a.75.75 0 01-1.5 0v-2.5z" />
								</svg>
							{/if}
						</div>
						<div class="flex-1 text-xs">
							<p class="text-slate-300">
								<span class="font-semibold text-white">{event.user}</span> {event.action} <span class="font-semibold text-white">“{event.content}”</span>
							</p>
							<p class="text-slate-500">{event.time}</p>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>
{:else if item.component === 'sounds'}
	<section class="min-w-0 border border-white/10 bg-white/[0.04] p-6">
		<header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-4">
		<button class="cursor-grab" aria-label="Drag panel">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" class="text-slate-500">
						<path d="M6 4h1v1H6V4zm3 0h1v1H9V4zM6 7h1v1H6V7zm3 0h1v1H9V7zm-3 3h1v1H6v-1zm3 3h1v1H9v-1zm0-3h1v1H9v-1z" fill="currentColor"></path>
					</svg>
				</button>
				<div>
					<p class="text-[10px] uppercase tracking-[0.35em] text-slate-500">Latest Sounds</p>
				</div>
			</div>
			<div class="flex items-center gap-4">
				<span class="text-[11px] text-slate-500">SORT {tableState.sounds.sortKey.toUpperCase()} [{tableState.sounds.sortDirection.toUpperCase()}]</span>
				<button onclick={() => toggleCollapse('sounds')}>{collapsed.sounds ? '+' : '-'}</button>
			</div>
		</header>
		{#if !collapsed.sounds}
			<div class="mt-4 min-w-0 rounded-2xl border border-white/10 bg-black/20" transition:slide>
				<div class="min-w-0 overflow-x-auto rounded-2xl">
					<table class="min-w-full border-collapse text-left text-[12px] leading-snug">
						<thead class="bg-white/5 text-slate-500">
							<tr>
								{#each tableState.sounds.columns as column}
									<th scope="col" class={`px-4 py-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
										<button
											type="button"
											class="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-slate-500 transition hover:text-slate-200"
											onclick={() => toggleSort('sounds', column.key)}
										>
											<span>{column.label}</span>
											{#if tableState.sounds.sortKey === column.key}<span aria-hidden="true">{tableState.sounds.sortDirection === 'asc' ? '▲' : '▼'}</span>{/if}
										</button>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody class="bg-black/20">
							{#each sortedSoundRows as row, index (row.id)}
								<tr class={`${index % 2 === 0 ? 'bg-white/[0.04]' : ''}`}>
									{#each tableState.sounds.columns as column}
										<td class={`px-4 py-3 text-slate-200 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
											{#if column.key === 'title'}<span class="text-slate-100">{row.title}</span>
											{:else if column.key === 'recordist'}<span>{row.recordist}</span>
											{:else if column.key === 'captured'}<span>{row.captured}</span>
											{:else if column.key === 'duration'}<span>{row.duration}</span>{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</section>
{:else if item.component === 'members'}
	<section class="min-w-0 border border-white/10 bg-white/[0.04] p-6">
		<header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-4">
		<button class="cursor-grab" aria-label="Drag panel">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" class="text-slate-500">
						<path d="M6 4h1v1H6V4zm3 0h1v1H9V4zM6 7h1v1H6V7zm3 0h1v1H9V7zm-3 3h1v1H6v-1zm3 3h1v1H9v-1zm0-3h1v1H9v-1z" fill="currentColor"></path>
					</svg>
				</button>
				<div>
					<p class="text-[10px] uppercase tracking-[0.35em] text-slate-500">Members</p>
				</div>
			</div>
			<div class="flex items-center gap-4">
				<span class="text-[11px] text-slate-500">SORT {tableState.members.sortKey.toUpperCase()} [{tableState.members.sortDirection.toUpperCase()}]</span>
				<button onclick={() => toggleCollapse('members')}>{collapsed.members ? '+' : '-'}</button>
			</div>
		</header>
		{#if !collapsed.members}
			<div class="mt-4 min-w-0 rounded-2xl border border-white/10 bg-black/20" transition:slide>
				<div class="min-w-0 overflow-x-auto rounded-2xl">
					<table class="min-w-full border-collapse text-left text-[12px] leading-snug">
						<thead class="bg-white/5 text-slate-500">
							<tr>
								{#each tableState.members.columns as column}
									<th scope="col" class={`px-4 py-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
										<button
											type="button"
											class="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-slate-500 transition hover:text-slate-200"
											onclick={() => toggleSort('members', column.key)}
										>
											<span>{column.label}</span>
											{#if tableState.members.sortKey === column.key}<span aria-hidden="true">{tableState.members.sortDirection === 'asc' ? '▲' : '▼'}</span>{/if}
										</button>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody class="bg-black/20">
							{#each sortedMemberRows as row, index (row.id)}
								<tr class={`${index % 2 === 0 ? 'bg-white/[0.04]' : ''}`}>
									{#each tableState.members.columns as column}
										<td class={`px-4 py-3 text-slate-200 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
											{#if column.key === 'name'}<span class="text-slate-100">{row.name}</span>
											{:else if column.key === 'videos'}<span>{row.videos}</span>
											{:else if column.key === 'followers'}<span>{row.followers}</span>
											{:else if column.key === 'following'}<span>{row.following}</span>
											{:else if column.key === 'joined'}<span>{row.joined}</span>{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</section>
{:else if item.component === 'keywords'}
	<section class="min-w-0 border border-white/10 bg-white/[0.04] p-6">
		<header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-4">
		<button class="cursor-grab" aria-label="Drag panel">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" class="text-slate-500">
						<path d="M6 4h1v1H6V4zm3 0h1v1H9V4zM6 7h1v1H6V7zm3 0h1v1H9V7zm-3 3h1v1H6v-1zm3 3h1v1H9v-1zm0-3h1v1H9v-1z" fill="currentColor"></path>
					</svg>
				</button>
				<div>
					<p class="text-[10px] uppercase tracking-[0.35em] text-slate-500">Keywords</p>
				</div>
			</div>
			<div class="flex items-center gap-4">
				<span class="text-[11px] text-slate-500">SORT {tableState.keywords.sortKey.toUpperCase()} [{tableState.keywords.sortDirection.toUpperCase()}]</span>
				<button onclick={() => toggleCollapse('keywords')}>{collapsed.keywords ? '+' : '-'}</button>
			</div>
		</header>
		{#if !collapsed.keywords}
			<div class="mt-4 min-w-0 rounded-2xl border border-white/10 bg-black/20" transition:slide>
				<div class="min-w-0 overflow-x-auto rounded-2xl">
					<table class="min-w-full border-collapse text-left text-[12px] leading-snug">
						<thead class="bg-white/5 text-slate-500">
							<tr>
								{#each tableState.keywords.columns as column}
									<th scope="col" class={`px-4 py-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
										<button
											type="button"
											class="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-slate-500 transition hover:text-slate-200"
											onclick={() => toggleSort('keywords', column.key)}
										>
											<span>{column.label}</span>
											{#if tableState.keywords.sortKey === column.key}<span aria-hidden="true">{tableState.keywords.sortDirection === 'asc' ? '▲' : '▼'}</span>{/if}
										</button>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody class="bg-black/20">
							{#each sortedKeywordRows as row, index (row.keyword)}
								<tr class={`${index % 2 === 0 ? 'bg-white/[0.04]' : ''}`}>
									{#each tableState.keywords.columns as column}
										<td class={`px-4 py-3 text-slate-200 ${column.align === 'right' ? 'text-right' : 'text-left'}`}>
											{#if column.key === 'keyword'}<span class="text-slate-100">{row.keyword}</span>
											{:else if column.key === 'usage'}<span>{row.usage.toString().padStart(2, '0')}</span>
											{:else if column.key === 'related'}<span class="text-[10px] text-slate-400/80">{row.related}</span>{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</section>
{:else if item.component === 'locations'}
	<section class="min-w-0 border border-white/10 bg-white/[0.04] p-6">
		<header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div class="flex items-center gap-4">
				<button class="cursor-grab">
					<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" class="text-slate-500">
						<path d="M6 4h1v1H6V4zm3 0h1v1H9V4zM6 7h1v1H6V7zm3 0h1v1H9V7zm-3 3h1v1H6v-1zm3 3h1v1H9v-1zm0-3h1v1H9v-1z" fill="currentColor"></path>
					</svg>
				</button>
				<div>
					<p class="text-[10px] uppercase tracking-[0.35em] text-slate-500">Latest Locations</p>
					<p class="text-[11px] text-slate-500/70">Recent shoots plotted across the Rushes.fm map.</p>
				</div>
			</div>
			<button onclick={() => toggleCollapse('locations')}>{collapsed.locations ? '+' : '-'}</button>
		</header>
		{#if !collapsed.locations}
			<div class="mt-5 grid gap-6 lg:grid-cols-5" transition:slide>
				<div class="relative min-h-[18rem] overflow-hidden rounded-2xl border border-white/10 bg-black/30 lg:col-span-3">
					<Map
						locations={mapPins}
						initialCenterLat={locationCenter.lat}
						initialCenterLon={locationCenter.lon}
						initialZoom={locationCenter.zoom}
					/>
				</div>
				<div class="space-y-4 lg:col-span-2">
					{#if latestLocations.length === 0}
						<p class="text-[11px] text-slate-500">No geo-tagged videos yet. Pins appear here once locations are available.</p>
					{:else}
						<ul class="space-y-3">
							{#each latestLocations as loc (loc.id)}
								<li class="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
									{#if loc.thumbnailUrl}
										<img src={loc.thumbnailUrl} alt={loc.videoTitle} class="h-12 w-12 flex-shrink-0 rounded-xl object-cover" loading="lazy" />
									{:else}
										<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-[11px] uppercase tracking-[0.3em] text-white">
											{loc.videoTitle.slice(0, 2)}
										</div>
									{/if}
									<div class="min-w-0 flex-1 space-y-1">
										<p class="text-sm font-medium text-white">{loc.videoTitle}</p>
										<p class="text-[11px] uppercase tracking-[0.25em] text-slate-500">{loc.setting ?? 'On location'}</p>
										<div class="flex flex-wrap gap-3 text-[11px] text-slate-400">
											{#if loc.videoAuthor}<span>{loc.videoAuthor}</span>{/if}
											<span>{loc.uploadedLabel}</span>
										</div>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		{/if}
	</section>
{/if}

<style>
	.panel-placeholder {
		min-height: 4rem;
		border-radius: 1rem;
		border: 1px dashed rgba(148, 163, 184, 0.3);
		background-color: rgba(15, 23, 42, 0.2);
	}
</style>
