<script>
    import { resolveAlert } from '$lib/stores/alerts.js';

    export let alert;

    const typeLabel = {
        series_ending:  'Series Ending',
        repeated_push:  'Repeated Push',
        probe_fail:     'Probe Failed',
        pool_exhausted: 'Pool Exhausted',
        double_length:  'Double-Length Episode',
    };

    const typeColor = {
        series_ending:  '#f90',
        repeated_push:  '#f44',
        probe_fail:     '#f44',
        pool_exhausted: '#f44',
        double_length:  '#69f',
    };

    let payload = {};
    try { payload = JSON.parse(alert.payload ?? '{}'); } catch {}

    async function resolve() {
        await resolveAlert(alert.id);
    }
</script>

<div class="alert" style="border-left-color:{typeColor[alert.type] ?? '#888'}">
    <div class="header">
        <span class="type">{typeLabel[alert.type] ?? alert.type}</span>
        <span class="channel">{alert.channel_name}</span>
    </div>
    <div class="body">
        {#if alert.type === 'series_ending'}
            <p><strong>{payload.title}</strong> ends on {payload.final_date} (EP {payload.final_episode})</p>
        {:else if alert.type === 'repeated_push'}
            <p>Show ID {payload.mal_id} has been pushed repeatedly — consider widening its slot.</p>
        {:else if alert.type === 'probe_fail'}
            <p>Failed to probe slot {payload.slot_id} — EP {payload.episode} of show {payload.mal_id}.</p>
        {:else if alert.type === 'pool_exhausted'}
            <p>Random pool is empty after filters. Add shows or relax the filter rules.</p>
        {:else if alert.type === 'double_length'}
            <p>EP {payload.episode} of show {payload.mal_id} is {Math.round(payload.duration / 60)}m — may need a double slot.</p>
        {/if}
    </div>
    <button on:click={resolve}>Resolve</button>
</div>

<style>
    .alert {
        padding: 0.75rem 1rem;
        background: #1a1a1a;
        border-left: 3px solid #888;
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .type    { font-size: 0.85rem; font-weight: 600; color: #eee; }
    .channel { font-size: 0.75rem; color: #888; }
    .body p  { font-size: 0.82rem; color: #ccc; margin: 0; }
    button {
        align-self: flex-end;
        padding: 0.25rem 0.75rem;
        background: #333;
        border: 1px solid #555;
        border-radius: 4px;
        color: #eee;
        font-size: 0.8rem;
        cursor: pointer;
    }
    button:hover { background: #444; }
</style>