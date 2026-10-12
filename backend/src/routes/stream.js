import { Hono } from 'hono';
import { resolveStream } from '../services/stream/index.js';
import { getCurrentSlot, getCurrentOffset, getNextSlot } from '../services/scheduler.js';
import db from '../db/index.js';

const stream = new Hono();

// GET /stream/:channelId — get stream URL + offset for current slot
// this is what the player page calls on load
stream.get('/:channelId', async (c) => {
    const channelId = c.req.param('channelId');
    const slot      = getCurrentSlot(channelId);

    if (!slot) return c.json({ playing: false });

    // filler slot — return filler signal, player handles locally
    if (slot.status === 'filler') {
        const offset = getCurrentOffset(slot);
        const next   = getNextSlot(channelId);
        return c.json({ playing: true, type: 'filler', slot, offset_seconds: offset, next });
    }

    // use cached stream URL if available
    let streamUrl = slot.stream_url;
    let provider  = slot.provider;

    if (!streamUrl) {
        const show = db.prepare('SELECT title FROM shows WHERE mal_id = ?').get(slot.mal_id);
        if (!show) return c.json({ error: 'show metadata missing' }, 500);

        try {
            const result = await resolveStream(slot.mal_id, slot.episode, show.title);
            streamUrl = result.url;
            provider  = result.provider;

            // cache the resolved URL
            db.prepare('UPDATE slots SET stream_url = ?, provider = ? WHERE slot_id = ?')
                .run(streamUrl, provider, slot.slot_id);
        } catch (err) {
            return c.json({ error: 'stream resolution failed', detail: err.message }, 502);
        }
    }

    const offset = getCurrentOffset(slot);
    const next   = getNextSlot(channelId);

    return c.json({
        playing:        true,
        type:           'stream',
        slot,
        stream_url:     streamUrl,
        provider,
        offset_seconds: offset,
        next,
    });
});

// GET /stream/resolve — manually resolve a stream URL for a specific episode
// query: ?mal_id=123&episode=1
stream.get('/resolve', async (c) => {
    const malId   = Number(c.req.query('mal_id'));
    const episode = Number(c.req.query('episode'));

    if (!malId || !episode) return c.json({ error: 'mal_id and episode required' }, 400);

    const show = db.prepare('SELECT title FROM shows WHERE mal_id = ?').get(malId);
    if (!show) return c.json({ error: 'show not in cache' }, 404);

    try {
        const result = await resolveStream(malId, episode, show.title);
        return c.json(result);
    } catch (err) {
        return c.json({ error: err.message }, 502);
    }
});

export default stream;