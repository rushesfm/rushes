<script lang="ts">
  import type { PageData } from './$types';
  import BreadcrumbBar, { type BreadcrumbEntry } from '$lib/components/BreadcrumbBar.svelte';
  import { goto } from '$app/navigation';

  interface Props { data: PageData }
  const { data }: Props = $props();

  let viewMode = $state<'grid'|'list'>('grid');

  function startEditing(video) {
    goto(`/account/uploads/${video.id}`);
  }
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

  const breadcrumbItems: BreadcrumbEntry[] = [
    { label: 'My Account', href: '/account' },
    { label: 'My Uploads' }
  ];
</script>

<div class="min-h-screen p-8 bg-black/80">
  <div class="mx-auto w-full max-w-6xl">
    <BreadcrumbBar items={breadcrumbItems} />
    <header class="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
      <h1 class="text-3xl font-bold text-white">Your Uploads</h1>
      <div class="flex gap-2 items-center">
        <button class="px-3 py-1 text-sm border border-white/10 text-white/80 bg-white/10 hover:bg-white/20 transition font-medium" aria-pressed={viewMode==='grid'} on:click={()=>viewMode='grid'}>Grid</button>
        <button class="px-3 py-1 text-sm border border-white/10 text-white/80 bg-white/10 hover:bg-white/20 transition font-medium" aria-pressed={viewMode==='list'} on:click={()=>viewMode='list'}>List</button>
        <a href="/account" class="text-sm px-3 py-2 border border-white/10 text-white/70 hover:bg-white/10 transition ml-2">← Back to Account</a>
      </div>
    </header>

    {#if data.userVideos && data.userVideos.length > 0}
      {#if viewMode === 'grid'}
        <div class="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {#each data.userVideos as video (video.id)}
            <div class="relative group bg-white/5 border border-white/10 overflow-hidden shadow flex flex-col">
              <button on:click={()=>startEditing(video)} class="h-40 w-full block bg-black border-b border-white/10 overflow-hidden cursor-pointer">
                <img src={video.thumbnailUrl ?? 'https://placehold.co/400x225?text=No+Thumbnail'} alt={video.title} class="w-full h-full object-cover"/>
              </button>
              <div class="flex-1 flex flex-col justify-between p-3">
                <div>
                  <h3 class="font-semibold text-white text-base truncate">{video.title}</h3>
                  <p class="text-xs text-white/40 truncate">{video.description ?? ''}</p>
                  <p class="text-[10px] text-white/30">{formatDateTime(video.uploadedAt ?? video.createdAt)}</p>
                </div>
                <div class="flex gap-2 mt-3">
                  <button class="text-xs px-2 py-1 border border-white/20 bg-white/5 hover:bg-white/10 text-white transition inline-flex items-center gap-1" on:click={()=>startEditing(video)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Edit
                  </button>
                  <form method="POST" action="?/deleteVideo" style="display:inline">
                    <input type="hidden" name="videoId" value={video.id} />
                    <button type="submit" class="text-xs px-2 py-1 border border-rose-700/30 bg-rose-700/10 hover:bg-rose-700/20 text-rose-300 transition inline-flex items-center gap-1" on:click={event => { if (!confirm('Are you sure you want to delete this video? This cannot be undone.')) event.preventDefault(); }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="border border-white/10 overflow-hidden divide-y divide-white/10 bg-white/5">
          <div class="hidden md:grid grid-cols-6 px-4 py-2 text-white/50 text-xs font-semibold bg-white/10">
            <div class="col-span-2">Title</div>
            <div>Description</div>
            <div>Date</div>
            <div>Thumbnail</div>
            <div>Actions</div>
          </div>
          {#each data.userVideos as video (video.id)}
            <div class="grid grid-cols-1 md:grid-cols-6 items-center px-4 py-2 text-white/90 hover:bg-white/7 transition">
              <div class="md:col-span-2 font-semibold truncate">{video.title}</div>
              <div class="truncate">{video.description ?? ''}</div>
              <div class="truncate text-xs text-white/50">{formatDateTime(video.uploadedAt ?? video.createdAt)}</div>
              <div>
                <button on:click={()=>startEditing(video)} class="cursor-pointer">
                  <img src={video.thumbnailUrl ?? 'https://placehold.co/120x68?text=No+Thumb'} alt={video.title} class="w-[60px] h-[34px] object-cover border border-white/15"/>
                </button>
              </div>
              <div class="flex gap-1">
                <button class="text-xs px-2 py-1 border border-white/20 bg-white/5 hover:bg-white/10 text-white transition inline-flex items-center gap-1" on:click={()=>startEditing(video)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  Edit
                </button>
                <form method="POST" action="?/deleteVideo" style="display:inline">
                  <input type="hidden" name="videoId" value={video.id} />
                  <button type="submit" class="text-xs px-2 py-1 border border-rose-700/30 bg-rose-700/10 hover:bg-rose-700/20 text-rose-300 transition inline-flex items-center gap-1" on:click={event => { if (!confirm('Are you sure you want to delete this video? This cannot be undone.')) event.preventDefault(); }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Delete
                  </button>
                </form>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="text-white/70 text-lg py-12 text-center">You haven't uploaded any videos yet.</div>
    {/if}
  </div>
</div>
