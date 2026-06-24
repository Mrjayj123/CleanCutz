import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, 'cleancutz.db')

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

// ─── SCHEMA ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    theme TEXT NOT NULL DEFAULT 'light',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    source_filename TEXT,
    kind TEXT NOT NULL DEFAULT 'original',   -- 'original' | 'trimmed'
    origin TEXT NOT NULL DEFAULT 'upload',   -- 'upload' | 'import-url' | 'import-ytdlp' | 'trim'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);

  -- Password reset tokens. We store a HASH of the token, never the raw token
  -- (same principle as passwords) so a DB leak alone can't be used to reset accounts.
  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
`)

// ─── USER QUERIES ────────────────────────────────────────────
export function createUser({ name, email, passwordHash }) {
  const stmt = db.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
  )
  const info = stmt.run(name, email.toLowerCase(), passwordHash)
  return getUserById(info.lastInsertRowid)
}

export function getUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase())
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id)
}

export function updateUserTheme(userId, theme) {
  db.prepare('UPDATE users SET theme = ? WHERE id = ?').run(theme, userId)
  return getUserById(userId)
}

export function updateUserPassword(userId, passwordHash) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId)
  return getUserById(userId)
}

// ─── PASSWORD RESET QUERIES ───────────────────────────────────
export function createPasswordReset({ userId, tokenHash, expiresAt }) {
  // Invalidate any previous outstanding tokens for this user first,
  // so only the most recent reset request/link is ever valid.
  db.prepare(
    `UPDATE password_resets SET used_at = datetime('now')
     WHERE user_id = ? AND used_at IS NULL`
  ).run(userId)

  const stmt = db.prepare(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  )
  stmt.run(userId, tokenHash, expiresAt)
}

export function getValidPasswordReset(tokenHash) {
  return db.prepare(
    `SELECT * FROM password_resets
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')`
  ).get(tokenHash)
}

export function markPasswordResetUsed(id) {
  db.prepare(
    `UPDATE password_resets SET used_at = datetime('now') WHERE id = ?`
  ).run(id)
}

// ─── VIDEO QUERIES ───────────────────────────────────────────
export function addVideoRecord({ userId, filename, sourceFilename = null, kind = 'original', origin = 'upload' }) {
  const stmt = db.prepare(
    `INSERT INTO videos (user_id, filename, source_filename, kind, origin)
     VALUES (?, ?, ?, ?, ?)`
  )
  const info = stmt.run(userId, filename, sourceFilename, kind, origin)
  return db.prepare('SELECT * FROM videos WHERE id = ?').get(info.lastInsertRowid)
}

export function getVideosForUser(userId, kind = null) {
  if (kind) {
    return db.prepare(
      'SELECT * FROM videos WHERE user_id = ? AND kind = ? ORDER BY created_at DESC'
    ).all(userId, kind)
  }
  return db.prepare(
    'SELECT * FROM videos WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId)
}

export function getVideoByFilename(userId, filename) {
  return db.prepare(
    'SELECT * FROM videos WHERE user_id = ? AND filename = ?'
  ).get(userId, filename)
}

export function deleteVideoRecord(userId, filename) {
  return db.prepare(
    'DELETE FROM videos WHERE user_id = ? AND filename = ?'
  ).run(userId, filename)
}