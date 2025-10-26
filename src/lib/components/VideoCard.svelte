<script lang="ts">
  import { selectedVideo } from '$lib/stores/selectedVideo';

  export let video: {
    id: string;
    title: string;
    author: string;
    thumbnailUrl: string;
  };

  function handleVideoClick() {
    // If we're already on this video, toggle PiP
    if ($selectedVideo.id === video.id) {
      selectedVideo.toggleFullScreen();
    } else {
      // Otherwise select the new video
      selectedVideo.selectVideo(video.id);
    }
  }
</script>

<div 
  class="group relative aspect-video overflow-hidden rounded-lg bg-neutral-900 cursor-pointer"
  on:click={handleVideoClick}
>
  <img 
    src={video.thumbnailUrl} 
    alt={video.title}
    class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
  />
  <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
    <div class="absolute bottom-0 left-0 right-0 p-4">
      <h3 class="text-sm font-medium text-white truncate">{video.title}</h3>
      <p class="text-xs text-neutral-300">{video.author}</p>
    </div>
  </div>
</div> 