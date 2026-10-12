// slot boundary monitor
// polls every 30 seconds to detect slot transitions and overruns
// triggers healer when an episode runs past its window

import db from '../db/index.js';
import { handleOverrun } from '../services/healer.js';
import { getCurrentSlot } from '../services/scheduler.js';

const POLL_INTERVAL_MS  = 30 * 1000; // 30 seconds
const OVERRUN_GRACE_SEC = 60;         // allow 60s past window end before flagging

// track which slots we've already flagged this session to avoid duplicate triggers
const flagged = new Set();

function getSlotEndSeconds(slot) {
    const [h, m]   = slot.start_time.split(':').map(Number);
    const slotStart = new Date(slot.date);
    slotStart.setHours(h, m, 0, 0);
    return slotStart.getTime() + slot.window_minutes * 60 * 1000;
}

async function checkChannels() {
    const channels = db.prepare('SELECT id FROM channels').all();

    for (const { id } of channels) {
        try {
            const slot = getCurrentSlot(id);
            if (!slot) continue;
            if (slot.status === 'filler' || slot.status === 'buffer') continue;

            const now        = Date.now();
            const windowEnds = getSlotEndSeconds(slot);
            const overrunBy  = Math.floor((now - windowEnds) / 1000);

            // slot has blown past its window by more than the grace period
            if (overrunBy > OVERRUN_GRACE_SEC && !flagged.has(slot.slot_id)) {
                flagged.add(slot.slot_id);
                console.warn(
                    `[slot-monitor] overrun detected on channel:${id} ` +
                    `slot:${slot.slot_id} by ${overrunBy}s`
                );
                handleOverrun(slot.slot_id);
            }

            // pre-buffer: check if next slot's stream URL is ready 5 min before boundary
            const fiveMinBefore = windowEnds - 5 * 60 * 1000;
            if (now >= fiveMinBefore) {
                const nextSlot = db.prepare(`
                    SELECT * FROM slots
                    WHERE channel_id = ?
                      AND (date > ? OR (date = ? AND start_time > ?))
                      AND status = 'scheduled'
                    ORDER BY date, start_time
                    LIMIT 1
                `).get(id, slot.date, slot.date, slot.start_time);

                if (nextSlot && !nextSlot.stream_url) {
                    console.warn(
                        `[slot-monitor] next slot has no stream URL, 5min warning — ` +
                        `channel:${id} slot:${nextSlot.slot_id}`
                    );
                }
            }
        } catch (err) {
            console.error(`[slot-monitor] error on channel:${id} — ${err.message}`);
        }
    }
}

// clean up flagged set daily so memory doesn't grow indefinitely
function scheduleFlaggedCleanup() {
    setInterval(() => {
        flagged.clear();
        console.log('[slot-monitor] cleared flagged slot cache');
    }, 24 * 60 * 60 * 1000);
}

export function startSlotMonitor() {
    console.log(`[slot-monitor] starting — polling every ${POLL_INTERVAL_MS / 1000}s`);
    setInterval(() => {
        checkChannels().catch(err => {
            console.error('[slot-monitor] unhandled error —', err.message);
        });
    }, POLL_INTERVAL_MS);

    scheduleFlaggedCleanup();
}