<script lang="ts">
    import { activeVideo } from '$lib/stores/video';
    import { selectedVideo } from '$lib/stores/selectedVideo';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import {gsap}  from "gsap/dist/gsap";
  import {ScrollTrigger} from "gsap/dist/ScrollTrigger";
  import VideoInfo from './VideoInfo.svelte';
  import VideoPlayer from './VideoPlayer.svelte';
  import { afterNavigate, goto } from '$app/navigation';

  
  import type { Video } from '$lib/types/content';
  import { getVideoById as lookupVideo, videosStore } from '$lib/stores/library';

  interface VideoData {
    video: Video;
  }

  let videoContainer = $state<HTMLDivElement>();
  let vidPlayer = $state<HTMLDivElement>();
  let isPip = $state(false);
  let videoData = $state<VideoData | null>(null);

  async function fetchVideoData(id: string) {
    try {
      let video = lookupVideo(id);
      if (!video && id === 'home') {
        video = $videosStore[0];
      }
      if (!video) throw new Error('Video not found');

      videoData = { video };

      // Update active video
      activeVideo.setActive({
        id: video.id,
        url: video.videoUrl ?? video.url ?? '',
        title: video.title,
        author: video.author,
        authorId: video.authorId,
        durationSeconds: video.durationSeconds ?? 0,
        thumbnailUrl: video.thumbnailUrl ?? undefined
      });
    } catch (error) {
      console.error('Error fetching video data:', error);
    }
  }

let manualOverride = false;

function togglePip() {
  const currentPath = $page.url.pathname;
  const isVideoDetailPage = currentPath.startsWith('/videos/') && currentPath !== '/videos';

  // If we're on a video detail page and minimizing (going to PiP), navigate back
  if (isVideoDetailPage && !isPip) {
    // Navigate to previous page or videos list
    goto('/videos');
    return;
  }

  isPip = !isPip;
  manualOverride = true;
  selectedVideo.toggleFullScreen();

  if (isPip && videoContainer) {
    gsap.to(videoContainer, {
      y: window.innerHeight - 180,
      x: -20,
      width: '280px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      duration: 0.5,
      ease: 'power2.out'
    });
  } else if (videoContainer) {
    gsap.to(videoContainer, {
      y: 0,
      x: 0,
      width: '100%',
      borderRadius: 0,
      boxShadow: 'none',
      duration: 0.5,
      ease: 'power2.inOut'
    });
  }

  // Clear manual override after a short delay
  setTimeout(() => {
    manualOverride = false;
  }, 1000);
}

  onMount(async () => {
    try {
      if ($selectedVideo.id) {
        let video = lookupVideo($selectedVideo.id);
        if (!video && $selectedVideo.id === 'home') {
          video = $videosStore[0];
        }
        if (video) {
          videoData = { video };
        }
      }
    } catch (e) {
      console.error('Error loading video:', e);
    }
  });

// onMount(async () => {
//    gsap.registerPlugin(ScrollTrigger);
//    const scroller = document.querySelector('.scroll-container');

//   ScrollTrigger.create({
//     trigger: videoContainer,
//     start: "top top",
//     end: "+=250",
//     scrub: true,
//     scroller,
//     onUpdate: (self) => {
//       if (manualOverride) return;

//       const progress = self.progress;

//       const pipScale = gsap.utils.interpolate(1, 0.28, progress); // shrink to ~28%
//       const pipX = gsap.utils.interpolate(0, -20, progress);
//       const pipY = gsap.utils.interpolate(0, window.innerHeight - 180, progress);
//       const borderRadius = gsap.utils.interpolate(0, 8, progress);
//       const boxShadow = progress > 0.9
//         ? '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
//         : 'none';

//       gsap.to(vidPlayer, {
//         scale: pipScale,
//         x: pipX,
//         y: pipY,
//         zIndex: 999999,
//         borderRadius,
//         boxShadow,
//         transformOrigin: 'bottom right',
//         duration: 0.2,
//         overwrite: 'auto'
//       });

//     },
//     invalidateOnRefresh: true
//   });
// });

  onMount(() => {
  const handleRouteChange = () => {
    const currentPath = $page.url.pathname;

    const isFullscreenRoute =
      (currentPath.startsWith('/videos/') && currentPath !== '/videos') ||
      currentPath === '/live';

    if ($selectedVideo.id) {
      if (isFullscreenRoute && isPip) {
        togglePip(); 
        isPip = false;
      } else if (!isFullscreenRoute && !isPip) {
        togglePip();
        isPip = true;
      }
    }

  };

  afterNavigate(handleRouteChange);

  // Run it once immediately
  handleRouteChange();
});


  // Watch for selected video changes
  $effect(() => {
    if ($selectedVideo.id) {
      fetchVideoData($selectedVideo.id);
      isPip = !$selectedVideo.isFullScreen;
      
      // Animate based on isFullScreen state
      if (!$selectedVideo.isFullScreen && videoContainer) {
        gsap.to(videoContainer, {
          y: window.innerHeight - 180,
          x: -20,
          width: '280px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          duration: 0.5,
          ease: 'power2.out'
        });
      } else if (videoContainer) {
        gsap.to(videoContainer, {
          y: 0,
          x: 0,
          width: '100%',
          borderRadius: 0,
          boxShadow: 'none',
          duration: 0.5,
          ease: 'power2.inOut'
        });
      }
    }
  });

  // Watch for page changes
  
</script>

{#if $selectedVideo.id}
  <div 
    bind:this={videoContainer}
    class="video-container scroll-container h-full overflow-y-auto"
    
  >
    <button
      class="relative aspect-video bg-black cursor-pointer w-full text-left"
      onclick={togglePip}
      aria-label="Toggle picture-in-picture mode"
    >
      {#if $activeVideo?.url}
        <div class="vidplayer"  bind:this={vidPlayer}>
            <VideoPlayer videoUrl={$activeVideo.url} />
        </div>
      {/if}
      
      <!-- Video Info -->
      <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white pointer-events-none">
        <div class="flex items-center justify-between">
          <div class="p-4 flex items-center gap-4">
            <h3 class="text-sm font-medium truncate">{$activeVideo?.title}</h3>
            <p class="text-xs text-neutral-300">{$activeVideo?.author}</p>
          </div>
          <!-- PiP Toggle Button -->
         
        </div>
      </div>
    </button>

    {#if !isPip && videoData}
        <VideoInfo data={videoData} />
   
    {/if}
  </div>
{/if}

<style>
  .video-container {
    transform-origin: bottom right;
    position: fixed;
    top: 0;
    right: 0;
    background: black;
  }

</style> 
