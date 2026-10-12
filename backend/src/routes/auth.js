import { Hono } from 'hono';
import { createHash, randomBytes } from 'crypto';
import db from '../db/index.js';

const auth = new Hono();

const MAL_AUTH_URL  = 'https://myanimelist.net/v1/oauth2/authorize';
const MAL_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';

const CLIENT_ID    = process.env.MAL_CLIENT_ID;
const REDIRECT_URI = process.env.MAL_REDIRECT_URI;

// held in memory for the duration of the OAuth roundtrip only
let pendingVerifier = null;

function generatePKCE() {
    const verifier  = randomBytes(64).toString('base64url');
    const challenge = createHash('sha256')
        .update(verifier)
        .digest('base64url');
    return { verifier, challenge };
}

// GET /auth/login
auth.get('/login', (c) => {
    const { verifier, challenge } = generatePKCE();
    pendingVerifier = verifier;

    const params = new URLSearchParams({
        response_type:         'code',
        client_id:             CLIENT_ID,
        redirect_uri:          REDIRECT_URI,
        code_challenge:        challenge,
        code_challenge_method: 'S256',
    });

    return c.redirect(`${MAL_AUTH_URL}?${params.toString()}`);
});

// GET /auth/callback
auth.get('/callback', async (c) => {
    const code = c.req.query('code');

    if (!code)            return c.json({ error: 'missing code' }, 400);
    if (!pendingVerifier) return c.json({ error: 'no pending auth session' }, 400);

    const body = new URLSearchParams({
        client_id:     CLIENT_ID,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
        code_verifier: pendingVerifier,
    });

    pendingVerifier = null;

    const res = await fetch(MAL_TOKEN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        return c.json({ error: 'token exchange failed', detail: err }, 502);
    }

    const data = await res.json();

    db.prepare(`
        INSERT INTO tokens (id, access_token, refresh_token, expires_at)
        VALUES (1, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            access_token  = excluded.access_token,
            refresh_token = excluded.refresh_token,
            expires_at    = excluded.expires_at
    `).run(
        data.access_token,
        data.refresh_token,
        Date.now() + data.expires_in * 1000
    );

    return c.redirect('http://localhost:5173/dashboard');
});

// GET /auth/status
auth.get('/status', (c) => {
    const row = db.prepare('SELECT expires_at FROM tokens WHERE id = 1').get();
    if (!row) return c.json({ authenticated: false });

    return c.json({
        authenticated: true,
        expires_at:    row.expires_at,
        expired:       Date.now() > row.expires_at,
    });
});

// POST /auth/logout
auth.post('/logout', (c) => {
    db.prepare('DELETE FROM tokens WHERE id = 1').run();
    return c.json({ ok: true });
});

export default auth;