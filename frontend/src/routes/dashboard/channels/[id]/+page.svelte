<script>
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import PoolFilter from '$lib/components/dashboard/PoolFilter.svelte';
    import { channelsApi } from '$lib/utils/api.js';

    $: id = $page.params.id;

    let channel  = null;
    let loading  = true;
    let saving   = false;
    let msg      = '';

    // editable fields
    let name, slotWindow, requeueMode, fillerPath, airDelay;
    let poolFilters = {};
    let blacklistGenres = '', blacklistShows = '', exceptions = '';

    onMount(async () => {
        channel = await channelsApi.get(id);
        name          = channel.name;
        slotWindow    = channel.slot_window_min;
        requeueMode   = channel.requeue_mode;
        fillerPath    = channel.filler_path ?? '';
        airDelay      = channel.air_delay_days;
        poolFilters   = JSON.parse(channel.pool_filters  ?? '{}');

        const bl      = JSON.parse(channel.blacklist ?? '{}');
        blacklistGenres = (bl.genres ?? []).join(', ');
        blacklistShows  = (bl.shows  ?? []).join(', ');
        exceptions      = (JSON.parse(channel.exceptions ?? '[]')).join(', ');

        loading = false;
    });

    async function save() {
        saving = true; msg = '';
        try {
            await channelsApi.update(id, {
                name,
                slot_window_min: Number(slotWindow),
                requeue_mode:    requeueMode,
                filler_path:     fillerPath || null,
                air_delay_days:  Number(airDelay),
                pool_filters:    poolFilters,
                blacklist: {
                    genres: blacklistGenres.split(',').map(s => s.trim()).filter(Boolean),
                    shows:  blacklistShows.split(',').map(s => Number(s.trim())).filter(Boolean),
                },
                exceptions: exceptions.split(',').map(s => Number(s.trim())).filter(Boolean),
            });
            msg = 'Saved.';
        } catch (err) {
            msg = 'Error: ' + err.message;
        } finally {
            saving = false;
        }
    }

    async function syncMAL() {
        msg = 'Syncing...';
        try {
            const res = await channelsApi.sync(id);
            msg = `Synced ${res.synced} shows from MAL.`;
        } catch (err) {
            msg = 'Sync failed: ' + err.message;
        }
    }

    async function addShow() {
        const malId    = prompt('MAL ID:');
        const startDate = prompt('Start date (YYYY-MM-DD):');
        const startTime = prompt('Start time (HH:MM):');
        if (!malId || !startDate || !startTime) return;
        try {
            await channelsApi.addShow(id, {
                mal_id:     Number(malId),
                start_date: startDate,
                start_time: startTime,
            });
            msg = 'Show added — schedule building in background.';
        } catch (err) {
            msg = 'Error: ' + err.message;
        }
    }
</script>

<div class="editor">
    {#if loading}
        <p>Loading...</p>
    {:else}
        <div class="header">
            <h1>{name}</h1>
            <div class="actions">
                <button on:click={syncMAL}>Sync MAL</button>
                <button on:click={addShow}>+ Add Show</button>
                <button class="save" on:click={save} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>

        {#if msg}<p class="msg">{msg}</p>{/if}

        <section>
            <h2>General</h2>
            <label>Name <input bind:value={name} /></label>
            <label>Slot window (minutes) <input type="number" bind:value={slotWindow} /></label>
            <label>
                Requeue mode
                <select bind:value={requeueMode}>
                    <option value="loop">Loop</option>
                    <option value="random">Random</option>
                    <option value="manual">Manual</option>
                </select>
            </label>
            <label>Air delay (days) <input type="number" bind:value={airDelay} /></label>
            <label>Filler path <input bind:value={fillerPath} placeholder="filler/my-channel/" /></label>
        </section>

        <section>
            <h2>Pool Filters</h2>
            <PoolFilter filters={poolFilters} onChange={f => poolFilters = f} />
        </section>

        <section>
            <h2>Blacklist</h2>
            <label>Genres (comma-separated) <input bind:value={blacklistGenres} placeholder="isekai, ecchi" /></label>
            <label>Show IDs (comma-separated MAL IDs) <input bind:value={blacklistShows} /></label>
        </section>

        <section>
            <h2>Exceptions</h2>
            <label>MAL IDs that bypass the blacklist <input bind:value={exceptions} /></label>
        </section>
    {/if}
</div>

<style>
    .editor  { display: flex; flex-direction: column; gap: 1.5rem; max-width: 640px; }
    .header  { display: flex; align-items: center; justify-content: space-between; }
    h1 { font-size: 1.4rem; }
    h2 { font-size: 0.9rem; color: #888; margin-bottom: 0.5rem; }
    section  { display: flex; flex-direction: column; gap: 0.6rem; }
    label {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        font-size: 0.82rem;
        color: #aaa;
    }
    input, select {
        padding: 0.4rem 0.6rem;
        background: #222;
        border: 1px solid #444;
        border-radius: 4px;
        color: #eee;
        font-size: 0.85rem;
    }
    input:focus, select:focus { outline: none; border-color: #666; }
    .actions { display: flex; gap: 0.5rem; }
    button {
        padding: 0.4rem 0.9rem;
        background: #222;
        border: 1px solid #444;
        border-radius: 4px;
        color: #eee;
        cursor: pointer;
        font-size: 0.82rem;
    }
    button:hover { background: #333; }
    .save { border-color: #e05; color: #f88; }
    .save:hover { background: #311; }
    .msg { font-size: 0.82rem; color: #aaa; }
</style>