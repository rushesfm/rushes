<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { getContext, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import VideoPlayer from '$lib/components/VideoPlayer.svelte';
	import type { BreadcrumbItem } from '$lib/types/navigation';

	const props = $props<{ data: PageData; form: ActionData }>();
	const data = $derived(() => props.data);
	const form = $derived(() => props.form);

	let activeTab = $state<'login' | 'signup'>('login');

	type LoginFormState =
		| undefined
		| {
				message: string;
				email?: string;
		  };

	type SignupFormState =
		| undefined
		| {
				message: string;
				fields: { name: string; email: string };
		  }
		| {
				success: true;
				message: string;
				fields: { name: string; email: string };
		  };

	type LogoutFormState =
		| undefined
		| {
				message: string;
		  };

	const inviteRequired = $derived(() => data.inviteRequired);
	const redirectTo = $derived(() => data.redirectTo ?? '/');
	const sessionUser = $derived(() => data.sessionUser);
	const isAuthenticated = $derived(() => Boolean(sessionUser));
	const totalUserVideos = $derived(() => (Array.isArray(data.userVideos) ? data.userVideos.length : (data.totalUserVideos ?? 0)));
	const recentVideos = $derived(() => (Array.isArray(data.userVideos) ? data.userVideos.slice(0, 3) : (data.recentVideos ?? [])));

	const loginState = $derived(() => form?.login as LoginFormState);
	const signupState = $derived(() => form?.signup as SignupFormState);
	const logoutState = $derived(() => form?.logout as LogoutFormState);
	const signupFields = $derived(() => signupState?.fields ?? { name: '', email: '' });
	const signupWasSuccessful = $derived(() =>
		!isAuthenticated ? Boolean(signupState && 'success' in signupState && signupState.success) : false
	);

	const customBreadcrumbs: BreadcrumbItem[] = [
		{ href: '/', label: 'Home' },
		{ href: '/account', label: 'My Account' }
	];

	const breadcrumbsContext = getContext<{ set: (items: BreadcrumbItem[]) => void; clear: () => void }>(
		'breadcrumbs'
	);

	$effect(() => {
		if (breadcrumbsContext) {
			breadcrumbsContext.set(customBreadcrumbs);
			return () => breadcrumbsContext.clear();
		}
	});

	$effect(() => {
		if (!isAuthenticated && signupWasSuccessful) {
			activeTab = 'login';
		}
	});

	onMount(() => {
		if (typeof window !== 'undefined' && window.location.hash === '#signup') {
			activeTab = 'signup';
		}
	});

	function onDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		const file = event.dataTransfer?.files?.[0];
		if (file) queueUpload(file);
	}

	function onFileSelect(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (file) queueUpload(file);
	}

	function queueUpload(file: File) {
		(window as any).__rushesUploadFile = file;
		goto('/account/upload');
	}

	function formatDateTime(value?: string | Date | null) {
		if (!value) return '';
		try {
			const date = value instanceof Date ? value : new Date(value);
			if (Number.isNaN(date.getTime())) {
				return typeof value === 'string' ? value : '';
			}
			return date.toLocaleString();
		} catch {
			return typeof value === 'string' ? value : '';
		}
	}
</script>

<div class="min-h-screen p-8">
	<div class="mx-auto w-full max-w-4xl">
		{#if isAuthenticated}
			<header class="mb-8">
				<h1 class="mb-4 text-3xl font-bold text-white">Your Account</h1>
				<p class="text-sm text-white/60">Manage your profile, uploads, and account settings.</p>
			</header>

			<section class="mb-8 rounded-lg border border-white/10 bg-white/5 p-6">
				<div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
					<div class="flex items-center gap-4">
						<div class="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg font-semibold uppercase text-white">
							{sessionUser.email?.slice(0, 1) ?? 'U'}
						</div>
						<div class="space-y-2 text-white">
							<h2 class="text-xl font-semibold">
								{sessionUser.user_metadata?.name ?? sessionUser.email ?? 'Account'}
							</h2>
							{#if sessionUser.email}
								<p class="text-sm text-white/60">{sessionUser.email}</p>
							{/if}
							<div class="grid gap-1 text-xs text-white/40">
								{#if sessionUser.user_metadata?.inviteCode}
									<p>Invite code: {sessionUser.user_metadata.inviteCode}</p>
								{/if}
								<p>
									User id:
									<span class="font-mono text-white/70">{sessionUser.id}</span>
								</p>
							</div>
						</div>
					</div>
					<div class="flex flex-col gap-3 md:items-end">
						<div class="flex flex-col gap-3 sm:flex-row">
							<button
								type="button"
								class="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/40"
								on:click={() => goto('/account/upload')}
							>
								Upload a video
							</button>
							<a
								class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-teal-200 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30"
								href="/account/uploads"
							>
								Manage uploads
							</a>
						</div>
						<form method="POST" action="?/logout" class="flex justify-end">
							<input type="hidden" name="redirectTo" value="/account" />
							{#if logoutState?.message}
								<p class="mr-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
									{logoutState.message}
								</p>
							{/if}
							<button
								type="submit"
								class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30"
							>
								Sign out
							</button>
						</form>
					</div>
				</div>
			</section>

			<section class="mb-8 rounded-lg border border-dashed border-white/10 bg-white/5 p-6">
				<header class="mb-4">
					<h2 class="text-xl font-semibold text-white">Quick upload</h2>
					<p class="text-sm text-white/60">Drop a video file or open the uploader to start a new upload.</p>
				</header>
				<div
					class="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-white/20 bg-neutral-900/40 p-8 text-center text-white/70 transition hover:border-white/30 hover:bg-neutral-900/30"
					on:dragover={e => { e.preventDefault(); e.stopPropagation(); }}
					on:drop={onDrop}
				>
					<label class="cursor-pointer text-lg font-medium">
						Drop a video or <span class="underline text-orange-400 hover:text-orange-300">browse</span>
						<input type="file" accept="video/*" class="hidden" on:change={onFileSelect} />
					</label>
					<p class="text-sm text-white/50">Nothing uploads until you confirm details on the next step.</p>
					<button
						type="button"
						class="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-teal-200 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30"
						on:click={() => goto('/account/upload')}
					>
						Open uploader
					</button>
				</div>
			</section>

			{#if data.uploadedVideo}
				<section class="mb-8 rounded-lg border border-white/10 bg-white/5 p-6">
					<h2 class="mb-4 text-xl font-semibold text-white">Latest upload</h2>
					<div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
						<div class="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black">
							<VideoPlayer
								videoUrl={data.uploadedVideo.videoUrl ?? data.uploadedVideo.url ?? ''}
								controls
							/>
						</div>
						<div class="space-y-3 text-white">
							<h3 class="text-lg font-semibold">{data.uploadedVideo.title}</h3>
							{#if data.uploadedVideo.description}
								<p class="max-h-32 overflow-hidden text-sm leading-relaxed text-white/70">
									{data.uploadedVideo.description}
								</p>
							{/if}
							<p class="text-xs text-white/50">
								Uploaded {formatDateTime(data.uploadedVideo.uploadedAt ?? data.uploadedVideo.createdAt)}
							</p>
							<a
								class="inline-flex items-center gap-1 text-sm font-medium text-teal-300 transition hover:text-teal-200"
								href={`/videos/${data.uploadedVideo.id}`}
							>
								View video →
							</a>
						</div>
					</div>
				</section>
			{/if}

			<section class="rounded-lg border border-white/10 bg-white/5 p-6">
				<div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 class="text-xl font-semibold text-white">Recent uploads</h2>
						<p class="text-sm text-white/60">A quick look at your latest videos.</p>
					</div>
					{#if totalUserVideos > 0}
						<a
							class="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-teal-200 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30"
							href="/account/uploads"
						>
							View all uploads
						</a>
					{/if}
				</div>

				{#if recentVideos.length > 0}
					<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{#each recentVideos as video (video.id)}
							<article class="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 transition hover:border-white/20 hover:bg-white/10">
								<a
									href={`/videos/${video.id}`}
									class="block h-40 overflow-hidden border-b border-white/10 bg-black"
								>
									<img
										src={video.thumbnailUrl ?? 'https://placehold.co/400x225?text=No+Thumbnail'}
										alt={video.title}
										class="h-full w-full object-cover"
									/>
								</a>
								<div class="flex flex-1 flex-col justify-between gap-3 p-4">
									<div class="space-y-2">
										<h3 class="text-base font-semibold text-white line-clamp-2">{video.title}</h3>
										<p class="text-xs text-white/50">
											{formatDateTime(video.uploadedAt ?? video.createdAt)}
										</p>
									</div>
									<a
										class="inline-flex items-center justify-start text-sm font-medium text-teal-300 transition hover:text-teal-200"
										href={`/videos/${video.id}`}
									>
										View video →
									</a>
								</div>
							</article>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-white/60">
						You haven't uploaded any videos yet. Use the uploader above to add your first one.
					</p>
				{/if}
			</section>
		{:else}
			<header class="mb-8">
				<h1 class="text-3xl font-bold text-white mb-4">Access Your Account</h1>
				<p class="text-white/60 text-sm">
					Sign in to continue, or request access with an invite code to create a new account.
				</p>
			</header>

			<!-- Tab Switcher -->
			<div class="mb-8 flex gap-2 border-b border-white/10">
				<button
					class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
					'login'
						? 'border-white text-white'
						: 'border-transparent text-white/60 hover:text-white'}"
          on:click={() => (activeTab = 'login')}
					type="button"
				>
					Sign in
				</button>
				<button
					class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
					'signup'
						? 'border-white text-white'
						: 'border-transparent text-white/60 hover:text-white'}"
          on:click={() => (activeTab = 'signup')}
					type="button"
				>
					Create account
				</button>
			</div>

			<div class="rounded-lg border border-white/10 bg-white/5 p-8">
				{#if activeTab === 'login'}
					<section>
						<header class="mb-6 space-y-2">
							<h2 class="text-xl font-semibold text-white">Welcome back</h2>
							<p class="text-sm text-white/60">
								Use your email and password to sign in.
							</p>
						</header>

						<form method="POST" action="?/login" class="space-y-5">
							<input type="hidden" name="redirectTo" value={redirectTo} />

							<label class="block space-y-2 text-sm font-medium">
								<span class="text-white">Email</span>
								<input
									class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
									autocomplete="email"
									type="email"
									name="email"
									required
									value={loginState?.email ?? ''}
								/>
							</label>

							<label class="block space-y-2 text-sm font-medium">
								<span class="text-white">Password</span>
								<input
									class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
									type="password"
									name="password"
									autocomplete="current-password"
									required
								/>
							</label>

							{#if loginState?.message}
								<p class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
									{loginState.message}
								</p>
							{/if}

							<button
								class="mt-2 w-full rounded-lg bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/40"
								type="submit"
							>
								Sign in
							</button>
						</form>
					</section>
				{:else}
					<section>
						<header class="mb-6 space-y-2">
							<h2 class="text-xl font-semibold text-white">Request access</h2>
							<p class="text-sm text-white/60">
								Create a new account using your invite code.
							</p>
						</header>

						<form method="POST" action="?/signup" class="space-y-5">
							<input type="hidden" name="redirectTo" value={redirectTo} />

							<label class="block space-y-2 text-sm font-medium">
								<span class="text-white">Display name</span>
								<input
									class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
									type="text"
									name="name"
									placeholder="How should we address you?"
									value={signupFields.name}
								/>
							</label>

							<label class="block space-y-2 text-sm font-medium">
								<span class="text-white">Email</span>
								<input
									class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
									type="email"
									name="email"
									autocomplete="email"
									required
									value={signupFields.email}
								/>
							</label>

							<label class="block space-y-2 text-sm font-medium">
								<span class="text-white">Password</span>
								<input
									class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
									type="password"
									name="password"
									autocomplete="new-password"
									required
								/>
							</label>

							<label class="block space-y-2 text-sm font-medium">
								<span class="text-white">Invite code</span>
								<input
									class="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/20"
									type="text"
									name="inviteCode"
									required={inviteRequired}
									placeholder="Enter your invite code"
								/>
							</label>

							{#if signupState && !signupWasSuccessful && signupState.message}
								<p class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
									{signupState.message}
								</p>
							{:else if signupWasSuccessful && signupState?.message}
								<p class="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
									{signupState.message}
								</p>
							{/if}

							<button
								class="mt-2 w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30"
								type="submit"
							>
								Request access
							</button>

							{#if inviteRequired}
								<p class="text-xs text-white/40">
									Need an invite? Reach out to your RUSHES contact to request a code.
								</p>
							{:else}
								<p class="text-xs text-emerald-300/70">
									Invite codes are optional in this environment.
								</p>
							{/if}
						</form>
					</section>
				{/if}
			</div>
		{/if}
	</div>
</div>
