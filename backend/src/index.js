import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import auth from './routes/auth.js';
import channels from './routes/channels.js';
import schedule from './routes/schedule.js';
import stream from './routes/stream.js';
import filler from './routes/filler.js';

import { startSlotMonitor } from './jobs/slot-monitor.js';
import { scheduleWeeklyBatch } from './jobs/weekly-batch.js';

const app = new Hono();

// middleware
app.use('*', logger());
app.use('*', cors({
    origin: 'http://localhost:5173', // SvelteKit dev port
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
}));

// routes
app.route('/auth', auth);
app.route('/channels', channels);
app.route('/schedule', schedule);
app.route('/stream', stream);
app.route('/filler', filler);

// health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

// 404 fallback
app.notFound((c) => c.json({ error: 'not found' }, 404));

// error handler
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message ?? 'internal server error' }, 500);
});

// start background jobs
startSlotMonitor();
scheduleWeeklyBatch();

const PORT = process.env.PORT ?? 3001;

export default {
    port: PORT,
    fetch: app.fetch,
};

console.log(`AniTV backend running on http://localhost:${PORT}`);