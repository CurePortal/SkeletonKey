#!/usr/bin/env node
// Local geo bridge for SkeletonKey.
//
// One HTTP surface over the two offline map services this machine already has:
//   - Valhalla at http://127.0.0.1:8002 (routing, locate, height)
//   - the OSM gazetteer at ~/maps/overlay/overlay.sqlite (names, places)
//
// Why a bridge: Valhalla allows browser CORS but has no geocoder, and the
// gazetteer is a Node module. The desktop app, the browser build, the `geo` CLI,
// and the MCP tools should all see the same answers, so this server is the
// shared protocol.
//
//   node tools/geo-http.mjs            # http://127.0.0.1:8788
//   GEO_PORT=9000 node tools/geo-http.mjs
//
// Endpoints:
//   GET  /health
//   GET  /find?q=NAME&limit=10
//   GET  /reverse?lat=&lon=&radius=800&limit=15
//   GET  /nearby?lat=&lon=&radius=3000&category=&limit=50
//   GET  /status
//   GET  /fieldlog/recent?days=7&limit=100
//   POST /route   {from, to, costing}
//   POST /height  {points:[{lat,lon}], range?}
//   POST /locate  {lat, lon}
//   GET  /ollama/models   local pulls + ~/.ollama/config.json + capabilities
//   *    /ollama/*        proxy to Ollama, optional ?base=
//
// Coordinates may be passed as "lat,lon" or as an object. Place names are
// resolved through the gazetteer. Nothing leaves the machine.

import { createServer } from "node:http";
import { access, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join as joinPath } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.GEO_PORT || 8788);
const HOST = process.env.GEO_HOST || "127.0.0.1";
const VALHALLA = (process.env.VALHALLA_URL || "http://127.0.0.1:8002").replace(/\/$/, "");
const BEACON = (process.env.BEACON_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const OPENCODE = (process.env.OPENCODE_URL || "http://127.0.0.1:4096").replace(/\/$/, "");
const OLLAMA = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const OLLAMA_CONFIG =
  process.env.OLLAMA_CONFIG || `${homedir()}/.ollama/config.json`;
const FIELDLOG_DB =
  process.env.BEACON_DB || `${homedir()}/.local/state/beacon/beacon.db`;
// The gazetteer module can live in the repo, in a packaged Tauri resource, or
// in the legacy ~/maps layout. Pick the first one that exists.
const GAZETTEER_PATH =
  [
    process.env.GAZETTEER_MODULE,
    joinPath(HERE, "..", "sousveillance", "maps", "overlay", "gazetteer.mjs"),
    `${homedir()}/maps/overlay/gazetteer.mjs`,
  ].find((candidate) => candidate && existsSync(candidate)) ||
  joinPath(HERE, "..", "sousveillance", "maps", "overlay", "gazetteer.mjs");
const COSTINGS = new Set(["auto", "bicycle", "pedestrian", "truck", "bus"]);

let gaz = null;
let gazError = "";

async function loadGazetteer() {
  try {
    await access(GAZETTEER_PATH);
    gaz = await import(pathToFileURL(GAZETTEER_PATH).href);
  } catch (error) {
    gazError = String(error?.message || error);
  }
}

function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

async function readRaw(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4_000_000) throw new Error("body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_000_000) throw new Error("body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function coord(value) {
  if (value && typeof value === "object") {
    const lat = Number(value.lat);
    const lon = Number(value.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }
  const text = String(value ?? "").trim();
  const match = text.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lon = Number(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

async function resolvePoint(value) {
  const direct = coord(value);
  if (direct) return direct;
  const name = String(value ?? "").trim();
  if (!name) throw new Error("an empty place cannot be resolved");
  if (!gaz) throw new Error(gazError || "the gazetteer is not available");
  const rows = gaz.lookup(name, 1) || [];
  const row = rows[0];
  if (!row) throw new Error(`no gazetteer match for "${name}"`);
  return { lat: row.lat, lon: row.lon, matched: row.name };
}

async function valhalla(path, body) {
  const response = await fetch(`${VALHALLA}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(
      `Valhalla ${path} returned ${response.status}: ${String(data.error || text).slice(0, 300)}`,
    );
  }
  return data;
}

function decodePolyline(encoded, precision = 6) {
  if (!encoded) return [];
  let index = 0;
  let lat = 0;
  let lon = 0;
  const factor = 10 ** precision;
  const points = [];
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ lat: lat / factor, lon: lon / factor });
  }
  return points;
}

function ollamaTarget(url) {
  const raw = String(url.searchParams.get("base") || "").trim();
  if (!raw) return OLLAMA;
  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
  } catch {
    throw new Error("invalid Ollama base URL");
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error("Ollama base must be loopback (localhost, 127.0.0.1, or ::1)");
  }
  return parsed.origin;
}

async function ollamaConfiguredModels() {
  const names = new Set();
  try {
    const config = JSON.parse(await readFile(OLLAMA_CONFIG, "utf8"));
    const integrations = config?.integrations;
    if (integrations && typeof integrations === "object") {
      for (const entry of Object.values(integrations)) {
        const models = entry?.models;
        if (Array.isArray(models)) {
          for (const name of models) if (typeof name === "string") names.add(name.trim());
        }
      }
    }
    if (typeof config?.last_model === "string") names.add(config.last_model.trim());
  } catch {
    // Optional; /api/tags still covers local pulls.
  }
  return names;
}

async function ollamaModels(base) {
  const names = new Set();
  try {
    const response = await fetch(`${base}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json();
      for (const row of data.models || []) {
        const name = String(row.name || row.model || "").trim();
        if (name) names.add(name);
      }
    }
  } catch {
    // Ollama may be offline; configured names can still answer.
  }
  for (const name of await ollamaConfiguredModels()) names.add(name);

  return Promise.all(
    [...names]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map(async (name) => {
        try {
          const response = await fetch(`${base}/api/show`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: name }),
            signal: AbortSignal.timeout(4000),
          });
          if (!response.ok) return { name, vision: false };
          const data = await response.json();
          return {
            name,
            vision: Array.isArray(data.capabilities) && data.capabilities.includes("vision"),
          };
        } catch {
          return { name, vision: false };
        }
      }),
  );
}

function normalizeRows(rows) {
  return (rows || []).map((row) => ({
    lat: row.lat,
    lon: row.lon,
    name: row.name,
    category: row.category || "",
    subcat: row.subcat || "",
    ...(row.dist != null ? { distanceM: row.dist } : {}),
  }));
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end();
    return;
  }

  if (path === "/" || path === "/health") {
    const check = async (url) => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
        return response.ok;
      } catch {
        return false;
      }
    };
    const [valhallaStatus, beaconOk, opencodeOk, ollamaOk] = await Promise.all([
      valhalla("status", {}).catch(() => null),
      check(`${BEACON}/health`),
      check(`${OPENCODE}/global/health`),
      check(`${OLLAMA}/api/tags`),
    ]);
    json(res, 200, {
      ok: Boolean(valhallaStatus),
      gazetteer: Boolean(gaz),
      gazetteerError: gaz ? "" : gazError,
      valhalla: Boolean(valhallaStatus),
      valhallaUrl: VALHALLA,
      beacon: beaconOk,
      beaconUrl: BEACON,
      opencode: opencodeOk,
      opencodeUrl: OPENCODE,
      ollama: ollamaOk,
      ollamaUrl: OLLAMA,
      version: valhallaStatus?.version || "",
    });
    return;
  }

  if (path === "/beacon/history" || path === "/beacon/track") {
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 7)));
    const limit = Math.min(20000, Math.max(1, Number(url.searchParams.get("limit") || 5000)));
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    let track = [];
    try {
      const db = new DatabaseSync(FIELDLOG_DB);
      track = db
        .prepare(
          `SELECT id, ts, lat, lon, speed, heading, accuracy, altitude, battery, source
           FROM positions WHERE ts >= ? ORDER BY ts ASC LIMIT ?`,
        )
        .all(cutoff, limit);
      db.close();
    } catch {
      track = [];
    }
    json(res, 200, {
      ok: true,
      days,
      count: track.length,
      latest: track.length ? track[track.length - 1] : null,
      track,
    });
    return;
  }

  if (path === "/ollama/models") {
    const base = ollamaTarget(url);
    json(res, 200, { models: await ollamaModels(base), base });
    return;
  }

  if (
    path.startsWith("/beacon/") ||
    path.startsWith("/opencode/") ||
    path.startsWith("/ollama/")
  ) {
    const isBeacon = path.startsWith("/beacon/");
    const isOllama = path.startsWith("/ollama/");
    const target = isBeacon ? BEACON : isOllama ? ollamaTarget(url) : OPENCODE;
    const rest = path.slice(isBeacon ? "/beacon".length : isOllama ? "/ollama".length : "/opencode".length);
    const params = new URLSearchParams(url.search);
    if (isOllama) params.delete("base");
    const query = params.toString();
    const headers = {};
    if (req.headers.authorization) headers["Authorization"] = req.headers.authorization;
    if (req.headers["content-type"]) headers["Content-Type"] = req.headers["content-type"];
    const init = { method: req.method, headers, signal: AbortSignal.timeout(180_000) };
    if (req.method !== "GET" && req.method !== "HEAD") init.body = await readRaw(req);
    const response = await fetch(`${target}${rest}${query ? `?${query}` : ""}`, init);
    const body = await response.text();
    res.writeHead(response.status, {
      "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    res.end(body);
    return;
  }

  if (path === "/status") {
    json(res, 200, await valhalla("status", {}));
    return;
  }

  if (path === "/fieldlog/recent") {
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 7)));
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 100)));
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    let events = [];
    try {
      const db = new DatabaseSync(FIELDLOG_DB);
      events = db
        .prepare(
          `SELECT id, ts, kind, lat, lon, detail FROM fl_events
           WHERE ts >= ? AND kind NOT LIKE 'raven:%' AND kind NOT IN ('dark','operative','ambient')
           ORDER BY ts DESC LIMIT ?`,
        )
        .all(cutoff, limit);
      db.close();
    } catch {
      events = [];
    }
    json(res, 200, { events });
    return;
  }

  if (path === "/find") {
    if (!gaz) throw new Error(gazError || "the gazetteer is not available");
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 10)));
    json(res, 200, { query: q, places: normalizeRows(gaz.lookup(q, limit)) });
    return;
  }

  if (path === "/reverse") {
    if (!gaz) throw new Error(gazError || "the gazetteer is not available");
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const radius = Math.min(50_000, Math.max(50, Number(url.searchParams.get("radius") || 800)));
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 15)));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("lat and lon are required");
    json(res, 200, { lat, lon, places: normalizeRows(gaz.reverse(lat, lon, radius, limit)) });
    return;
  }

  if (path === "/nearby") {
    if (!gaz) throw new Error(gazError || "the gazetteer is not available");
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    const radius = Math.min(50_000, Math.max(50, Number(url.searchParams.get("radius") || 3000)));
    const category = (url.searchParams.get("category") || "").trim() || null;
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("lat and lon are required");
    json(res, 200, {
      lat,
      lon,
      places: normalizeRows(gaz.nearby(lat, lon, radius, category, limit)),
    });
    return;
  }

  if (path === "/route" && req.method === "POST") {
    const body = await readJson(req);
    const from = await resolvePoint(body.from);
    const to = await resolvePoint(body.to);
    const costing = COSTINGS.has(body.costing) ? body.costing : "auto";
    const data = await valhalla("route", {
      locations: [
        { lat: from.lat, lon: from.lon },
        { lat: to.lat, lon: to.lon },
      ],
      costing,
      units: "kilometers",
      language: "en-US",
    });
    const summary = data.trip?.summary || {};
    const legs = data.trip?.legs || [];
    json(res, 200, {
      from,
      to,
      costing,
      distanceKm: Number(summary.length || 0),
      durationMin: Math.round(Number(summary.time || 0) / 60),
      maneuvers: legs.flatMap((leg) =>
        (leg.maneuvers || []).map((m) => ({
          instruction: m.instruction || "",
          lengthKm: Number(m.length || 0),
          timeSec: Number(m.time || 0),
          street: (m.street_names || []).join(", "),
        })),
      ),
      geometry: legs.flatMap((leg) => decodePolyline(leg.shape)),
      raw: data,
    });
    return;
  }

  if (path === "/height" && req.method === "POST") {
    const body = await readJson(req);
    const points = Array.isArray(body.points) ? body.points.map(coord).filter(Boolean) : [];
    if (!points.length) throw new Error("points are required");
    const data = await valhalla("height", {
      shape: points,
      range: Boolean(body.range),
      height_precision: 1,
    });
    json(res, 200, data);
    return;
  }

  if (path === "/locate" && req.method === "POST") {
    const body = await readJson(req);
    const point = await resolvePoint(body.lat != null ? { lat: body.lat, lon: body.lon } : body.place);
    const data = await valhalla("locate", {
      locations: [{ lat: point.lat, lon: point.lon }],
      verbose: true,
    });
    json(res, 200, { point, result: data });
    return;
  }

  json(res, 404, { error: "unknown endpoint" });
}

await loadGazetteer();

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    json(res, 400, { error: String(error?.message || error) });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`geo-http: http://${HOST}:${PORT}`);
  console.log(`geo-http: valhalla ${VALHALLA}`);
  console.log(`geo-http: gazetteer ${gaz ? "ready" : `unavailable (${gazError})`}`);
  console.log(`geo-http: beacon ${BEACON}`);
  console.log(`geo-http: opencode ${OPENCODE}`);
  console.log(`geo-http: ollama ${OLLAMA}`);
});
