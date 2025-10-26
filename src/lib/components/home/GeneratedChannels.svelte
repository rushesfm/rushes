<script lang="ts">
  // Generate channels based on different criteria
  const generatedChannels = [
    {
      id: 'tokyo-streets',
      title: 'Around Tokyo - This Year',
      type: 'location',
      description: 'Unedited footage from Tokyo',
      location: 'Tokyo, Japan',
      videoCount: 12,
      thumbnails: [
        'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=200&h=112&fit=crop',
        'https://images.unsplash.com/photo-1513407030348-c983a97b98d8?w=200&h=112&fit=crop',
        'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=200&h=112&fit=crop',
        'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=200&h=112&fit=crop'
      ],
      generatedAt: '2024-01-15',
      badge: '📍'
    },
    {
      id: 'digital-art-week',
      title: 'Digital Art Week',
      type: 'keyword',
      description: 'Creative digital art processes and studio sessions',
      keyword: 'digital art',
      videoCount: 8,
      thumbnails: [
        'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=200&h=112&fit=crop',
        'https://images.unsplash.com/photo-1561736778-92e52a7769ef?w=200&h=112&fit=crop',
        'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&h=112&fit=crop',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&h=112&fit=crop'
      ],
      generatedAt: '2024-01-14',
      badge: '🎨'
    },
    {
      id: 'urban-exploration',
      title: 'Urban Exploration',
      type: 'vibe',
      description: 'Raw footage of abandoned places and hidden urban gems',
      query: 'abandoned urban exploration architecture',
      videoCount: 15,
      thumbnails: [
        'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=200&h=112&fit=crop',
        'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=200&h=112&fit=crop',
        'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&h=112&fit=crop',
        'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?w=200&h=112&fit=crop'
      ],
      generatedAt: '2024-01-13',
      badge: '🏗️'
    }
  ];

  function handleChannelClick(channelId: string) {
    // For now, just navigate to a channel page
    window.location.href = `/channels/${channelId}`;
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }
</script>

<section class="mb-16">
  <div class="text-center mb-8">
    <h2 class="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
      This Week's Featured Channels
    </h2>
  
  </div>

  <div class="space-y-4">
    {#each generatedChannels as channel}
      <div class="group cursor-pointer">
        <button
          onclick={() => handleChannelClick(channel.id)}
          class="w-full text-left border-t p-4 pb-1 transition-colors  border-gray-200/10 "
        >
          <div class="flex items-center justify-between w-full gap-4">
            <!-- Channel Badge -->
            <!--<div class="text-xl flex-shrink-0">{channel.badge}</div>
-->
            <!-- Overlapping Thumbnails -->
            <div class="flex -space-x-2 flex-shrink-0">
              {#each channel.thumbnails.slice(0, 5) as thumbnail, index}
                <div class="relative h-8 w-8  overflow-hidden rounded-full bg-gray-900 border-2 border-white dark:border-gray-900 shadow-sm">
                  <img
                    src={thumbnail}
                    alt="Video thumbnail {index + 1}"
                    class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              {/each}
            </div>

            <!-- Channel Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-end gap-2 mb-1">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                  {channel.title}
                </h3>

                <!-- Type Badge -->
                {#if channel.type === 'location'}
                  <span class="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900 px-2 py-0.5 text-xs font-medium text-green-800 dark:text-green-200 flex-shrink-0">
                    Location
                  </span>
                {:else if channel.type === 'keyword'}
                  <span class="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900 px-2 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-200 flex-shrink-0">
                    Keyword
                  </span>
                {:else if channel.type === 'vibe'}
                  <span class="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900 px-2 py-0.5 text-xs font-medium text-purple-800 dark:text-purple-200 flex-shrink-0">
                    Vibe
                  </span>
                {/if}
              </div>

              

               <div class="flex items-center justify-end gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>{channel.videoCount} videos</span>
                <span>•</span>
                <span>Generated {formatDate(channel.generatedAt)}</span>
                {#if channel.type === 'location'}
                  <span>•</span>
                  <span>{channel.location}</span>
                {:else if channel.type === 'keyword'}
                  <span>•</span>
                  <span>#{channel.keyword}</span>
                {/if}
              </div>
  <!-- <p class="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
                {channel.description}
              </p> -->

              
            
            </div>

            <!-- Arrow -->
            <div class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <svg class="h-5 w-5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          </div>
        </button>
      </div>
    {/each}
  </div>

  
</section>
