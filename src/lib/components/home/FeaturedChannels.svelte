<script lang="ts">
  import { usersStore } from '$lib/stores/library';

  function formatCount(value: number) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toString();
  }

  const featuredChannels = $derived(
    $usersStore.slice(0, 4).map((user) => ({
      id: user.id,
      name: user.name,
      description: user.bio,
      avatar: user.avatar,
      subscribers: formatCount(user.stats?.followers ?? 0),
      videos: user.stats?.videos ?? 0
    }))
  );
</script>

<section class="py-16 bg-gray-50 dark:bg-gray-900">
  <div class="mx-auto max-w-7xl px-6 lg:px-8">
    <div class="mx-auto max-w-2xl text-center">
      <h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
        Featured Channels
      </h2>
      <p class="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-300">
        Discover amazing creators and their unique perspectives
      </p>
    </div>
    
    <div class="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-8 lg:mx-0 lg:max-w-none lg:grid-cols-2">
      {#each featuredChannels as channel}
        <div class="group relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm hover:shadow-lg transition-all duration-300">
          <div class="flex items-start gap-4">
      
            
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {channel.name}
                </h3>
           
              </div>
              
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {channel.description}
              </p>
              
              <div class="mt-3 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span class="flex items-center gap-1">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                  </svg>
                  {channel.subscribers} subscribers
                </span>
                <span class="flex items-center gap-1">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                  </svg>
                  {channel.videos} videos
                </span>
              </div>
              
            
            </div>
          </div>
          
          <div class="mt-6 flex gap-3">
            <a 
              href={`/users/${channel.id}`}
              class="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
            >
              View Channel
            </a>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>
