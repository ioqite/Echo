-- Echo D1 schema
-- Apply with: wrangler d1 execute echo-db --file=./schema.sql

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'plain',    -- 'plain' | 'markdown' | 'code'
  language TEXT,                            -- e.g. 'javascript' (when format='code')
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  is_edited INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- Full-text search index (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 1'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;

-- Meta table (password hash, settings)
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
