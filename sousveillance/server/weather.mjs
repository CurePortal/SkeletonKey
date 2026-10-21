#!/usr/bin/env node
// weather.mjs -- local weather/air-quality via Open-Meteo, the one approved
// outbound exception. Coordinates are TRUNCATED to a ~0.05 deg (~5 km) grid
// before every request (data minimisation). Fetched on a timer and cached
// locally, so HQ can state the conditions and their age without a live call.
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";

import { latestPosition } from "./lib/store.mjs";

const DB = process.env.BEACON_DB || `${homedir()}/.local/state/beacon/beacon.db`;
const GRID = 0.05;
const KEEP_MS = 7 * 86400000;

function db() {
  const d = new DatabaseSync(DB);
  d.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  d.exec("CREATE TABLE IF NOT EXISTS wx(ts INTEGER, glat REAL, glon REAL, json TEXT);");
  return d;
}
const trunc = (x) => Math.round(x / GRID) * GRID;

export async function update() {
  const p = latestPosition();
  if (!p) return { ok: false, error: "no position yet" };
  const glat = trunc(p.lat);
  const glon = trunc(p.lon);
  const fields = "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m";
  const fc =
    `https://api.open-meteo.com/v1/forecast?latitude=${glat}&longitude=${glon}` +
    `&current=${fields}&hourly=precipitation_probability,temperature_2m&forecast_hours=6&timezone=auto`;
  const aq = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${glat}&longitude=${glon}&current=us_aqi,pm2_5`;

  const out = { glat, glon, fetched: Date.now() };
  try {
    out.forecast = await (await fetch(fc, { signal: AbortSignal.timeout(15000) })).json();
    out.air = await (await fetch(aq, { signal: AbortSignal.timeout(15000) })).json();
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
  const d = db();
  d.prepare("INSERT INTO wx(ts,glat,glon,json) VALUES(?,?,?,?)").run(Date.now(), glat, glon, JSON.stringify(out));
  d.prepare("DELETE FROM wx WHERE ts < ?").run(Date.now() - KEEP_MS);
  return { ok: true, glat, glon, current: out.forecast?.current };
}

export function latest() {
  const d = db();
  const r = d.prepare("SELECT ts,glat,glon,json FROM wx ORDER BY ts DESC LIMIT 1").get();
  if (!r) return null;
  return { ts: r.ts, glat: r.glat, glon: r.glon, data: JSON.parse(r.json) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] || "update";
  if (cmd === "update") console.log(JSON.stringify(await update()));
  else if (cmd === "show") console.log(JSON.stringify(latest(), null, 1));
  else { console.error("usage: weather.mjs update|show"); process.exit(2); }
}
