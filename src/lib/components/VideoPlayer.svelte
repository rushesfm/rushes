<script lang="ts">
  import { onMount } from 'svelte';
  import 'hls-video-element';

  const props = $props<{
    videoUrl?: string;
    autoplay?: boolean;
    controls?: boolean;
    muted?: boolean;
    loop?: boolean;
    poster?: string;
  }>();

  let videoUrl = $state(props.videoUrl ?? '');
  let autoplay = $state(props.autoplay ?? false);
  let controls = $state(props.controls ?? true);
  let muted = $state(props.muted ?? false);
  let loop = $state(props.loop ?? false);
  let poster = $state<string | undefined>(props.poster);

  $effect(() => {
    videoUrl = props.videoUrl ?? '';
    autoplay = props.autoplay ?? false;
    controls = props.controls ?? true;
    muted = props.muted ?? false;
    loop = props.loop ?? false;
    poster = props.poster;
  });

const isHls = $derived(videoUrl?.toLowerCase().includes('.m3u8') ?? false);
let videoElement = $state<any>(null);

	onMount(() => {
		if (!videoElement) return;
		if (autoplay) {
			videoElement
				.play()
				.catch(() => {
					// Autoplay may be blocked; leave the video paused.
				});
		}
	});

	$effect(() => {
		if (!videoElement) return;
		if (!videoUrl) {
			videoElement.src = '';
			videoElement.removeAttribute('src');
			videoElement.pause();
			return;
		}

		const targetSrc = videoUrl ?? '';
		const currentSrc = videoElement.getAttribute('src') ?? '';
		if (currentSrc !== targetSrc) {
			if (isHls) {
				(videoElement as unknown as HTMLMediaElement).src = targetSrc;
				videoElement.setAttribute('src', targetSrc);
			} else {
				videoElement.src = targetSrc;
			}

			if (autoplay) {
				videoElement
					.play()
					.catch(() => {});
			} else {
				videoElement.pause();
			}
		}
	});
</script>

{#if videoUrl}
  {#if isHls}
    <hls-video
      bind:this={videoElement}
      class="video-player"
      crossorigin="anonymous"
      {controls}
      {loop}
      {muted}
      playsinline
      poster={poster}
    ></hls-video>
  {:else}
    <video
      bind:this={videoElement}
      class="video-player"
      {controls}
      {loop}
      {muted}
      playsinline
      poster={poster}
    >
      <source src={videoUrl} type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  {/if}
{:else}
  <div class="video-player video-player--empty">
    <p>No video selected</p>
  </div>
{/if}

<style>
	.video-player {
		width: 100%;
		height: 100%;
		display: block;
	
		background: black;
	}

	.video-player--empty {
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.875rem;
		background: rgba(17, 24, 39, 0.8);
		padding: 1.5rem;
	}
</style>
