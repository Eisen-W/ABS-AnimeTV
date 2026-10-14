<script>
    import { onDestroy } from 'svelte';
    import { secondsUntilSlotEnd, formatDuration } from '$lib/utils/time.js';

    export let channelName = '';
    export let slot        = null;
    export let title       = '';
    export let visible     = true;

    let remaining = 0;
    let timer;

    function tick() {
        if (slot) remaining = secondsUntilSlotEnd(slot);
    }

    $: if (slot) {
        clearInterval(timer);
        tick();
        timer = setInterval(tick, 1000);
    }

    onDestroy(() => clearInterval(timer));
</script>

{#if visible && slot}
    <div class="overlay">
        <div class="top">
            <span class="channel">{channelName}</span>
            <span class="remaining">{formatDuration(remaining)}</span>
        </div>
        <div class="bottom">
            <span class="title">{title}</span>
            {#if slot.episode}
                <span class="episode">EP {slot.episode}</span>
            {/if}
        </div>
    </div>
{/if}

<style>
    .overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 1rem;
        background: linear-gradient(
            to bottom,
            rgba(0,0,0,0.6) 0%,
            transparent 25%,
            transparent 75%,
            rgba(0,0,0,0.7) 100%
        );
    }
    .top, .bottom {
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #fff;
        font-family: sans-serif;
    }
    .channel   { font-size: 0.85rem; opacity: 0.8; }
    .remaining { font-size: 0.85rem; font-variant-numeric: tabular-nums; }
    .title     { font-size: 1rem; font-weight: 600; }
    .episode   { font-size: 0.85rem; opacity: 0.8; }
</style>