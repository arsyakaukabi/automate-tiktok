const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'videos.db');
console.log('DB_PATH in container:', DB_PATH); // 👈 debug

const db = new Database(DB_PATH);

db.pragma('journal_mode = DELETE');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// debug: lihat tabel apa aja
const tables = db.prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view')").all();
console.log('SQLite schema on startup:', tables);

// DDL: 3 job (urls, transcripts, comments)
const ddl = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- ========== JOB 1: URLS / DOWNLOAD ==========
CREATE TABLE IF NOT EXISTS urls (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  url          TEXT NOT NULL UNIQUE,
  is_downloaded INTEGER NOT NULL DEFAULT 0,       -- 0/1
  mp4_path     TEXT,                              -- path lokal / S3 presigned / dsb.
  create_time  INTEGER,                           -- epoch detik dari TikTok
  video_desc   TEXT,                              -- deskripsi video
  author_username TEXT,                           -- uniqueId / username penulis
  author_signature TEXT,                          -- signature penulis
  created_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER IF NOT EXISTS trg_urls_updated_at
AFTER UPDATE ON urls
FOR EACH ROW
BEGIN
  UPDATE urls
     SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
   WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_urls_is_downloaded ON urls (is_downloaded);

-- ========== JOB 2: STT / TRANSCRIPTS ==========
CREATE TABLE IF NOT EXISTS transcripts (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  url_id           INTEGER NOT NULL,
  is_transcripted  INTEGER NOT NULL DEFAULT 0,    -- 0/1
  wav_path         TEXT,                          -- hasil konversi audio
  is_converted     INTEGER NOT NULL DEFAULT 0,    -- flag job konversi
  transcript_text  TEXT,                          -- hasil whisper.cpp
  created_at       TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE,
  UNIQUE (url_id)                                   -- 1:1 dengan urls
);

CREATE TRIGGER IF NOT EXISTS trg_transcripts_updated_at
AFTER UPDATE ON transcripts
FOR EACH ROW
BEGIN
  UPDATE transcripts
     SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
   WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_transcripts_flags ON transcripts (is_transcripted);
CREATE INDEX IF NOT EXISTS idx_transcripts_converted ON transcripts (is_converted);

-- ========== JOB 3: PROMPT & LLM COMMENTS ==========
CREATE TABLE IF NOT EXISTS comments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  url_id       INTEGER NOT NULL,
  prompt_text  TEXT,                              -- prompt final yang dikirim ke LLM
  llm_comment  TEXT,                              -- hasil komentar dari LLM
  is_posted    INTEGER NOT NULL DEFAULT 0,        -- 0/1
  posted_at    TEXT,                              -- ISO8601 ketika sudah dipost
  created_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE,
  UNIQUE (url_id)                                   -- 1:1 dengan urls
);

CREATE TRIGGER IF NOT EXISTS trg_comments_updated_at
AFTER UPDATE ON comments
FOR EACH ROW
BEGIN
  UPDATE comments
     SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
   WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_comments_posted ON comments (is_posted);
`;

try {
  db.exec(ddl);
  console.log('[DB] DDL executed OK');

  const tables = db
    .prepare("SELECT name, type FROM sqlite_master WHERE type IN ('table','view')")
    .all();
  console.log('[DB] Existing objects:', tables);
} catch (err) {
  console.error('[DB] Error executing DDL:', err);
}

module.exports = db;
