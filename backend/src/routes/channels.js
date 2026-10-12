import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import db from '../db/index.js';
import { syncWatchlist } from '../services/mal.js';
import { resolvePool, pickRandom } from '../services/pool.js';
import { buildShowSchedule } from '../services/scheduler.js';
import { runBatch } from '../jobs/weekly-batch.js';

const channels = new Hono();

// GET /channels
channels.get('/', (c) => {
    const rows = db.prepare('SELECT * FROM channels').all();
    return c.json(rows);
});

// GET /channels/:id
channels.get('/:id', (c) => {
    const row = db.prepare('SELECT * FROM channels WHERE id = ?').get(c.req.param('id'));
    if (!row) return c.json({ error: 'not found' }, 404);
    return c.json(row);
});

// POST /channels — create channel
channels.post('/', async (c) => {
    const body = await c.req.json();
    if (!body.name) return c.json({ error: 'name is required' }, 400);

    const id = body.id ?? randomUUID();

    db.prepare(`
        INSERT INTO channels (id, name, air_delay_days, slot_window_min, requeue_mode,
            pool, pool_filters, blacklist, exceptions, filler_path, provider_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        id,
        body.name,
        body.air_delay_days   ?? 0,
        body.slot_window_min  ?? 30,
        body.requeue_mode     ?? 'loop',
        JSON.stringify(body.pool          ?? []),
        JSON.stringify(body.pool_filters  ?? {}),
        JSON.stringify(body.blacklist     ?? {}),
        JSON.stringify(body.exceptions    ?? []),
        body.filler_path      ?? null,
        JSON.stringify(body.provider_order ?? ['hianime', 'gogoanime', 'animepahe'])
    );

    return c.json({ id }, 201);
});

// PUT /channels/:id — update channel config
channels.put('/:id', async (c) => {
    const id   = c.req.param('id');
    const body = await c.req.json();

    const existing = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
    if (!existing) return c.json({ error: 'not found' }, 404);

    db.prepare(`
        UPDATE channels SET
            name            = ?,
            air_delay_days  = ?,
            slot_window_min = ?,
            requeue_mode    = ?,
            pool            = ?,
            pool_filters    = ?,
            blacklist       = ?,
            exceptions      = ?,
            filler_path     = ?,
            provider_order  = ?
        WHERE id = ?
    `).run(
        body.name            ?? existing.name,
        body.air_delay_days  ?? existing.air_delay_days,
        body.slot_window_min ?? existing.slot_window_min,
        body.requeue_mode    ?? existing.requeue_mode,
        JSON.stringify(body.pool           ?? JSON.parse(existing.pool)),
        JSON.stringify(body.pool_filters   ?? JSON.parse(existing.pool_filters)),
        JSON.stringify(body.blacklist      ?? JSON.parse(existing.blacklist)),
        JSON.stringify(body.exceptions     ?? JSON.parse(existing.exceptions)),
        body.filler_path     ?? existing.filler_path,
        JSON.stringify(body.provider_order ?? JSON.parse(existing.provider_order)),
        id
    );

    return c.json({ ok: true });
});

// DELETE /channels/:id
channels.delete('/:id', (c) => {
    const id = c.req.param('id');
    db.prepare('DELETE FROM channels WHERE id = ?').run(id);
    return c.json({ ok: true });
});

// GET /channels/:id/pool — resolve eligible pool for channel
channels.get('/:id/pool', (c) => {
    try {
        const pool = resolvePool(c.req.param('id'));
        return c.json(pool);
    } catch (err) {
        return c.json({ error: err.message }, 400);
    }
});

// POST /channels/:id/shows — add a show and build its schedule
// body: { mal_id, start_date, start_time, episodes? }
channels.post('/:id/shows', async (c) => {
    const channelId = c.req.param('id');
    const body      = await c.req.json();

    if (!body.mal_id)     return c.json({ error: 'mal_id required' }, 400);
    if (!body.start_date) return c.json({ error: 'start_date required' }, 400);
    if (!body.start_time) return c.json({ error: 'start_time required' }, 400);

    const show = db.prepare('SELECT * FROM shows WHERE mal_id = ?').get(body.mal_id);
    if (!show) return c.json({ error: 'show not in local cache — sync watchlist first' }, 404);

    const episodes = body.episodes
        ?? Array.from({ length: show.episode_count }, (_, i) => i + 1);

    // build schedule in background, return immediately
    buildShowSchedule(channelId, body.mal_id, episodes, body.start_date, body.start_time)
        .catch(err => console.error(`[channels] schedule build failed: ${err.message}`));

    return c.json({ ok: true, episodes: episodes.length, message: 'schedule building in background' }, 202);
});

// DELETE /channels/:id/shows/:malId — remove a show's slots from channel
channels.delete('/:id/shows/:malId', (c) => {
    const { id, malId } = c.req.param();
    db.prepare('DELETE FROM slots WHERE channel_id = ? AND mal_id = ?').run(id, Number(malId));
    return c.json({ ok: true });
});

// POST /channels/:id/sync — sync MAL watchlist into local shows cache
channels.post('/:id/sync', async (c) => {
    try {
        const count = await syncWatchlist();
        return c.json({ ok: true, synced: count });
    } catch (err) {
        return c.json({ error: err.message }, 502);
    }
});

// POST /channels/:id/batch — manually trigger weekly batch for this channel
channels.post('/:id/batch', async (c) => {
    const id = c.req.param('id');
    runBatch().catch(err => console.error(`[channels] manual batch error: ${err.message}`));
    return c.json({ ok: true, message: 'batch started in background' }, 202);
});

export default channels;