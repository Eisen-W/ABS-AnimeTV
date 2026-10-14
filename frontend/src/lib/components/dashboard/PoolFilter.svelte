<script>
    export let filters  = {};
    export let onChange = () => {};

    let genres     = (filters.genres     ?? []).join(', ');
    let yearMin    = filters.year_range?.[0] ?? '';
    let yearMax    = filters.year_range?.[1] ?? '';
    let status     = (filters.status     ?? []).join(', ');
    let minScore   = filters.min_score   ?? '';

    function emit() {
        const out = {};
        if (genres)             out.genres     = genres.split(',').map(s => s.trim()).filter(Boolean);
        if (yearMin || yearMax) out.year_range = [Number(yearMin) || 0, Number(yearMax) || 9999];
        if (status)             out.status     = status.split(',').map(s => s.trim()).filter(Boolean);
        if (minScore !== '')    out.min_score  = Number(minScore);
        onChange(out);
    }
</script>

<div class="pool-filter">
    <label>
        Genres <small>(comma-separated)</small>
        <input bind:value={genres} on:change={emit} placeholder="comedy, romance" />
    </label>
    <label>
        Year range
        <div class="row">
            <input bind:value={yearMin} on:change={emit} type="number" placeholder="2000" />
            <span>–</span>
            <input bind:value={yearMax} on:change={emit} type="number" placeholder="2024" />
        </div>
    </label>
    <label>
        Status <small>(comma-separated)</small>
        <input bind:value={status} on:change={emit} placeholder="finished, airing" />
    </label>
    <label>
        Min score
        <input bind:value={minScore} on:change={emit} type="number" step="0.1" min="0" max="10" placeholder="7.0" />
    </label>
</div>

<style>
    .pool-filter { display: flex; flex-direction: column; gap: 0.75rem; }
    label {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.82rem;
        color: #aaa;
    }
    small { color: #666; }
    input {
        padding: 0.4rem 0.6rem;
        background: #222;
        border: 1px solid #444;
        border-radius: 4px;
        color: #eee;
        font-size: 0.85rem;
    }
    input:focus { outline: none; border-color: #666; }
    .row  { display: flex; align-items: center; gap: 0.5rem; }
    .row input { width: 80px; }
    span  { color: #666; }
</style>