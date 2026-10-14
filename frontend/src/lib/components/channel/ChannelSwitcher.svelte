<script>
    import { onMount } from 'svelte';
    import ChannelCard from './ChannelCard.svelte';
    import { channels, activeChannel, loadChannels, setActiveChannel } from '$lib/stores/channel.js';
    import { goto } from '$app/navigation';

    onMount(loadChannels);

    function select(channel) {
        setActiveChannel(channel);
        goto(`/watch/${channel.id}`);
    }
</script>

<aside class="switcher">
    <h2>Channels</h2>
    {#each $channels as channel (channel.id)}
        <ChannelCard
            {channel}
            active={$activeChannel?.id === channel.id}
            onClick={() => select(channel)}
        />
    {:else}
        <p class="empty">No channels yet — create one in the dashboard.</p>
    {/each}
    <a href="/dashboard" class="dash-link">Dashboard →</a>
</aside>

<style>
    .switcher {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
        background: #111;
        width: 220px;
        height: 100vh;
        overflow-y: auto;
    }
    h2 { color: #fff; font-size: 1rem; margin: 0 0 0.5rem; }
    .empty    { color: #666; font-size: 0.8rem; }
    .dash-link {
        margin-top: auto;
        font-size: 0.8rem;
        color: #888;
        text-decoration: none;
    }
    .dash-link:hover { color: #fff; }
</style>