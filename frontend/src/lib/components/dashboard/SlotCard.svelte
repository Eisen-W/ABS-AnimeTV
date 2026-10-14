<script>
    export let slot;

    const statusColor = {
        scheduled: '#4a9',
        pushed:    '#f90',
        filler:    '#69f',
        buffer:    '#555',
        flagged:   '#f44',
    };
</script>

<div class="slot" style="border-left-color:{statusColor[slot.status] ?? '#444'}">
    <div class="time">{slot.start_time}</div>
    <div class="info">
        {#if slot.title}
            <span class="title">{slot.title}</span>
            <span class="ep">EP {slot.episode}</span>
        {:else if slot.status === 'filler'}
            <span class="title filler">Filler</span>
        {:else if slot.status === 'buffer'}
            <span class="title buffer">Buffer Zone</span>
        {:else}
            <span class="title empty">—</span>
        {/if}
    </div>
    <div class="meta">
        <span class="status">{slot.status}</span>
        {#if slot.push_count > 0}
            <span class="push">pushed ×{slot.push_count}</span>
        {/if}
        {#if slot.real_duration_s}
            <span class="dur">{Math.round(slot.real_duration_s / 60)}m</span>
        {/if}
    </div>
</div>

<style>
    .slot {
        display: grid;
        grid-template-columns: 3.5rem 1fr auto;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.75rem;
        border-left: 3px solid #444;
        background: #1a1a1a;
        border-radius: 4px;
        font-family: sans-serif;
    }
    .time   { font-size: 0.8rem; color: #888; font-variant-numeric: tabular-nums; }
    .info   { display: flex; flex-direction: column; gap: 0.1rem; }
    .title  { font-size: 0.85rem; color: #eee; font-weight: 500; }
    .ep     { font-size: 0.75rem; color: #888; }
    .filler { color: #69f; }
    .buffer { color: #555; }
    .empty  { color: #444; }
    .meta   { display: flex; flex-direction: column; align-items: flex-end; gap: 0.1rem; }
    .status { font-size: 0.7rem; color: #666; }
    .push   { font-size: 0.7rem; color: #f90; }
    .dur    { font-size: 0.7rem; color: #888; }
</style>