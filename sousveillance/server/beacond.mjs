// beacond -- the phone's home base.
//
// Ingest (phone -> here):
//   POST /beacon   {lat, lon, speed?, heading?, accuracy?, altitude?, battery?, ts?}
//   POST /ambient  {text}              (background stream; no spoken reply)
//   WS   /stream   {type:"pos", ...}   (same payload, over the live socket)
//   WS   /stream   {type:"ambient", text} (background stream)
//
// Downlink (here -> phone, pushed over the WebSocket):
//   any row queued in the `outbox` table by the MCP (`beacon_say`) or POST /say
//
// Read:
//   GET  /whereami?limit=100
//   GET  /health
//
// Auth: `Authorization: Bearer $BEACON_TOKEN` (HTTP) or `?token=$BEACON_TOKEN`
// (WebSocket). If no phone is connected, queued messages wait in the outbox and
// are flushed on the next connection.
import { createServer } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PORT, HOST, TOKEN } from "./config.mjs";
import { HAS_KEY, isEnvelope, encrypt, decrypt } from "./lib/crypto.mjs";
import {
  addPosition,
  latestPosition,
  recentTrack,
  enqueueSay,
  unsent,
  markSent,
  outboxSince,
  maxOutboxId,
} from "./lib/store.mjs";
import { createSession, getSession, listMessages, promptAsync, waitForReply } from "./lib/opencode.mjs";
import { note as fieldNote } from "./fieldlog.mjs";
import { proposeExtension } from "./lib/extensions.mjs";

if (!TOKEN) {
  console.error("beacon: BEACON_TOKEN is required (put it in sousveillance/server/.env)");
  process.exit(1);
}

const clients = new Set(); // live phone sockets

function safeEq(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function authed(req) {
  const h = req.headers.authorization || "";
  const tok = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  return tok.length > 0 && safeEq(tok, TOKEN);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1_000_000) throw new Error("body too large");
    chunks.push(c);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// --- downlink ---------------------------------------------------------------

function send(ws, obj) {
  ws.send(JSON.stringify(encrypt(obj)));
}

function broadcast(obj) {
  const s = JSON.stringify(encrypt(obj));
  let n = 0;
  for (const c of clients) {
    if (c.readyState === c.OPEN) {
      c.send(s);
      n++;
    }
  }
  return n;
}

// Push any queued outbox rows to connected phones; mark sent only if delivered.
function flushOutbox() {
  const rows = unsent(100);
  let delivered = 0;
  for (const r of rows) {
    const n = broadcast({ type: r.kind || "say", id: r.id, ts: r.ts, text: r.text });
    if (n > 0) {
      markSent([r.id]);
      delivered++;
    }
  }
  return delivered;
}

setInterval(flushOutbox, 2000).unref();

// --- mirror phone messages to the WhatsApp HQ chat --------------------------
// Every message the beacon speaks (Raven alerts, agent beacon_say, /say) is
// also posted to the WhatsApp HQ chat, so the two channels stay in sync.
const HERE = dirname(fileURLToPath(import.meta.url));
const WA_ENV =
  [
    process.env.WA_AGENT_ENV,
    join(HERE, "..", "..", "integrations", "whatsapp", ".env"),
    `${homedir()}/opencode-whatsapp/.wa-agent-hq.env`,
  ].find((candidate) => candidate && existsSync(candidate)) ||
  join(HERE, "..", "..", "integrations", "whatsapp", ".env");
const WA_STATE =
  process.env.WA_AGENT_STATE_FILE ||
  `${homedir()}/.local/state/wa-agent-bridge-hq.json`;
let waToken = process.env.WA_AGENT_API_KEY || "";
let waTo = "";
function loadWa() {
  try {
    if (!waToken && existsSync(WA_ENV)) {
      const m = readFileSync(WA_ENV, "utf8").match(/WA_AGENT_API_KEY=\s*(\S+)/);
      if (m) waToken = m[1];
    }
  } catch {}
  try {
    const j = JSON.parse(readFileSync(WA_STATE, "utf8"));
    const k = Object.keys(j.sessions || {})[0];
    if (k) waTo = k.split("#")[0];
  } catch {}
}

async function mirrorToWhatsApp(text) {
  if (!text) return;
  loadWa();
  if (!waToken || !waTo) return;
  try {
    await fetch("https://api.whatsapp.com/agent/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer " + waToken },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: waTo,
        type: "text",
        text: { body: String(text).slice(0, 3500) },
      }),
      signal: AbortSignal.timeout(15000),
    }).then((r) => console.log(`wa-mirror: ${r.ok ? "ok" : "HTTP " + r.status}`));
  } catch (e) {
    console.log("wa-mirror fail:", String(e.message || e).slice(0, 80));
  }
}

// Mirror only messages created after startup (don't replay history).
let mirrorSince = maxOutboxId();
setInterval(() => {
  try {
    for (const r of outboxSince(mirrorSince, 20)) {
      mirrorSince = r.id;
      if (r.kind !== "test") mirrorToWhatsApp(r.text);
    }
  } catch {}
}, 3000);

// --- voice uplink: text -> HQ agent -> spoken reply -------------------------
// The phone does STT on-device and sends text; we drive the HQ agent and speak
// the reply back. Serialized so turns don't race on one session.

const VOICE_SESSION_FILE = `${homedir()}/.local/state/beacon/voice-session.json`;
let voiceSession = null;
let askChain = Promise.resolve();

function loadVoiceSession() {
  try {
    return JSON.parse(readFileSync(VOICE_SESSION_FILE, "utf8")).id;
  } catch {
    return null;
  }
}
function saveVoiceSession(id) {
  try {
    writeFileSync(VOICE_SESSION_FILE, JSON.stringify({ id }));
  } catch {}
}

async function ensureVoiceSession() {
  if (voiceSession && (await getSession(voiceSession))) return voiceSession;
  const saved = loadVoiceSession();
  if (saved && (await getSession(saved))) {
    voiceSession = saved;
    return saved;
  }
  const s = await createSession("HQ voice");
  voiceSession = s.id;
  saveVoiceSession(s.id);
  return s.id;
}

async function handleAsk(text) {
  const sid = await ensureVoiceSession();
  const seen = new Set();
  for (const m of await listMessages(sid)) if (m.info.role === "assistant") seen.add(m.info.id);
  try {
    fieldNote("operative", text);
  } catch {}
  mirrorToWhatsApp(`[app] Operative: ${text}`);
  await promptAsync(sid, text, { agent: "hq" });
  const reply = await waitForReply(sid, seen, 180000);
  enqueueSay(reply, "say");
  flushOutbox();
  return reply;
}

// --- ambient stream: text -> silent extraction into SkeletonKey -------------
// Ambient microphone transcripts are not messages. They are background context:
// log them, ask HQ to extract people/places/events, and write the result to the
// SkeletonKey project. Extraction is silent: never speak, never mirror to
// WhatsApp, never ask a question. The one exception is a self-extension
// proposal, which is a question the operative must answer: the server records it
// and then queues the ask.

const SK_PROJECT_URL = (process.env.SK_PROJECT_URL || "http://127.0.0.1:8799").replace(/\/$/, "");
const AMBIENT_SESSION_FILE = `${homedir()}/.local/state/beacon/ambient-session.json`;
const ENTRY_CURSOR_FILE = `${homedir()}/.local/state/beacon/fieldlog-extract-cursor.json`;
const BEACON_DB = process.env.BEACON_DB || `${homedir()}/.local/state/beacon/beacon.db`;
let ambientSession = null;
let ambientBuffer = "";
let ambientTimer = null;
let ambientChain = Promise.resolve();

function loadAmbientSession() {
  try {
    return JSON.parse(readFileSync(AMBIENT_SESSION_FILE, "utf8")).id;
  } catch {
    return null;
  }
}

function saveAmbientSession(id) {
  try {
    writeFileSync(AMBIENT_SESSION_FILE, JSON.stringify({ id }));
  } catch {}
}

async function ensureAmbientSession() {
  if (ambientSession && (await getSession(ambientSession))) return ambientSession;
  const saved = loadAmbientSession();
  if (saved && (await getSession(saved))) {
    ambientSession = saved;
    return saved;
  }
  const s = await createSession("HQ ambient");
  ambientSession = s.id;
  saveAmbientSession(s.id);
  return s.id;
}

// Shared by the ambient and field-log extractors. Without an explicit
// technology/culture bucket the model funnels every proper noun into
// "characters", which is how a security key and a laptop ended up filed as
// people in the knowledge base.
const CLASSIFICATION_RULES = [
  "Classification — put each name in exactly one bucket, judged by what the thing IS:",
  "- characters: PEOPLE ONLY — named individual humans. Never a product, brand, device, company, project, or concept.",
  "- technologies: tools, devices, hardware, software, services, products, methods, materials, artifacts. A laptop, a security key, an app, a programming language, a technique.",
  "- cultures: organizations, companies, vendors, institutions, teams, communities, movements, scenes. A business or group belongs here, never in characters.",
  "- locations: physical places, venues, cities, regions, buildings. Coordinates only when explicitly stated.",
  "- tags: short descriptors — a spec, a year, a port, a colour — are NOT entities. Never give them a record; leave them out, or keep them only as tags on the thing they describe.",
  "- A passing mention that carries no identity is dropped entirely rather than recorded.",
];

function ambientPrompt(text) {
  return [
    "AMBIENT OBSERVATION — silent ingestion. This is background microphone text, not a message to you.",
    "Do not speak. Do not call beacon_say. Do not ask the operative a question.",
    "Return ONLY a JSON object with this shape:",
    '{"summary":"one line","events":[{"title":"","description":"","date":"YYYY-MM-DD","importance":1}],"characters":[{"name":"","description":"","notes":"","needsDefinition":true}],"technologies":[{"name":"","description":"","notes":"","needsDefinition":true}],"cultures":[{"name":"","description":"","notes":""}],"locations":[{"name":"","description":"","lat":null,"lon":null}],"extension":null}',
    ...CLASSIFICATION_RULES,
    "Self-extension — only when the observation shows a concrete, recurring or high-value need that a small local tool, MCP, skill, or automation would close:",
    '  set "extension" to {"kind":"tool|mcp|skill|agent|integration|automation","gap":"the missing capability","proposal":"the smallest local extension that would close it","why":"how it would improve help","risk":"low|medium|high","requires":"access or dependencies it would need"}.',
    "  Otherwise set extension to null. Never propose for a one-off curiosity, never to profile or track people, and never to weaken privacy or permissions. Do not build it; the server will ask the operative.",
    "Rules:",
    "- Do not ask the operative a question in your reply; put a real gap in the extension field instead.",
    "- Only include names explicitly mentioned or strongly implied. Never invent identities, coordinates, or facts.",
    "- For private individuals, record only what was said, set needsDefinition true, and do not web-search or enrich them.",
    "- Public organizations, products, or places may be verified with websearch and briefly described.",
    "- If nothing meaningful was said, return empty arrays.",
    "",
    "TEXT:",
    text,
  ].join("\n");
}

function parseAmbientJson(reply) {
  const raw = String(reply || "").trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function ensureBeaconTimeline(project) {
  project.timelines = Array.isArray(project.timelines) ? project.timelines : [];
  let timeline = project.timelines.find(
    (row) => String(row?.name || "").trim().toLowerCase() === "beacon",
  );
  if (!timeline) {
    timeline = {
      id: randomUUID(),
      name: "Beacon",
      description: "Ambient field stream.",
      events: [],
      pointsOfDivergence: [],
      startDate: "",
      endDate: "",
      isMainTimeline: false,
      parentTimelineId: null,
      branchFromEventId: null,
      color: "#22c55e",
      tags: ["ambient", "beacon", "telemetry"],
    };
    project.timelines.push(timeline);
  }
  timeline.events = Array.isArray(timeline.events) ? timeline.events : [];
  return timeline;
}

// The extractor is not reliable about buckets: a product mentioned in a stream
// can still come back under "characters". Before writing a new record, check
// every bucket — an entity already known to the knowledge base keeps its
// existing home instead of being duplicated as a person.
const ENTITY_BUCKETS = ["characters", "technologies", "cultures", "locations"];

function findAcrossBuckets(project, name) {
  const needle = String(name || "").trim().toLowerCase();
  if (!needle) return null;
  for (const bucket of ENTITY_BUCKETS) {
    const list = Array.isArray(project[bucket]) ? project[bucket] : [];
    const row = list.find(
      (entry) => String(entry?.name || "").trim().toLowerCase() === needle,
    );
    if (row) return { bucket, row };
  }
  return null;
}

function mergeEntityDetail(row, item) {
  const description = String(item?.description || "").slice(0, 4000);
  if (description && description.length > String(row.description || "").length) {
    row.description = description;
  }
  const notes = String(item?.notes || "").slice(0, 4000);
  if (notes && !String(row.notes || "").includes(notes.slice(0, 200))) {
    row.notes = [row.notes, notes].filter(Boolean).join("\n");
  }
}


// SkeletonKey's Narrative Builder is a set of reports with ordered scenes.
// Every perceived event should land there too, not only on the timeline, so
// the story fills itself in as the day happens.
function ensureFieldNarrative(project, timeline) {
  const list = Array.isArray(project.reports)
    ? project.reports
    : Array.isArray(project.narratives)
      ? project.narratives
      : (project.reports = []);
  let report = list.find(
    (row) => row?.id === "field-narrative" || row?.title === "Field Narrative",
  );
  if (!report) {
    const stamp = new Date().toISOString();
    report = {
      id: "field-narrative",
      title: "Field Narrative",
      description: "What happened, written down as it was perceived.",
      scenes: [],
      nodes: [],
      edges: [],
      timelineId: timeline.id,
      characterIds: [],
      tags: ["hq", "fieldlog", "auto"],
      createdAt: stamp,
      updatedAt: stamp,
      reportType: "linear",
    };
    list.unshift(report);
  }
  report.scenes = Array.isArray(report.scenes) ? report.scenes : [];
  report.reportType = report.reportType || "linear";
  report.timelineId = report.timelineId || timeline.id;
  project.reports = list;
  project.narratives = list;
  return report;
}

function appendNarrativeScenes(project, timeline, rows, label = "Field log") {
  if (!rows.length) return 0;
  const report = ensureFieldNarrative(project, timeline);
  let added = 0;
  for (const row of rows) {
    const title = String(row.title || "").trim().slice(0, 200);
    const content = String(row.content || row.description || "").trim();
    if (!title && !content) continue;
    const key = row.eventId
      ? `event:${row.eventId}`
      : `note:${row.date || ""}:${(title || content).slice(0, 120)}`;
    if (
      report.scenes.some((scene) =>
        String(scene?.notes || "").includes(key),
      )
    ) {
      continue;
    }
    report.scenes.push({
      id: randomUUID(),
      title: title || "Field note",
      description: content.slice(0, 400),
      content,
      order: report.scenes.length + 1,
      characters: [],
      locations: [],
      eventIds: row.eventId ? [row.eventId] : [],
      notes: `Auto-filled from ${label} (${key}).`,
      technologies: [],
      cultures: [],
      sources: [],
    });
    added += 1;
  }
  if (added) report.updatedAt = new Date().toISOString();
  return added;
}

function applyAmbient(project, batch, data, label = "Ambient", tag = "ambient") {
  const timeline = ensureBeaconTimeline(project);
  // Local calendar day. toISOString() converts to UTC first, which files every
  // evening event (after 17:00 Pacific) under tomorrow's date.
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  project.sourceDocuments = Array.isArray(project.sourceDocuments)
    ? project.sourceDocuments
    : [];
  project.characters = Array.isArray(project.characters) ? project.characters : [];
  project.locations = Array.isArray(project.locations) ? project.locations : [];
  project.technologies = Array.isArray(project.technologies)
    ? project.technologies
    : [];
  project.cultures = Array.isArray(project.cultures) ? project.cultures : [];

  project.sourceDocuments.push({
    id: randomUUID(),
    title: `${label} · ${new Date().toLocaleTimeString()}`,
    description: String(data.summary || "").slice(0, 4000),
    authors: ["Beacon ambient stream"],
    publicationDate: date,
    type: "ambient",
    url: null,
    filePath: null,
    fileName: null,
    notes: String(batch || "").slice(0, 20000),
    tags: [tag, "stream", "fieldlog"],
    citations: {},
  });

  for (const item of Array.isArray(data.characters) ? data.characters : []) {
    const name = String(item?.name || "").trim().slice(0, 200);
    if (!name) continue;
    const known = findAcrossBuckets(project, name);
    if (known && known.bucket !== "characters") {
      // Already filed as a technology, culture, or place — enrich it there
      // rather than duplicating it as a person.
      mergeEntityDetail(known.row, item);
      known.row.tags = [...new Set([...(known.row.tags || []), tag])].slice(0, 50);
      continue;
    }
    let person = project.characters.find(
      (row) => String(row?.name || "").trim().toLowerCase() === name.toLowerCase(),
    );
    if (!person) {
      person = {
        id: randomUUID(),
        name,
        description: String(item.description || "").slice(0, 4000),
        birthDate: null,
        deathDate: null,
        timelineIds: [timeline.id],
        relatedCharacterIds: {},
        linkedEventIds: [],
        locations: [],
        traits: [],
        motivation: "",
        background: "",
        notes: String(item.notes || "").slice(0, 4000),
        isHistorical: false,
        imageUrl: null,
        tags: [tag],
      };
      project.characters.push(person);
    } else {
      if (item.description) person.description = String(item.description).slice(0, 4000);
      if (item.notes) {
        person.notes = [person.notes, String(item.notes).slice(0, 4000)]
          .filter(Boolean)
          .join("\n");
      }
      if (!person.timelineIds.includes(timeline.id)) person.timelineIds.push(timeline.id);
    }
    person.tags = [...new Set([...(person.tags || []), tag])].slice(0, 50);
    // A record the operative has personally confirmed stays confirmed; the
    // extractor routinely re-flags known entities as unknown.
    if (item.needsDefinition === true && !(person.tags || []).includes("confirmed")) {
      person.tags = [...new Set([...person.tags, "needs-definition"])].slice(0, 50);
      if (!String(person.notes || "").includes("Needs definition")) {
        person.notes = [person.notes, "Needs definition — ask the operative later."]
          .filter(Boolean)
          .join("\n");
      }
    }
  }

  for (const item of Array.isArray(data.technologies) ? data.technologies : []) {
    const name = String(item?.name || "").trim().slice(0, 200);
    if (!name) continue;
    const known = findAcrossBuckets(project, name);
    if (known && known.bucket !== "technologies") {
      mergeEntityDetail(known.row, item);
      known.row.tags = [...new Set([...(known.row.tags || []), tag])].slice(0, 50);
      continue;
    }
    const stamp = new Date().toISOString();
    let tech = project.technologies.find(
      (row) => String(row?.name || "").trim().toLowerCase() === name.toLowerCase(),
    );
    if (!tech) {
      tech = {
        id: randomUUID(),
        name,
        description: String(item.description || "").slice(0, 4000),
        discoveryDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || ""))
          ? String(item.date)
          : null,
        timelineIds: [timeline.id],
        prerequisiteTechIds: [],
        derivedTechIds: [],
        inventors: [],
        linkedEventIds: [],
        developmentLevel: 3,
        impact: 3,
        fields: [],
        notes: String(item.notes || "").slice(0, 4000),
        tags: [tag],
        createdAt: stamp,
        updatedAt: stamp,
      };
      project.technologies.push(tech);
    } else {
      if (item.description) tech.description = String(item.description).slice(0, 4000);
      if (item.notes) {
        tech.notes = [tech.notes, String(item.notes).slice(0, 4000)]
          .filter(Boolean)
          .join("\n");
      }
      if (!Array.isArray(tech.timelineIds)) tech.timelineIds = [];
      if (!tech.timelineIds.includes(timeline.id)) tech.timelineIds.push(timeline.id);
      tech.updatedAt = stamp;
    }
    tech.tags = [...new Set([...(tech.tags || []), tag])].slice(0, 50);
    if (item.needsDefinition === true) {
      tech.tags = [...new Set([...tech.tags, "needs-definition"])].slice(0, 50);
    }
  }

  for (const item of Array.isArray(data.cultures) ? data.cultures : []) {
    const name = String(item?.name || "").trim().slice(0, 200);
    if (!name) continue;
    const known = findAcrossBuckets(project, name);
    if (known && known.bucket !== "cultures") {
      mergeEntityDetail(known.row, item);
      known.row.tags = [...new Set([...(known.row.tags || []), tag])].slice(0, 50);
      continue;
    }
    const stamp = new Date().toISOString();
    let culture = project.cultures.find(
      (row) => String(row?.name || "").trim().toLowerCase() === name.toLowerCase(),
    );
    if (!culture) {
      culture = {
        id: randomUUID(),
        name,
        description: String(item.description || "").slice(0, 4000),
        foundedDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || ""))
          ? String(item.date)
          : null,
        endDate: null,
        timelineIds: [timeline.id],
        linkedLocationIds: [],
        linkedCharacterIds: [],
        linkedEventIds: [],
        values: [],
        practices: [],
        languages: [],
        beliefs: [],
        notes: String(item.notes || "").slice(0, 4000),
        imageUrl: null,
        tags: [tag],
        createdAt: stamp,
        updatedAt: stamp,
      };
      project.cultures.push(culture);
    } else {
      if (item.description) culture.description = String(item.description).slice(0, 4000);
      if (item.notes) {
        culture.notes = [culture.notes, String(item.notes).slice(0, 4000)]
          .filter(Boolean)
          .join("\n");
      }
      if (!Array.isArray(culture.timelineIds)) culture.timelineIds = [];
      if (!culture.timelineIds.includes(timeline.id)) culture.timelineIds.push(timeline.id);
      culture.updatedAt = stamp;
    }
    culture.tags = [...new Set([...(culture.tags || []), tag])].slice(0, 50);
    if (item.needsDefinition === true) {
      culture.tags = [...new Set([...culture.tags, "needs-definition"])].slice(0, 50);
    }
  }

  for (const item of Array.isArray(data.locations) ? data.locations : []) {
    const name = String(item?.name || "").trim().slice(0, 200);
    if (!name) continue;
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    let location = project.locations.find(
      (row) => String(row?.name || "").trim().toLowerCase() === name.toLowerCase(),
    );
    if (!location) {
      location = {
        id: randomUUID(),
        name,
        description: String(item.description || "").slice(0, 4000),
        coordinates:
          Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lng: lon } : null,
        timelineIds: [timeline.id],
        parentLocationId: null,
        linkedEventIds: [],
        foundedDate: null,
        destroyedDate: null,
        population: null,
        importance: 2,
        type: "other",
        notes: "",
        mapUrl: null,
        tags: [tag],
        mapData: { importance: "low", category: "other" },
      };
      project.locations.push(location);
    } else {
      if (item.description) location.description = String(item.description).slice(0, 4000);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        location.coordinates = { lat, lng: lon };
      }
      if (!location.timelineIds.includes(timeline.id)) location.timelineIds.push(timeline.id);
    }
    location.tags = [...new Set([...(location.tags || []), tag])].slice(0, 50);
  }

  for (const item of Array.isArray(data.technologies) ? data.technologies : []) {
    const name = String(item?.name || "").trim().slice(0, 200);
    if (!name) continue;
    let tech = project.technologies.find(
      (row) => String(row?.name || "").trim().toLowerCase() === name.toLowerCase(),
    );
    if (!tech) {
      tech = {
        id: randomUUID(),
        name,
        description: String(item.description || "").slice(0, 4000),
        discoveryDate: null,
        timelineIds: [timeline.id],
        prerequisiteTechIds: [],
        derivedTechIds: [],
        inventors: [],
        linkedEventIds: [],
        developmentLevel: 3,
        impact: 3,
        fields: [],
        notes: String(item.notes || "").slice(0, 4000),
        tags: [tag],
      };
      project.technologies.push(tech);
    } else {
      if (item.description) tech.description = String(item.description).slice(0, 4000);
      if (item.notes) {
        tech.notes = [tech.notes, String(item.notes).slice(0, 4000)]
          .filter(Boolean)
          .join("\n");
      }
      if (!tech.timelineIds.includes(timeline.id)) tech.timelineIds.push(timeline.id);
    }
    tech.tags = [...new Set([...(tech.tags || []), tag])].slice(0, 50);
  }

  const narrativeRows = [];
  for (const item of Array.isArray(data.events) ? data.events : []) {
    const title = String(item?.title || "").trim().slice(0, 200);
    if (!title) continue;
    const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || ""))
      ? String(item.date)
      : date;
    const duplicate = timeline.events.find(
      (row) => row.title === title && row.date === eventDate,
    );
    if (duplicate) continue;
    const event = {
      id: randomUUID(),
      title,
      description: String(item.description || "").slice(0, 8000),
      date: eventDate,
      endDate: null,
      timelineId: timeline.id,
      importance: Math.min(5, Math.max(1, Number(item.importance) || 2)),
      iconId: "default",
      causes: [],
      effects: [],
      linkedCharacterIds: [],
      linkedLocationIds: [],
      linkedTechnologyIds: [],
      linkedCultureIds: [],
      linkedSourceDocumentIds: [],
      linkedNarrativeIds: [],
      notes: "Source: ambient microphone stream.",
      tags: [tag, "stream", "fieldlog"],
      isPointOfDivergence: false,
    };
    timeline.events.push(event);
    narrativeRows.push({
      eventId: event.id,
      title,
      content: event.description || title,
      date: eventDate,
    });
  }

  // Field-log entries are already timeline events, so their extracted item
  // list is empty. Still write the entry itself into the narrative.
  const entryText = String(batch || "").trim();
  if (tag === "fieldlog" && entryText) {
    narrativeRows.push({
      title: entryText.split(/[.!?]\s/)[0].slice(0, 120) || "Field note",
      content: entryText,
      date,
    });
  }

  appendNarrativeScenes(project, timeline, narrativeRows, label);
  project.updatedAt = new Date().toISOString();
}

async function writeAmbientToSkeletonKey(batch, data, label = "Ambient", tag = "ambient") {
  const project = await fetch(`${SK_PROJECT_URL}/project`, {
    signal: AbortSignal.timeout(10000),
  }).then((r) => (r.ok ? r.json() : null));
  if (!project) return;
  applyAmbient(project, batch, data, label, tag);
  const res = await fetch(`${SK_PROJECT_URL}/project`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(project),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) console.log(`ambient: SkeletonKey write HTTP ${res.status}`);
}

async function processAmbient(batch) {
  try {
    const sid = await ensureAmbientSession();
    const seen = new Set();
    for (const m of await listMessages(sid)) {
      if (m.info.role === "assistant") seen.add(m.info.id);
    }
    await promptAsync(sid, ambientPrompt(batch), { agent: "hq" });
    const reply = await waitForReply(sid, seen, 240000);
    const data = parseAmbientJson(reply) || {
      summary: "",
      events: [],
      characters: [],
      technologies: [],
      cultures: [],
      locations: [],
    };
    await writeAmbientToSkeletonKey(batch, data);
    if (data.extension && typeof data.extension === "object") {
      const result = proposeExtension({ ...data.extension, source: batch });
      if (result.ok) {
        console.log(
          `ambient: extension proposed (${result.proposal.kind}, ${result.proposal.risk}): ${result.proposal.gap}`,
        );
      } else if (result.skipped) {
        console.log(`ambient: extension skipped (${result.skipped})`);
      } else if (result.error) {
        console.log(`ambient: extension ignored (${result.error})`);
      }
    }
    if (
      !data.summary &&
      !data.events?.length &&
      !data.characters?.length &&
      !data.technologies?.length &&
      !data.cultures?.length
    ) {
      console.log("ambient: processed with no extracted items");
    }
  } catch (e) {
    console.log("ambient: process failed:", String(e.message || e).slice(0, 120));
  }
}

// --- field log entries: silent character/place extraction -------------------
// The app already ingests the timeline event. This pass only enriches the KB:
// characters and places, with uncertain identities marked for a later check-in.

let entryCursor = null;
let entryScanning = false;
let entryChain = Promise.resolve();

function loadEntryCursor() {
  try {
    const value = JSON.parse(readFileSync(ENTRY_CURSOR_FILE, "utf8")).lastId;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  } catch {
    return null;
  }
}

function saveEntryCursor(lastId) {
  try {
    writeFileSync(ENTRY_CURSOR_FILE, JSON.stringify({ lastId }));
  } catch {}
}

function entryPrompt(text) {
  return [
    "FIELD LOG ENTRY — silent knowledge extraction. This entry is already recorded in the timeline; do not add another event.",
    "Do not speak. Do not call beacon_say. Do not ask the operative a question.",
    "Return ONLY a JSON object with this shape:",
    '{"summary":"one line","characters":[{"name":"","description":"","notes":"","needsDefinition":true}],"technologies":[{"name":"","description":"","notes":"","needsDefinition":true}],"cultures":[{"name":"","description":"","notes":""}],"locations":[{"name":"","description":"","lat":null,"lon":null}]}',
    ...CLASSIFICATION_RULES,
    "Rules:",
    "- Extract people, technologies, organizations, and places explicitly mentioned or strongly implied. Never invent identities, coordinates, or facts.",
    "- For a private individual, record only what the entry says, set needsDefinition true, and do not web-search or enrich them.",
    "- A public organization, product, or place may be verified with websearch and briefly described.",
    "- If nothing new is identifiable, return empty arrays.",
    "",
    "TEXT:",
    text,
  ].join("\n");
}

async function processFieldLogEntry(row) {
  try {
    const sid = await ensureAmbientSession();
    const seen = new Set();
    for (const m of await listMessages(sid)) {
      if (m.info.role === "assistant") seen.add(m.info.id);
    }
    await promptAsync(sid, entryPrompt(row.detail), { agent: "hq" });
    const reply = await waitForReply(sid, seen, 240000);
    const data = parseAmbientJson(reply) || {
      summary: "",
      characters: [],
      technologies: [],
      cultures: [],
      locations: [],
    };
    data.events = [];
    await writeAmbientToSkeletonKey(row.detail, data, "Field log", "fieldlog");
    saveEntryCursor(row.id);
  } catch (e) {
    console.log("fieldlog-extract: failed:", String(e.message || e).slice(0, 120));
  }
}

function scanFieldLogEntries() {
  if (entryScanning) return;
  entryScanning = true;
  try {
    if (entryCursor === null) entryCursor = loadEntryCursor();
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const since = entryCursor === null ? 0 : entryCursor;
    const db = new DatabaseSync(BEACON_DB);
    const rows = db
      .prepare(
        `SELECT id, ts, kind, detail FROM fl_events
         WHERE id > ? AND ts >= ? AND kind IN ('event','decision','place','hazard')
         ORDER BY id LIMIT 20`,
      )
      .all(since, cutoff);
    db.close();
    for (const row of rows) {
      entryChain = entryChain
        .then(() => processFieldLogEntry(row))
        .catch(() => {});
    }
    if (rows.length) entryCursor = rows[rows.length - 1].id;
    if (!rows.length && entryCursor === null) entryCursor = 0;
  } catch {
    // Field log is optional.
  } finally {
    entryScanning = false;
  }
}

setTimeout(scanFieldLogEntries, 5000).unref();
setInterval(scanFieldLogEntries, 120000).unref();

function queueAmbient(text) {
  const clean = String(text || "").trim().slice(0, 8000);
  if (!clean) return;
  try {
    fieldNote("ambient", clean);
  } catch {}
  ambientBuffer += (ambientBuffer ? "\n" : "") + clean;
  if (!ambientTimer) {
    ambientTimer = setTimeout(() => {
      const batch = ambientBuffer.trim();
      ambientBuffer = "";
      ambientTimer = null;
      if (!batch) return;
      ambientChain = ambientChain.then(() => processAmbient(batch)).catch(() => {});
    }, 30000);
  }
}

// --- accept a position from either transport --------------------------------

function acceptPosition(p) {
  if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) {
    throw new Error("lat and lon are required numbers");
  }
  const ts = addPosition(p);
  return ts;
}

// --- http -------------------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const latest = latestPosition();
    return json(res, 200, { ok: true, clients: clients.size, latest });
  }

  if (!authed(req)) return json(res, 401, { error: "unauthorized" });

  try {
    if (req.method === "POST" && url.pathname === "/beacon") {
      const raw = await readJson(req);
      const body = isEnvelope(raw) ? decrypt(raw) : HAS_KEY ? null : raw;
      if (!body) return json(res, 400, { error: "encrypted payload required" });
      const ts = acceptPosition(body);
      return json(res, 200, { ok: true, ts });
    }

    if (req.method === "GET" && url.pathname === "/whereami") {
      const limit = Number(url.searchParams.get("limit") || 50);
      const latest = latestPosition();
      if (!latest) return json(res, 200, { ok: true, latest: null, track: [] });
      return json(res, 200, { ok: true, latest, track: recentTrack(limit) });
    }

    if (req.method === "POST" && url.pathname === "/say") {
      const body = await readJson(req);
      const text = String(body.message || body.text || "").trim();
      if (!text) return json(res, 400, { error: "message required" });
      enqueueSay(text, body.kind || "say");
      const delivered = flushOutbox();
      return json(res, 200, { ok: true, delivered });
    }

    if (req.method === "POST" && url.pathname === "/ambient") {
      const rawAmbient = await readJson(req);
      const body = isEnvelope(rawAmbient) ? decrypt(rawAmbient) : HAS_KEY ? null : rawAmbient;
      if (!body) return json(res, 400, { error: "encrypted payload required" });
      const text = String(body.text || body.message || "").trim();
      if (!text) return json(res, 400, { error: "text required" });
      queueAmbient(text);
      return json(res, 202, { ok: true, queued: true });
    }

    if (req.method === "POST" && url.pathname === "/ask") {
      const rawAsk = await readJson(req);
      const body = isEnvelope(rawAsk) ? decrypt(rawAsk) : HAS_KEY ? null : rawAsk;
      if (!body) return json(res, 400, { error: "encrypted payload required" });
      const text = String(body.text || body.message || "").trim();
      if (!text) return json(res, 400, { error: "text required" });
      const run = askChain.then(() => handleAsk(text));
      askChain = run.catch(() => {});
      try {
        const reply = await run;
        return json(res, 200, { ok: true, reply });
      } catch (err) {
        return json(res, 502, { error: String(err.message || err) });
      }
    }

    return json(res, 404, { error: "not found" });
  } catch (err) {
    return json(res, 400, { error: String(err.message || err) });
  }
});

// --- websocket --------------------------------------------------------------

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const tok = url.searchParams.get("token") || "";
  if (url.pathname !== "/stream" || !tok || !safeEq(tok, TOKEN)) {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`beacon: phone connected (${clients.size} live)`);

  // Greet with current state so the fresh app can render immediately.
  send(ws, {
    type: "hello",
    latest: latestPosition(),
    track: recentTrack(50),
  });

  // Deliver anything queued while the phone was away.
  flushOutbox();

  ws.on("message", (data) => {
    try {
      const raw = JSON.parse(data.toString());
      const msg = isEnvelope(raw) ? decrypt(raw) : HAS_KEY ? null : raw;
      if (!msg) {
        send(ws, { type: "error", error: "encrypted payload required" });
        return;
      }
      if (msg.type === "pos" || msg.lat !== undefined) {
        acceptPosition(msg);
        send(ws, { type: "ack", ts: Date.now() });
      } else if (msg.type === "ambient" && (msg.text || msg.message)) {
        const text = String(msg.text || msg.message).trim();
        if (text) {
          queueAmbient(text);
          send(ws, { type: "ack", ts: Date.now() });
        }
      } else if (msg.type === "ask" && (msg.text || msg.message)) {
        const text = String(msg.text || msg.message).trim();
        if (text) {
          const run = askChain.then(() => handleAsk(text));
          askChain = run.catch(() => {});
          run.catch((e) => send(ws, { type: "error", error: String(e.message || e) }));
        }
      } else if (msg.type === "ping") {
        send(ws, { type: "pong", ts: Date.now() });
      }
    } catch (err) {
      send(ws, { type: "error", error: String(err.message || err) });
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`beacon: phone disconnected (${clients.size} live)`);
  });
  ws.on("error", () => clients.delete(ws));
});

server.listen(PORT, HOST, () => {
  console.log(`beacond: listening on http://${HOST}:${PORT}  (ws /stream)`);
});
