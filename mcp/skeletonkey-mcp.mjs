#!/usr/bin/env node
// SkeletonKey MCP — lets HQ populate a SkeletonKey project from telemetry and chat.
//
// Design:
//   - One JSON project on disk (SkeletonKey .ark-compatible) is the shared store.
//   - MCP tools write to it; an HTTP bridge on 127.0.0.1:8799 lets the app push/pull
//     the same project (Settings → HQ bridge, or Project menu).
//   - Nothing leaves the machine. No account, no cloud.
//
// Run standalone:  node mcp/skeletonkey-mcp.mjs
// opencode spawns it over stdio; stdout must carry MCP frames only.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const STATE_DIR = process.env.SK_STATE_DIR || join(homedir(), ".local", "state", "skeletonkey");
const PROJECT_FILE = process.env.SK_PROJECT_FILE || join(STATE_DIR, "project.json");
const PORT = Number(process.env.SK_MCP_PORT || 8799);
const HOST = process.env.SK_MCP_HOST || "127.0.0.1";
const HQ_BRIDGE = (process.env.SK_BRIDGE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const BEACON_TOKEN = process.env.BEACON_TOKEN || "";

mkdirSync(STATE_DIR, { recursive: true });

const uid = () => randomUUID();
const now = () => new Date().toISOString();
const day = (value = Date.now()) => new Date(value).toISOString().slice(0, 10);

function defaultMapData() {
  return {
    anchoredShapes: [],
    scenarios: [],
    defaultMapSettings: {
      baseMap: "standard",
      showBorders: true,
      showLabels: true,
      defaultZoom: 2,
      defaultCenter: { lat: 30, lng: 0 },
    },
  };
}

function defaultTimeline(name = "Life", isMain = true) {
  return {
    id: uid(),
    name,
    description: "",
    events: [],
    pointsOfDivergence: [],
    startDate: "",
    endDate: "",
    isMainTimeline: isMain,
    parentTimelineId: null,
    branchFromEventId: null,
    color: "#3b82f6",
    tags: ["hq", "telemetry"],
  };
}

function newProject(name = "HQ Field Record") {
  const stamp = now();
  return {
    id: uid(),
    name,
    description: "Built by HQ from local telemetry and conversation.",
    createdAt: stamp,
    updatedAt: stamp,
    version: "1.0",
    timelines: [defaultTimeline()],
    characters: [],
    locations: [],
    technologies: [],
    cultures: [],
    sourceDocuments: [],
    narratives: [],
    mapData: defaultMapData(),
  };
}

function ensureProjectShape(project) {
  const base = newProject(project?.name || "HQ Field Record");
  const out = { ...base, ...(project || {}) };
  out.timelines = Array.isArray(out.timelines) ? out.timelines : [];
  if (!out.timelines.length) out.timelines = [defaultTimeline()];
  for (const timeline of out.timelines) {
    timeline.events = Array.isArray(timeline.events) ? timeline.events : [];
    timeline.pointsOfDivergence = Array.isArray(timeline.pointsOfDivergence)
      ? timeline.pointsOfDivergence
      : [];
    timeline.parentTimelineId = timeline.parentTimelineId ?? null;
    timeline.branchFromEventId = timeline.branchFromEventId ?? null;
    timeline.tags = Array.isArray(timeline.tags) ? timeline.tags : [];
  }
  for (const key of ["characters", "locations", "technologies", "cultures", "sourceDocuments", "narratives", "reports", "tasks", "caseDocuments", "links", "fieldNotes"]) {
    out[key] = Array.isArray(out[key]) ? out[key] : [];
  }
  out.deletedIds = Array.isArray(out.deletedIds) ? out.deletedIds.map(String) : [];
  out.mapData = { ...defaultMapData(), ...(out.mapData || {}) };
  return out;
}

let project = existsSync(PROJECT_FILE)
  ? ensureProjectShape(JSON.parse(readFileSync(PROJECT_FILE, "utf8")))
  : newProject();

function save() {
  project.updatedAt = now();
  project = ensureProjectShape(project);
  mkdirSync(dirname(PROJECT_FILE), { recursive: true });
  const tmp = `${PROJECT_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(project, null, 2));
  renameSync(tmp, PROJECT_FILE);
}

function mainTimeline() {
  return project.timelines.find((timeline) => timeline.isMainTimeline) || project.timelines[0];
}

function timelineByName(name) {
  if (!name) return mainTimeline();
  const found = project.timelines.find(
    (timeline) => timeline.name.toLowerCase() === String(name).toLowerCase(),
  );
  if (found) return found;
  const timeline = defaultTimeline(String(name).slice(0, 200), false);
  project.timelines.push(timeline);
  return timeline;
}

function findLocation(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return (
    project.locations.find((location) => location.id === text) ||
    project.locations.find((location) => location.name.toLowerCase() === text.toLowerCase()) ||
    null
  );
}

function upsertLocation(input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("location name is required");
  const lat = Number(input.lat);
  const lon = Number(input.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("lat and lon are required for a location");
  }
  const timeline = timelineByName(input.timeline);
  let location = findLocation(input.id || name);
  const nearExisting = project.locations.find(
    (row) =>
      row.coordinates &&
      Math.abs(row.coordinates.lat - lat) < 0.0005 &&
      Math.abs(row.coordinates.lng - lon) < 0.0005,
  );
  if (!location) location = nearExisting || null;
  if (!location) {
    location = {
      id: uid(),
      name,
      description: input.description || "",
      coordinates: { lat, lng: lon },
      timelineIds: [timeline.id],
      parentLocationId: null,
      linkedEventIds: [],
      foundedDate: null,
      destroyedDate: null,
      population: null,
      importance: Number(input.importance) || 3,
      type: input.type || "other",
      notes: input.notes || "",
      mapUrl: null,
      tags: Array.isArray(input.tags) ? input.tags.slice(0, 50) : [],
      mapData: { importance: "medium", category: "other" },
    };
    project.locations.push(location);
  } else {
    location.name = location.name || name;
    location.coordinates = { lat, lng: lon };
    location.description = input.description || location.description;
    location.notes = input.notes || location.notes;
    location.type = input.type || location.type;
    if (!location.timelineIds.includes(timeline.id)) location.timelineIds.push(timeline.id);
    location.tags = [...new Set([...(location.tags || []), ...(input.tags || [])])].slice(0, 50);
  }
  return location;
}

function upsertCharacter(input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("character name is required");
  const timeline = timelineByName(input.timeline);
  let character = project.characters.find(
    (row) => row.name.toLowerCase() === name.toLowerCase(),
  );
  if (!character) {
    character = {
      id: uid(),
      name,
      description: input.description || "",
      birthDate: null,
      deathDate: null,
      timelineIds: [timeline.id],
      relatedCharacterIds: {},
      linkedEventIds: [],
      locations: [],
      traits: Array.isArray(input.traits) ? input.traits.slice(0, 50) : [],
      motivation: "",
      background: "",
      notes: input.notes || "",
      isHistorical: false,
      imageUrl: null,
      tags: Array.isArray(input.tags) ? input.tags.slice(0, 50) : [],
    };
    project.characters.push(character);
  } else {
    character.description = input.description || character.description;
    character.notes = input.notes || character.notes;
    if (!character.timelineIds.includes(timeline.id)) character.timelineIds.push(timeline.id);
    character.tags = [...new Set([...(character.tags || []), ...(input.tags || [])])].slice(0, 50);
  }
  return character;
}


function ensureNarrativeReport(timeline) {
  const list = Array.isArray(project.reports)
    ? project.reports
    : Array.isArray(project.narratives)
      ? project.narratives
      : (project.reports = []);
  let report = list.find(
    (row) => row?.id === "field-narrative" || row?.title === "Field Narrative",
  );
  if (!report) {
    const stamp = now();
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

function appendNarrativeScene(timeline, row, label = "HQ") {
  const report = ensureNarrativeReport(timeline);
  const key = row.eventId
    ? `event:${row.eventId}`
    : `note:${row.date || day()}:${String(row.title || row.content || "").slice(0, 120)}`;
  if (report.scenes.some((scene) => String(scene?.notes || "").includes(key))) {
    return report;
  }
  report.scenes.push({
    id: uid(),
    title: String(row.title || "Field note").slice(0, 200),
    description: String(row.content || "").slice(0, 400),
    content: String(row.content || ""),
    order: report.scenes.length + 1,
    characters: [],
    locations: [],
    eventIds: row.eventId ? [row.eventId] : [],
    notes: `Auto-filled from ${label} (${key}).`,
    technologies: [],
    cultures: [],
    sources: [],
  });
  report.updatedAt = now();
  return report;
}

function addEvent(input) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("event title is required");
  const timeline = timelineByName(input.timeline);
  const date = String(input.date || day());
  let location = input.location ? findLocation(input.location) : null;
  if (
    !location &&
    input.location &&
    Number.isFinite(Number(input.lat)) &&
    Number.isFinite(Number(input.lon))
  ) {
    location = upsertLocation({
      name: input.location,
      lat: Number(input.lat),
      lon: Number(input.lon),
      timeline: timeline.name,
      tags: ["hq", "telemetry"],
    });
  }
  const characters = (input.characters || []).map((name) =>
    upsertCharacter({ name, timeline: timeline.name, tags: ["hq"] }),
  );
  const duplicate = timeline.events.find(
    (event) => event.title === title && event.date === date && input.dedupe !== false,
  );
  const event = duplicate || {
    id: uid(),
    title,
    description: input.description || "",
    date,
    endDate: input.endDate || null,
    timelineId: timeline.id,
    importance: Math.min(5, Math.max(1, Number(input.importance) || 3)),
    iconId: "default",
    causes: [],
    effects: [],
    linkedCharacterIds: [],
    linkedLocationIds: [],
    linkedTechnologyIds: [],
    linkedCultureIds: [],
    linkedSourceDocumentIds: [],
    linkedNarrativeIds: [],
    notes: input.notes || "",
    tags: Array.isArray(input.tags) ? input.tags.slice(0, 50) : [],
  };
  event.description = input.description || event.description;
  event.notes = input.notes || event.notes;
  event.tags = [...new Set([...(event.tags || []), ...(input.tags || [])])].slice(0, 50);
  if (location) {
    event.linkedLocationIds = [...new Set([...(event.linkedLocationIds || []), location.id])];
    if (!location.linkedEventIds.includes(event.id)) location.linkedEventIds.push(event.id);
  }
  for (const character of characters) {
    event.linkedCharacterIds = [...new Set([...(event.linkedCharacterIds || []), character.id])];
    if (!character.linkedEventIds.includes(event.id)) character.linkedEventIds.push(event.id);
  }
  if (!duplicate) timeline.events.push(event);
  appendNarrativeScene(
    timeline,
    {
      eventId: event.id,
      title: event.title,
      content: event.description || event.title,
      date: event.date,
    },
    "timeline event",
  );
  return { event, timeline, location, characters };
}

function addSourceDocument(input) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("title is required");
  const doc = {
    id: uid(),
    title,
    description: String(input.description || "").slice(0, 4000),
    authors: Array.isArray(input.authors) ? input.authors : ["HQ"],
    publicationDate: input.date || day(),
    type: input.type || "note",
    url: null,
    filePath: null,
    fileName: null,
    notes: String(input.text || input.notes || "").slice(0, 20000),
    tags: Array.isArray(input.tags) ? input.tags.slice(0, 50) : [],
    citations: {},
  };
  project.sourceDocuments.push(doc);
  return doc;
}

async function bridgeJson(path, options = {}) {
  const response = await fetch(`${HQ_BRIDGE}${path}`, {
    ...options,
    headers: { Accept: "application/json", ...(options.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text.slice(0, 300) };
  }
  if (!response.ok) throw new Error(data.error || `bridge HTTP ${response.status}`);
  return data;
}

async function ingestBeacon(input = {}) {
  const token = input.token || BEACON_TOKEN;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const snapshot = await bridgeJson(
    token ? `/beacon/whereami?limit=${Math.min(500, Math.max(1, input.track || 60))}` : "/beacon/health",
    { headers },
  );
  const latest = snapshot.latest || snapshot.position || null;
  if (!latest) return { ok: false, message: "No beacon position available." };
  let label = "";
  try {
    const reverse = await bridgeJson(`/reverse?lat=${latest.lat}&lon=${latest.lon}&radius=800`);
    label = reverse.places?.[0]?.name || "";
  } catch {
    label = "";
  }
  const coord = `${latest.lat.toFixed(5)},${latest.lon.toFixed(5)}`;
  const name = input.name || (label ? `HQ · ${label}` : `HQ · ${coord}`);
  const beaconTimeline = input.timeline || "Beacon";
  const location = upsertLocation({
    name,
    lat: latest.lat,
    lon: latest.lon,
    type: input.type || "beacon",
    description: input.description || `Phone beacon${label ? ` near ${label}` : ""}.`,
    timeline: beaconTimeline,
    tags: ["hq", "beacon", "telemetry"],
  });
  const track = Array.isArray(snapshot.track) ? snapshot.track : [];
  const parts = [
    `Position ${coord}${label ? ` near ${label}` : ""}.`,
    latest.accuracy != null ? `Accuracy ±${Math.round(latest.accuracy)} m.` : "",
    latest.speed != null ? `Speed ${Number(latest.speed).toFixed(2)} m/s.` : "",
    latest.heading != null ? `Heading ${Math.round(latest.heading)}°.` : "",
    latest.altitude != null ? `Altitude ${Math.round(latest.altitude)} m.` : "",
    latest.battery != null ? `Battery ${Math.round(latest.battery)}%.` : "",
    track.length ? `${track.length} recent track samples.` : "",
  ].filter(Boolean);
  const event = addEvent({
    title: `Beacon · ${label || coord}`,
    date: day(latest.ts || Date.now()),
    description: parts.join(" "),
    timeline: beaconTimeline,
    importance: input.importance || 2,
    tags: ["hq", "beacon", "telemetry", "auto"],
    notes: input.notes || "Source: local phone beacon. HQ auto-ingest.",
    dedupe: true,
  });
  event.location = location;
  return {
    ok: true,
    position: latest,
    location: { id: location.id, name: location.name },
    event: { id: event.event.id, title: event.event.title, date: event.event.date },
    track: track.length,
  };
}

function status() {
  const timeline = mainTimeline();
  return {
    ok: true,
    project: { id: project.id, name: project.name, updatedAt: project.updatedAt },
    counts: {
      timelines: project.timelines.length,
      events: project.timelines.reduce((sum, row) => sum + row.events.length, 0),
      locations: project.locations.length,
      characters: project.characters.length,
      sourceDocuments: project.sourceDocuments.length,
      narratives: project.narratives.length,
    },
    storage: { projectFile: PROJECT_FILE, bridge: HQ_BRIDGE, http: `http://${HOST}:${PORT}` },
    beaconTokenConfigured: Boolean(BEACON_TOKEN),
  };
}

export function snapshotProject() {
  return project;
}

const server = new McpServer({ name: "skeletonkey", version: "0.1.0" });

server.registerTool(
  "skeleton_status",
  {
    title: "SkeletonKey project status",
    description:
      "Counts, storage paths, and HQ bridge status for the local SkeletonKey project. Read this before writing, so HQ knows what already exists.",
    inputSchema: {},
  },
  async () => ({ content: [{ type: "text", text: JSON.stringify(status(), null, 2) }] }),
);

server.registerTool(
  "skeleton_init",
  {
    title: "Initialize the HQ SkeletonKey project",
    description:
      "Create a local SkeletonKey project (or reset it) with one main timeline. Changes the shared project file; ask the operative first.",
    inputSchema: {
      name: z.string().optional().describe("Project name (default: HQ Field Record)"),
      reset: z.boolean().optional().describe("Replace the existing project"),
      description: z.string().optional(),
    },
  },
  async ({ name, reset, description }) => {
    if (reset || !existsSync(PROJECT_FILE)) {
      project = newProject(name || project.name || "HQ Field Record");
      if (description) project.description = description;
      save();
    } else if (name) {
      project.name = name;
      if (description) project.description = description;
      save();
    }
    return { content: [{ type: "text", text: JSON.stringify(status(), null, 2) }] };
  },
);

server.registerTool(
  "skeleton_location_upsert",
  {
    title: "Add or update a location",
    description:
      "Add a place to the SkeletonKey map. Upserts by name or coordinates. Use real gazetteer/beacon coordinates only. Changes state; ask first.",
    inputSchema: {
      name: z.string().describe("Place name"),
      lat: z.number(),
      lon: z.number(),
      type: z.string().optional().describe("home, work, service, beacon, other"),
      description: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      timeline: z.string().optional(),
      importance: z.number().optional(),
    },
  },
  async (input) => {
    const location = upsertLocation(input);
    save();
    return { content: [{ type: "text", text: JSON.stringify(location, null, 2) }] };
  },
);

server.registerTool(
  "skeleton_event_add",
  {
    title: "Add a timeline event",
    description:
      "Add a dated event to the SkeletonKey timeline, optionally linked to a location and people. Deduplicates by title+date. Changes state; ask first.",
    inputSchema: {
      title: z.string(),
      date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
      description: z.string().optional(),
      timeline: z.string().optional(),
      importance: z.number().optional(),
      location: z.string().optional().describe("Location id or name"),
      lat: z.number().optional(),
      lon: z.number().optional(),
      characters: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
      dedupe: z.boolean().optional(),
    },
  },
  async (input) => {
    const result = addEvent(input);
    save();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { event: result.event, timeline: result.timeline.name, location: result.location?.name },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "skeleton_narrative_add",
  {
    title: "Add a scene to the Field Narrative",
    description:
      "Append something that happened to SkeletonKey's Narrative Builder. Use this as the AI perceives a real moment (a walk, a conversation, a place, a decision), not for invented prose. Deduplicates by event id or title+date. Changes state; ask first.",
    inputSchema: {
      title: z.string(),
      text: z.string().describe("What happened, in plain language"),
      date: z.string().optional().describe("YYYY-MM-DD; defaults to today"),
      timeline: z.string().optional(),
      eventId: z.string().optional().describe("Link an existing event"),
      tags: z.array(z.string()).optional(),
    },
  },
  async ({ title, text, date, timeline, eventId, tags }) => {
    const timelineRow = timelineByName(timeline);
    const report = appendNarrativeScene(
      timelineRow,
      {
        eventId,
        title,
        content: String(text || "").slice(0, 20000),
        date: date || day(),
      },
      "MCP",
    );
    if (tags?.length) {
      report.tags = [...new Set([...(report.tags || []), ...tags])].slice(0, 50);
    }
    save();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              report: report.title,
              scenes: report.scenes.length,
              last: report.scenes[report.scenes.length - 1],
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  "skeleton_character_upsert",
  {
    title: "Add or update a person/organization",
    description:
      "Add a person or organization to the SkeletonKey knowledge base. No dossiers on private individuals beyond what the operative provides. Changes state; ask first.",
    inputSchema: {
      name: z.string(),
      description: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      traits: z.array(z.string()).optional(),
      timeline: z.string().optional(),
    },
  },
  async (input) => {
    const character = upsertCharacter(input);
    save();
    return { content: [{ type: "text", text: JSON.stringify(character, null, 2) }] };
  },
);

server.registerTool(
  "skeleton_note_add",
  {
    title: "Add a note or chat capture",
    description:
      "Store a note, decision, or chat excerpt as a SkeletonKey source document with provenance. Use for material the operative wants kept, not for every message. Changes state; ask first.",
    inputSchema: {
      title: z.string(),
      text: z.string(),
      description: z.string().optional(),
      date: z.string().optional(),
      source: z.string().optional().describe("chat, hq, field-log, manual"),
      tags: z.array(z.string()).optional(),
    },
  },
  async (input) => {
    const doc = addSourceDocument({
      ...input,
      type: input.source || "note",
      tags: [...(input.tags || []), input.source || "hq"],
    });
    save();
    return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
  },
);

server.registerTool(
  "skeleton_ingest_beacon",
  {
    title: "Ingest the phone beacon into SkeletonKey",
    description:
      "Read the latest beacon position (and optional track), reverse-geocode it locally, upsert a location, and add/update a dated timeline event. Real data only; never invent coordinates. Changes state; ask first.",
    inputSchema: {
      token: z.string().optional().describe("Beacon token; falls back to BEACON_TOKEN env"),
      track: z.number().optional().describe("Recent track samples to summarize (default 60)"),
      timeline: z.string().optional(),
      name: z.string().optional().describe("Optional fixed location name"),
      importance: z.number().optional(),
      notes: z.string().optional(),
    },
  },
  async (input) => {
    const result = await ingestBeacon(input);
    if (result.ok) save();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  "skeleton_capture_chat",
  {
    title: "Capture a conversation excerpt",
    description:
      "Save a chat turn or summary into the SkeletonKey record with role/source tags. Preserves provenance; does not treat chat as verified fact. Changes state; ask first.",
    inputSchema: {
      text: z.string(),
      role: z.string().optional().describe("user or assistant"),
      summary: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
  },
  async ({ text, role, summary, tags }) => {
    const doc = addSourceDocument({
      title: `HQ chat · ${day()}`,
      description: summary || text.slice(0, 200),
      text,
      type: "chat",
      authors: [role === "user" ? "Operative" : "HQ"],
      tags: ["chat", role || "hq", ...(tags || [])],
    });
    save();
    return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
  },
);

server.registerTool(
  "skeleton_export",
  {
    title: "Export the SkeletonKey project",
    description:
      "Write the shared project as a SkeletonKey .ark JSON file (default under the state directory). Read-only on the project.",
    inputSchema: {
      path: z.string().optional().describe("Destination path; ~ is expanded"),
    },
  },
  async ({ path }) => {
    const dest = path
      ? resolve(String(path).replace(/^~(?=$|\/)/, homedir()))
      : join(STATE_DIR, "SkeletonKey-HQ.ark.json");
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, JSON.stringify(project, null, 2));
    return { content: [{ type: "text", text: `Exported to ${dest}` }] };
  },
);

server.registerTool(
  "skeleton_get_project",
  {
    title: "Read the shared project",
    description: "Return the current SkeletonKey project JSON (read-only).",
    inputSchema: {},
  },
  async () => ({ content: [{ type: "text", text: JSON.stringify(project, null, 2) }] }),
);

// --- HTTP bridge for the app -------------------------------------------------
function jsonResponse(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20_000_000) throw new Error("body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const http = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    res.end();
    return;
  }
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return jsonResponse(res, 200, status());
    }
    if (req.method === "GET" && url.pathname === "/project") {
      return jsonResponse(res, 200, project);
    }
    if (req.method === "POST" && url.pathname === "/project") {
      const incoming = JSON.parse(await readBody(req));
      if (!incoming || typeof incoming !== "object" || !incoming.name || !Array.isArray(incoming.timelines)) {
        return jsonResponse(res, 400, { error: "Not a SkeletonKey project." });
      }
      project = ensureProjectShape(incoming);
      save();
      return jsonResponse(res, 200, status());
    }
    return jsonResponse(res, 404, { error: "unknown endpoint" });
  } catch (error) {
    return jsonResponse(res, 400, { error: String(error?.message || error) });
  }
});

http.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(
      `skeletonkey-mcp: port ${HOST}:${PORT} already served by another instance; ` +
        "stdio tools stay available",
    );
    return;
  }
  console.error(`skeletonkey-mcp: http bridge error: ${error?.message || error}`);
});

http.listen(PORT, HOST, () => {
  console.error(`skeletonkey-mcp: http://${HOST}:${PORT}`);
  console.error(`skeletonkey-mcp: project ${PROJECT_FILE}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
