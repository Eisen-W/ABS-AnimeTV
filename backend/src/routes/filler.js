import { Hono } from 'hono';
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { probeStream } from '../services/probe.js';
import db from '../db/index.js';

const filler = new Hono();

const SUPPORTED_EXTS = ['.mp4', '.mkv', '.webm', '.avi', '.mov'];

function getFillerDir(channelId) {
    const channel = db.prepare('SELECT filler_path FROM channels WHERE id = ?').get(channelId);
    return channel?.filler_path ?? join(process.cwd(), '..', 'filler', channelId);
}

function listFillerFiles(dir) {
    try {
        return readdirSync(dir)
            .filter(f => SUPPORTED_EXTS.includes(extname(f).toLowerCase()))
            .map(f => join(dir, f));
    } catch {
        return [];
    }
}

// GET /filler/:channelId — list filler files for a channel
filler.get('/:channelId', (c) => {
    const dir   = getFillerDir(c.req.param('channelId'));
    const files = listFillerFiles(dir);
    return c.json({ dir, files });
});

// GET /filler/:channelId/sequence?duration=120
// returns an ordered list of file paths that fills the target duration
filler.get('/:channelId/sequence', async (c) => {
    const channelId     = c.req.param('channelId');
    const targetSeconds = Number(c.req.query('duration') ?? 0);

    if (!targetSeconds) return c.json({ sequence: [] });

    const dir   = getFillerDir(channelId);
    const files = listFillerFiles(dir);

    if (!files.length) return c.json({ sequence: [], warning: 'no filler files found' });

    // shuffle files
    const shuffled = [...files].sort(() => Math.random() - 0.5);

    const sequence = [];
    let filled     = 0;

    for (const file of shuffled) {
        if (filled >= targetSeconds) break;
        const duration = await probeStream(file);
        if (!duration) continue;
        sequence.push({ path: file, duration_s: duration });
        filled += duration;
    }

    return c.json({ sequence, total_duration_s: filled, target_s: targetSeconds });
});

export default filler;