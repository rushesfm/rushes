<script lang="ts">
  import { page } from '$app/stores';
  import { selectedVideo } from '$lib/stores/selectedVideo';
  import { onMount } from 'svelte';

  onMount(() => {
    // Set the video based on the URL
    const videoId = $page.params.id;
    if (videoId) {
      // First select the video
      selectedVideo.selectVideo(videoId);
      // Then ensure it's in full screen mode
      if (!$selectedVideo.isFullScreen) {
        selectedVideo.toggleFullScreen();
      }
    }
  });
</script>

<div class=" bg-neutral-950">
  <!-- Video info will be shown in the Playing component -->
</div>
