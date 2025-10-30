<script lang="ts">
  import { getUserById as lookupUser, videosStore } from '$lib/stores/library';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { selectedVideo } from "$lib/stores/selectedVideo";
  import type { QueueContext } from "$lib/stores/selectedVideo";
  import { trackDirectLoad } from '$lib/utils/direct-load';

  let { data } = $props();

  // Get user data from the centralized database
  const userId = $page.params.id ?? '';
  const user = lookupUser(userId) || {
    id: userId,
    name: "Unknown User",
    avatar: "https://i.pravatar.cc/150?img=4",
    bio: "User not found",
    stats: {
      videos: 0,
      followers: 0,
      following: 0
    },
    videos: [],
    recentVideos: []
  };

  // Get all videos from this user
  const userVideos = $derived.by(() => {
    const videos = $videosStore;
    return videos.filter((video) => video.authorId === userId);
  });

  function handlePlayAll() {
    if (userVideos.length === 0) return;
    const videoIds = userVideos.map((v) => v.id);
    const context: QueueContext = {
      type: "user",
      label: user.name,
      videoIds
    };
    selectedVideo.setTemporaryQueue(videoIds, context);
  }

  // Track if auto-play has been triggered (prevent duplicate triggers)
  let autoPlayTriggered = $state(false);
  let wasDirectLoad = $state(false);
  
  trackDirectLoad((value) => {
    wasDirectLoad = value;
  });
  
  // Auto-play on direct page load (not internal navigation)
  // Use $effect to ensure stores are ready
  $effect(() => {
    if (!browser) return;
    if (autoPlayTriggered) return;
    if (!wasDirectLoad) return; // Only for direct loads
    
    const videos = userVideos;
    const hasQueueContext = !!$selectedVideo.queueContext;
    
    // Wait for videos to be loaded and stores initialized
    if (videos.length === 0) return;
    
    // Only auto-play if:
    // 1. No queue context (not interrupting playback)
    // 2. We have videos
    // 3. This was a direct load
    if (!hasQueueContext && videos.length > 0) {
      autoPlayTriggered = true;
      
      // Small delay to ensure everything is ready
      setTimeout(() => {
        if (userVideos.length > 0) {
          handlePlayAll();
        }
      }, 300);
    }
  });
</script>

<div class=" ">
  <!-- Profile Header -->
  <div class="flex items-start gap-6 mb-8">
    <img 
      src={user.avatar} 
      alt={user.name} 
      class="w-24 h-24 rounded-full"
    />
    <div class="flex-1">
      <div class="flex items-center justify-between mb-2">
        <h1 class="text-2xl font-medium dark:text-neutral-200">{user.name}</h1>
        {#if userVideos.length > 0}
          <button
            onclick={handlePlayAll}
            class="px-4 py-2 bg-orange-500/20 text-orange-400 border border-orange-500/40 rounded-lg hover:bg-orange-500/30 transition-colors font-medium text-sm flex items-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Play All
          </button>
        {/if}
      </div>
      <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{user.bio}</p>
      <div class="flex gap-6">
        <div>
          <span class="font-medium dark:text-neutral-200">{user.stats.videos}</span>
          <span class="text-sm text-neutral-600 dark:text-neutral-400 ml-1">videos</span>
        </div>
        <div>
          <span class="font-medium dark:text-neutral-200">{user.stats.followers}</span>
          <span class="text-sm text-neutral-600 dark:text-neutral-400 ml-1">followers</span>
        </div>
        <div>
          <span class="font-medium dark:text-neutral-200">{user.stats.following}</span>
          <span class="text-sm text-neutral-600 dark:text-neutral-400 ml-1">following</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Recent Videos -->
  <h2 class="text-lg font-medium dark:text-neutral-200 mb-4">Recent Videos</h2>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each user.recentVideos || [] as video}
      <a href="/videos/{video.id}" class="group">
        <div class="relative aspect-video rounded-lg overflow-hidden bg-white/10">
          <img
            src={video.thumbnail}
            alt={video.title}
            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
          <div class="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
            <p class="text-sm text-white">{video.title}</p>
            <p class="text-xs text-neutral-400">{video.duration}</p>
          </div>
        </div>
      </a>
    {/each}
  </div>
</div> 
