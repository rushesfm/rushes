<script lang="ts">
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import type { BreadcrumbItem } from "$lib/types/navigation";

    const props = $props<{
        items?: BreadcrumbItem[];
        labels?: Record<string, string>;
    }>();

    const currentPage = $derived(page);
    const providedItems = $derived(() => props.items);

    const defaultLabels: Record<string, string> = {
        account: "My Account",
        upload: "Upload",
        uploads: "My Uploads",
        browse: "Browse",
        map: "Map",
        live: "Live",
        faq: "FAQ",
        users: "Users",
        videos: "Videos",
        date: "Date",
        keywords: "Keywords",
        sounds: "Sounds"
    };

    const mergedLabels = $derived(() => ({
        ...defaultLabels,
        ...(props.labels ?? {})
    }));

    const breadcrumbs = $derived((): BreadcrumbItem[] => {
        const override = providedItems;
        if (override && override.length > 0) {
            return override;
        }
        return generateBreadcrumbsFromPath(currentPage.url.pathname, mergedLabels);
    });

    function generateBreadcrumbsFromPath(
        pathname: string,
        labels: Record<string, string>
    ): BreadcrumbItem[] {
        const segments = pathname.split("/").filter(Boolean);
        const crumbs: BreadcrumbItem[] = [];

        crumbs.push({ href: "/", label: "Home" });

        let currentPath = "";
        for (let i = 0; i < segments.length; i++) {
            currentPath += `/${segments[i]}`;
            const segment = segments[i];
            const label =
                labels[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);

            crumbs.push({
                href: currentPath,
                label
            });
        }

        return crumbs;
    }

    function handleClick(href: string, event: MouseEvent) {
        event.preventDefault();
        goto(href);
    }
</script>

{#if breadcrumbs.length > 0}
    <nav class="breadcrumbs" aria-label="Breadcrumb navigation">
        <ol class="breadcrumbs-list">
            {#each breadcrumbs as crumb, index}
                <li class="breadcrumbs-item">
                    {#if index < breadcrumbs.length - 1}
                        <a 
                            href={crumb.href} 
                            class="breadcrumbs-link"
                            onclick={(e) => handleClick(crumb.href, e)}
                        >
                            {crumb.label}
                        </a>
                        <span class="breadcrumbs-separator" aria-hidden="true">/</span>
                    {:else}
                        <span class="breadcrumbs-current" aria-current="page">
                            {crumb.label}
                        </span>
                    {/if}
                </li>
            {/each}
        </ol>
    </nav>
{/if}

<style>
    .breadcrumbs {
        padding: 0.75rem 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.02);
    }

    .breadcrumbs-list {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .breadcrumbs-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
    }

    .breadcrumbs-link {
        color: rgba(255, 255, 255, 0.6);
        text-decoration: none;
        transition: color 0.2s ease;
    }

    .breadcrumbs-link:hover {
        color: rgba(94, 234, 212, 0.8);
    }

    .breadcrumbs-current {
        color: white;
        font-weight: 500;
    }

    .breadcrumbs-separator {
        color: rgba(255, 255, 255, 0.3);
        user-select: none;
    }
</style>
