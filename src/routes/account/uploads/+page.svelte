<script lang="ts">
  import type { PageData } from './$types';
  import { getContext, onDestroy } from 'svelte';
  import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
  import type { BreadcrumbItem } from '$lib/types/navigation';

  export let data: PageData;

  function startEditing(video) { /* NOOP for now */ }
  function formatDateTime(value?: string | Date | null): string {
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

  const customBreadcrumbs: BreadcrumbItem[] = [
    { href: '/', label: 'Home' },
    { href: '/account', label: 'My Account' },
    { href: '/account/uploads', label: 'My Uploads' }
  ];

  const breadcrumbsContext = getContext<{
    set: (items: BreadcrumbItem[]) => void;
    setInline: (items: BreadcrumbItem[]) => void;
    clear: () => void;
  }>('breadcrumbs');

  if (breadcrumbsContext) {
    breadcrumbsContext.setInline(customBreadcrumbs);
  }

  onDestroy(() => {
    breadcrumbsContext?.clear?.();
  });
</script>

<div class="min-h-screen p-8 bg-black/80">
  <div class="mx-auto w-full max-w-6xl">
    <Breadcrumbs items={customBreadcrumbs} />
    <header class="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <h1 class="text-3xl font-bold text-white">Your Uploads</h1>
      <a href="/account" class="text-sm rounded px-3 py-2 border border-white/10 text-white/70 hover:bg-white/10 transition">← Back to Account</a>
    </header>

    {#if data.userVideos && data.userVideos.length > 0}
      <div class="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {#each data.userVideos as video (video.id)}
          <div class="relative group bg-white/5 rounded-xl border border-white/10 overflow-hidden shadow flex flex-col">
            <a href={`/videos/${video.id}`}
              class="h-40 w-full block bg-black border-b border-white/10 overflow-hidden">
                <img src={video.thumbnailUrl ?? 'https://placehold.co/400x225?text=No+Thumbnail'} alt={video.title} class="w-full h-full object-cover"/>
            </a>
            <div class="flex-1 flex flex-col justify-between p-3">
              <div>
                <h3 class="font-semibold text-white text-base truncate">{video.title}</h3>
                <p class="text-xs text-white/40 truncate">{video.description ?? ''}</p>
                <p class="text-[10px] text-white/30">{formatDateTime(video.uploadedAt ?? video.createdAt)}</p>
              </div>
              <div class="flex gap-2 mt-3">
                <button class="text-xs px-2 py-1 rounded bg-teal-700/80 hover:bg-teal-600 text-white" on:click={() => startEditing(video)}>Edit</button>
                <form method="POST" action="?/deleteVideo" style="display:inline">
                  <input type="hidden" name="videoId" value={video.id} />
                  <button type="submit" class="text-xs px-2 py-1 rounded bg-rose-700/80 hover:bg-rose-600 text-white" on:click={event => { if (!confirm('Are you sure you want to delete this video? This cannot be undone.')) event.preventDefault(); }}>Delete</button>
                </form>
                <a href={`/videos/${video.id}`} class="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-teal-200">View</a>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="text-white/70 text-lg py-12 text-center">You haven't uploaded any videos yet.</div>
    {/if}
  </div>
</div>
