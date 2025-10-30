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
        <button class="px-3 py-1 text-sm rounded border border-white/10 text-white/80 bg-white/10 hover:bg-white/20 transition font-medium" aria-pressed={viewMode==='grid'} on:click={()=>viewMode='grid'}>Grid</button>
        <button class="px-3 py-1 text-sm rounded border border-white/10 text-white/80 bg-white/10 hover:bg-white/20 transition font-medium" aria-pressed={viewMode==='list'} on:click={()=>viewMode='list'}>List</button>
        <a href="/account" class="text-sm rounded px-3 py-2 border border-white/10 text-white/70 hover:bg-white/10 transition ml-2">← Back to Account</a>
      </div>
    </header>

    {#if data.userVideos && data.userVideos.length > 0}
      {#if viewMode === 'grid'}
        <div class="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {#each data.userVideos as video (video.id)}
            <div class="relative group bg-white/5 rounded-xl border border-white/10 overflow-hidden shadow flex flex-col">
              <a href={`/videos/${video.id}`} class="h-40 w-full block bg-black border-b border-white/10 overflow-hidden">
                <img src={video.thumbnailUrl ?? 'https://placehold.co/400x225?text=No+Thumbnail'} alt={video.title} class="w-full h-full object-cover"/>
              </a>
              <div class="flex-1 flex flex-col justify-between p-3">
                <div>
                  <h3 class="font-semibold text-white text-base truncate">{video.title}</h3>
                  <p class="text-xs text-white/40 truncate">{video.description ?? ''}</p>
                  <p class="text-[10px] text-white/30">{formatDateTime(video.uploadedAt ?? video.createdAt)}</p>
                </div>
                <div class="flex gap-2 mt-3">
                  <button class="text-xs px-2 py-1 rounded bg-teal-700/80 hover:bg-teal-600 text-white" on:click={()=>startEditing(video)}>Edit</button>
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
        <div class="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/10 bg-white/5">
          <div class="hidden md:grid grid-cols-7 px-4 py-2 text-white/50 text-xs font-semibold bg-white/10">
            <div class="col-span-2">Title</div>
            <div>Description</div>
            <div>Date</div>
            <div>Thumbnail</div>
            <div colspan="2">Actions</div>
          </div>
          {#each data.userVideos as video (video.id)}
            <div class="grid grid-cols-1 md:grid-cols-7 items-center px-4 py-2 text-white/90 hover:bg-white/7 transition">
              <div class="md:col-span-2 font-semibold truncate">{video.title}</div>
              <div class="truncate">{video.description ?? ''}</div>
              <div class="truncate text-xs text-white/50">{formatDateTime(video.uploadedAt ?? video.createdAt)}</div>
              <div>
                <a href={`/videos/${video.id}`}>  <img src={video.thumbnailUrl ?? 'https://placehold.co/120x68?text=No+Thumb'} alt={video.title} class="w-[60px] h-[34px] rounded object-cover border border-white/15"/></a>
              </div>
              <div class="flex gap-1">
                <button class="text-xs px-2 py-1 rounded bg-teal-700/80 hover:bg-teal-600 text-white" on:click={()=>startEditing(video)}>Edit</button>
                <form method="POST" action="?/deleteVideo" style="display:inline">
                  <input type="hidden" name="videoId" value={video.id} />
                  <button type="submit" class="text-xs px-2 py-1 rounded bg-rose-700/80 hover:bg-rose-600 text-white" on:click={event => { if (!confirm('Are you sure you want to delete this video? This cannot be undone.')) event.preventDefault(); }}>Delete</button>
                </form>
                <a href={`/videos/${video.id}`} class="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-teal-200">View</a>
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
