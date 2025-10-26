<script lang="ts">
  import { videosStore } from '$lib/stores/library';

  const fallbackVideo = {
    id: 'placeholder',
    title: 'Featured Video',
    author: 'Creator',
    thumbnailUrl: 'https://placehold.co/800x450?text=Rushes'
  };

  const featuredVideo = $derived(($videosStore[0] ?? fallbackVideo));
</script>

<section class="relative overflow-hidden bg-black">
  <!-- Subtle dot pattern overlay -->
  <div class="absolute inset-0 opacity-30" style="background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,.6) 1px, transparent 0); background-size: 20px 20px;"></div>

  <!-- Additional subtle gradient overlay -->
  <div class="absolute inset-0 bg-gradient-to-br from-gray-900/50 via-transparent to-gray-900/50"></div>
  
  <div class="relative px-6 py-16 lg:py-24">
    <div class="mx-auto max-w-4xl text-center">
      <h1 class="text-4xl font-bold tracking-tight text-white sm:text-6xl">
         <span class="text-blue-400">Rushes</span>
      </h1>
      <p class="mt-6 text-lg leading-8 text-gray-300">
      </p>
      
      <div class="mt-10 flex items-center justify-center gap-x-6">
        <a
          href="/videos"
          class="rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white transition-all"
        >
          Explore Videos
        </a>
        <a
          href={`/videos/${featuredVideo.id}`}
          class="text-sm font-semibold leading-6 text-white hover:text-blue-400 transition-colors"
        >
          Watch Featured <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
    
    <!-- Featured Video Preview -->
    <div class="mx-auto mt-16 max-w-2xl">
      <div class="relative rounded-xl bg-gray-900/40 backdrop-blur-sm p-4 border border-gray-800/50">
        <div class="aspect-video overflow-hidden rounded-lg bg-gray-900">
          <img
            src={featuredVideo.thumbnailUrl ?? fallbackVideo.thumbnailUrl}
            alt={featuredVideo.title}
            class="h-full w-full object-cover"
          />
          <div class="absolute inset-0 flex items-center justify-center">
            <button class="rounded-full bg-black/60 p-4 backdrop-blur-sm hover:bg-black/80 transition-colors border border-gray-600" aria-label="Play featured video">
              <svg class="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="mt-4 text-center">
          <h3 class="text-lg font-semibold text-white">{featuredVideo.title}</h3>
          <p class="text-sm text-gray-400">by {featuredVideo.author}</p>
        </div>
      </div>
    </div>
  </div>
</section>
