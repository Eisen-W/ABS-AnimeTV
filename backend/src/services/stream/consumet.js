// wrapper for @consumet/extensions
// used as fallback when all HiAnime servers fail

import { ANIME } from '@consumet/extensions';

const gogoanime  = new ANIME.Gogoanime();
const animepahe  = new ANIME.AnimePahe();

const PROVIDERS = [
    { name: 'gogoanime', instance: gogoanime },
    { name: 'animepahe', instance: animepahe },
];

// search a provider for an anime title, return the first result's ID
async function resolveProviderId(provider, title) {
    const results = await provider.search(title);
    if (!results?.results?.length) throw new Error(`no results on ${provider.name} for: ${title}`);
    return results.results[0].id;
}

// get stream URL from a single provider instance
async function fetchFromProvider(providerName, instance, title, episodeNumber) {
    const showId = await resolveProviderId(instance, title);

    const info = await instance.fetchAnimeInfo(showId);
    if (!info?.episodes?.length) throw new Error(`no episodes found on ${providerName} for: ${title}`);

    const episode = info.episodes.find(e => e.number === episodeNumber);
    if (!episode) throw new Error(`episode ${episodeNumber} not found on ${providerName}`);

    const sources = await instance.fetchEpisodeSources(episode.id);
    if (!sources?.sources?.length) throw new Error(`no sources on ${providerName} for episode ${episodeNumber}`);

    // prefer m3u8
    const hls = sources.sources.find(s => s.isM3U8) ?? sources.sources[0];
    if (!hls?.url) throw new Error(`no valid URL on ${providerName}`);

    return {
        url:      hls.url,
        provider: providerName,
    };
}

// try each provider in order, return first that works
export async function getStreamUrl(title, episodeNumber) {
    const errors = [];

    for (const { name, instance } of PROVIDERS) {
        try {
            return await fetchFromProvider(name, instance, title, episodeNumber);
        } catch (err) {
            errors.push(`${name}: ${err.message}`);
        }
    }

    throw new Error(`all consumet providers failed:\n${errors.join('\n')}`);
}