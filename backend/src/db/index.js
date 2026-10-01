import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = join(__dirname, '..', '..', 'anitv.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);

// performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// run schema on startup — IF NOT EXISTS guards make this safe to call every time
const schema = readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

export default db;