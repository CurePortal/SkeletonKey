#!/usr/bin/env node
// hazards.mjs -- cached seismic + wildfire (+ stream) hazards near the
// operative. Free, keyless public feeds (USGS, NIFC); fetched on a timer and
// cached locally so HQ can state severity + age without a live call.
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";

import { latestPosition } from "./lib/store.mjs";

const DB = process.env.BEACON_DB || `${homedir()}/.local/state/beacon/beacon.db`;
const R_KM = 200;
const KEEP_MS = 30 * 86400000;

function db() {
  const d = new DatabaseSync(DB);
  d.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  d.exec("CREATE TABLE IF NOT EXISTS hz(ts INTEGER, json TEXT);");
  return d;
}
function near(aLat, aLon, bLat, bLon) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function quakes(lat, lon) {
  const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const url =
    `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=2.5` +
    `&starttime=${start}&latitude=${lat}&longitude=${lon}&maxradiuskm=${R_KM}&orderby=magnitude&limit=5`;
  const j = await (await fetch(url, { signal: AbortSignal.timeout(15000) })).json();
  return (j.features || []).map((f) => {
    const c = f.geometry?.coordinates || [null, null];
    return {
      mag: f.properties.mag,
      place: f.properties.place,
      t: f.properties.time,
      km: c[1] != null ? Math.round(near(lat, lon, c[1], c[0])) : null,
    };
  });
}

async function fires(lat, lon) {
  const d = R_KM / 111;
  const geo = `${lon - d},${lat - d},${lon + d},${lat + d}`;
  const url =
    `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters/FeatureServer/0/query` +
    `?where=1%3D1&geometry=${geo}&geometryType=esriGeometryEnvelope&inSR=4326` +
    `&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json&resultRecordCount=5`;
  const j = await (await fetch(url, { signal: AbortSignal.timeout(15000) })).json();
  return (j.features || []).map((f) => {
    const a = f.attributes || {};
    const pick = (...keys) => keys.map((k) => a[k]).find((v) => v != null);
    return {
      name: pick("poly_IncidentName", "IncidentName", "irwin_IncidentName"),
      contained: pick("attr_PercentContained", "PercentContained"),
      acres: pick("poly_GISAcres", "GISAcres", "attr_CalculatedAcres"),
    };
  });
}

export async function update() {
  const p = latestPosition();
  if (!p) return { ok: false, error: "no position yet" };
  const out = { fetched: Date.now(), lat: p.lat, lon: p.lon };
  try {
    out.quakes = await quakes(p.lat, p.lon);
  } catch (e) {
    out.quakes = [];
    out.qerr = String(e.message || e);
  }
  try {
    out.fires = await fires(p.lat, p.lon);
  } catch (e) {
    out.fires = [];
    out.ferr = String(e.message || e);
  }
  const d = db();
  d.prepare("INSERT INTO hz(ts,json) VALUES(?,?)").run(Date.now(), JSON.stringify(out));
  d.prepare("DELETE FROM hz WHERE ts < ?").run(Date.now() - KEEP_MS);
  return { ok: true, quakes: (out.quakes || []).length, fires: (out.fires || []).length };
}

export function latest() {
  const d = db();
  const r = d.prepare("SELECT ts,json FROM hz ORDER BY ts DESC LIMIT 1").get();
  if (!r) return null;
  return { ts: r.ts, data: JSON.parse(r.json) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2] || "update";
  if (cmd === "update") console.log(JSON.stringify(await update()));
  else if (cmd === "show") console.log(JSON.stringify(latest(), null, 1));
  else { console.error("usage: hazards.mjs update|show"); process.exit(2); }
}
