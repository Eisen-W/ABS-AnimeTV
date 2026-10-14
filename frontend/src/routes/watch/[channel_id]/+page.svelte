<script>
    import { onMount, onDestroy } from 'svelte';
    import { page } from '$app/stores';
    import HLSPlayer from '$lib/components/player/HLSPlayer.svelte';
    import FillerPlayer from '$lib/components/player/FillerPlayer.svelte';
    import PlayerOverlay from '$lib/components/player/PlayerOverlay.svelte';
    import ChannelSwitcher from '$lib/components/channel/ChannelSwitcher.svelte';
    import { fillerApi } from '$lib/utils/api.js';
    import { fillerDuration } from '$lib/utils/time.js';
    import {
        currentStream, streamUrl, offsetSeconds,
        currentSlot, nextSlot, isFiller,
        startPolling, stopPolling
    } from '$lib/stores/schedule.js';
    import { channels } from '$lib/stores/channel.js';

    $: channelId = $page.params.channel_id;
    $: channel   = $channels.find(c => c.id === channelId);

    let fillerSequence = [];
    let overlayVisible = true;
    let overlayTimer;

    function showOverlay() {
        overlayVisible = true;
        clearTimeout(overlayTimer);
        overlayTimer = setTimeout(() => overlayVisible = false, 4000);
    }

    async function loadFiller(slot) {
        const dur = fillerDuration(slot);
        if (!dur) { fillerSequence = []; return; }
        try {
            const res = await fillerApi.sequence(channelId, dur);
            fillerSequence = res.sequence ?? [];
        } catch { fillerSequence = []; }
    }

    $: if ($currentSlot) loadFiller($currentSlot);

    onMount(() => startPolling(channelId));
    onDestroy(() => { stopPolling(); clearTimeout(overlayTimer); });
</script>

<svelte:window on:mousemove={showOverlay} />

<div class="watch">
    <ChannelSwitcher />

    <div class="player-wrap" role="presentation" on:click={showOverlay}>
        {#if !$currentStream || !$currentStream.playing}
            <div class="no-signal">No signal — nothing scheduled right now.</div>

        {:else if $isFiller}
            <FillerPlayer sequence={fillerSequence} onDone={() => {}} />
            <PlayerOverlay
                channelName={channel?.name ?? channelId}
                slot={$currentSlot}
                title="Filler"
                visible={overlayVisible}
            />

        {:else}
            <HLSPlayer src={$streamUrl} offset={$offsetSeconds} />
            <PlayerOverlay
                channelName={channel?.name ?? channelId}
                slot={$currentSlot}
                title={$currentStream?.slot?.title ?? ''}
                visible={overlayVisible}
            />
        {/if}
    </div>
</div>

<style>
    .watch       { display: flex; height: 100vh; background: #000; }
    .player-wrap {
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .no-signal { color: #444; font-size: 1rem; }
</style>