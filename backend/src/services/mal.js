import db from '../db/index.js';

const MAL_API      = 'https://api.myanimelist.net/v2';
const MAL_TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
const CLIENT_ID    = process.env.MAL_CLIENT_ID;

function getTokens() {
    const row = db.prepare('SELECT * FROM tokens WHERE id = 1').get();
    if (!row) throw new Error('not authenticated — visit /auth/login first');
    return row;
}

async function refreshIfNeeded() {
    const row = getTokens();

    // refresh if expiring within 5 minutes
    if (Date.now() < row.expires_at - 5 * 60 * 1000) {
        return row.access_token;
    }

    const body = new URLSearchParams({
        client_id:     CLIENT_ID,
        grant_type:    'refresh_token',
        refresh_token: row.refresh_token,
    });

    const res = await fetch(MAL_TOKEN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`token refresh failed: ${err}`);
    }

    const data = await res.json();

    db.prepare(`
        UPDATE tokens SET
            access_token  = ?,
            refresh_token = ?,
            expires_at    = ?
        WHERE id = 1
    `).run(
        data.access_token,
        data.refresh_token,
        Date.now() + data.expires_in * 1000
    );

    return data.access_token;
}

async function malFetch(path, params = {}) {
    const token = await refreshIfNeeded();

    const url = new URL(`${MAL_API}${path}`);
    for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
        },
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`MAL API error ${res.status}: ${err}`);
    }

    return res.json();
}

async function malPatch(path, body = {}) {
    const token = await refreshIfNeeded();

    const res = await fetch(`${MAL_API}${path}`, {
        method:  'PATCH',
        headers: {
            'Authorization':  `Bearer ${token}`,
            'Content-Type':   'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(body).toString(),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`MAL API error ${res.status}: ${err}`);
    }

    return res.json();
}

// pull user's anime list with metadata
// status: watching|completed|on_hold|dropped|plan_to_watch
export async function getWatchlist(status = null, limit = 1000) {
    const params = {
        fields: 'id,title,genres,num_episodes,average_episode_duration,mean,status,start_season',
        limit,
        nsfw: true,
    };
    if (status) params.status = status;

    const data = await malFetch('/users/@me/animelist', params);
    return data.data.map(entry => ({
        mal_id:        entry.node.id,
        title:         entry.node.title,
        genres:        JSON.stringify(entry.node.genres?.map(g => g.name) ?? []),
        episode_count: entry.node.num_episodes ?? 0,
        avg_duration:  entry.node.average_episode_duration ?? 0,
        score:         entry.node.mean ?? null,
        status:        entry.node.status,
        year:          entry.node.start_season?.year ?? null,
    }));
}

// get single show metadata
export async function getShow(malId) {
    return malFetch(`/anime/${malId}`, {
        fields: 'id,title,genres,num_episodes,average_episode_duration,mean,status,start_season',
    });
}

// update watch progress on MAL
export async function updateProgress(malId, episode) {
    return malPatch(`/anime/${malId}/my_list_status`, {
        num_watched_episodes: episode,
        status: 'watching',
    });
}

// cache a show's metadata in local db
export function cacheShow(show) {
    db.prepare(`
        INSERT INTO shows (mal_id, title, genres, episode_count, avg_duration, score, status, year, cached_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(mal_id) DO UPDATE SET
            title         = excluded.title,
            genres        = excluded.genres,
            episode_count = excluded.episode_count,
            avg_duration  = excluded.avg_duration,
            score         = excluded.score,
            status        = excluded.status,
            year          = excluded.year,
            cached_at     = excluded.cached_at
    `).run(
        show.mal_id,
        show.title,
        show.genres,
        show.episode_count,
        show.avg_duration,
        show.score,
        show.status,
        show.year,
        Date.now()
    );
}

// sync watchlist to local shows cache
export async function syncWatchlist() {
    const shows = await getWatchlist();
    const insert = db.transaction((list) => {
        for (const show of list) cacheShow(show);
    });
    insert(shows);
    return shows.length;
}