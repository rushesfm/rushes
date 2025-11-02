<script lang="ts">
   interface ToggleOption {
        value: string;
        icon: string; // SVG markup
        label: string;
        ariaLabel?: string;
    }

    interface Props {
        options: ToggleOption[];
        value: string;
        onValueChange?: (value: string) => void;
    }

    let { options, value, onValueChange }: Props = $props();

    function handleClick(optionValue: string) {
        if (onValueChange) {
            onValueChange(optionValue);
        }
    }

    // Get the index of the active option
    const activeIndex = $derived(options.findIndex(opt => opt.value === value));
    
    // Calculate the number of options for dynamic width
    const optionCount = $derived(options.length);
    
    // Calculate highlight transform dynamically
    const highlightTransform = $derived.by(() => {
        const index = activeIndex >= 0 ? activeIndex : 0;
        if (index === 0) return "translateX(0)";
        
        // Each step is 100% of the highlight's own (now correct) width
        const translatePercent = 100 * index;
        
        // No extra spacing is needed!
        return `translateX(${translatePercent}%)`;
    });
</script>

<div 
    class="toggle-pill-container"
    data-active-index={activeIndex >= 0 ? activeIndex : 0}
    style="--option-count: {optionCount}; --highlight-transform: {highlightTransform};"
>
    {#each options as option, index}
        <button
            onclick={() => handleClick(option.value)}
            class="toggle-pill-btn {value === option.value ? 'active' : ''}"
            aria-label={option.ariaLabel || option.label}
            title={option.label}
        >
            {@html option.icon}
        </button>
    {/each}
</div>

<style>
    .toggle-pill-container {
        display: inline-flex;
        gap: 0;
        padding: 0.25rem;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        position: relative;
    }

    .toggle-pill-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.5rem 0.75rem;
        border: none;
        background: transparent;
        color: rgba(255, 255, 255, 0.6);
        cursor: pointer;
        border-radius: 9999px;
        transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        flex-shrink: 0;
        position: relative;
        z-index: 1;
        min-width: 40px;
    }

    .toggle-pill-btn:hover {
        color: rgba(255, 255, 255, 0.8);
    }

    .toggle-pill-btn.active {
        color: white;
    }

    .toggle-pill-btn :global(svg) {
        width: 18px;
        height: 18px;
        position: relative;
        z-index: 1;
    }

    /* Animated orange highlight background */
    .toggle-pill-container::before {
        content: '';
        position: absolute;
        top: 0.25rem;
        bottom: 0.25rem;
        left: 0.25rem;

        /* * FIX: Account for left/right container padding (0.25rem + 0.25rem = 0.5rem)
         * We calculate the width based on the *available inner space*, not the full width.
         */
        width: calc((100% - 0.5rem) / var(--option-count));

        background: rgb(255, 132, 0);
        border-radius: 9999px;
        transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), 
                    width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        z-index: 0;
        will-change: transform;
        pointer-events: none;
        transform: var(--highlight-transform, translateX(0));
    }
</style>

