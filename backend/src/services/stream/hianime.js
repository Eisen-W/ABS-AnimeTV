// wrapper for self-hosted aniwatch-api (github.com/ghoshRitesh12/aniwatch-api)
// runs as a Docker container, URL set in .env as HIANIME_URL

const BASE_URL = process.env.HIANIME_URL ?? 'http://localhost:4000';

// in-memory cache: mal_id+episode → { hiAnimeId, episodeId }
// avoids re-searching on every probe/stream call
const idCache = new Map();

async function hiGet(path) {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) throw new Error(`aniwatch-api ${res.status}: ${path}`);
    return res.json();
}

// search HiAnime by title, return the best match's HiAnime anime ID
async function resolveHiAnimeId(title) {
    const data = await hiGet(`/api/v2/hianime/search?q=${encodeURIComponent(title)}`);
    const results = data?.data?.animes;

    if (!results?.length) throw new Error(`no HiAnime results for: ${title}`);

    // first result is usually the right one for exact titles from MAL
    return results[0].id;
}

// get the HiAnime episode ID for a specific episode number
async function resolveEpisodeId(hiAnimeId, episodeNumber) {
    const data = await hiGet(`/api/v2/hianime/anime/${hiAnimeId}/episodes`);
    const episodes = data?.data?.episodes;

    if (!episodes?.length) throw new Error(`no episodes found for HiAnime ID: ${hiAnimeId}`);

    const episode = episodes.find(e => e.number === episodeNumber);
    if (!episode) throw new Error(`episode ${episodeNumber} not found for HiAnime ID: ${hiAnimeId}`);

    return episode.episodeId;
}

// get stream URL for a given MAL ID + episode number
// title is used for the initial HiAnime search
export async function getStreamUrl(malId, episodeNumber, title, category = 'sub', server = 'hd-1') {
    const cacheKey = `${malId}:${episodeNumber}`;

    let hiAnimeId, episodeId;

    if (idCache.has(cacheKey)) {
        ({ hiAnimeId, episodeId } = idCache.get(cacheKey));
    } else {
        hiAnimeId = await resolveHiAnimeId(title);
        episodeId = await resolveEpisodeId(hiAnimeId, episodeNumber);
        idCache.set(cacheKey, { hiAnimeId, episodeId });
    }

    const data = await hiGet(
        `/api/v2/hianime/episode/sources?animeEpisodeId=${episodeId}&server=${server}&category=${category}`
    );

    const sources = data?.data?.sources;
    if (!sources?.length) throw new Error(`no stream sources for episode ${episodeNumber}`);

    // prefer m3u8 (HLS) source
    const hls = sources.find(s => s.type === 'hls') ?? sources[0];
    if (!hls?.url) throw new Error(`no valid stream URL for episode ${episodeNumber}`);

    return {
        url:      hls.url,
        provider: 'hianime',
        episodeId,
    };
}

// get episode count directly from HiAnime — used as a cross-check against MAL
export async function getEpisodeCount(title) {
    const hiAnimeId = await resolveHiAnimeId(title);
    const data = await hiGet(`/api/v2/hianime/anime/${hiAnimeId}/episodes`);
    return data?.data?.totalEpisodes ?? 0;
}