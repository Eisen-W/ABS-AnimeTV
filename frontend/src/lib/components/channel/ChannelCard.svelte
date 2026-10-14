<script>
    export let channel;
    export let active = false;
    export let onClick = () => {};
</script>

<button class="card" class:active on:click={onClick}>
    <span class="name">{channel.name}</span>
    <span class="meta">{channel.slot_window_min}min slots · {channel.requeue_mode}</span>
</button>

<style>
    .card {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.75rem 1rem;
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 6px;
        cursor: pointer;
        text-align: left;
        width: 100%;
        transition: border-color 0.15s;
    }
    .card:hover  { border-color: #666; }
    .card.active { border-color: #e05;  }
    .name  { font-size: 0.95rem; font-weight: 600; color: #fff; }
    .meta  { font-size: 0.75rem; color: #888; }
</style>