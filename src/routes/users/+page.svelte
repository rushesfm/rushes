<script lang="ts">
    import { browser } from "$app/environment";
    import { goto } from "$app/navigation";
    import { usersStore } from "$lib/stores/library";
    import { selectedVideo } from "$lib/stores/selectedVideo";
    import { onMount } from "svelte";

    const users = $derived($usersStore);
    let container = $state<HTMLElement | null>(null);
    let gsapModule: any = null;

    onMount(() => {
        selectedVideo.selectVideo("home");
    });

    async function ensureGsap() {
        if (!browser) return null;
        if (!gsapModule) {
            const { default: gsap } = await import("gsap");
            gsapModule = gsap;
        }
        return gsapModule;
    }

    $effect(() => {
        const host = container;
        if (!host) return;
        ensureGsap().then((gsap) => {
            if (!gsap) return;
            gsap.fromTo(
                host.querySelectorAll("[data-user-card]"),
                { opacity: 0, y: 18 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.5,
                    stagger: 0.05,
                    ease: "power2.out",
                },
            );
        });
    });

    function openProfile(id: string) {
        goto(`/users/${id}`);
    }
</script>

<svelte:head>
    <title>Creators — Rushes Directory</title>
    <meta
        name="description"
        content="Browse the Rushes collective, discover filmmakers and dive into their rushes."
    />
</svelte:head>

<div class="mx-auto w-full max-w-[1200px] pb-24">
    <header class="flex flex-col gap-2 pb-8">
        <p class="text-xs uppercase tracking-[0.45em] text-slate-500">
            Directory
        </p>
        <h1
            class="text-3xl font-semibold text-white"
            style="font-family: 'Space Grotesk', 'Inter', sans-serif;"
        >
            Rushes collective
        </h1>
        <p class="max-w-xl text-sm text-slate-400">
            Meet the filmmakers weaving the Rushes archive. Select a profile to
            view their rushes, locations and shared notes.
        </p>
    </header>

    <div class="grid gap-6 md:grid-cols-2" bind:this={container}>
        {#each users as user (user.id)}
            <button
                class="group flex flex-col gap-4 rounded-4xl border border-white/10 bg-white/[0.04] p-6 text-left shadow-[0_45px_140px_-80px_rgba(12,18,38,0.92)] backdrop-blur-3xl transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_55px_160px_-90px_rgba(99,102,241,0.65)]"
                onclick={() => openProfile(user.id)}
                data-user-card
            >
                <div class="flex items-center gap-4">
                    <img
                        src={user.avatar}
                        alt={user.name}
                        class="h-16 w-16 rounded-3xl border border-white/10 object-cover"
                    />
                    <div>
                        <h2
                            class="text-xl font-semibold text-white"
                            style="font-family: 'Space Grotesk', 'Inter', sans-serif;"
                        >
                            {user.name}
                        </h2>
                        <p
                            class="mt-1 text-xs uppercase tracking-[0.35em] text-slate-500"
                        >
                            {user.stats.videos} rushes
                        </p>
                    </div>
                </div>
                <p class="text-sm text-slate-300">{user.bio}</p>
                <div
                    class="grid grid-cols-3 gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs uppercase tracking-[0.3em] text-slate-400"
                >
                    <div>
                        <p class="text-[11px] text-slate-500">Followers</p>
                        <p class="mt-1 text-base text-white">
                            {user.stats.followers}
                        </p>
                    </div>
                    <div>
                        <p class="text-[11px] text-slate-500">Following</p>
                        <p class="mt-1 text-base text-white">
                            {user.stats.following}
                        </p>
                    </div>
                    <div>
                        <p class="text-[11px] text-slate-500">Videos</p>
                        <p class="mt-1 text-base text-white">
                            {user.stats.videos}
                        </p>
                    </div>
                </div>
            </button>
        {/each}
    </div>
</div>

<style>
    .rounded-4xl {
        border-radius: 2rem;
    }
</style>
