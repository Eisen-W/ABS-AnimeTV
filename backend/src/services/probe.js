// wraps ffprobe to get real episode duration from an HLS stream URL

import ffmpeg from 'fluent-ffmpeg';

// returns duration in seconds, or null if probe fails
export function probeStream(url) {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(url, (err, metadata) => {
            if (err) {
                console.warn(`[probe] failed for ${url}: ${err.message}`);
                return resolve(null);
            }

            const duration = metadata?.format?.duration;
            if (!duration) {
                console.warn(`[probe] no duration in metadata for ${url}`);
                return resolve(null);
            }

            resolve(Math.round(duration));
        });
    });
}

// probe a list of { url, slotId } objects, returns Map<slotId, durationSeconds>
export async function probeBatch(items) {
    const results = new Map();

    await Promise.allSettled(
        items.map(async ({ url, slotId }) => {
            const duration = await probeStream(url);
            results.set(slotId, duration);
        })
    );

    return results;
}