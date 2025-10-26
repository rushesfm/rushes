<script lang="ts">
  import { activeVideo } from '$lib/stores/video';
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';
  import VideoInfo from './VideoInfo.svelte';
  import VideoPlayer from './VideoPlayer.svelte';

  interface VideoData {
    video: {
      id: string;
      url: string;
      title: string;
      description: string;
      author: string;
      authorId: string;
      transcript: string;
      keywords: string[];
      locations: any[];
    }
  }

  let videoContainer: HTMLDivElement;
  let isPip = $state(false);
  let { data } = $props<{ data?: VideoData }>();

  function togglePip() {
    isPip = !isPip;
    
    // Animate to PiP mode
    if (isPip) {
      gsap.to(videoContainer, {
        y: window.innerHeight - 180, // offset to bottom
        x: -20,
        width: '280px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        duration: 0.5,
        ease: 'power2.out'
      });
    } 
    // Animate to full screen
    else {
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

  onMount(() => {
    // Set initial position based on isPip state
    if (isPip) {
      gsap.set(videoContainer, {
        y: window.innerHeight - 180, // offset to bottom
        x: window.innerWidth - 400,
        width: '280px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      });
    } else {
      gsap.set(videoContainer, {
        y: 0,
        x: 0,
        width: '100%',
        borderRadius: 0,
        boxShadow: 'none'
      });
    }
  });
</script>

<div 
  bind:this={videoContainer}
  class="video-container"
>
  <div class:dashboard-panel={!isPip}>
    <div class="relative aspect-video bg-black">
      {#if $activeVideo?.url}
        <VideoPlayer videoUrl={$activeVideo.url} />
      {/if}
          
      <!-- Video Info -->
      <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
        <div class="flex items-center justify-between">
          <div class="display-none">
            <h3 class="text-sm font-medium truncate">{$activeVideo?.title}</h3>
            <p class="text-xs text-neutral-300">{$activeVideo?.author}</p>
          </div>
            <!-- PiP Toggle Button -->
      <button
        on:click={togglePip}
        class="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
      >
        {#if isPip}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M4.5 7.5a.5.5 0 0 1 0 1H3a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1.5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a.5.5 0 0 1 .5-.5z"/>
          </svg>
        {:else}
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M4.5 7.5a.5.5 0 0 1 0 1H3a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h-1.5a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-1a.5.5 0 0 1 .5-.5z"/>
          </svg>
        {/if}
      </button>
        </div>
      </div>

    
    </div>

    {#if !isPip && data}
      <VideoInfo {data} />
    {/if}
  </div>
</div>

<style>
  .video-container {
    transform-origin: bottom right;
    position: fixed;
    top: 0;
    right: 0;
  }

  .dashboard-panel {
    border: 1px solid rgba(255, 255, 255, 0.1);
    background-color: rgba(255, 255, 255, 0.04);
    padding: 1.5rem;
  }
</style>