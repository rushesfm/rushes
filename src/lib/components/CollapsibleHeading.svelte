<script lang="ts">
  import { slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export let title: string;
  export let isOpen: boolean;
  export let actionButton: { text: string; icon?: string; href?: string } | null = null;
</script>

<!-- <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-100/10 py-4 "> -->
 <div class="flex items-center justify-between  ">
  <button 
    class="flex items-center w-full gap-2 pb-5"
    onclick={() => isOpen = !isOpen}
  >
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="10" 
      height="10" 
      fill="currentColor" 
      class="text-black/30 dark:text-white -rotate-90 transition-transform duration-200" 
      class:rotate-0={isOpen}
      viewBox="0 0 16 16"
    >
      <path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>
    </svg>
    <h3 class="text-sm  font-medium dark:text-neutral-200">{title}</h3>
  </button>
  {#if actionButton}
    {#if actionButton.href}
      <a 
        href={actionButton.href}
        class="text-xs dark:text-neutral-400 hover:text-white transition-colors flex flex-shrink-0 w-auto items-center gap-1"
      >
        {#if actionButton.icon}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d={actionButton.icon} />
          </svg>
        {/if}
        {actionButton.text}
      </a>
    {:else}
      <button class="text-xs dark:text-neutral-400 hover:text-white transition-colors flex flex-shrink-0 w-auto items-center gap-1">
        {#if actionButton.icon}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d={actionButton.icon} />
          </svg>
        {/if}
        {actionButton.text}
      </button>
    {/if}
  {/if}
</div>

{#if isOpen}
  <div 
    transition:slide={{ 
      duration: 200,
      easing: cubicOut
    }}
  >
    <slot />
  </div>
{/if} 
