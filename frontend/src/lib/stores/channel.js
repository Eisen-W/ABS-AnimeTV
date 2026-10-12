import { writable } from 'svelte/store';
import { channelsApi } from '$lib/utils/api.js';

export const channels      = writable([]);
export const activeChannel = writable(null);
export const loading       = writable(false);
export const error         = writable(null);

export async function loadChannels() {
    loading.set(true);
    error.set(null);
    try {
        const data = await channelsApi.list();
        channels.set(data);
    } catch (err) {
        error.set(err.message);
    } finally {
        loading.set(false);
    }
}

export function setActiveChannel(channel) {
    activeChannel.set(channel);
}