// stream resolution orchestrator
// tries HiAnime servers in order, falls back to consumet providers if all fail

import { getStreamUrl as hiAnimeStream } from './hianime.js';
import { getStreamUrl as consumetStream } from './consumet.js';

// HiAnime server fallback order
const HIANIME_SERVERS = ['hd-1', 'hd-2', 'megacloud', 'streamsb', 'streamtape'];

export async function resolveStream(malId, episodeNumber, title) {
    const errors = [];

    // try each HiAnime server in order
    for (const server of HIANIME_SERVERS) {
        try {
            const result = await hiAnimeStream(malId, episodeNumber, title, 'sub', server);
            console.log(`[stream] resolved via hianime/${server} — mal:${malId} ep:${episodeNumber}`);
            return result;
        } catch (err) {
            errors.push(`hianime/${server}: ${err.message}`);
        }
    }

    // all HiAnime servers failed, try consumet providers
    console.warn(`[stream] HiAnime exhausted, falling back to consumet — mal:${malId} ep:${episodeNumber}`);
    try {
        const result = await consumetStream(title, episodeNumber);
        console.log(`[stream] resolved via consumet/${result.provider} — mal:${malId} ep:${episodeNumber}`);
        return result;
    } catch (err) {
        errors.push(`consumet: ${err.message}`);
    }

    // everything failed
    throw new Error(
        `[stream] all sources failed for mal:${malId} ep:${episodeNumber}\n${errors.join('\n')}`
    );
}