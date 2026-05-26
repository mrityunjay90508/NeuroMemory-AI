import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

let dbInstance = null;

/**
 * Initializes and returns the SQLite database connection.
 * Creates the `.nma` directory and database if they do not exist.
 * @param {string} [customCwd] - Custom working directory for testing.
 * @returns {DatabaseSync} The SQLite database connection instance.
 */
export function getDb(customCwd = process.cwd()) {
  if (dbInstance) {
    return dbInstance;
  }

  const normalizedBase = path.normalize(path.resolve(customCwd));
  const nmaDir = path.normalize(path.resolve(normalizedBase, '.nma'));
  const baseBoundary = normalizedBase.endsWith(path.sep) ? normalizedBase : normalizedBase + path.sep;
  if (nmaDir !== normalizedBase && !nmaDir.startsWith(baseBoundary)) {
    throw new Error('Directory traversal attempt detected');
  }
  if (!fs.existsSync(nmaDir)) {
    fs.mkdirSync(nmaDir, { recursive: true });
  }

  const dbPath = path.join(nmaDir, 'nma.db');
  const db = new DatabaseSync(dbPath);

  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // Create core tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      summary TEXT,
      tags TEXT
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      decision TEXT NOT NULL,
      reason TEXT,
      status TEXT DEFAULT 'active',
      source_chat_id INTEGER,
      FOREIGN KEY (source_chat_id) REFERENCES chats(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Create FTS5 virtual tables for full text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS chats_fts USING fts5(
      chat_id UNINDEXED,
      title,
      prompt,
      response,
      tags
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
      decision_id UNINDEXED,
      decision,
      reason
    );
  `);

  // Create triggers to auto-sync chats_fts
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS chats_ai AFTER INSERT ON chats BEGIN
      INSERT INTO chats_fts(chat_id, title, prompt, response, tags)
      VALUES (new.id, new.title, new.prompt, new.response, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS chats_ad AFTER DELETE ON chats BEGIN
      DELETE FROM chats_fts WHERE chat_id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS chats_au AFTER UPDATE ON chats BEGIN
      DELETE FROM chats_fts WHERE chat_id = old.id;
      INSERT INTO chats_fts(chat_id, title, prompt, response, tags)
      VALUES (new.id, new.title, new.prompt, new.response, new.tags);
    END;
  `);

  // Create triggers to auto-sync decisions_fts
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS decisions_ai AFTER INSERT ON decisions BEGIN
      INSERT INTO decisions_fts(decision_id, decision, reason)
      VALUES (new.id, new.decision, new.reason);
    END;

    CREATE TRIGGER IF NOT EXISTS decisions_ad AFTER DELETE ON decisions BEGIN
      DELETE FROM decisions_fts WHERE decision_id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS decisions_au AFTER UPDATE ON decisions BEGIN
      DELETE FROM decisions_fts WHERE decision_id = old.id;
      INSERT INTO decisions_fts(decision_id, decision, reason)
      VALUES (new.id, new.decision, new.reason);
    END;
  `);

  dbInstance = db;
  return dbInstance;
}

/**
 * Closes the active database connection.
 */
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Insert a new chat into the database.
 * @param {DatabaseSync} db
 * @param {object} param1
 * @param {string} param1.title
 * @param {string} param1.prompt
 * @param {string} param1.response
 * @param {string} [param1.summary]
 * @param {string} [param1.tags]
 * @returns {number} The ID of the inserted chat.
 */
export function insertChat(db, { title, prompt, response, summary = '', tags = '' }) {
  const stmt = db.prepare(`
    INSERT INTO chats (title, prompt, response, summary, tags)
    VALUES (?, ?, ?, ?, ?)
    RETURNING id;
  `);
  const result = stmt.get(title, prompt, response, summary, tags);
  return result.id;
}

/**
 * Update an existing chat in the database.
 * @param {DatabaseSync} db
 * @param {number} id
 * @param {object} param2
 * @param {string} param2.title
 * @param {string} param2.prompt
 * @param {string} param2.response
 * @param {string} [param2.summary]
 * @param {string} [param2.tags]
 */
export function updateChat(db, id, { title, prompt, response, summary = '', tags = '' }) {
  const stmt = db.prepare(`
    UPDATE chats
    SET title = ?, prompt = ?, response = ?, summary = ?, tags = ?
    WHERE id = ?;
  `);
  stmt.run(title, prompt, response, summary, tags, id);
}

/**
 * Insert a new decision into the database.
 * @param {DatabaseSync} db
 * @param {object} param1
 * @param {string} param1.decision
 * @param {string} [param1.reason]
 * @param {string} [param1.status]
 * @param {number} [param1.source_chat_id]
 * @returns {number} The ID of the inserted decision.
 */
export function insertDecision(db, { decision, reason = '', status = 'active', source_chat_id = null }) {
  const stmt = db.prepare(`
    INSERT INTO decisions (decision, reason, status, source_chat_id)
    VALUES (?, ?, ?, ?)
    RETURNING id;
  `);
  const result = stmt.get(decision, reason, status, source_chat_id);
  return result.id;
}

/**
 * Fetches all config key-value pairs.
 * @param {DatabaseSync} db
 * @returns {object} Config object
 */
export function getConfig(db) {
  const rows = db.prepare('SELECT key, value FROM config;').all();
  const config = {};
  for (const row of rows) {
    if (row.key === '__proto__' || row.key === 'constructor' || row.key === 'prototype') {
      continue;
    }
    Reflect.set(config, row.key, row.value);
  }
  return config;
}

/**
 * Sets a config key-value pair.
 * @param {DatabaseSync} db
 * @param {string} key
 * @param {string} value
 */
export function setConfig(db, key, value) {
  const stmt = db.prepare(`
    INSERT INTO config (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
  `);
  stmt.run(key, value);
}

/**
 * Search decisions using FTS5.
 * @param {DatabaseSync} db
 * @param {string} query
 * @returns {Array<object>} Matching decisions sorted by relevance
 */
export function searchDecisions(db, query) {
  const stmt = db.prepare(`
    SELECT d.id, d.timestamp, d.decision, d.reason, d.status, d.source_chat_id
    FROM decisions_fts f
    JOIN decisions d ON d.id = f.decision_id
    WHERE decisions_fts MATCH ?
    ORDER BY bm25(decisions_fts) ASC;
  `);
  return stmt.all(query);
}

/**
 * Search chats using FTS5.
 * @param {DatabaseSync} db
 * @param {string} query
 * @returns {Array<object>} Matching chats sorted by relevance
 */
export function searchChats(db, query) {
  const stmt = db.prepare(`
    SELECT c.id, c.timestamp, c.title, c.prompt, c.response, c.summary, c.tags
    FROM chats_fts f
    JOIN chats c ON c.id = f.chat_id
    WHERE chats_fts MATCH ?
    ORDER BY bm25(chats_fts) ASC;
  `);
  return stmt.all(query);
}

/**
 * Retrieves all active decisions sorted by date descending (newest first).
 * @param {DatabaseSync} db
 * @returns {Array<object>}
 */
export function getActiveDecisions(db) {
  return db.prepare(`
    SELECT id, timestamp, decision, reason, status, source_chat_id
    FROM decisions
    WHERE status = 'active'
    ORDER BY timestamp DESC;
  `).all();
}

/**
 * Retrieves all logged chats sorted by date descending (newest first).
 * @param {DatabaseSync} db
 * @returns {Array<object>}
 */
export function getAllChats(db) {
  return db.prepare(`
    SELECT id, timestamp, title, prompt, response, summary, tags
    FROM chats
    ORDER BY timestamp DESC;
  `).all();
}
