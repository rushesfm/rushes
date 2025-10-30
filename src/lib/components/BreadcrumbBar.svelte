<script lang="ts">
  export type BreadcrumbEntry = {
    label: string;
    href?: string;
  };

  export let items: BreadcrumbEntry[] = [];
</script>

{#if items.length > 0}
  <nav class="breadcrumb-bar">
    <ol class="breadcrumb-list">
      {#each items as item, index}
        <li class="breadcrumb-item">
          {#if item.href && index !== items.length - 1}
            <a href={item.href} class="breadcrumb-link">
              {item.label}
            </a>
          {:else}
            <span class="breadcrumb-current">
              {item.label}
            </span>
          {/if}
          {#if index < items.length - 1}
            <span class="breadcrumb-chevron" aria-hidden="true">›</span>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
{/if}

<style>
  .breadcrumb-bar {
    margin-bottom: 2rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.65), rgba(30, 41, 59, 0.55));
    backdrop-filter: blur(12px);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.25);
  }

  .breadcrumb-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.9rem 1.5rem;
    list-style: none;
    margin: 0;
  }

  .breadcrumb-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .breadcrumb-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
    padding: 0.35rem 0.9rem;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
    text-decoration: none;
    transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
  }

  .breadcrumb-link:hover {
    border-color: rgba(255, 255, 255, 0.35);
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
  }

  .breadcrumb-current {
    color: #fff;
    font-weight: 700;
  }

  .breadcrumb-chevron {
    color: rgba(226, 232, 240, 0.6);
    font-size: 1rem;
  }

  @media (max-width: 640px) {
    .breadcrumb-list {
      padding: 0.75rem 1.1rem;
      gap: 0.4rem;
    }

    .breadcrumb-item {
      font-size: 0.8rem;
    }

    .breadcrumb-link {
      padding: 0.3rem 0.75rem;
    }
  }
</style>
