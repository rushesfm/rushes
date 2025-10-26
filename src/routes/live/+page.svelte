<script lang="ts">
    import { onMount } from "svelte";
    import { selectedVideo } from "$lib/stores/selectedVideo";

    onMount(() => {
        // Ensure the player transitions into fullscreen layout
        selectedVideo.setFullScreen(true);
    });
</script>

<section class="live-wrapper">
    <div class="live-card">
        <span class="live-indicator">EN DIRECT</span>
        <h1>Flux en direct</h1>
        <p>
            La lecture principale occupe désormais tout l'écran. Sélectionnez un
            clip ou laissez la file s'enchaîner automatiquement pour alimenter
            le direct.
        </p>
    </div>
</section>

<style>
    .live-wrapper {
        min-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4rem 1.5rem;
        background: black;
    }

    .live-card {
        max-width: 560px;
        display: grid;
        gap: 1.25rem;
        padding: 2.5rem;
        border-radius: 1.5rem;
        border: 1px solid rgba(148, 163, 184, 0.25);
        background: rgba(15, 23, 42, 0.65);
        box-shadow: 0 40px 120px -60px rgba(30, 64, 175, 0.6);
        text-align: center;
        color: #e2e8f0;
    }

    .live-indicator {
        justify-self: center;
        padding: 0.4rem 1rem;
        border-radius: 999px;
        background: linear-gradient(135deg, #ef4444, #f97316);
        color: #0f172a;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.3em;
    }

    h1 {
        margin: 0;
        font-size: 2rem;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.6;
        color: rgba(226, 232, 240, 0.82);
    }

    @media (max-width: 640px) {
        .live-wrapper {
            padding: 2.5rem 1rem;
        }

        .live-card {
            padding: 2rem;
        }

        h1 {
            font-size: 1.6rem;
        }
    }
</style>
