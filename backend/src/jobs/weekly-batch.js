// weekly batch job
// re-resolves stream URLs and re-probes durations for the upcoming week
// also checks for series endings and pool exhaustion across all channels

import cron from 'node-cron';
import db from '../db/index.js';
import { probeUpcomingSlots } from '../services/scheduler.js';
import { checkSeriesEnding, checkPoolExhaustion } from '../services/healer.js';
import { resolvePool } from '../services/pool.js';

async function runBatch() {
    console.log('[weekly-batch] starting run —', new Date().toISOString());

    const channels = db.prepare('SELECT id FROM channels').all();

    for (const { id } of channels) {
        console.log(`[weekly-batch] processing channel:${id}`);

        try {
            // re-probe upcoming week's slots
            const results = await probeUpcomingSlots(id, 7);
            const failed  = results.filter(r => !r.ok);
            if (failed.length) {
                console.warn(`[weekly-batch] ${failed.length} probe failures on channel:${id}`);
            }
        } catch (err) {
            console.error(`[weekly-batch] probe pass failed for channel:${id} — ${err.message}`);
        }

        try {
            // check if any series is ending within 3 days
            checkSeriesEnding(id, 3);
        } catch (err) {
            console.error(`[weekly-batch] series-ending check failed for channel:${id} — ${err.message}`);
        }

        try {
            // check if random pool is exhausted
            const channel = db.prepare('SELECT requeue_mode FROM channels WHERE id = ?').get(id);
            if (channel?.requeue_mode === 'random') {
                const pool = resolvePool(id);
                checkPoolExhaustion(id, pool.length);
            }
        } catch (err) {
            console.error(`[weekly-batch] pool check failed for channel:${id} — ${err.message}`);
        }
    }

    console.log('[weekly-batch] run complete —', new Date().toISOString());
}

// run every Monday at 03:00
export function scheduleWeeklyBatch() {
    cron.schedule('0 3 * * 1', () => {
        runBatch().catch(err => {
            console.error('[weekly-batch] unhandled error —', err.message);
        });
    });

    console.log('[weekly-batch] scheduled — runs every Monday at 03:00');
}

// expose for manual trigger via API if needed
export { runBatch };