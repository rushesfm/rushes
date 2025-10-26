<script lang="ts">
  import { getUserById as lookupUser } from '$lib/stores/library';
  import { page } from '$app/stores';

  let { data } = $props();

  // Get user data from the centralized database
  const userId = $page.params.id;
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
      <h1 class="text-2xl font-medium dark:text-neutral-200 mb-2">{user.name}</h1>
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
