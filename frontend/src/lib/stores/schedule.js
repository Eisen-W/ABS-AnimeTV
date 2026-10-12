import { writable, derived } from 'svelte/store';
import { streamApi } from '$lib/utils/api.js';
import { computeOffset, secondsUntilSlotEnd, fillerDuration } from '$lib/utils/time.js';

export const currentStream  = writable(null);  // full response from /stream/:channelId
export const polling        = writable(false);

let pollTimer  = null;
let slotTimer  = null;

// derived values components can read directly
export const currentSlot   = derived(currentStream, $s => $s?.slot   ?? null);
export const streamUrl     = derived(currentStream, $s => $s?.stream_url ?? null);
export const offsetSeconds = derived(currentStream, $s => $s?.offset_seconds ?? 0);
export const nextSlot      = derived(currentStream, $s => $s?.next   ?? null);
export const isFiller      = derived(currentStream, $s => $s?.type === 'filler');

export async function fetchCurrentStream(channelId) {
    try {
        const data = await streamApi.current(channelId);
        currentStream.set(data);
        return data;
    } catch (err) {
        console.error('[schedule-store] fetch failed:', err.message);
        return null;
    }
}

// poll backend at slot boundaries so player auto-refreshes
export function startPolling(channelId) {
    stopPolling();
    polling.set(true);

    async function tick() {
        const data = await fetchCurrentStream(channelId);
        if (!data?.slot) return;

        // schedule next fetch at slot boundary + 2s buffer
        const remaining = secondsUntilSlotEnd(data.slot);
        clearTimeout(slotTimer);
        slotTimer = setTimeout(() => tick(), (remaining + 2) * 1000);
    }

    tick();
}

export function stopPolling() {
    clearTimeout(pollTimer);
    clearTimeout(slotTimer);
    polling.set(false);
    currentStream.set(null);
}