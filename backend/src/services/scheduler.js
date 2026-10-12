// builds and manages the slot schedule for a channel

import { randomUUID } from 'crypto';
import db from '../db/index.js';
import { resolveStream } from './stream/index.js';
import { probeStream } from './probe.js';

const BUFFER_ZONE_HOURS = 2;      // reserved at end of each day for overrun margin
const DOUBLE_SLOT_THRESHOLD = 1.4; // episode duration > 1.4x window = double slot

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

// total available slot minutes per day minus buffer zone
function availableMinutesPerDay(windowMin) {
    return 24 * 60 - BUFFER_ZONE_HOURS * 60;
}

// build a single slot record
function makeSlot(channelId, date, startTime, windowMin, malId, episode, overrides = {}) {
    return {
        slot_id:        randomUUID(),
        channel_id:     channelId,
        date,
        start_time:     startTime,
        window_minutes: windowMin,
        mal_id:         malId,
        episode,
        real_duration_s: null,
        stream_url:     null,
        provider:       null,
        status:         'scheduled',
        push_count:     0,
        reschedule_date: null,
        probed_at:      null,
        ...overrides,
    };
}

function insertSlot(slot) {
    db.prepare(`
        INSERT OR REPLACE INTO slots
            (slot_id, channel_id, date, start_time, window_minutes,
             mal_id, episode, real_duration_s, stream_url, provider,
             status, push_count, reschedule_date, probed_at)
        VALUES
            (@slot_id, @channel_id, @date, @start_time, @window_minutes,
             @mal_id, @episode, @real_duration_s, @stream_url, @provider,
             @status, @push_count, @reschedule_date, @probed_at)
    `).run(slot);
}

// resolve + probe a single episode, update its slot in db
export async function probeAndUpdateSlot(slot) {
    let streamUrl = slot.stream_url;
    let provider  = slot.provider;

    const show = db.prepare('SELECT * FROM shows WHERE mal_id = ?').get(slot.mal_id);
    if (!show) throw new Error(`show not found in cache: ${slot.mal_id}`);

    // resolve stream URL if not already set
    if (!streamUrl) {
        const result = await resolveStream(slot.mal_id, slot.episode, show.title);
        streamUrl = result.url;
        provider  = result.provider;
    }

    const duration = await probeStream(streamUrl);

    db.prepare(`
        UPDATE slots SET
            stream_url      = ?,
            provider        = ?,
            real_duration_s = ?,
            probed_at       = ?
        WHERE slot_id = ?
    `).run(streamUrl, provider, duration, Date.now(), slot.slot_id);

    return { streamUrl, provider, duration };
}

// build full schedule for a show starting at a given date + time
// episodes: array of episode numbers to schedule
export async function buildShowSchedule(channelId, malId, episodes, startDate, startTime) {
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel) throw new Error(`channel not found: ${channelId}`);

    const windowMin   = channel.slot_window_min;
    const windowSec   = windowMin * 60;
    const availMin    = availableMinutesPerDay(windowMin);

    let currentDate   = startDate;
    let currentMinute = toMinutes(startTime);

    const insertBatch = db.transaction((slots) => {
        for (const slot of slots) insertSlot(slot);
    });

    const slots = [];

    for (const episode of episodes) {
        // wrap to next day if past available window
        if (currentMinute >= availMin) {
            currentDate   = addDays(currentDate, 1);
            currentMinute = toMinutes(startTime);
        }

        const slot = makeSlot(
            channelId,
            currentDate,
            fromMinutes(currentMinute),
            windowMin,
            malId,
            episode
        );

        slots.push(slot);
        currentMinute += windowMin;
    }

    insertBatch(slots);
    console.log(`[scheduler] built ${slots.length} slots for mal:${malId} on channel:${channelId}`);
    return slots;
}

// probe a week's worth of upcoming slots for a channel
// called by weekly batch job
export async function probeUpcomingSlots(channelId, days = 7) {
    const today    = new Date().toISOString().split('T')[0];
    const until    = addDays(today, days);

    const slots = db.prepare(`
        SELECT * FROM slots
        WHERE channel_id = ?
          AND date >= ?
          AND date <= ?
          AND status = 'scheduled'
          AND (probed_at IS NULL OR stream_url IS NULL)
        ORDER BY date, start_time
    `).all(channelId, today, until);

    console.log(`[scheduler] probing ${slots.length} upcoming slots for channel:${channelId}`);

    const results = [];
    for (const slot of slots) {
        try {
            const result = await probeAndUpdateSlot(slot);

            // flag double-length episodes
            const windowSec = slot.window_minutes * 60;
            if (result.duration && result.duration > windowSec * DOUBLE_SLOT_THRESHOLD) {
                db.prepare(`UPDATE slots SET status = 'flagged' WHERE slot_id = ?`).run(slot.slot_id);
                console.warn(`[scheduler] double-length flagged: mal:${slot.mal_id} ep:${slot.episode} (${result.duration}s)`);

                // create alert
                db.prepare(`
                    INSERT INTO alerts (id, channel_id, type, payload, created_at)
                    VALUES (?, ?, 'double_length', ?, ?)
                `).run(
                    randomUUID(),
                    channelId,
                    JSON.stringify({ mal_id: slot.mal_id, episode: slot.episode, duration: result.duration, slot_id: slot.slot_id }),
                    Date.now()
                );
            }

            results.push({ slot_id: slot.slot_id, ok: true, ...result });
        } catch (err) {
            console.error(`[scheduler] probe failed for slot:${slot.slot_id} — ${err.message}`);
            results.push({ slot_id: slot.slot_id, ok: false, error: err.message });

            // alert on total probe failure
            db.prepare(`
                INSERT INTO alerts (id, channel_id, type, payload, created_at)
                VALUES (?, ?, 'probe_fail', ?, ?)
            `).run(
                randomUUID(),
                channelId,
                JSON.stringify({ slot_id: slot.slot_id, mal_id: slot.mal_id, episode: slot.episode }),
                Date.now()
            );
        }
    }

    return results;
}

// get the current active slot for a channel right now
export function getCurrentSlot(channelId) {
    const now     = new Date();
    const date    = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return db.prepare(`
        SELECT * FROM slots
        WHERE channel_id = ?
          AND date = ?
          AND start_time <= ?
          AND status IN ('scheduled', 'filler')
        ORDER BY start_time DESC
        LIMIT 1
    `).get(channelId, date, timeStr);
}

// get next slot after current time
export function getNextSlot(channelId) {
    const now     = new Date();
    const date    = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    return db.prepare(`
        SELECT * FROM slots
        WHERE channel_id = ?
          AND (date > ? OR (date = ? AND start_time > ?))
          AND status IN ('scheduled', 'filler')
        ORDER BY date, start_time
        LIMIT 1
    `).get(channelId, date, date, timeStr);
}

// compute how many seconds into the current slot we are
export function getCurrentOffset(slot) {
    const now       = Date.now();
    const [h, m]    = slot.start_time.split(':').map(Number);
    const slotStart = new Date(slot.date);
    slotStart.setHours(h, m, 0, 0);
    return Math.max(0, Math.floor((now - slotStart.getTime()) / 1000));
}