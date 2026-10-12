// slot offset and boundary math

// seconds into the current slot we should seek to on player join
export function computeOffset(slot) {
    if (!slot) return 0;
    const [h, m]    = slot.start_time.split(':').map(Number);
    const slotStart = new Date(slot.date);
    slotStart.setHours(h, m, 0, 0);
    return Math.max(0, Math.floor((Date.now() - slotStart.getTime()) / 1000));
}

// unix timestamp (ms) when the current slot ends
export function slotEndTime(slot) {
    if (!slot) return 0;
    const [h, m]    = slot.start_time.split(':').map(Number);
    const slotStart = new Date(slot.date);
    slotStart.setHours(h, m, 0, 0);
    return slotStart.getTime() + slot.window_minutes * 60 * 1000;
}

// seconds remaining in the current slot
export function secondsUntilSlotEnd(slot) {
    return Math.max(0, Math.floor((slotEndTime(slot) - Date.now()) / 1000));
}

// seconds of filler needed after episode ends
export function fillerDuration(slot) {
    if (!slot?.real_duration_s) return 0;
    const windowSec = slot.window_minutes * 60;
    return Math.max(0, windowSec - slot.real_duration_s);
}

// format seconds as HH:MM:SS
export function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

// format a slot's start_time + date into a readable string
export function formatSlotTime(slot) {
    if (!slot) return '';
    return `${slot.date} ${slot.start_time}`;
}