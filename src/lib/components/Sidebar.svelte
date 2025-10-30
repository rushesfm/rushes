<script lang="ts">
    import { slide } from "svelte/transition";
    import { onMount, tick } from "svelte";
    import { page } from "$app/stores";
    // FIXED: This is the correct import for the component API you are using
    import { Tooltip } from "bits-ui";

    interface Props {
        isOpen?: boolean;
        onclose?: () => void;
    }

    let { isOpen = false, onclose }: Props = $props();

    function closeMobileSidebar() {
        onclose?.();
    }

    // REFACTORED: Added "Live" link to the navLinks array
    const navLinks = [
        { href: "/", label: "Home", icon: "live" },
        // { href: "/live", label: "Live", icon: "play" },
        { href: "/map", label: "Map", icon: "map" },
        { href: "/browse", label: "Browse", icon: "browse" },
        { href: "/account", label: "Upload", icon: "account" },
        { href: "/faq", label: "FAQ", icon: "faq" },
    ] as const;

    // --- State for Highlight Logic ---
    let navContainer = $state<HTMLDivElement | null>(null);
    let highlightContainer = $state<HTMLDivElement | null>(null);
    // REMOVED: liveLinkRef is no longer needed
    // let liveLinkRef = $state<HTMLAnchorElement | null>(null);

    // This array will now be 5 elements long, and navRefs[0] will be the "Live" link
    let navRefs: Array<HTMLAnchorElement | null> = $state(
        new Array(navLinks.length).fill(null),
    );
    let highlightY = $state(0);
    let highlightX = $state(0);
    let highlightWidth = $state(0);
    let highlightHeight = $state(0);
    let highlightVisible = $state(false);
    let highlightPulse = $state(false);
    let highlightElement: HTMLDivElement | null = null;
    let resizeHandler: (() => void) | null = null;

    function routeMatches(href: string | null, currentPath: string): boolean {
        if (!href) return false;
        return currentPath === href || currentPath.startsWith(`${href}/`);
    }

    async function refreshHighlight(currentPath: string) {
        await tick();
        if (!highlightContainer) {
            highlightVisible = false;
            return;
        }

        let target: HTMLElement | null = null;

        const activeIndex = navLinks.findIndex((link) =>
            routeMatches(link.href, currentPath),
        );
        if (activeIndex !== -1) {
            const candidate = navRefs[activeIndex];
            if (candidate instanceof HTMLElement) {
                target = candidate;
            }
        }

        if (!target) {
            highlightVisible = false;
            return;
        }

        const containerRect = highlightContainer.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        // UPDATED: Use the target's width and left directly.
        // Since the target <a> is h-12 w-12, this will result in a square.
        let width = targetRect.width;
        let left = targetRect.left - containerRect.left;

        // REMOVED: The block that calculated width based on the inner icon is gone.

        highlightY = targetRect.top - containerRect.top;
        highlightX = left;
        highlightWidth = width;
        highlightHeight = targetRect.height; // height will equal width (h-12)
        const isVisible = highlightHeight > 0 && highlightWidth > 0;

        if (!isVisible) {
            highlightVisible = false;
            highlightPulse = false;
            return;
        }

        highlightVisible = true;
        highlightPulse = false;
        await tick();
        highlightPulse = true;
    }

    onMount(() => {
        const handleResize = () => {
            refreshHighlight($page.url.pathname);
        };
        window.addEventListener("resize", handleResize);
        resizeHandler = handleResize;

        return () => {
            if (resizeHandler) {
                window.removeEventListener("resize", resizeHandler);
                resizeHandler = null;
            }
        };
    });

    // REFACTORED: Removed dependency on liveLinkRef
    $effect(() => {
        const path = $page.url.pathname;
        highlightContainer;
        navRefs.forEach((ref) => ref);
        refreshHighlight(path);
    });

    const icons = {
        home: `<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H3.75A.75.75 0 013 21V9.75z"/></svg>`,
        map: `<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3.75l6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5V6.25l6-2.5zM9 3.75v14.5m6-12v14.5"/></svg>`,
        play: `<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z" /></svg>`,
        browse: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15a4 4 0 1 0 8 0a4 4 0 1 0-8 0m7.5 3.5L21 21M4 6h16M4 12h4m-4 6h4"/></svg>`,
        users: `<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M6.5 21a5.5 5.5 0 0111 0M19.5 8.25a2.25 2.25 0 110 4.5M21 21a3 3 0 00-4-2.82"/></svg>`,
        account: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from HeroIcons by Refactoring UI Inc - https://github.com/tailwindlabs/heroicons/blob/master/LICENSE --><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87q.11.06.22.127c.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a8 8 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a7 7 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a7 7 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a7 7 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124q.108-.066.22-.128c.332-.183.582-.495.644-.869z"/><path d="M15 12a3 3 0 1 1-6 0a3 3 0 0 1 6 0"/></g></svg>`,
        upload: `<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16.5v1.25A2.25 2.25 0 006.25 20h11.5A2.25 2.25 0 0020 17.75V16.5M8.75 9.75L12 6.5l3.25 3.25M12 6.5v9.75"/></svg>`,
        faq: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><!-- Icon from Tabler Icons by Paweł Kuna - https://github.com/tabler/tabler-icons/blob/master/LICENSE --><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19.875 6.27c.7.398 1.13 1.143 1.125 1.948v7.284c0 .809-.443 1.555-1.158 1.948l-6.75 4.27a2.27 2.27 0 0 1-2.184 0l-6.75-4.27A2.23 2.23 0 0 1 3 15.502V8.217c0-.809.443-1.554 1.158-1.947l6.75-3.98a2.33 2.33 0 0 1 2.25 0l6.75 3.98zM12 16v.01"/><path d="M12 13a2 2 0 0 0 .914-3.782a1.98 1.98 0 0 0-2.414.483"/></g></svg>`,
    } satisfies Record<string, string>;
</script>

<Tooltip.Provider delayDuration={100}>
    <aside
        class="hidden z-100 lg:flex lg:w-20 lg:flex-col transition-all duration-300 ease-in-out overflow-visible"
    >
        <div
            class="sidebar-shell relative flex flex-1 flex-col overflow-y-auto overflow-x-visible border-r border-white/10 bg-white/[0.02] backdrop-blur-md shadow-[0_32px_120px_-45px_rgba(15,23,42,0.9)]"
            bind:this={highlightContainer}
        >
            <div
                bind:this={highlightElement}
                class="nav-highlight"
                class:visible={highlightVisible}
                style={`--highlight-x: ${highlightX}px; --highlight-y: ${highlightY}px; height: ${highlightHeight}px; width: ${highlightWidth}px;`}
            >
                <div
                    class="nav-highlight-inner"
                    class:animate={highlightPulse}
                    on:animationend={() => {
                        highlightPulse = false;
                    }}
                ></div>
            </div>

            <nav class="mt-6 flex-1 flex justify-center px-4">
                <div class="space-y-1 nav-list" bind:this={navContainer}>
                    {#each navLinks as link, index}
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <a
                                    href={link.href}
                                    bind:this={navRefs[index]}
                                    class="nav-item flex h-10 w-10 items-center justify-center rounded-xl transition {link.icon ===
                                    'live'
                                        ? 'logo-link mb-10 '
                                        : 'text-white/70 hover:bg-white/10 hover:text-white'}"
                                    class:active={routeMatches(
                                        link.href,
                                        $page.url.pathname,
                                    )}
                                    aria-label={link.label}
                                    aria-current={routeMatches(
                                        link.href,
                                        $page.url.pathname,
                                    )
                                        ? "page"
                                        : undefined}
                                >
                                    {#if link.icon === "live"}

                                    
                                        <span
                                            class="logo-mark"
                                            aria-hidden="true"
                                        >
                                            <span
                                                class="logo-bar logo-bar--long"
                                            ></span>
                                            <span
                                                class="logo-bar logo-bar--medium"
                                            ></span>
                                         
                                            <span
                                                class="logo-bar logo-bar--short"
                                            ></span>
                                        </span>
                                    {:else}
                                        <span
                                            class="nav-icon text-white/80"
                                            aria-hidden="true"
                                            >{@html icons[link.icon]}</span
                                        >
                                    {/if}
                                </a>
                            </Tooltip.Trigger>

                            <Tooltip.Portal>
                                <Tooltip.Content
                                    side="right"
                                    align="center"
                                    sideOffset={3}
                                    class="tooltip-content"
                                >
                                    {link.label}
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>
                    {/each}
                </div>
            </nav>
        </div>
    </aside>
</Tooltip.Provider>

<div class="lg:hidden">
    {#if isOpen}
        <aside
            class="fixed top-0 left-0 h-full w-64 bg-white dark:bg-black border-r border-gray-300 z-50"
            transition:slide={{ duration: 200, axis: "x" }}
        >
            <div class="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
                <div
                    class="flex items-center justify-between flex-shrink-0 px-4"
                >
                    <h1
                        class="text-xl font-bold tracking-wider text-gray-900 dark:text-white"
                    >
                        RUSHES
                    </h1>
                    <button
                        on:click={closeMobileSidebar}
                        class="p-2 hover:bg-gray-100 dark:hover:bg-gray-900 rounded transition-colors"
                        aria-label="Close menu"
                    >
                        <svg
                            class="h-5 w-5 text-gray-900 dark:text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <nav class="mt-8 flex-1 px-4 space-y-1">
                    {#each navLinks as link}
                        <a
                            href={link.href}
                            class="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                            on:click={closeMobileSidebar}
                        >
                            {#if link.icon === "live"}
                                <span class="mr-3 h-5 w-5" aria-hidden="true">
                                    <span class="logo-mark !h-5 !w-5">
                                        <span
                                            class="logo-bar logo-bar--long bg-gray-900 dark:bg-white"
                                        ></span>
                                        <span
                                            class="logo-bar logo-bar--medium bg-gray-900 dark:bg-white"
                                        ></span>
                                        <span
                                            class="logo-bar logo-bar--short bg-gray-900 dark:bg-white"
                                        ></span>
                                    </span>
                                </span>
                            {:else}
                                <span
                                    class="mr-3 h-5 w-5 text-gray-900 dark:text-white"
                                    aria-hidden="true"
                                    >{@html icons[link.icon]}</span
                                >
                            {/if}
                            {link.label}
                        </a>
                    {/each}
                </nav>
            </div>
        </aside>
    {/if}
</div>

<style>
    .logo-mark {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        width: 1.5rem;
        height: 1.5rem;
    }

    .logo-bar {
        width: 0.2rem;
        border-radius: 9999px;
        background: white;
    }

    .logo-bar--long {
        height: 1.15rem;
    }

    .logo-bar--medium {
        height: 0.8rem;
    }

    .logo-bar--short {
        height: 0.5rem;
    }

    .logo-bar--circle {
        width: 0.4rem;
        height: 0.4rem;
        border-radius: 9999px;
        background: white;
    }

    .sidebar-shell {
        overflow-x: visible;
        overflow-y: auto;
    }

    .nav-list {
        position: relative;
        overflow: visible;
    }

    .nav-item {
        position: relative;
    }

    .nav-item.active {
        color: #f8fafc;
    }

    .nav-icon :global(svg) {
        display: block;
        height: 1.25rem;
        width: 1.25rem;
    }

    /* FIXED: Removed :global() and set z-index properly */
    :global(.tooltip-content) {
        background: rgba(255, 255, 255, 0.2);
        font-family: sans-serif;
        color: #f8fafc;
        padding: 0.35rem 0.6rem;
        border-radius: 0.55rem;
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        white-space: nowrap;
        box-shadow: 0 18px 35px -24px rgba(15, 23, 42, 0.88);
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        z-index: 9999999;
    }

    /* Added style for tooltip arrow */
    .tooltip-arrow {
        fill: rgba(15, 23, 42, 0.92);
    }

    .nav-highlight {
        position: absolute;
        left: 0;
        top: 0;

        border-radius: 10px;
        pointer-events: none;
        z-index: -1;
        transform: translate3d(var(--highlight-x, 0), var(--highlight-y, 0), 0);
        transition:
            transform 0.32s cubic-bezier(0.28, 0.94, 0.38, 1),
            height 0.22s cubic-bezier(0.3, 0.95, 0.4, 1),
            width 0.22s cubic-bezier(0.3, 0.95, 0.4, 1),
            opacity 0.16s ease;
        opacity: 0;
    }

    .nav-highlight.visible {
        opacity: 1;
    }

    .nav-highlight-inner {
        position: absolute;
        inset: 0;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.18);
        transition: opacity 0.16s ease;
        opacity: 0.9;

        transform-origin: center;
    }

    .nav-highlight-inner.animate {
        animation: highlight-bounce 0.5s cubic-bezier(0.24, 1.58, 0.36, 1)
            forwards;
    }

    @keyframes highlight-bounce {
        0% {
            transform: scale(0.88);
        }
        45% {
            transform: scale(1.08);
        }
        70% {
            transform: scale(0.97);
        }
        100% {
            transform: scale(1);
        }
    }

    .nav-list a.active {
        color: orange;
    }

    .nav-list a.active span:first-child {
        color: orange;
    }

    a.active .logo-bar {
        background: orange !important;
    }
</style>
