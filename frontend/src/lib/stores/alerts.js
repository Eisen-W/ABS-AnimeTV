import { writable, derived } from 'svelte/store';
import { scheduleApi } from '$lib/utils/api.js';

export const alerts  = writable([]);
export const loading = writable(false);

export const unresolvedCount = derived(
    alerts,
    $alerts => $alerts.filter(a => !a.resolved).length
);

export async function loadAlerts() {
    loading.set(true);
    try {
        const data = await scheduleApi.alerts();
        alerts.set(data);
    } catch (err) {
        console.error('[alerts-store]', err.message);
    } finally {
        loading.set(false);
    }
}

export async function resolveAlert(alertId) {
    await scheduleApi.resolveAlert(alertId);
    alerts.update($alerts =>
        $alerts.map(a => a.id === alertId ? { ...a, resolved: 1 } : a)
    );
}