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
  for (const key of ["characters", "locations", "technologies", "cultures", "sourceDocuments", "narratives", "reports", "tasks", "caseDocuments", "assets", "financeSources", "links", "fieldNotes", "entityTypes", "entities"]) {
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

const BUILT_IN_KB_TYPE_IDS = new Set([
  "character",
  "location",
  "technology",
  "culture",
  "source",
  "tags",
]);

function kbTypeId(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function upsertEntityType(input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("entity type name is required");
  const id = String(input.id || kbTypeId(name)).trim();
  if (!id) throw new Error("entity type id is required");
  const existing = (project.entityTypes || []).find((row) => row.id === id);
  const type = {
    ...(existing || {}),
    id,
    name,
    namePlural:
      String(input.namePlural || "").trim() || existing?.namePlural || `${name}s`,
    description: input.description ?? existing?.description ?? "",
    icon: input.icon || existing?.icon || "FaBook",
    color: input.color || existing?.color || "#3B82F6",
    fields: Array.isArray(input.fields)
      ? input.fields
      : Array.isArray(existing?.fields)
        ? existing.fields
        : [],
    canHaveTimeline:
      input.canHaveTimeline ?? existing?.canHaveTimeline ?? false,
    canHaveLocation:
      input.canHaveLocation ?? existing?.canHaveLocation ?? false,
    canHaveNarratives:
      input.canHaveNarratives ?? existing?.canHaveNarratives ?? false,
  };
  project.entityTypes = [
    ...(project.entityTypes || []).filter((row) => row.id !== id),
    type,
  ];
  return type;
}

function upsertGenericEntity(input) {
  const entityType = String(input.entityType || "").trim();
  const name = String(input.name || "").trim();
  if (!entityType) throw new Error("entityType is required");
  if (!name) throw new Error("entity name is required");
  const existing = (project.entities || []).find(
    (row) =>
      row.entityType === entityType &&
      String(row.name || "").trim().toLowerCase() === name.toLowerCase(),
  );
  const stamp = now();
  const row = {
    ...(existing || {}),
    id: existing?.id || uid(),
    entityType,
    name: name.slice(0, 200),
    description: String(input.description ?? existing?.description ?? ""),
    tags: Array.isArray(input.tags)
      ? input.tags.slice(0, 50)
      : Array.isArray(existing?.tags)
        ? existing.tags
        : [],
    sourceDocumentIds: Array.isArray(existing?.sourceDocumentIds)
      ? existing.sourceDocumentIds
      : [],
    fields:
      input.fields && typeof input.fields === "object"
        ? { ...(existing?.fields || {}), ...input.fields }
        : existing?.fields || {},
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
  project.entities = [
    ...(project.entities || []).filter((item) => item.id !== row.id),
    row,
  ];
  return row;
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

function recordTaskCompletion(task) {
  const mainTimeline =
    (project.timelines || []).find((row) => row.isMainTimeline) ||
    (project.timelines || [])[0];
  if (!mainTimeline) return null;
  if (
    (mainTimeline.events || []).some(
      (event) =>
        Array.isArray(event.tags) && event.tags.includes(`task:${task.id}`),
    )
  ) {
    return null;
  }
  const event = {
    id: uid(),
    title: `Completed: ${String(task.title || "").slice(0, 190)}`,
    description: task.due
      ? `Task completed. Due ${task.due}${
          task.dueEnd && task.dueEnd !== task.due
            ? ` to ${task.dueEnd}`
            : ""
        }.`
      : "Task completed.",
    date: day(),
    endDate: null,
    timelineId: mainTimeline.id,
    importance: 2,
    iconId: "default",
    causes: [],
    effects: [],
    linkedCharacterIds: [],
    linkedLocationIds: [],
    linkedTechnologyIds: [],
    linkedCultureIds: [],
    linkedSourceDocumentIds: [],
    linkedNarrativeIds: [],
    notes: "Auto-recorded when the task was marked done.",
    tags: ["task", "completed", `task:${task.id}`],
    isPointOfDivergence: false,
  };
  mainTimeline.events = [...(mainTimeline.events || []), event];
  return event;
}

function upsertTask(input) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("task title is required");
  const list = Array.isArray(project.tasks) ? project.tasks : (project.tasks = []);
  const existing = input.id
    ? list.find((row) => row.id === input.id)
    : list.find(
        (row) =>
          String(row.title || "").trim().toLowerCase() === title.toLowerCase(),
      );
  const previousStatus = existing?.status;
  const stamp = now();
  const status = ["todo", "doing", "blocked", "done"].includes(input.status)
    ? input.status
    : existing?.status || "todo";
  const row = {
    ...(existing || {}),
    id: existing?.id || input.id || uid(),
    title: title.slice(0, 200),
    section: input.section || existing?.section || "General",
    status,
    due: input.due ?? existing?.due ?? "",
    dueEnd: input.dueEnd ?? existing?.dueEnd,
    notes: Array.isArray(input.notes)
      ? input.notes
      : Array.isArray(existing?.notes)
        ? existing.notes
        : [],
    documentIds: Array.isArray(input.documentIds)
      ? input.documentIds
      : Array.isArray(existing?.documentIds)
        ? existing.documentIds
        : [],
    linkedEntityIds: Array.isArray(input.linkedEntityIds)
      ? input.linkedEntityIds
      : Array.isArray(existing?.linkedEntityIds)
        ? existing.linkedEntityIds
        : [],
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
  if (existing) {
    const index = list.findIndex((item) => item.id === existing.id);
    list[index] = row;
  } else {
    list.push(row);
  }
  if (previousStatus !== "done" && row.status === "done") {
    recordTaskCompletion(row);
  }
  return row;
}

function upsertProfile(input) {
  const stamp = now();
  const current = project.profile || {};
  const row = {
    name: input.name ?? current.name ?? "",
    callsign: input.callsign ?? current.callsign ?? "",
    pronouns: input.pronouns ?? current.pronouns ?? "",
    timezone: input.timezone ?? current.timezone ?? "",
    homeBase: input.homeBase ?? current.homeBase ?? "",
    languages: input.languages ?? current.languages ?? "",
    communicationStyle:
      input.communicationStyle ?? current.communicationStyle ?? "",
    accessibilityNeeds:
      input.accessibilityNeeds ?? current.accessibilityNeeds ?? "",
    healthNotes: input.healthNotes ?? current.healthNotes ?? "",
    constraints: input.constraints ?? current.constraints ?? "",
    skills: input.skills ?? current.skills ?? "",
    resources: input.resources ?? current.resources ?? "",
    routines: input.routines ?? current.routines ?? "",
    currentObjectives:
      input.currentObjectives ?? current.currentObjectives ?? "",
    importantPeople: input.importantPeople ?? current.importantPeople ?? "",
    dislikes: input.dislikes ?? current.dislikes ?? "",
    notes: input.notes ?? current.notes ?? "",
    tags: Array.isArray(input.tags)
      ? input.tags.slice(0, 50)
      : Array.isArray(current.tags)
        ? current.tags
        : [],
    updatedAt: stamp,
  };
  project.profile = row;
  return row;
}

function upsertFinanceSource(input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("finance source name is required");
  const list = Array.isArray(project.financeSources)
    ? project.financeSources
    : (project.financeSources = []);
  const existing = input.id
    ? list.find((row) => row.id === input.id)
    : list.find(
        (row) =>
          String(row.name || "").trim().toLowerCase() === name.toLowerCase(),
      );
  const stamp = now();
  const row = {
    ...(existing || {}),
    id: existing?.id || input.id || uid(),
    name: name.slice(0, 200),
    kind: ["beancount", "stripe", "crypto", "bank", "manual", "other"].includes(
      input.kind,
    )
      ? input.kind
      : existing?.kind || "other",
    status: ["active", "paused", "error"].includes(input.status)
      ? input.status
      : existing?.status || "active",
    ledgerAccount: input.ledgerAccount ?? existing?.ledgerAccount ?? "",
    envVar: input.envVar ?? existing?.envVar ?? "",
    reference: input.reference ?? existing?.reference ?? "",
    chain: input.chain ?? existing?.chain ?? "",
    notes: input.notes ?? existing?.notes ?? "",
    tags: Array.isArray(input.tags)
      ? input.tags.slice(0, 50)
      : Array.isArray(existing?.tags)
        ? existing.tags
        : [],
    lastSync: input.lastSync ?? existing?.lastSync ?? "",
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
  if (existing) {
    const index = list.findIndex((item) => item.id === existing.id);
    list[index] = row;
  } else {
    list.push(row);
  }
  return row;
}

function upsertAsset(input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("asset name is required");
  const list = Array.isArray(project.assets) ? project.assets : (project.assets = []);
  const existing = input.id
    ? list.find((row) => row.id === input.id)
    : list.find(
        (row) =>
          String(row.name || "").trim().toLowerCase() === name.toLowerCase(),
      );
  const stamp = now();
  const row = {
    ...(existing || {}),
    id: existing?.id || input.id || uid(),
    name: name.slice(0, 200),
    category: input.category || existing?.category || "Other",
    quantity:
      input.quantity != null
        ? Math.max(0, Number(input.quantity) || 0)
        : existing?.quantity ?? 1,
    condition: input.condition ?? existing?.condition ?? "",
    status: ["owned", "loaned", "stored", "sold", "lost"].includes(input.status)
      ? input.status
      : existing?.status || "owned",
    location: input.location ?? existing?.location ?? "",
    serialNumber: input.serialNumber ?? existing?.serialNumber ?? "",
    value:
      input.value != null
        ? Number(input.value)
        : existing?.value ?? null,
    acquiredDate: input.acquiredDate ?? existing?.acquiredDate ?? "",
    notes: input.notes ?? existing?.notes ?? "",
    tags: Array.isArray(input.tags)
      ? input.tags.slice(0, 50)
      : Array.isArray(existing?.tags)
        ? existing.tags
        : [],
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
  if (existing) {
    const index = list.findIndex((item) => item.id === existing.id);
    list[index] = row;
  } else {
    list.push(row);
  }
  return row;
}

function upsertReport(input) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("report title is required");
  const list = Array.isArray(project.reports)
    ? project.reports
    : Array.isArray(project.narratives)
      ? project.narratives
      : (project.reports = []);
  const existing = input.id
    ? list.find((row) => row.id === input.id)
    : list.find(
        (row) =>
          String(row.title || "").trim().toLowerCase() === title.toLowerCase(),
      );
  const reportType = ["linear", "flow", "note"].includes(input.reportType)
    ? input.reportType
    : existing?.reportType || "linear";
  const timeline = timelineByName(input.timeline);
  const stamp = now();
  const row = {
    ...(existing || {}),
    id: existing?.id || input.id || uid(),
    title: title.slice(0, 200),
    description: input.description ?? existing?.description ?? "",
    reportType,
    content: input.content ?? existing?.content ?? "",
    scenes: Array.isArray(input.scenes)
      ? input.scenes
      : Array.isArray(existing?.scenes)
        ? existing.scenes
        : [],
    nodes: Array.isArray(input.nodes)
      ? input.nodes
      : Array.isArray(existing?.nodes)
        ? existing.nodes
        : [],
    edges: Array.isArray(input.edges)
      ? input.edges
      : Array.isArray(existing?.edges)
        ? existing.edges
        : [],
    timelineId: input.timeline ? timeline.id : existing?.timelineId || null,
    characterIds: Array.isArray(input.characterIds)
      ? input.characterIds
      : Array.isArray(existing?.characterIds)
        ? existing.characterIds
        : [],
    tags: Array.isArray(input.tags)
      ? input.tags.slice(0, 50)
      : Array.isArray(existing?.tags)
        ? existing.tags
        : [],
    createdAt: existing?.createdAt || stamp,
    updatedAt: stamp,
  };
  if (existing) {
    const index = list.findIndex((item) => item.id === existing.id);
    list[index] = row;
  } else {
    list.push(row);
  }
  project.reports = list;
  project.narratives = list;
  return row;
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
      assets: (project.assets || []).length,
      financeSources: (project.financeSources || []).length,
      reports: (project.reports || []).length,
    },
    hasProfile: Boolean(project.profile?.name || project.profile?.notes),
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
  "skeleton_kb_types",
  {
    title: "List knowledge base categories",
    description:
      "List the custom and renamed knowledge base categories stored in the project. Read-only.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            builtIn: [...BUILT_IN_KB_TYPE_IDS],
            categories: project.entityTypes || [],
          },
          null,
          2,
        ),
      },
    ],
  }),
);

server.registerTool(
  "skeleton_kb_type_upsert",
  {
    title: "Create or rename a knowledge base category",
    description:
      "Create a custom knowledge base category, or rename/re-icon an existing one by id (use the built-in ids character, location, technology, culture, source). Changes state; ask first.",
    inputSchema: {
      id: z.string().optional().describe("Category id; defaults to a slug of name"),
      name: z.string().describe("Singular name"),
      namePlural: z.string().optional().describe("Tab label"),
      description: z.string().optional(),
      icon: z.string().optional().describe("e.g. FaBook, FaUser, FaLightbulb"),
      color: z.string().optional(),
      fields: z.array(z.any()).optional(),
      canHaveTimeline: z.boolean().optional(),
      canHaveLocation: z.boolean().optional(),
      canHaveNarratives: z.boolean().optional(),
    },
  },
  async (input) => {
    const type = upsertEntityType(input);
    save();
    return { content: [{ type: "text", text: JSON.stringify(type, null, 2) }] };
  },
);

server.registerTool(
  "skeleton_kb_entity_upsert",
  {
    title: "Add or update an entity in a knowledge base category",
    description:
      "Create or update an entry in a custom or built-in knowledge base category. Upserts by entityType + name. Changes state; ask first.",
    inputSchema: {
      entityType: z.string().describe("Category id, e.g. client or character"),
      name: z.string(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
      fields: z.record(z.string(), z.any()).optional(),
    },
  },
  async (input) => {
    const entity = upsertGenericEntity(input);
    save();
    return { content: [{ type: "text", text: JSON.stringify(entity, null, 2) }] };
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
  "skeleton_report_upsert",
  {
    title: "Create or edit a story, flow chart, or note",
    description:
      "Create or update a Narrative Builder story, a Flows & Ideas flow chart, or a note. Use reportType flow for flow charts and note for notes. Changes state; ask first.",
    inputSchema: {
      id: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      reportType: z.enum(["linear", "flow", "note"]).optional(),
      content: z.string().optional().describe("Note body"),
      timeline: z.string().optional(),
      scenes: z.array(z.any()).optional(),
      nodes: z.array(z.any()).optional(),
      edges: z.array(z.any()).optional(),
      characterIds: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    },
  },
  async (input) => {
    const report = upsertReport(input);
    save();
    return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
  },
);

server.registerTool(
  "skeleton_profile_get",
  {
    title: "Read the operative's personnel file",
    description:
      "Read the operative's profile: how they want to be handled, constraints, needs, resources, objectives, and preferences. Read this before giving advice or making changes. Read-only.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: project.profile
          ? JSON.stringify(project.profile, null, 2)
          : "No personnel file recorded yet.",
      },
    ],
  }),
);

server.registerTool(
  "skeleton_profile_update",
  {
    title: "Update the operative's personnel file",
    description:
      "Update the operative's profile fields. Only send the fields that changed; the rest are preserved. Changes state; ask first.",
    inputSchema: {
      name: z.string().optional(),
      callsign: z.string().optional(),
      pronouns: z.string().optional(),
      timezone: z.string().optional(),
      homeBase: z.string().optional(),
      languages: z.string().optional(),
      communicationStyle: z.string().optional(),
      accessibilityNeeds: z.string().optional(),
      healthNotes: z.string().optional(),
      constraints: z.string().optional(),
      skills: z.string().optional(),
      resources: z.string().optional(),
      routines: z.string().optional(),
      currentObjectives: z.string().optional(),
      importantPeople: z.string().optional(),
      dislikes: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
  },
  async (input) => {
    const profile = upsertProfile(input);
    save();
    return { content: [{ type: "text", text: JSON.stringify(profile, null, 2) }] };
  },
);

server.registerTool(
  "skeleton_finance_info",
  {
    title: "Read the finance and Beancount setup",
    description:
      "Return the Beancount ledger path, Fava URL, finance sources, and the local beancount MCP instance details. Use this before answering money questions or adding finance sources. Read-only.",
    inputSchema: {},
  },
  async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            settings: project.financeSettings || {
              ledgerFile: process.env.BEANCOUNT_FILE || "~/beancount/main.beancount",
              favaUrl: "http://127.0.0.1:5000",
            },
            sources: project.financeSources || [],
            beancountMcp: {
              command: "mcp-beancount",
              env: {
                BEANCOUNT_FILE:
                  project.financeSettings?.ledgerFile ||
                  process.env.BEANCOUNT_FILE ||
                  "~/beancount/main.beancount",
              },
              favaCommand: "~/.local/bin/beancount-server",
            },
          },
          null,
          2,
        ),
      },
    ],
  }),
);

server.registerTool(
  "skeleton_finance_source_upsert",
  {
    title: "Add or update a finance source",
    description:
      "Configure a Beancount ledger, Stripe, crypto wallet, bank, or other money source. Never store API secrets; use an env var name. Changes state; ask first.",
    inputSchema: {
      id: z.string().optional(),
      name: z.string(),
      kind: z
        .enum(["beancount", "stripe", "crypto", "bank", "manual", "other"])
        .optional(),
      status: z.enum(["active", "paused", "error"]).optional(),
      ledgerAccount: z.string().optional(),
      envVar: z.string().optional(),
      reference: z.string().optional(),
      chain: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
  },
  async (input) => {
    const source = upsertFinanceSource(input);
    save();
    return { content: [{ type: "text", text: JSON.stringify(source, null, 2) }] };
  },
);

server.registerTool(
  "skeleton_asset_upsert",
  {
    title: "Add or update a personal asset",
    description:
      "Record something the operative owns or has at their disposal: tools, electronics, vehicles, documents, and so on. Upserts by name or id. Changes state; ask first.",
    inputSchema: {
      id: z.string().optional(),
      name: z.string(),
      category: z.string().optional(),
      quantity: z.number().optional(),
      condition: z.string().optional(),
      status: z.enum(["owned", "loaned", "stored", "sold", "lost"]).optional(),
      location: z.string().optional(),
      serialNumber: z.string().optional(),
      value: z.number().optional(),
      acquiredDate: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
  },
  async (input) => {
    const asset = upsertAsset(input);
    save();
    return { content: [{ type: "text", text: JSON.stringify(asset, null, 2) }] };
  },
);

server.registerTool(
  "skeleton_task_upsert",
  {
    title: "Create or edit a task",
    description:
      "Create or update a task, including multi-day due ranges and linked knowledge base records. A completion timeline event is written only when the task transitions to done. Changes state; ask first.",
    inputSchema: {
      id: z.string().optional(),
      title: z.string(),
      status: z.enum(["todo", "doing", "blocked", "done"]).optional(),
      section: z.string().optional(),
      due: z.string().optional().describe("YYYY-MM-DD"),
      dueEnd: z.string().optional().describe("Optional end date"),
      linkedEntityIds: z.array(z.string()).optional(),
      documentIds: z.array(z.string()).optional(),
      notes: z.array(z.any()).optional(),
    },
  },
  async (input) => {
    const task = upsertTask(input);
    save();
    return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
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

function favaBase() {
  return String(
    project.financeSettings?.favaUrl ||
      process.env.FAVA_URL ||
      "http://127.0.0.1:5001",
  ).replace(/\/$/, "");
}

async function favaRoot() {
  const base = favaBase();
  try {
    const response = await fetch(`${base}/`, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    const segment = new URL(response.url).pathname.split("/").filter(Boolean)[0];
    return segment ? `${base}/${segment}` : base;
  } catch {
    return base;
  }
}

async function favaApi(path) {
  const root = await favaRoot();
  const response = await fetch(`${root}/api/${path}`, {
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text.slice(0, 400) };
  }
  if (!response.ok) {
    throw new Error(data?.error || `Fava HTTP ${response.status}`);
  }
  return data;
}

function runProjectAction(action) {
  const kind = String(action?.kind || action?.action || "").trim();
  const args =
    action?.args && typeof action.args === "object" ? action.args : {};
  switch (kind) {
    case "task.upsert":
      return upsertTask(args);
    case "asset.upsert":
      return upsertAsset(args);
    case "finance.source.upsert":
      return upsertFinanceSource(args);
    case "profile.update":
      return upsertProfile(args);
    case "report.upsert":
      return upsertReport(args);
    case "kb.type.upsert":
      return upsertEntityType(args);
    case "kb.entity.upsert":
      return upsertGenericEntity(args);
    case "event.add":
      return addEvent(args);
    case "character.upsert":
      return upsertCharacter(args);
    case "location.upsert":
      return upsertLocation(args);
    default:
      throw new Error(`unknown project action: ${kind || "(empty)"}`);
  }
}

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
    if (req.method === "GET" && url.pathname === "/beancount/status") {
      const root = await favaRoot();
      return jsonResponse(res, 200, {
        ok: true,
        favaUrl: favaBase(),
        root,
        ledgerFile:
          project.financeSettings?.ledgerFile ||
          process.env.BEANCOUNT_FILE ||
          "~/Documents/SkeletonKey/finances/main.beancount",
      });
    }
    if (
      req.method === "GET" &&
      (url.pathname === "/beancount/balance_sheet" ||
        url.pathname === "/beancount/income_statement")
    ) {
      const report = url.pathname.endsWith("balance_sheet")
        ? "balance_sheet"
        : "income_statement";
      return jsonResponse(res, 200, await favaApi(report));
    }
    if (req.method === "GET" && url.pathname === "/beancount/query") {
      const query = url.searchParams.get("query_string") || "";
      return jsonResponse(
        res,
        200,
        await favaApi(`query?query_string=${encodeURIComponent(query)}`),
      );
    }
    if (req.method === "POST" && url.pathname === "/actions") {
      const body = JSON.parse(await readBody(req));
      const actions = Array.isArray(body?.actions)
        ? body.actions
        : body?.kind || body?.action
          ? [body]
          : [];
      if (!actions.length) {
        return jsonResponse(res, 400, { error: "No actions supplied." });
      }
      const results = [];
      for (const action of actions) {
        try {
          results.push({
            ok: true,
            kind: action.kind || action.action,
            result: runProjectAction(action),
          });
        } catch (error) {
          results.push({
            ok: false,
            kind: action.kind || action.action,
            error: String(error?.message || error),
          });
        }
      }
      save();
      return jsonResponse(res, 200, { ok: true, results });
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
