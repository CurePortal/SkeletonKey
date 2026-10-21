#!/usr/bin/env node
// RAVEN PROTOCOL -- the watch.
//
// A daemon that quietly watches the operative's beacon and speaks only when it
// matters: lost signal, reconnect, long stall, motion anomaly, geofence, dusk.
// On a trigger it composes a short line in mission-control voice (LLM, with a
// templated fallback so it never goes silent), enqueues it to the phone
// (beacon_say), and writes it to the field log. Severity tiers, per-trigger
// cooldowns and quiet hours keep it an eye, not a nag.
//
// Config: raven.json next to this file (see raven.json.example), or $RAVEN_CONFIG.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

import { latestPosition, enqueueSay } from "./lib/store.mjs";
import { note } from "./fieldlog.mjs";
import { latest as wxLatest } from "./weather.mjs";
import { latest as hzLatest } from "./hazards.mjs";

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const CFG_PATH = process.env.RAVEN_CONFIG || join(HERE, "raven.json");
const STATE_PATH = `${homedir()}/.local/state/beacon/raven-state.json`;
const GAZ = process.env.GAZETTEER || new URL("../maps/overlay/gazetteer.mjs", import.meta.url).pathname;

const DEFAULTS = {
  pollMs: 45000,
  lostMin: 20,
  escalateMin: 60,
  reconnectMin: 2,
  stallMin: 0, // 0 = disabled: stillness is not an event ("no news is good news")
  stallRadiusM: 150,
  speedMaxMps: 40, // interpreted with altitude/alt-rate, not reported raw
  altRateMaxMps: 5, // sustained climb/descent -> possibly airborne
  quiet: [23, 7], // local hours [start, end)
  llm: true,
  llmTimeoutMs: 60000,
  cooldownMin: 30,
  geofences: [],
  dangerZones: [],      // {name,lat,lon,radius} -> emergency if last known location is inside
  emergencyRepeatMin: 15,
  darkWatchMin: 15,     // while dark, re-assess the last known ground this often
};

const cfg = { ...DEFAULTS, ...(existsSync(CFG_PATH) ? JSON.parse(readFileSync(CFG_PATH, "utf8")) : {}) };

let state = {
  lost: false, escalated: false,
  lastMovingTs: 0, stallAnchor: null,
  lastAlt: null, lastAltTs: 0,
  duskDay: null, cooldowns: {}, inside: {},
};
if (existsSync(STATE_PATH)) {
  try { state = { ...state, ...JSON.parse(readFileSync(STATE_PATH, "utf8")) }; } catch {}
}
const saveState = () => { try { writeFileSync(STATE_PATH, JSON.stringify(state)); } catch {} };

function hav(a, b, c, e) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (c - a) * r, dLon = (e - b) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// NOAA sunset (ms) for a date at lat/lon, or null
function sunset(lat, lon, date) {
  const rad = Math.PI / 180;
  const N = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000);
  const lngHour = lon / 15;
  const t = N + ((18 - lngHour) / 24);
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * rad) + 0.020 * Math.sin(2 * M * rad) + 282.634;
  L = ((L % 360) + 360) % 360;
  let RA = Math.atan(0.91764 * Math.tan(L * rad)) / rad;
  RA = ((RA % 360) + 360) % 360;
  RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
  const sinDec = 0.39782 * Math.sin(L * rad);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return null;
  const H = (Math.acos(cosH) / rad) / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const UT = ((T - lngHour) % 24 + 24) % 24;
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + Math.round(UT * 3600 * 1000));
  return d.getTime();
}

function nearestPlace(lat, lon) {
  try {
    const out =
      execFileSync("node", [GAZ, "reverse", String(lat), String(lon), "1500"], {
        encoding: "utf8",
        timeout: 8000,
      }).split("\n")[0] || "";
    const m = out.match(/^\S+\s+(.*?)\s+\[/);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

// Is the *conditions/hazard* picture dangerous? Conservative: only genuinely
// alarming signals, so the dark-watch doesn't cry wolf. Returns a short reason.
function hazardReason() {
  const w = wxLatest();
  if (w) {
    const c = w.data.forecast?.current || {};
    const h = w.data.forecast?.hourly || {};
    const air = w.data.air?.current || {};
    const rain = Array.isArray(h.precipitation_probability)
      ? Math.max(...h.precipitation_probability.slice(0, 6))
      : null;
    if (c.temperature_2m != null && c.temperature_2m >= 40) return `extreme heat (${Math.round(c.temperature_2m)}°C)`;
    if (c.wind_gusts_10m != null && c.wind_gusts_10m >= 80) return "severe wind";
    if (rain != null && rain >= 85) return `storm risk (${rain}%)`;
    if (air.us_aqi != null && air.us_aqi >= 150) return `smoke (AQI ${air.us_aqi})`;
  }
  const hz = hzLatest();
  if (hz) {
    const now = Date.now();
    for (const q of hz.data.quakes || []) {
      if (q.mag >= 4.5 && q.km != null && q.km < 60 && now - q.t < 24 * 3600 * 1000) {
        return `recent M${q.mag} quake nearby`;
      }
    }
  }
  return null;
}

// Read the ground at a point (the dark-watch assessment): nearest named place,
// nearest water, and whether it's dangerous (zone, weather, or hazard).
function assess(lat, lon) {
  let place = null;
  let water = null;
  let waterDist = null;
  try {
    const out = execFileSync("node", [GAZ, "reverse", String(lat), String(lon), "1500"], {
      encoding: "utf8",
      timeout: 10000,
    });
    for (const line of out.split("\n")) {
      const m = line.match(/^\S+\s+(.*?)\s+\[([^\]]+)\]\s+(\d+)m\s*$/);
      if (!m) continue;
      const name = m[1];
      const [c, sub] = m[2].split("/");
      const dist = Number(m[3]);
      if (!place && c === "place") place = name;
      if (!water && (c === "waterway" || (c === "natural" && sub === "water"))) {
        water = name;
        waterDist = dist;
      }
    }
  } catch {}
  const zone = isEmergency(lat, lon);
  const reason = hazardReason();
  return { place, water, waterDist, danger: zone || !!reason, reason: reason || (zone ? "danger zone" : null) };
}

// Is the phone/app actually connected right now? (beacond's live client count.)
async function phoneOnline() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch("http://127.0.0.1:8787/health", { signal: ctrl.signal });
    clearTimeout(t);
    const j = await r.json();
    return (j.clients || 0) > 0;
  } catch {
    return false;
  }
}

// Emergency = the last known location is inside a configured danger zone.
function isEmergency(lat, lon) {
  for (const z of cfg.dangerZones || []) {
    if (Number.isFinite(z.lat) && Number.isFinite(z.lon) && hav(lat, lon, z.lat, z.lon) <= (z.radius ?? 500)) return true;
  }
  return false;
}

const TEMPLATES = {
  lost: () => `HQ to Operative — I've lost your signal. You've gone dark; sit tight and check the beacon when you can.`,
  app_offline: (d) => `Your beacon's offline — I'm reading that as the app dropping, not you.${d.place ? ` Last I had you near ${d.place}.` : ""} I'll keep watching; check in when you're back.`,
  emergency: (d) => `You went dark${d.place ? ` near ${d.place}` : " out there"}${d.reason ? ` — ${d.reason}` : d.water ? `, by the ${d.water}` : ""}. If you're in trouble, respond — I'm holding the channel.`,
  lost_escalate: (d) => `Still no fix${d.place ? ` since ${d.place}` : ""}. If you can read this, get to open ground and re-establish.`,
  reconnect: (d) => `Welcome back — you were dark about ${d.min} minutes.${d.place ? ` Last I had you near ${d.place}.` : ""} You're on the board.`,
  stall: (d) => `You've been held up about ${d.min} minutes. Anything you want to tell me, or are you just taking the view?`,
  motion: (d) =>
    d.airborne
      ? `You're off the ground — airborne. Where are you taking us?`
      : `That's faster than the truck should be doing. You okay?`,
  geofence_enter: (d) => d.onEnter || `You've entered ${d.name}.`,
  geofence_exit: (d) => d.onExit || `You've left ${d.name}.`,
  dusk: (d) => `Sun's down in about ${d.min} minutes. Start thinking about where you're making camp.`,
};

function quietNow() {
  const h = new Date().getHours();
  const [s, e] = cfg.quiet;
  return s <= e ? (h >= s && h < e) : (h >= s || h < e);
}

async function compose(kind, d) {
  const tpl = TEMPLATES[kind] ? TEMPLATES[kind](d) : `HQ here: ${kind}.`;
  if (!cfg.llm) return tpl;
  const sit = [
    `trigger: ${kind}`,
    d.min != null ? `for about ${d.min} minutes` : "",
    d.lat != null ? `operative at ${d.lat.toFixed(4)},${d.lon.toFixed(4)}` : "",
    d.place ? `nearest place: ${d.place}` : "",
    d.speed != null ? `speed ${d.speed.toFixed(1)} m/s` : "",
    d.altitude != null ? `altitude ${Math.round(d.altitude)} m` : "",
    d.altRate != null ? `climb/descent ${d.altRate.toFixed(1)} m/s` : "",
  ].filter(Boolean).join("; ");
  const prompt =
    `You are HQ, a mission-control handler speaking one line into the operative's earpiece. ` +
    `Compose ONE short spoken sentence (max ~25 words) for this situation: ${sit}. ` +
    `Calm, present tense, quietly urgent, in voice. Do not invent facts. ` +
    `Do not relay things the operative can already see for themselves (battery level, the time). ` +
    `If this is a movement event, do NOT state the speed — infer the mode of travel ` +
    `(on foot / truck / car / train / aircraft) from speed + altitude + climb-rate, and say only what it means. ` +
    `The operative drives a truck, so ordinary road-speed travel is expected — speak only if the ` +
    `movement does NOT fit driving (e.g. airborne). ` +
    `Output only the sentence.`;
  try {
    const { stdout } = await execFileP("opencode", ["run", prompt], { timeout: cfg.llmTimeoutMs, maxBuffer: 1 << 20 });
    const line = (stdout || "").trim().split("\n").filter(Boolean).pop();
    if (line && line.length > 3) return line.replace(/^["']|["']$/g, "");
  } catch {}
  return tpl;
}

async function fire(kind, d = {}) {
  const now = Date.now();
  const cd = (cfg.cooldownMin || 0) * 60000;
  const high = kind === "lost" || kind === "lost_escalate" || kind === "emergency";
  if (!high && state.cooldowns[kind] && now - state.cooldowns[kind] < cd) return; // high severity bypasses cooldown
  if (!high && quietNow()) return;

  const line = await compose(kind, d);
  enqueueSay(line, "say");
  try { note(`raven:${kind}`, line, d.lat ?? null, d.lon ?? null); } catch {}
  state.cooldowns[kind] = now;
  saveState();
  console.log(`raven: ${kind} -> ${line.slice(0, 80)}`);
}

async function tick() {
  const p = latestPosition();
  if (!p) return;
  const now = Date.now();
  const age = now - p.ts;
  const min = Math.round(age / 60000);

  const online = await phoneOnline();

  // Reconnect — announce with the ground we last had.
  if (state.lost && age < (cfg.reconnectMin || 2) * 60000) {
    const darkMin = Math.round((now - (state.lastFixTs || p.ts)) / 60000);
    const info = state.darkInfo || {};
    state.lost = false; state.escalated = false; state.darkWasOffline = false;
    state.emergencyAt = 0; state.darkAssessTs = 0; state.darkInfo = null;
    await fire("reconnect", { min: darkMin, lat: p.lat, lon: p.lon, place: info.place, water: info.water });
  }

  // Going dark — assess the ground once, then speak the minimum.
  // BUT: sitting still, connected, is NOT dark. The app only reports on movement,
  // so a climbing fix-age while stationary is normal, not a lost signal. Only act
  // if the phone is actually offline, or it went quiet *while moving*.
  const wasMoving = (p.speed ?? 0) > 0.5;
  if (age > cfg.lostMin * 60000 && !state.lost && (!online || wasMoving)) {
    state.lost = true;
    state.darkWasOffline = !online;
    const a = assess(p.lat, p.lon);
    state.darkInfo = { ...a, lat: p.lat, lon: p.lon, at: now };
    state.darkAssessTs = now;
    try {
      note("dark", `went dark ${a.place ? `near ${a.place}` : `at ${p.lat.toFixed(4)},${p.lon.toFixed(4)}`}${a.water ? ` (${a.water}, ${a.waterDist}m)` : ""}`, p.lat, p.lon);
    } catch {}
    if (a.danger) {
      state.emergencyAt = now;
      await fire("emergency", { lat: p.lat, lon: p.lon, place: a.place, water: a.water, reason: a.reason });
    } else if (!online) {
      await fire("app_offline", { lat: p.lat, lon: p.lon, place: a.place });
    } else {
      await fire("lost", { lat: p.lat, lon: p.lon, place: a.place });
    }
  }

  // Escalate once, only for genuine field signal-loss (app connected but no fix).
  if (age > cfg.escalateMin * 60000 && state.lost && !state.escalated && online && !state.darkWasOffline) {
    state.escalated = true;
    await fire("lost_escalate", { lat: p.lat, lon: p.lon, place: state.darkInfo?.place });
  }

  // Dark-watch: re-assess the last known ground while dark; broadcast only if it turns dangerous.
  if (state.lost && now - (state.darkAssessTs || 0) > cfg.darkWatchMin * 60000) {
    state.darkAssessTs = now;
    const a = assess(p.lat, p.lon);
    state.darkInfo = { ...(state.darkInfo || {}), ...a, at: now };
    if (a.danger && now - (state.emergencyAt || 0) > (cfg.emergencyRepeatMin || 15) * 60000) {
      state.emergencyAt = now;
      await fire("emergency", { lat: p.lat, lon: p.lon, place: a.place, water: a.water, reason: a.reason });
    }
    // Weather/hazard assessment extends `a.danger` here once those layers land.
  }
  if (age < 60000) state.lastFixTs = p.ts;

  // altitude rate (m/s) over the *tick interval* — discriminates ground
  // vehicles (stable altitude) from aircraft (sustained climb/descent).
  let altRate = null;
  if (p.altitude != null && state.lastAlt != null && now > (state.lastAltTs || 0)) {
    altRate = (p.altitude - state.lastAlt) / ((now - state.lastAltTs) / 1000);
  }
  if (p.altitude != null) {
    state.lastAlt = p.altitude;
    state.lastAltTs = now;
  }

  // movement / stall — disabled by default (stillness is not news)
  const moving = (p.speed ?? 0) > 0.5;
  if (moving) {
    state.lastMovingTs = p.ts; state.stallAnchor = null;
  } else if (cfg.stallMin > 0) {
    if (!state.stallAnchor) state.stallAnchor = { lat: p.lat, lon: p.lon, since: p.ts };
    else if (hav(state.stallAnchor.lat, state.stallAnchor.lon, p.lat, p.lon) > cfg.stallRadiusM)
      state.stallAnchor = { lat: p.lat, lon: p.lon, since: p.ts };
    if (now - state.stallAnchor.since > cfg.stallMin * 60000) {
      await fire("stall", { min: Math.round((now - state.stallAnchor.since) / 60000), lat: p.lat, lon: p.lon, place: nearestPlace(p.lat, p.lon) });
      state.stallAnchor = null;
    }
  }

  // motion: fast track or rapid climb/descent -> interpret the *mode*, not the number
  const airborne = altRate != null && Math.abs(altRate) > cfg.altRateMaxMps;
  if ((p.speed ?? 0) > cfg.speedMaxMps || airborne) {
    await fire("motion", { lat: p.lat, lon: p.lon, speed: p.speed, altitude: p.altitude, altRate, airborne, place: nearestPlace(p.lat, p.lon) });
  }

  // geofences
  for (const g of cfg.geofences || []) {
    if (!Number.isFinite(g.lat) || !Number.isFinite(g.lon)) continue;
    const inside = hav(p.lat, p.lon, g.lat, g.lon) <= (g.radius ?? 150);
    const was = state.inside[g.name];
    state.inside[g.name] = inside;
    if (was === undefined) continue;
    if (inside && !was) await fire("geofence_enter", { name: g.name, onEnter: g.onEnter, lat: p.lat, lon: p.lon });
    else if (!inside && was) await fire("geofence_exit", { name: g.name, onExit: g.onExit, lat: p.lat, lon: p.lon });
  }

  // dusk
  const ss = sunset(p.lat, p.lon, new Date());
  const today = new Date().toISOString().slice(0, 10);
  if (ss && state.duskDay !== today && now >= ss - 30 * 60000 && now < ss) {
    state.duskDay = today;
    await fire("dusk", { min: Math.round((ss - now) / 60000), lat: p.lat, lon: p.lon });
  }

  saveState();
}

console.log(`raven: watch online (poll ${cfg.pollMs}ms, quiet ${cfg.quiet[0]}-${cfg.quiet[1]})`);
let busy = false;
function runTick() {
  if (busy) return; // never overlap: a tick can await the LLM for seconds
  busy = true;
  tick()
    .catch((e) => console.error("raven error:", String(e).slice(0, 160)))
    .finally(() => { busy = false; });
}
setInterval(runTick, cfg.pollMs);
runTick();
