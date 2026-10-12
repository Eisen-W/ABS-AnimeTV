const BASE = 'http://localhost:3001';

async function req(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? `request failed: ${res.status}`);
    }
    return res.json();
}

const get    = (path)         => req(path);
const post   = (path, body)   => req(path, { method: 'POST',   body: JSON.stringify(body) });
const put    = (path, body)   => req(path, { method: 'PUT',    body: JSON.stringify(body) });
const patch  = (path, body)   => req(path, { method: 'PATCH',  body: JSON.stringify(body) });
const del    = (path)         => req(path, { method: 'DELETE' });

// auth
export const auth = {
    status:  ()     => get('/auth/status'),
    logout:  ()     => post('/auth/logout'),
    loginUrl: ()    => `${BASE}/auth/login`,
};

// channels
export const channelsApi = {
    list:         ()           => get('/channels'),
    get:          (id)         => get(`/channels/${id}`),
    create:       (body)       => post('/channels', body),
    update:       (id, body)   => put(`/channels/${id}`, body),
    remove:       (id)         => del(`/channels/${id}`),
    pool:         (id)         => get(`/channels/${id}/pool`),
    addShow:      (id, body)   => post(`/channels/${id}/shows`, body),
    removeShow:   (id, malId)  => del(`/channels/${id}/shows/${malId}`),
    sync:         (id)         => post(`/channels/${id}/sync`),
    batch:        (id)         => post(`/channels/${id}/batch`),
};

// schedule
export const scheduleApi = {
    current:       (channelId) => get(`/schedule/${channelId}/current`),
    week:          (channelId) => get(`/schedule/${channelId}/week`),
    all:           (channelId) => get(`/schedule/${channelId}/all`),
    updateSlot:    (slotId, body) => patch(`/schedule/slots/${slotId}`, body),
    alerts:        ()          => get('/schedule/alerts'),
    resolveAlert:  (alertId)   => patch(`/schedule/alerts/${alertId}/resolve`),
};

// stream
export const streamApi = {
    current:  (channelId)           => get(`/stream/${channelId}`),
    resolve:  (malId, episode)      => get(`/stream/resolve?mal_id=${malId}&episode=${episode}`),
};

// filler
export const fillerApi = {
    list:     (channelId)           => get(`/filler/${channelId}`),
    sequence: (channelId, duration) => get(`/filler/${channelId}/sequence?duration=${duration}`),
};