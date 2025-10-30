<script lang="ts">
import type { ActionData, PageData } from './$types';
import { onMount } from 'svelte';
import { goto } from "$app/navigation";
import VideoPlayer from "$lib/components/VideoPlayer.svelte";

	export let data: PageData;
	export let form: ActionData;

	let activeTab: 'login' | 'signup' = 'login';

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

	const inviteRequired = data.inviteRequired;
	const redirectTo = data.redirectTo ?? '/';
const sessionUser = data.sessionUser;
const isAuthenticated = Boolean(sessionUser);

	let loginState: LoginFormState = undefined;
	let signupState: SignupFormState = undefined;
	let logoutState: LogoutFormState = undefined;
	let signupFields = { name: '', email: '' };
	let signupWasSuccessful = false;

	$: loginState = form?.login as LoginFormState;
	$: signupState = form?.signup as SignupFormState;
	$: logoutState = form?.logout as LogoutFormState;
	$: signupFields = signupState?.fields ?? { name: '', email: '' };
	$: signupWasSuccessful = !isAuthenticated
		? Boolean(signupState && 'success' in signupState && signupState.success)
		: false;

	// When signup succeeds, switch back to the login tab
	$: if (!isAuthenticated && signupWasSuccessful) {
		activeTab = 'login';
	}

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
    // Store the file on window (not persisted after reload)
    (window as any).__rushesUploadFile = file;
    goto("/account/upload");
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
			<!-- 1. Account Info Card -->
			<section class="rounded-lg border border-white/10 bg-white/5 p-8 mb-8 flex flex-col sm:flex-row items-center gap-6 max-w-3xl mx-auto">
				<div class="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 text-3xl font-semibold uppercase text-white">
					{sessionUser.email?.slice(0, 1) ?? 'U'}
				</div>
				<div class="flex-1 space-y-2">
					<h2 class="text-2xl font-semibold text-white">{sessionUser.user_metadata?.name ?? sessionUser.email ?? 'Account'}</h2>
					{#if sessionUser.email}
						<p class="text-white/70 text-sm">{sessionUser.email}</p>
					{/if}
					{#if sessionUser.user_metadata?.inviteCode}
						<p class="text-xs text-white/40">Invite code: {sessionUser.user_metadata.inviteCode}</p>
					{/if}
					<p class="text-xs text-white/40">User id: <span class="font-mono text-white/60">{sessionUser.id}</span></p>
				</div>
				<form method="POST" action="?/logout" class="flex-shrink-0">
					<input type="hidden" name="redirectTo" value="/account" />
					<button type="submit" class="rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30">
						Sign out
					</button>
				</form>
			</section>

			<!-- 2. Video Upload Box -->
			<section class="rounded-lg border-2 border-dashed border-white/20 bg-neutral-900/40 mt-6 mb-10 p-8 shadow flex flex-col items-center max-w-2xl mx-auto">
				<label class="block text-white/80 text-lg font-medium mb-2 cursor-pointer">
					<svg class="inline-block h-10 w-10 text-orange-400 mr-2 align-middle" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
					Drag a video here to upload or <span class="underline text-orange-400 hover:text-orange-300">browse</span>
					<input type="file" accept="video/*" class="hidden" onchange={onFileSelect} />
				</label>
				<div class="mt-2 text-white/60 text-sm">Your video does not upload until you confirm on the next step.</div>
				<div class="h-32 w-full" style="pointer-events: none;"></div>
				<div
					class="absolute top-0 left-0 right-0 bottom-0 rounded-lg border-2 border-dashed opacity-0 hover:opacity-100 transition-opacity duration-150"
					ondragover={e => { e.preventDefault(); e.stopPropagation(); }}
					ondrop={e => { e.preventDefault(); e.stopPropagation(); onDrop(e); }}
					role="region"
					aria-label="Video Upload Dropzone"
				/>
			</section>

			<!-- 3. Recent Uploads -->
			<section class="rounded-lg border border-white/10 bg-white/5 p-8 mb-10 max-w-4xl mx-auto">
				<h2 class="text-xl font-semibold text-white mb-5">Recent uploads</h2>
				{#if data.userVideos && data.userVideos.length > 0}
					<div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
						{#each data.userVideos.slice(0, 3) as video (video.id)}
							<div class="relative group bg-white/5 rounded-xl border border-white/10 overflow-hidden shadow hover:shadow-lg transition-all flex flex-col">
								<a href={`/videos/${video.id}`} class="h-40 w-full block bg-black border-b border-white/10 overflow-hidden">
									<img src={video.thumbnailUrl ?? 'https://placehold.co/400x225?text=No+Thumbnail'} alt={video.title} class="w-full h-full object-cover"/>
								</a>
								<div class="flex-1 flex flex-col justify-between p-3">
									<div>
										<h3 class="font-semibold text-white text-base truncate">{video.title}</h3>
										<p class="text-xs text-white/40 truncate">{video.description ?? ''}</p>
									</div>
									<div class="flex gap-2 mt-3">
										<a href={`/videos/${video.id}`} class="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-teal-200">View</a>
									</div>
								</div>
							</div>
						{/each}
					</div>
					<div class="flex justify-center mt-5">
						<a href="/account/uploads" class="rounded-lg px-5 py-2 bg-white/10 text-teal-300 hover:bg-white/20 hover:text-teal-200 font-semibold transition">View all uploads</a>
					</div>
				{:else}
					<p class="text-white/60 text-sm">You haven't uploaded any videos yet.</p>
				{/if}
			</section>
			<!-- The logic for full uploads grid has been moved to /account/uploads, only latest videos are shown on /account now. -->
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
          onclick={() => (activeTab = 'login')}
					type="button"
				>
					Sign in
				</button>
				<button
					class="px-4 py-2 text-sm font-medium transition-colors border-b-2 {activeTab ===
					'signup'
						? 'border-white text-white'
						: 'border-transparent text-white/60 hover:text-white'}"
          onclick={() => (activeTab = 'signup')}
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
