-- MAL OAuth tokens (single-user, single row)
CREATE TABLE IF NOT EXISTS tokens (
    id            INTEGER PRIMARY KEY DEFAULT 1,
    access_token  TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at    INTEGER NOT NULL
);

-- Cached show metadata from MAL
CREATE TABLE IF NOT EXISTS shows (
    mal_id        INTEGER PRIMARY KEY,
    title         TEXT NOT NULL,
    genres        TEXT,
    episode_count INTEGER,
    avg_duration  INTEGER,
    score         REAL,
    status        TEXT,
    year          INTEGER,
    cached_at     INTEGER
);

-- Channel definitions
CREATE TABLE IF NOT EXISTS channels (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    air_delay_days   INTEGER DEFAULT 0,
    slot_window_min  INTEGER DEFAULT 30,
    requeue_mode     TEXT DEFAULT 'loop',
    pool             TEXT DEFAULT '[]',
    pool_filters     TEXT DEFAULT '{}',
    blacklist        TEXT DEFAULT '{}',
    exceptions       TEXT DEFAULT '[]',
    filler_playlists TEXT DEFAULT '[]',
    provider_order   TEXT DEFAULT '["hianime","gogoanime","animepahe"]'
);

-- Schedule slots
CREATE TABLE IF NOT EXISTS slots (
    slot_id         TEXT PRIMARY KEY,
    channel_id      TEXT NOT NULL,
    date            TEXT NOT NULL,
    start_time      TEXT NOT NULL,
    window_minutes  INTEGER NOT NULL,
    mal_id          INTEGER,
    episode         INTEGER,
    real_duration_s INTEGER,
    stream_url      TEXT,
    provider        TEXT,
    status          TEXT DEFAULT 'scheduled',
    push_count      INTEGER DEFAULT 0,
    reschedule_date TEXT,
    probed_at       INTEGER,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

-- Dashboard alerts
CREATE TABLE IF NOT EXISTS alerts (
    id         TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    type       TEXT NOT NULL,
    payload    TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL,
    resolved   INTEGER DEFAULT 0
);

-- Cached YouTube filler videos per channel
CREATE TABLE IF NOT EXISTS filler_videos (
    id         TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    youtube_id TEXT NOT NULL,
    duration_s INTEGER,
    fetched_at INTEGER,
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slots_channel_date ON slots(channel_id, date);
CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);
CREATE INDEX IF NOT EXISTS idx_alerts_channel ON alerts(channel_id, resolved);
CREATE INDEX IF NOT EXISTS idx_filler_channel ON filler_videos(channel_id);