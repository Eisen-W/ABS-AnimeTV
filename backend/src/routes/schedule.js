import { Hono } from 'hono';
import db from '../db/index.js';
import { getCurrentSlot, getNextSlot, getCurrentOffset } from '../services/scheduler.js';

const schedule = new Hono();

// GET /schedule/:channelId/current — what's playing right now + seek offset
schedule.get('/:channelId/current', (c) => {
    const channelId = c.req.param('channelId');
    const slot      = getCurrentSlot(channelId);

    if (!slot) return c.json({ playing: false });

    const offset  = getCurrentOffset(slot);
    const next    = getNextSlot(channelId);

    return c.json({ playing: true, slot, offset_seconds: offset, next });
});

// GET /schedule/:channelId/week — full week's slots
schedule.get('/:channelId/week', (c) => {
    const channelId = c.req.param('channelId');
    const today     = new Date().toISOString().split('T')[0];
    const until     = new Date();
    until.setDate(until.getDate() + 7);
    const untilStr  = until.toISOString().split('T')[0];

    const slots = db.prepare(`
        SELECT s.*, sh.title
        FROM slots s
        LEFT JOIN shows sh ON sh.mal_id = s.mal_id
        WHERE s.channel_id = ?
          AND s.date BETWEEN ? AND ?
        ORDER BY s.date, s.start_time
    `).all(channelId, today, untilStr);

    return c.json(slots);
});

// GET /schedule/:channelId/all — full schedule for a channel
schedule.get('/:channelId/all', (c) => {
    const channelId = c.req.param('channelId');

    const slots = db.prepare(`
        SELECT s.*, sh.title
        FROM slots s
        LEFT JOIN shows sh ON sh.mal_id = s.mal_id
        WHERE s.channel_id = ?
        ORDER BY s.date, s.start_time
    `).all(channelId);

    return c.json(slots);
});

// PATCH /schedule/slots/:slotId — manually update a slot
schedule.patch('/slots/:slotId', async (c) => {
    const slotId = c.req.param('slotId');
    const body   = await c.req.json();

    const slot = db.prepare('SELECT * FROM slots WHERE slot_id = ?').get(slotId);
    if (!slot) return c.json({ error: 'not found' }, 404);

    const allowed = ['status', 'window_minutes', 'mal_id', 'episode', 'start_time', 'date'];
    const updates = Object.entries(body).filter(([k]) => allowed.includes(k));
    if (!updates.length) return c.json({ error: 'no valid fields to update' }, 400);

    const set    = updates.map(([k]) => `${k} = ?`).join(', ');
    const values = updates.map(([, v]) => v);

    db.prepare(`UPDATE slots SET ${set} WHERE slot_id = ?`).run(...values, slotId);
    return c.json({ ok: true });
});

// GET /schedule/alerts — all unresolved alerts across all channels
schedule.get('/alerts', (c) => {
    const alerts = db.prepare(`
        SELECT a.*, c.name as channel_name
        FROM alerts a
        JOIN channels c ON c.id = a.channel_id
        WHERE a.resolved = 0
        ORDER BY a.created_at DESC
    `).all();

    return c.json(alerts);
});

// PATCH /schedule/alerts/:alertId/resolve
schedule.patch('/alerts/:alertId/resolve', (c) => {
    db.prepare('UPDATE alerts SET resolved = 1 WHERE id = ?').run(c.req.param('alertId'));
    return c.json({ ok: true });
});

export default schedule;