<script>
    import { onMount } from 'svelte';
    import { channels, loadChannels } from '$lib/stores/channel.js';
    import { channelsApi } from '$lib/utils/api.js';
    import { goto } from '$app/navigation';

    onMount(loadChannels);

    async function create() {
        const name = prompt('Channel name:');
        if (!name) return;
        const { id } = await channelsApi.create({ name });
        await loadChannels();
        goto(`/dashboard/channels/${id}`);
    }

    async function remove(id) {
        if (!confirm('Delete this channel and all its slots?')) return;
        await channelsApi.remove(id);
        loadChannels();
    }
</script>

<div class="channels">
    <div class="header">
        <h1>Channels</h1>
        <button on:click={create}>+ New Channel</button>
    </div>

    {#each $channels as channel (channel.id)}
        <div class="row">
            <div class="info">
                <span class="name">{channel.name}</span>
                <span class="meta">{channel.slot_window_min}min · {channel.requeue_mode}</span>
            </div>
            <div class="actions">
                <a href="/dashboard/channels/{channel.id}">Edit</a>
                <a href="/dashboard/schedule/{channel.id}">Schedule</a>
                <button class="del" on:click={() => remove(channel.id)}>Delete</button>
            </div>
        </div>
    {:else}
        <p class="empty">No channels yet.</p>
    {/each}
</div>

<style>
    .channels { display: flex; flex-direction: column; gap: 1rem; }
    .header   { display: flex; align-items: center; justify-content: space-between; }
    h1 { font-size: 1.4rem; }
    .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: #1a1a1a;
        border-radius: 6px;
        border: 1px solid #2a2a2a;
    }
    .info   { display: flex; flex-direction: column; gap: 0.15rem; }
    .name   { font-size: 0.9rem; font-weight: 600; }
    .meta   { font-size: 0.75rem; color: #666; }
    .actions { display: flex; gap: 0.75rem; align-items: center; }
    .actions a { font-size: 0.82rem; color: #aaa; text-decoration: none; }
    .actions a:hover { color: #fff; }
    button {
        padding: 0.35rem 0.9rem;
        background: #222;
        border: 1px solid #444;
        border-radius: 4px;
        color: #eee;
        cursor: pointer;
        font-size: 0.82rem;
    }
    button:hover { background: #333; }
    .del { border-color: #622; color: #f88; }
    .del:hover { background: #311; }
    .empty { color: #666; font-size: 0.85rem; }
</style>