<script>
    import AlertCard from '$lib/components/dashboard/AlertCard.svelte';
    import { alerts, loading, loadAlerts } from '$lib/stores/alerts.js';
    import { runBatch } from '$lib/utils/api.js';
    import { onMount } from 'svelte';

    onMount(loadAlerts);

    async function triggerBatch() {
        // hits first channel's batch endpoint — fine for single-user
        try {
            await fetch('http://localhost:3001/channels', { method: 'GET' })
                .then(r => r.json())
                .then(channels => {
                    if (channels[0]) {
                        fetch(`http://localhost:3001/channels/${channels[0].id}/batch`, { method: 'POST' });
                    }
                });
            alert('Batch job started in background.');
        } catch (err) {
            alert('Failed to trigger batch: ' + err.message);
        }
    }
</script>

<div class="overview">
    <div class="header">
        <h1>Dashboard</h1>
        <button on:click={triggerBatch}>Run Batch Now</button>
    </div>

    <section>
        <h2>Alerts</h2>
        {#if $loading}
            <p class="state">Loading...</p>
        {:else if !$alerts.length}
            <p class="state">No unresolved alerts.</p>
        {:else}
            <div class="alerts">
                {#each $alerts as alert (alert.id)}
                    <AlertCard {alert} />
                {/each}
            </div>
        {/if}
    </section>
</div>

<style>
    .overview { display: flex; flex-direction: column; gap: 1.5rem; }
    .header   { display: flex; align-items: center; justify-content: space-between; }
    h1 { font-size: 1.4rem; }
    h2 { font-size: 1rem; color: #aaa; margin-bottom: 0.75rem; }
    .alerts { display: flex; flex-direction: column; gap: 0.5rem; }
    .state  { color: #666; font-size: 0.85rem; }
    button {
        padding: 0.4rem 1rem;
        background: #222;
        border: 1px solid #444;
        border-radius: 4px;
        color: #eee;
        cursor: pointer;
        font-size: 0.82rem;
    }
    button:hover { background: #333; }
</style>