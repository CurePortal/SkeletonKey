#!/usr/bin/env node
// fieldlog -- tiered, narrative memory for the beacon operative.
//
//   raw positions ──daily──► digests ──(90d, chronicler)──► narratives ──(yearly)──► legend
//
// Compaction, not expiry: raw coordinates roll off (the beacon store caps them),
// but the *meaning* is rewritten upward into prose. Narrative is the highest-
// density lossy codec for lived experience, so the whole log stays tiny while
// HQ gains continuity. The chronicler voice wraps the truth; it never invents it.
//
// CLI:
//   node fieldlog.mjs digest [YYYY-MM-DD]   build a daily digest
//   node fieldlog.mjs compact [days]        compact digests older than N days
//   node fieldlog.mjs legend [days]         compact narratives older than N days
//   node fieldlog.mjs recent [n]            latest digests + newest narrative
//   node fieldlog.mjs note <kind> <detail>  append an event (lat/lon optional)
//   node fieldlog.mjs init                  create tables
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

const DB_PATH = process.env.BEACON_DB || `${homedir()}/.local/state/beacon/beacon.db`;
const GAZ = process.env.GAZETTEER || new URL("../maps/overlay/gazetteer.mjs", import.meta.url).pathname;
const MOVING_MS = 0.5; // m/s threshold

function db() {
  const d = new DatabaseSync(DB_PATH);
  d.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  ensure(d);
  return d;
}

function ensure(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS fl_events(id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER, kind TEXT, lat REAL, lon REAL, detail TEXT);
    CREATE TABLE IF NOT EXISTS fl_digests(id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT UNIQUE, distance_km REAL, moving_min REAL, dwell_min REAL,
      places TEXT, summary TEXT, created INTEGER);
    CREATE TABLE IF NOT EXISTS fl_narratives(id INTEGER PRIMARY KEY AUTOINCREMENT,
      tier TEXT, voice TEXT, period_start TEXT, period_end TEXT,
      text TEXT, source_ref TEXT, created INTEGER);
    CREATE TABLE IF NOT EXISTS fl_baseline(key TEXT PRIMARY KEY, value TEXT, updated INTEGER);
  `);
}

function hav(a, b, c, e) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (c - a) * r, dLon = (e - b) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// label a coordinate via the gazetteer CLI (best effort; offline, no network)
function labelAt(lat, lon) {
  try {
    const out = execFileSync("node", [GAZ, "reverse", String(lat), String(lon), "800"],
      { encoding: "utf8", timeout: 8000 }).split("\n")[0] || "";
    // strip "lat,lon  NAME  [cat]  distm" -> NAME
    const m = out.match(/^\S+\s+(.*?)\s+\[/);
    return m ? m[1] : null;
  } catch { return null; }
}

function dayBounds(dayStr) {
  // local-day bounds (machine timezone)
  const start = new Date(`${dayStr}T00:00:00`).getTime();
  const end = start + 24 * 3600 * 1000;
  return [start, end];
}

export function digest(dayStr) {
  const d = db();
  const [start, end] = dayBounds(dayStr);
  const rows = d.prepare(
    `SELECT ts,lat,lon,speed,accuracy FROM positions WHERE ts>=? AND ts<? ORDER BY ts`).all(start, end);
  if (!rows.length) return { day: dayStr, rows: 0 };

  let dist = 0, movingMs = 0, dwellMs = 0;
  const slow = []; // candidate stay points
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i];
    const prev = rows[i - 1];
    if (prev) {
      const dt = p.ts - prev.ts;
      if (dt > 0 && dt < 20 * 60 * 1000) {
        const m = hav(prev.lat, prev.lon, p.lat, p.lon);
        if ((p.accuracy ?? 999) < 100 && (prev.accuracy ?? 999) < 100 && m / (dt / 1000) < 40) dist += m;
        if ((p.speed ?? 0) > MOVING_MS) movingMs += dt; else dwellMs += dt;
      }
    }
    if ((p.speed ?? 0) <= MOVING_MS) slow.push(p);
  }

  // cluster slow points into stays (grid ~120 m)
  const stays = new Map();
  for (const p of slow) {
    const key = `${Math.round(p.lat / 0.0011)}:${Math.round(p.lon / 0.0011)}`;
    const s = stays.get(key) || { lat: 0, lon: 0, n: 0, first: p.ts, last: p.ts };
    s.lat += p.lat; s.lon += p.lon; s.n++;
    s.first = Math.min(s.first, p.ts); s.last = Math.max(s.last, p.ts);
    stays.set(key, s);
  }
  const top = [...stays.values()]
    .map((s) => ({ lat: s.lat / s.n, lon: s.lon / s.n, dwell: (s.last - s.first) / 60000 }))
    .filter((s) => s.dwell >= 5)
    .sort((a, b) => b.dwell - a.dwell)
    .slice(0, 3)
    .map((s) => ({ ...s, label: labelAt(s.lat, s.lon) }));

  const ev = d.prepare(`SELECT kind,detail FROM fl_events WHERE ts>=? AND ts<? ORDER BY ts`).all(start, end);
  const km = dist / 1000;
  const mins = (ms) => Math.round(ms / 60000);
  const places = top.map((s) => s.label).filter(Boolean);
  const summary =
    `${dayStr}: ${km.toFixed(1)} km, ${mins(movingMs)} min moving, ${mins(dwellMs)} min held still.` +
    (top.length ? ` Longest dwells: ` + top.map((s) => `${s.label || `${s.lat.toFixed(4)},${s.lon.toFixed(4)}`} (${Math.round(s.dwell)}m)`).join(", ") + "." : "") +
    (ev.length ? ` ${ev.length} logged event(s): ` + ev.map((e) => e.kind).join(", ") + "." : "");

  d.prepare(`INSERT INTO fl_digests(day,distance_km,moving_min,dwell_min,places,summary,created)
             VALUES(?,?,?,?,?,?,?)
             ON CONFLICT(day) DO UPDATE SET distance_km=excluded.distance_km, moving_min=excluded.moving_min,
               dwell_min=excluded.dwell_min, places=excluded.places, summary=excluded.summary, created=excluded.created`)
    .run(dayStr, km, mins(movingMs), mins(dwellMs), JSON.stringify(places), summary, Date.now());
  return { day: dayStr, rows: rows.length, km: +km.toFixed(1), summary };
}

const CHRONICLER = `You are the chronicler of a field log. You will receive daily digests of a
person's movements and events. Compress them into a short narrative (150-300 words) in the
"chronicler" voice: dense with fact, sparing with metaphor, warm but precise. Preserve the
operative's arc -- recurring places, rhythms, notable events, the dog. You may use metaphor,
but NEVER invent facts, names, places, or numbers that are not in the input. The story must
wrap the truth, not replace it. Output only the narrative prose.`;

export function compact(cutoffDays = 90, tier = "narrative") {
  const d = db();
  const cutoff = new Date(Date.now() - cutoffDays * 86400000).toISOString().slice(0, 10);
  const covered = new Set();
  for (const n of d.prepare(`SELECT source_ref FROM fl_narratives WHERE source_ref IS NOT NULL`).all())
    for (const day of String(n.source_ref).split(",")) covered.add(day);
  const digests = d.prepare(`SELECT day,summary FROM fl_digests WHERE day < ? ORDER BY day`).all(cutoff)
    .filter((r) => !covered.has(r.day));
  if (digests.length < 3) return { compacted: 0, note: "not enough un-compacted days yet" };

  const body = digests.map((r) => `- ${r.summary}`).join("\n");
  let text;
  try {
    text = execFileSync("opencode", ["run", `${CHRONICLER}\n\nDigests:\n${body}`], { encoding: "utf8", timeout: 180000 }).trim();
  } catch (e) {
    return { compacted: 0, note: `model call failed: ${String(e.message).slice(0, 120)}` };
  }
  if (!text) return { compacted: 0, note: "empty narrative" };
  d.prepare(`INSERT INTO fl_narratives(tier,voice,period_start,period_end,text,source_ref,created) VALUES(?,?,?,?,?,?,?)`)
    .run(tier, "chronicler", digests[0].day, digests[digests.length - 1].day, text, digests.map((r) => r.day).join(","), Date.now());
  return { compacted: digests.length, from: digests[0].day, to: digests[digests.length - 1].day };
}

export function recent(n = 5) {
  const d = db();
  const digs = d.prepare(`SELECT day,summary FROM fl_digests ORDER BY day DESC LIMIT ?`).all(n);
  const narr = d.prepare(`SELECT tier,period_start,period_end,text FROM fl_narratives ORDER BY created DESC LIMIT 1`).get();
  return { digests: digs.reverse(), narrative: narr || null };
}

// Append an event to the field log (watch triggers, notable turns, notes).
export function note(kind, detail = "", lat = null, lon = null) {
  const d = db();
  d.prepare(`INSERT INTO fl_events(ts,kind,lat,lon,detail) VALUES(?,?,?,?,?)`)
    .run(Date.now(), String(kind), lat, lon, String(detail));
  return { ok: true };
}

// ---- CLI ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...a] = process.argv.slice(2);
  if (cmd === "init") { db(); console.log("fieldlog: tables ready"); }
  else if (cmd === "digest") {
    const day = a[0] || new Date().toISOString().slice(0, 10);
    console.log(JSON.stringify(digest(day)));
  } else if (cmd === "compact") console.log(JSON.stringify(compact(Number(a[0]) || 90)));
  else if (cmd === "legend") console.log(JSON.stringify(compact(Number(a[0]) || 365, "legend")));
  else if (cmd === "recent") console.log(JSON.stringify(recent(Number(a[0]) || 5), null, 1));
  else {
    console.error("usage: fieldlog.mjs init|digest [day]|compact [days]|legend [days]|recent [n]");
    process.exit(2);
  }
}
