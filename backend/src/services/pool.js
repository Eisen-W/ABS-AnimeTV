// resolves the eligible show pool for a channel
// applies filters, blacklist, and exceptions in priority order

import db from '../db/index.js';

// priority order:
// 1. blacklist  — excluded unconditionally
// 2. exceptions — re-includes specific shows overriding blacklist
// 3. pool_filters — applied to everything not blacklisted

function parseJSON(val, fallback) {
    try { return JSON.parse(val) ?? fallback; }
    catch { return fallback; }
}

function matchesFilters(show, filters) {
    if (!filters || Object.keys(filters).length === 0) return true;

    const genres = parseJSON(show.genres, []);

    if (filters.genres?.length) {
        const hasGenre = filters.genres.some(g =>
            genres.map(x => x.toLowerCase()).includes(g.toLowerCase())
        );
        if (!hasGenre) return false;
    }

    if (filters.year_range) {
        const [min, max] = filters.year_range;
        if (show.year < min || show.year > max) return false;
    }

    if (filters.status?.length) {
        if (!filters.status.includes(show.status)) return false;
    }

    if (filters.min_score != null) {
        if (!show.score || show.score < filters.min_score) return false;
    }

    return true;
}

// resolve the full eligible pool for a channel
// returns array of show rows from local db
export function resolvePool(channelId) {
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(channelId);
    if (!channel) throw new Error(`channel not found: ${channelId}`);

    const manualPool  = parseJSON(channel.pool, []);
    const filters     = parseJSON(channel.pool_filters, {});
    const blacklist   = parseJSON(channel.blacklist, {});
    const exceptions  = parseJSON(channel.exceptions, []);

    const blacklistedGenres = blacklist.genres ?? [];
    const blacklistedShows  = blacklist.shows  ?? [];

    // get candidate shows — manual pool or full local cache
    let candidates;
    if (filters.source === 'manual' || (!filters.source && manualPool.length)) {
        candidates = db.prepare(
            `SELECT * FROM shows WHERE mal_id IN (${manualPool.map(() => '?').join(',')})`
        ).all(...manualPool);
    } else {
        candidates = db.prepare('SELECT * FROM shows').all();
    }

    const eligible = [];

    for (const show of candidates) {
        const isException      = exceptions.includes(show.mal_id);
        const isShowBlacklisted = blacklistedShows.includes(show.mal_id);

        if (isShowBlacklisted && !isException) continue;

        if (!isException) {
            const genres = parseJSON(show.genres, []);
            const hasBlacklistedGenre = blacklistedGenres.some(bg =>
                genres.map(g => g.toLowerCase()).includes(bg.toLowerCase())
            );
            if (hasBlacklistedGenre) continue;
        }

        if (!matchesFilters(show, filters)) continue;

        eligible.push(show);
    }

    return eligible;
}

// pick a random show from the pool, optionally excluding recently aired IDs
export function pickRandom(channelId, excludeIds = []) {
    const pool = resolvePool(channelId);
    const filtered = pool.filter(s => !excludeIds.includes(s.mal_id));

    if (!filtered.length) {
        // fall back to full pool if exclusions wiped everything
        if (!pool.length) throw new Error(`pool is empty for channel: ${channelId}`);
        return pool[Math.floor(Math.random() * pool.length)];
    }

    return filtered[Math.floor(Math.random() * filtered.length)];
}