import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import { join } from 'path';

import auth from './routes/auth.js';
import channels from './routes/channels.js';
import schedule from './routes/schedule.js';
import stream from './routes/stream.js';
import filler from './routes/filler.js';

import { startSlotMonitor } from './jobs/slot-monitor.js';
import { scheduleWeeklyBatch } from './jobs/weekly-batch.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
    origin: 'http://localhost:5173',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization'],
}));

// serve local filler files as static
// filler/ directory sits at project root (one level above backend/)
app.use('/filler-static/*', serveStatic({
    root: join(process.cwd(), '..', 'filler'),
    rewriteRequestPath: (path) => path.replace('/filler-static', ''),
}));

app.route('/auth', auth);
app.route('/channels', channels);
app.route('/schedule', schedule);
app.route('/stream', stream);
app.route('/filler', filler);

app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

app.notFound((c) => c.json({ error: 'not found' }, 404));
app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message ?? 'internal server error' }, 500);
});

startSlotMonitor();
scheduleWeeklyBatch();

const PORT = process.env.PORT ?? 3001;

export default {
    port: PORT,
    fetch: app.fetch,
};

console.log(`AniTV backend running on http://localhost:${PORT}`);