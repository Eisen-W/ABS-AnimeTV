<script>
    import { onMount } from 'svelte';
    import SlotCard from './SlotCard.svelte';
    import { scheduleApi } from '$lib/utils/api.js';

    export let channelId;

    let slots   = [];
    let loading = true;
    let error   = null;

    // group slots by date
    $: byDate = slots.reduce((acc, slot) => {
        (acc[slot.date] ??= []).push(slot);
        return acc;
    }, {});

    onMount(async () => {
        try {
            slots = await scheduleApi.week(channelId);
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    });
</script>

<div class="grid">
    {#if loading}
        <p class="state">Loading schedule...</p>
    {:else if error}
        <p class="state error">{error}</p>
    {:else if !slots.length}
        <p class="state">No slots scheduled for the next 7 days.</p>
    {:else}
        {#each Object.entries(byDate) as [date, daySlots]}
            <section>
                <h3>{date}</h3>
                <div class="slots">
                    {#each daySlots as slot (slot.slot_id)}
                        <SlotCard {slot} />
                    {/each}
                </div>
            </section>
        {/each}
    {/if}
</div>

<style>
    .grid    { display: flex; flex-direction: column; gap: 1.5rem; }
    section  { display: flex; flex-direction: column; gap: 0.5rem; }
    h3       { color: #aaa; font-size: 0.85rem; margin: 0; }
    .slots   { display: flex; flex-direction: column; gap: 0.35rem; }
    .state   { color: #666; font-size: 0.85rem; }
    .error   { color: #f44; }
</style>