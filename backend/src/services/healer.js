// self-healing schedule logic
// handles slot overruns, pushes displaced shows, inserts filler slots

import { randomUUID } from 'crypto';
import db from '../db/index.js';

const BUFFER_ZONE_HOURS  = 2;
const REPEATED_PUSH_THRESHOLD = 3;

function toMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function fromMinutes(totalMinutes) {
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addDays(dateStr, n) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

function isInBufferZone(timeStr) {
    const bufferStart = (24 - BUFFER_ZONE_HOURS) * 60;
    return toMinutes(timeStr) >= bufferStart;
}

function getNextDaySlotTime(channelId) {
    // get the earliest scheduled slot start time for this channel as the day start anchor
    const first = db.prepare(`
        SELECT start_time FROM slots
        WHERE channel_id = ?
          AND status = 'scheduled'
        ORDER BY date, start_time
        LIMIT 1
    `).get(channelId);
    return first?.start_time ?? '00:00';
}

// called when an episode is detected to have run over its slot window
// slotId: the slot that overran
// actualDurationS: real duration from stream or runtime detection
export function handleOverrun(slotId) {
    const slot = db.prepare('SELECT * FROM slots WHERE slot_id = ?').get(slotId);
    if (!slot) throw new Error(`slot not found: ${slotId}`);

    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(slot.channel_id);
    if (!channel) throw new Error(`channel not found: ${slot.channel_id}`);

    const windowMin = channel.slot_window_min;

    // find the next slot after this one on the same channel
    const nextSlot = db.prepare(`
        SELECT * FROM slots
        WHERE channel_id = ?
          AND (date > ? OR (date = ? AND start_time > ?))
          AND status = 'scheduled'
        ORDER BY date, start_time
        LIMIT 1
    `).get(slot.channel_id, slot.date, slot.date, slot.start_time);

    if (!nextSlot) {
        console.warn(`[healer] no next slot found after overrun on slot:${slotId}`);
        return;
    }

    // check if next slot is in buffer zone — if so, push to next day instead
    if (isInBufferZone(nextSlot.start_time)) {
        const nextDayTime = getNextDaySlotTime(slot.channel_id);
        const rescheduleDate = addDays(nextSlot.date, 1);

        db.prepare(`
            UPDATE slots SET
                status          = 'pushed',
                push_count      = push_count + 1,
                reschedule_date = ?
            WHERE slot_id = ?
        `).run(rescheduleDate, nextSlot.slot_id);

        console.log(`[healer] pushed slot:${nextSlot.slot_id} to next day (${rescheduleDate})`);
    } else {
        // convert next slot to filler, push its show down
        const displacedMalId  = nextSlot.mal_id;
        const displacedEpisode = nextSlot.episode;

        // turn next slot into a filler block
        db.prepare(`
            UPDATE slots SET
                status  = 'filler',
                mal_id  = NULL,
                episode = NULL
            WHERE slot_id = ?
        `).run(nextSlot.slot_id);

        // find the slot after the filler and push displaced show there
        const slotAfterFiller = db.prepare(`
            SELECT * FROM slots
            WHERE channel_id = ?
              AND (date > ? OR (date = ? AND start_time > ?))
              AND status = 'scheduled'
            ORDER BY date, start_time
            LIMIT 1
        `).get(slot.channel_id, nextSlot.date, nextSlot.date, nextSlot.start_time);

        if (slotAfterFiller && !isInBufferZone(slotAfterFiller.start_time)) {
            // insert displaced show ahead of whatever is in that slot
            // by creating a new slot entry at the same time
            const pushedSlot = {
                slot_id:         randomUUID(),
                channel_id:      slot.channel_id,
                date:            slotAfterFiller.date,
                start_time:      slotAfterFiller.start_time,
                window_minutes:  windowMin,
                mal_id:          displacedMalId,
                episode:         displacedEpisode,
                real_duration_s: null,
                stream_url:      null,
                provider:        null,
                status:          'pushed',
                push_count:      (nextSlot.push_count ?? 0) + 1,
                reschedule_date: null,
                probed_at:       null,
            };

            db.prepare(`
                INSERT INTO slots
                    (slot_id, channel_id, date, start_time, window_minutes,
                     mal_id, episode, real_duration_s, stream_url, provider,
                     status, push_count, reschedule_date, probed_at)
                VALUES
                    (@slot_id, @channel_id, @date, @start_time, @window_minutes,
                     @mal_id, @episode, @real_duration_s, @stream_url, @provider,
                     @status, @push_count, @reschedule_date, @probed_at)
            `).run(pushedSlot);

            console.log(`[healer] displaced mal:${displacedMalId} ep:${displacedEpisode} → slot at ${slotAfterFiller.start_time}`);
        } else {
            // no room — reschedule to next day
            const rescheduleDate = addDays(nextSlot.date, 1);
            const dayStartTime   = getNextDaySlotTime(slot.channel_id);

            db.prepare(`
                UPDATE slots SET
                    status          = 'pushed',
                    push_count      = push_count + 1,
                    reschedule_date = ?
                WHERE slot_id = ?
            `).run(rescheduleDate, nextSlot.slot_id);

            console.log(`[healer] no room, pushed mal:${displacedMalId} ep:${displacedEpisode} to ${rescheduleDate} ${dayStartTime}`);
        }
    }

    // fire alert if push count is too high on the original slot's show
    checkRepeatedPushes(slot.channel_id, slot.mal_id);
}

function checkRepeatedPushes(channelId, malId) {
    const highPushSlots = db.prepare(`
        SELECT COUNT(*) as count FROM slots
        WHERE channel_id = ? AND mal_id = ? AND push_count >= ?
    `).get(channelId, malId, REPEATED_PUSH_THRESHOLD);

    if (highPushSlots.count > 0) {
        const existing = db.prepare(`
            SELECT id FROM alerts
            WHERE channel_id = ? AND type = 'repeated_push'
              AND json_extract(payload, '$.mal_id') = ?
              AND resolved = 0
        `).get(channelId, malId);

        if (!existing) {
            db.prepare(`
                INSERT INTO alerts (id, channel_id, type, payload, created_at)
                VALUES (?, ?, 'repeated_push', ?, ?)
            `).run(
                randomUUID(),
                channelId,
                JSON.stringify({ mal_id: malId }),
                Date.now()
            );
            console.warn(`[healer] repeated push alert fired for mal:${malId} on channel:${channelId}`);
        }
    }
}

// check if a series is ending within N days, fire alert if so
export function checkSeriesEnding(channelId, daysAhead = 3) {
    const until = new Date();
    until.setDate(until.getDate() + daysAhead);
    const untilStr = until.toISOString().split('T')[0];
    const today    = new Date().toISOString().split('T')[0];

    // find shows where the last scheduled episode falls within the window
    const endingShows = db.prepare(`
        SELECT s.mal_id, s.episode, s.date, sh.title, sh.episode_count
        FROM slots s
        JOIN shows sh ON sh.mal_id = s.mal_id
        WHERE s.channel_id = ?
          AND s.date BETWEEN ? AND ?
          AND s.status = 'scheduled'
          AND s.episode = sh.episode_count
    `).all(channelId, today, untilStr);

    for (const show of endingShows) {
        const existing = db.prepare(`
            SELECT id FROM alerts
            WHERE channel_id = ? AND type = 'series_ending'
              AND json_extract(payload, '$.mal_id') = ?
              AND resolved = 0
        `).get(channelId, show.mal_id);

        if (!existing) {
            db.prepare(`
                INSERT INTO alerts (id, channel_id, type, payload, created_at)
                VALUES (?, ?, 'series_ending', ?, ?)
            `).run(
                randomUUID(),
                channelId,
                JSON.stringify({
                    mal_id:        show.mal_id,
                    title:         show.title,
                    final_episode: show.episode,
                    final_date:    show.date,
                }),
                Date.now()
            );
            console.log(`[healer] series ending alert: ${show.title} on ${show.date}`);
        }
    }
}

// check if random pool is exhausted after filters
export function checkPoolExhaustion(channelId, poolSize) {
    if (poolSize > 0) return;

    const existing = db.prepare(`
        SELECT id FROM alerts
        WHERE channel_id = ? AND type = 'pool_exhausted' AND resolved = 0
    `).get(channelId);

    if (!existing) {
        db.prepare(`
            INSERT INTO alerts (id, channel_id, type, payload, created_at)
            VALUES (?, ?, 'pool_exhausted', '{}', ?)
        `).run(randomUUID(), channelId, Date.now());
        console.warn(`[healer] pool exhausted alert for channel:${channelId}`);
    }
}