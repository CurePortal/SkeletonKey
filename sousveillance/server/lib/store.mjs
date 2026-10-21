// Shared SQLite store. Both beacond.mjs (server) and mcp-server.mjs (spawned by
// opencode) open this same file directly, so the MCP can read the phone's
// position and queue messages without talking to the server over HTTP. WAL mode
// + busy_timeout make the two-process access safe.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { DB_PATH, TRACK_MAX } from "../config.mjs";

let _db = null;

export function store() {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      ts       INTEGER NOT NULL,
      lat      REAL    NOT NULL,
      lon      REAL    NOT NULL,
      speed    REAL,
      heading  REAL,
      accuracy REAL,
      altitude REAL,
      battery  REAL,
      source   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_positions_ts ON positions(ts);

    CREATE TABLE IF NOT EXISTS outbox (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      ts   INTEGER NOT NULL,
      text TEXT    NOT NULL,
      kind TEXT    NOT NULL DEFAULT 'say',
      sent INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_sent ON outbox(sent, id);

    CREATE TABLE IF NOT EXISTS extension_proposals (
      id         TEXT PRIMARY KEY,
      ts         INTEGER NOT NULL,
      kind       TEXT    NOT NULL,
      gap        TEXT    NOT NULL,
      proposal   TEXT    NOT NULL,
      why        TEXT,
      risk       TEXT,
      requires   TEXT,
      source     TEXT,
      status     TEXT    NOT NULL DEFAULT 'pending',
      decided_ts INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_extension_ts ON extension_proposals(ts);
    CREATE INDEX IF NOT EXISTS idx_extension_status ON extension_proposals(status);
  `);
  _db = db;
  return db;
}

export function addPosition(p) {
  const db = store();
  const ts = Number.isFinite(p.ts) ? p.ts : Date.now();
  db.prepare(
    `INSERT INTO positions (ts, lat, lon, speed, heading, accuracy, altitude, battery, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    ts,
    p.lat,
    p.lon,
    p.speed ?? null,
    p.heading ?? null,
    p.accuracy ?? null,
    p.altitude ?? null,
    p.battery ?? null,
    p.source ?? "app",
  );
  prune();
  return ts;
}

function prune() {
  const db = store();
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM positions`).get();
  if (n <= TRACK_MAX) return;
  db.prepare(
    `DELETE FROM positions WHERE id IN (
       SELECT id FROM positions ORDER BY ts ASC LIMIT ?
     )`,
  ).run(n - TRACK_MAX);
}

export function latestPosition() {
  return store().prepare(`SELECT * FROM positions ORDER BY ts DESC LIMIT 1`).get() ?? null;
}

export function recentTrack(limit = 100) {
  const rows = store()
    .prepare(`SELECT * FROM positions ORDER BY ts DESC LIMIT ?`)
    .all(Math.max(1, Math.min(limit, 5000)));
  return rows.reverse();
}

export function enqueueSay(text, kind = "say") {
  store()
    .prepare(`INSERT INTO outbox (ts, text, kind) VALUES (?, ?, ?)`)
    .run(Date.now(), String(text), kind);
}

export function unsent(limit = 50) {
  return store()
    .prepare(`SELECT * FROM outbox WHERE sent = 0 ORDER BY id ASC LIMIT ?`)
    .all(Math.max(1, Math.min(limit, 500)));
}

export function maxOutboxId() {
  return store().prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM outbox`).get().m;
}

export function outboxSince(id, limit = 20) {
  return store()
    .prepare(`SELECT id, text, kind FROM outbox WHERE id > ? ORDER BY id ASC LIMIT ?`)
    .all(id, limit);
}

export function markSent(ids) {
  if (!ids.length) return;
  const db = store();
  const stmt = db.prepare(`UPDATE outbox SET sent = 1 WHERE id = ?`);
  for (const id of ids) stmt.run(id);
}

export function insertExtension(p) {
  store()
    .prepare(
      `INSERT INTO extension_proposals
         (id, ts, kind, gap, proposal, why, risk, requires, source, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      p.id,
      p.ts,
      p.kind,
      p.gap,
      p.proposal,
      p.why ?? null,
      p.risk ?? null,
      p.requires ?? null,
      p.source ?? null,
      p.status || "pending",
    );
  return p;
}

export function listExtensions(limit = 20, status = null) {
  const n = Math.max(1, Math.min(Number(limit) || 20, 100));
  const db = store();
  if (status && status !== "all") {
    return db
      .prepare(
        `SELECT * FROM extension_proposals WHERE status = ? ORDER BY ts DESC LIMIT ?`,
      )
      .all(status, n);
  }
  return db
    .prepare(`SELECT * FROM extension_proposals ORDER BY ts DESC LIMIT ?`)
    .all(n);
}

export function getExtension(id) {
  return (
    store()
      .prepare(`SELECT * FROM extension_proposals WHERE id = ?`)
      .get(String(id)) ?? null
  );
}

export function setExtensionStatus(id, status) {
  store()
    .prepare(
      `UPDATE extension_proposals SET status = ?, decided_ts = ? WHERE id = ?`,
    )
    .run(String(status), Date.now(), String(id));
  return getExtension(id);
}
