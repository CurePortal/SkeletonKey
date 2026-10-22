import type { EventType, ProjectType } from "../types";
import type { FieldLogEvent } from "./fieldLogService";
import { createProject, loadProject } from "./projectService";
import {
  loadProjectFromFileSystem,
  saveProjectToFileSystem,
} from "./projectFileSystem";
import { compressedStorage } from "./compressedStorageService";
import { isTauriEnvironmentAsync } from "../utils/tauriDetection";

const MAIN_PROJECT_PATH_KEY = "sk-main-project-path";
const MAIN_PROJECT_STORAGE_KEY = "skeletonkey_project_main";
const MAIN_PROJECT_ID = "main";
const MAIN_PROJECT_NAME = "Main";

export interface LoadedMainProject {
  project: ProjectType;
  path: string | null;
  isFile: boolean;
}

async function ensureParentDir(filePath: string): Promise<void> {
  const index = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (index <= 0) return;
  try {
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    await mkdir(filePath.slice(0, index), { recursive: true });
  } catch {
    // The directory may already exist or the platform may handle it.
  }
}

export function setMainProjectFilePath(path: string): void {
  try {
    localStorage.setItem(MAIN_PROJECT_PATH_KEY, path);
  } catch {
    // Ignore storage failures.
  }
}

export async function getMainProjectPath(): Promise<string | null> {
  if (!(await isTauriEnvironmentAsync())) return null;
  try {
    const stored = localStorage.getItem(MAIN_PROJECT_PATH_KEY);
    if (stored) return stored;
    const internals = (window as any).__TAURI_INTERNALS__;
    if (!internals?.invoke) return null;
    const dir = (await internals.invoke("document_dir", {})) as string;
    return `${dir.replace(/[\\/]+$/, "")}/SkeletonKey/main.ark`;
  } catch {
    return null;
  }
}

async function loadOrCreateFileProject(path: string): Promise<LoadedMainProject> {
  const { exists } = await import("@tauri-apps/plugin-fs");
  if (await exists(path)) {
    const loaded = (await loadProjectFromFileSystem(path)) as ProjectType;
    const project = applyDeletionTombstones(pruneTimelineNoise(loaded));
    return { project, path, isFile: true };
  }

  const created = await createProject({
    name: MAIN_PROJECT_NAME,
    description: "",
  });
  if (!created.success || !created.data) {
    throw new Error(created.error || "Could not create the main project.");
  }
  await ensureParentDir(path);
  await saveProjectToFileSystem(created.data, path);
  return { project: created.data, path, isFile: true };
}

/**
 * The app runs against exactly one main project. In the desktop app it lives at
 * Documents/SkeletonKey/main.ark unless the user has chosen another file. The
 * browser build keeps the same single project in one stable localStorage slot.
 */
export async function loadMainProject(): Promise<LoadedMainProject> {
  if (await isTauriEnvironmentAsync()) {
    const path = await getMainProjectPath();
    if (!path) throw new Error("Could not resolve the main project path.");
    return loadOrCreateFileProject(path);
  }

  const stored = compressedStorage.getItem(
    MAIN_PROJECT_STORAGE_KEY,
  ) as ProjectType | null;
  if (stored?.id && Array.isArray(stored.timelines)) {
    const project = applyDeletionTombstones(pruneTimelineNoise(stored));
    return { project, path: null, isFile: false };
  }

  const created = await createProject({
    name: MAIN_PROJECT_NAME,
    description: "",
  });
  if (!created.success || !created.data) {
    throw new Error(created.error || "Could not create the main project.");
  }
  const project = { ...created.data, id: MAIN_PROJECT_ID };
  await compressedStorage.setItemImmediate(MAIN_PROJECT_STORAGE_KEY, project);
  return { project, path: null, isFile: false };
}

export async function createMainProject(
  name: string,
  description: string,
  thumbnailUrl?: string,
): Promise<void> {
  const created = await createProject({ name, description });
  if (!created.success || !created.data) {
    throw new Error(created.error || "Could not create the project.");
  }
  const project: ProjectType = {
    ...created.data,
    thumbnailUrl,
    updatedAt: new Date().toISOString(),
  };

  if (await isTauriEnvironmentAsync()) {
    const path = await getMainProjectPath();
    if (!path) throw new Error("Could not resolve the main project path.");
    await ensureParentDir(path);
    await saveProjectToFileSystem(project, path);
    localStorage.setItem(MAIN_PROJECT_PATH_KEY, path);
  } else {
    project.id = MAIN_PROJECT_ID;
    await compressedStorage.setItemImmediate(MAIN_PROJECT_STORAGE_KEY, project);
  }

  window.location.reload();
}

function pickBrowserProjectFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".ark,.ahp,.json,application/json";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

/**
 * Opening another project replaces the main project and reloads the app. There
 * is no project gallery: one record is active at a time.
 */
export async function openAnotherProject(): Promise<void> {
  if (await isTauriEnvironmentAsync()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      title: "Open main project",
      filters: [{ name: "ARK Project", extensions: ["ark", "ahp", "json"] }],
      multiple: false,
    });
    if (typeof selected !== "string") return;

    const result = await loadProject(selected);
    if (!result.success) {
      throw new Error(result.error || "That is not a valid SkeletonKey project.");
    }
    localStorage.setItem(MAIN_PROJECT_PATH_KEY, selected);
    window.location.reload();
    return;
  }

  const file = await pickBrowserProjectFile();
  if (!file) return;
  const text = await file.text();
  const project = JSON.parse(text) as ProjectType;
  if (!project?.id || !Array.isArray(project.timelines)) {
    throw new Error("That is not a SkeletonKey project.");
  }
  project.id = MAIN_PROJECT_ID;
  project.updatedAt = new Date().toISOString();
  await compressedStorage.setItemImmediate(MAIN_PROJECT_STORAGE_KEY, project);
  window.location.reload();
}

export function mergeFieldLogEvents(
  project: ProjectType,
  events: FieldLogEvent[],
): { project: ProjectType; added: number } {
  if (!events.length) return { project, added: 0 };
  const next = structuredClone(project);
  let beacon = (next.timelines || []).find(
    (timeline) => timeline.name.trim().toLowerCase() === "beacon",
  );
  if (!beacon) {
    beacon = {
      id: "fieldlog-beacon",
      name: "Beacon",
      description: "Field log events imported from the phone beacon.",
      events: [],
      pointsOfDivergence: [],
      startDate: "",
      endDate: "",
      isMainTimeline: false,
      parentTimelineId: null,
      branchFromEventId: null,
      color: "#22c55e",
      tags: ["fieldlog", "beacon", "telemetry"],
    };
    next.timelines = [...(next.timelines || []), beacon];
  }

  const seen = new Set<string>();
  for (const timeline of next.timelines || []) {
    for (const event of timeline.events || []) {
      for (const tag of event.tags || []) {
        if (tag.startsWith("fieldlog:")) seen.add(tag);
      }
    }
  }

  let added = 0;
  for (const row of events) {
    const tag = `fieldlog:${row.id}`;
    if (seen.has(tag)) continue;
    const detail = String(row.detail || "").trim();
    const firstLine =
      detail.split(/[.!?]\s/)[0]?.replace(/\s+/g, " ").trim() ||
      row.kind ||
      `Field log ${row.id}`;
    const date = new Date(row.ts).toLocaleDateString("en-CA");
    const event: EventType = {
      id: `fieldlog-${row.id}`,
      title: firstLine.slice(0, 90),
      description: detail,
      date,
      endDate: null,
      timelineId: beacon.id,
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
      notes: `Source: beacon field log event ${row.id}.`,
      tags: ["fieldlog", "beacon", row.kind, tag],
      isPointOfDivergence: false,
    };
    beacon.events.push(event);
    seen.add(tag);
    added += 1;
  }

  if (added) next.updatedAt = new Date().toISOString();
  return { project: next, added };
}

export async function saveMainProject(
  project: ProjectType,
  filePath?: string | null,
): Promise<void> {
  if (await isTauriEnvironmentAsync()) {
    const path = filePath || (await getMainProjectPath());
    if (!path) throw new Error("Could not resolve the main project path.");
    await ensureParentDir(path);
    await saveProjectToFileSystem(project, path);
    return;
  }
  await compressedStorage.setItemImmediate(MAIN_PROJECT_STORAGE_KEY, {
    ...project,
    id: MAIN_PROJECT_ID,
  });
}

type LooseProject = ProjectType & Record<string, any>;

function normalizedProject(project: LooseProject): LooseProject {
  return {
    ...project,
    timelines: Array.isArray(project.timelines) ? project.timelines : [],
    characters: Array.isArray(project.characters) ? project.characters : [],
    locations: Array.isArray(project.locations) ? project.locations : [],
    technologies: Array.isArray(project.technologies) ? project.technologies : [],
    cultures: Array.isArray(project.cultures) ? project.cultures : [],
    sources: Array.isArray(project.sources)
      ? project.sources
      : Array.isArray(project.sourceDocuments)
        ? project.sourceDocuments
        : [],
    reports: Array.isArray(project.reports)
      ? project.reports
      : Array.isArray(project.narratives)
        ? project.narratives
        : [],
    tasks: Array.isArray(project.tasks) ? project.tasks : [],
    caseDocuments: Array.isArray(project.caseDocuments) ? project.caseDocuments : [],
    assets: Array.isArray((project as any).assets) ? (project as any).assets : [],
    financeSources: Array.isArray((project as any).financeSources)
      ? (project as any).financeSources
      : [],
    financeSettings: (project as any).financeSettings || null,
    profile: (project as any).profile || null,
    links: Array.isArray(project.links) ? project.links : [],
    fieldNotes: Array.isArray(project.fieldNotes) ? project.fieldNotes : [],
    entityTypes: Array.isArray((project as any).entityTypes)
      ? (project as any).entityTypes
      : [],
    entities: Array.isArray((project as any).entities)
      ? (project as any).entities
      : [],
    deletedIds: Array.isArray(project.deletedIds) ? project.deletedIds : [],
  };
}

function isDocumentTimelineEvent(event: any): boolean {
  const title = String(event?.title || "");
  const tags = Array.isArray(event?.tags) ? event.tags : [];
  return (
    title.startsWith("Document — ") &&
    (tags.includes("case-worker") || tags.includes("document"))
  );
}

/** Drop imported document rows that were mirrored into a timeline. */
export function pruneTimelineNoise(project: ProjectType): ProjectType {
  const next = normalizedProject(project as LooseProject);
  next.timelines = (next.timelines || []).map((timeline: any) => {
    const events = Array.isArray(timeline.events) ? timeline.events : [];
    const kept = events.filter((event: any) => !isDocumentTimelineEvent(event));
    return kept.length === events.length ? timeline : { ...timeline, events: kept };
  });
  return next as ProjectType;
}

function collectProjectIds(project: LooseProject): Set<string> {
  const ids = new Set<string>();
  const add = (rows: any[] | undefined) => {
    for (const row of rows || []) {
      if (row?.id) ids.add(String(row.id));
    }
  };
  add(project.timelines);
  for (const timeline of project.timelines || []) add(timeline.events);
  for (const timeline of project.timelines || []) add(timeline.pointsOfDivergence);
  add(project.characters);
  add(project.locations);
  add(project.technologies);
  add(project.cultures);
  add(project.sources);
  add(project.reports);
  add((project as any).assets);
  add((project as any).financeSources);
  add((project as any).entities);
  for (const report of project.reports || []) add(report.scenes);
  add(project.tasks);
  add(project.caseDocuments);
  add(project.links);
  add(project.fieldNotes);
  add(project.mapData?.anchoredShapes);
  add(project.mapData?.scenarios);
  return ids;
}

/** Add tombstones for anything that disappeared since the previous snapshot. */
export function withDeletionTombstones(
  previous: ProjectType,
  next: ProjectType,
): ProjectType {
  const before = collectProjectIds(normalizedProject(previous as LooseProject));
  const after = collectProjectIds(normalizedProject(next as LooseProject));
  const deleted = new Set<string>(
    (previous as LooseProject).deletedIds || [],
  );
  for (const id of before) {
    if (!after.has(id)) deleted.add(id);
  }
  for (const id of after) deleted.delete(id);
  const out = next as LooseProject;
  out.deletedIds = [...deleted];
  return out as ProjectType;
}

function withoutDeleted<T>(rows: T[] | undefined, deleted: Set<string>): T[] {
  return (rows || []).filter((row: any) => !row?.id || !deleted.has(String(row.id)));
}

function applyDeletionTombstones(project: ProjectType): ProjectType {
  const out = normalizedProject(project as LooseProject);
  const deleted = new Set<string>((out.deletedIds || []).map(String));
  if (!deleted.size) return project;
  out.characters = withoutDeleted(out.characters, deleted);
  out.locations = withoutDeleted(out.locations, deleted);
  out.technologies = withoutDeleted(out.technologies, deleted);
  out.cultures = withoutDeleted(out.cultures, deleted);
  out.sources = withoutDeleted(out.sources, deleted);
  out.reports = withoutDeleted(out.reports, deleted);
  out.tasks = withoutDeleted(out.tasks, deleted);
  out.caseDocuments = withoutDeleted(out.caseDocuments, deleted);
  out.links = withoutDeleted(out.links, deleted);
  out.fieldNotes = withoutDeleted(out.fieldNotes, deleted);
  out.timelines = (out.timelines || [])
    .filter((timeline: any) => !deleted.has(String(timeline.id)))
    .map((timeline: any) => ({
      ...timeline,
      events: withoutDeleted(timeline.events, deleted),
      pointsOfDivergence: withoutDeleted(timeline.pointsOfDivergence, deleted),
    }));
  if (out.mapData) {
    out.mapData = {
      ...out.mapData,
      anchoredShapes: withoutDeleted(out.mapData.anchoredShapes, deleted),
      scenarios: withoutDeleted(out.mapData.scenarios, deleted),
    };
  }
  return out as ProjectType;
}

function mergeByKey<T>(
  left: T[],
  right: T[],
  key: (row: T) => string,
  combine: (left: T, right: T) => T,
): T[] {
  const map = new Map<string, T>();
  for (const row of left) {
    const k = key(row) || JSON.stringify(row);
    map.set(k, row);
  }
  for (const row of right) {
    const k = key(row) || JSON.stringify(row);
    const existing = map.get(k);
    map.set(k, existing ? combine(existing, row) : row);
  }
  return [...map.values()];
}

function combineTags(left: any, right: any): string[] {
  return [...new Set([...(left?.tags || []), ...(right?.tags || [])])];
}

function combineText(left: any, right: any): string {
  return [left, right]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, rows) => rows.indexOf(value) === index)
    .join("\n");
}

function combineNotes(left: any, right: any): any[] {
  const rows = [
    ...(Array.isArray(left) ? left : []),
    ...(Array.isArray(right) ? right : []),
  ];
  const map = new Map<string, any>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const key = `${row.ts || ""}|${row.text || ""}`;
    map.set(key, row);
  }
  return [...map.values()];
}

/**
 * The app is the person's record. When both sides have the same row, keep the
 * local edit unless the incoming copy explicitly says it is newer. The old
 * merge preferred incoming fields, so a 15-second HQ pull silently reverted
 * every manual edit.
 */
function newerRow(left: any, right: any): any {
  const leftTime = Date.parse(left?.updatedAt || left?.createdAt || "");
  const rightTime = Date.parse(right?.updatedAt || right?.createdAt || "");
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return rightTime > leftTime ? right : left;
  }
  if (Number.isFinite(rightTime) && !Number.isFinite(leftTime)) return right;
  return left;
}

function combineTask(left: any, right: any): any {
  const newer = newerRow(left, right);
  const older = newer === left ? right : left;
  return {
    ...older,
    ...newer,
    notes: combineNotes(left.notes, right.notes),
    documentIds: [
      ...new Set([...(left.documentIds || []), ...(right.documentIds || [])]),
    ],
    tags: combineTags(left, right),
  };
}

function combineEntity(left: any, right: any): any {
  const newer = newerRow(left, right);
  const older = newer === left ? right : left;
  return {
    ...older,
    ...newer,
    description: newer.description || older.description || "",
    notes: combineText(newer.notes, older.notes),
    tags: combineTags(left, right),
    timelineIds: [...new Set([...(left.timelineIds || []), ...(right.timelineIds || [])])],
    linkedEventIds: [
      ...new Set([...(left.linkedEventIds || []), ...(right.linkedEventIds || [])]),
    ],
  };
}

function combineScene(left: any, right: any): any {
  const newer = newerRow(left, right);
  const older = newer === left ? right : left;
  return {
    ...older,
    ...newer,
    characters: [...new Set([...(left.characters || []), ...(right.characters || [])])],
    locations: [...new Set([...(left.locations || []), ...(right.locations || [])])],
    eventIds: [...new Set([...(left.eventIds || []), ...(right.eventIds || [])])],
    technologies: [...new Set([...(left.technologies || []), ...(right.technologies || [])])],
    cultures: [...new Set([...(left.cultures || []), ...(right.cultures || [])])],
    sources: [...new Set([...(left.sources || []), ...(right.sources || [])])],
  };
}

function combineReport(left: any, right: any): any {
  const newer = newerRow(left, right);
  const older = newer === left ? right : left;
  return {
    ...older,
    ...newer,
    tags: combineTags(left, right),
    characterIds: [
      ...new Set([...(left.characterIds || []), ...(right.characterIds || [])]),
    ],
    scenes: mergeByKey(
      Array.isArray(left.scenes) ? left.scenes : [],
      Array.isArray(right.scenes) ? right.scenes : [],
      (scene: any) => String(scene.id || `${scene.title}|${scene.order}`),
      combineScene,
    ),
    nodes: Array.isArray(newer.nodes) ? newer.nodes : older.nodes || [],
    edges: Array.isArray(newer.edges) ? newer.edges : older.edges || [],
  };
}

function combineEvent(left: any, right: any): any {
  const newer = newerRow(left, right);
  const older = newer === left ? right : left;
  return {
    ...older,
    ...newer,
    description: newer.description || older.description || "",
    notes: combineText(newer.notes, older.notes),
    tags: combineTags(left, right),
    causes: [...new Set([...(left.causes || []), ...(right.causes || [])])],
    effects: [...new Set([...(left.effects || []), ...(right.effects || [])])],
    linkedCharacterIds: [
      ...new Set([
        ...(left.linkedCharacterIds || []),
        ...(right.linkedCharacterIds || []),
      ]),
    ],
    linkedLocationIds: [
      ...new Set([...(left.linkedLocationIds || []), ...(right.linkedLocationIds || [])]),
    ],
    linkedTechnologyIds: [
      ...new Set([
        ...(left.linkedTechnologyIds || []),
        ...(right.linkedTechnologyIds || []),
      ]),
    ],
    linkedCultureIds: [
      ...new Set([...(left.linkedCultureIds || []), ...(right.linkedCultureIds || [])]),
    ],
    linkedSourceDocumentIds: [
      ...new Set([
        ...(left.linkedSourceDocumentIds || []),
        ...(right.linkedSourceDocumentIds || []),
      ]),
    ],
    linkedNarrativeIds: [
      ...new Set([...(left.linkedNarrativeIds || []), ...(right.linkedNarrativeIds || [])]),
    ],
  };
}

function combineTimeline(left: any, right: any): any {
  const newer = newerRow(left, right);
  const older = newer === left ? right : left;
  return {
    ...older,
    ...newer,
    tags: combineTags(left, right),
    events: mergeByKey(
      Array.isArray(left.events) ? left.events : [],
      Array.isArray(right.events) ? right.events : [],
      (event: any) => String(event.id || `${event.title}|${event.date}`),
      combineEvent,
    ),
  };
}

/** Merge two records without discarding the richer side. */
export function mergeProjects(local: ProjectType, incoming: ProjectType): ProjectType {
  const a = pruneTimelineNoise(local) as LooseProject;
  const b = pruneTimelineNoise(incoming) as LooseProject;
  const newerProject = newerRow(a, b);
  const olderProject = newerProject === a ? b : a;
  const out: LooseProject = { ...olderProject, ...newerProject };
  const tombstones = new Set<string>(
    [...(a.deletedIds || []), ...(b.deletedIds || [])].map(String),
  );
  out.deletedIds = [...tombstones];

  out.characters = withoutDeleted(
    mergeByKey(
      a.characters,
      b.characters,
      (row: any) => String(row.name || row.id || "").toLowerCase(),
      combineEntity,
    ),
    tombstones,
  );
  out.locations = withoutDeleted(
    mergeByKey(
      a.locations,
      b.locations,
      (row: any) => String(row.name || row.id || "").toLowerCase(),
      combineEntity,
    ),
    tombstones,
  );
  out.technologies = withoutDeleted(
    mergeByKey(
      a.technologies,
      b.technologies,
      (row: any) => String(row.name || row.id || "").toLowerCase(),
      combineEntity,
    ),
    tombstones,
  );
  out.cultures = withoutDeleted(
    mergeByKey(
      a.cultures,
      b.cultures,
      (row: any) => String(row.name || row.id || "").toLowerCase(),
      combineEntity,
    ),
    tombstones,
  );
  out.sources = withoutDeleted(
    mergeByKey(
      a.sources,
      b.sources,
      (row: any) => String(row.id || row.title || ""),
      combineEntity,
    ),
    tombstones,
  );
  out.reports = withoutDeleted(
    mergeByKey(
      a.reports,
      b.reports,
      (row: any) => String(row.id || row.title || ""),
      combineReport,
    ),
    tombstones,
  ).map((report: any) => ({
    ...report,
    scenes: withoutDeleted(report.scenes, tombstones),
  }));
  out.tasks = withoutDeleted(
    mergeByKey(
      a.tasks || [],
      b.tasks || [],
      (row: any) => String(row.id || row.title || ""),
      combineTask,
    ),
    tombstones,
  );
  out.caseDocuments = withoutDeleted(
    mergeByKey(
      a.caseDocuments || [],
      b.caseDocuments || [],
      (row: any) => String(row.id || row.name || ""),
      combineEntity,
    ),
    tombstones,
  );
  out.assets = withoutDeleted(
    mergeByKey(
      (a as any).assets || [],
      (b as any).assets || [],
      (row: any) => String(row.id || row.name || ""),
      combineEntity,
    ),
    tombstones,
  );
  out.financeSources = withoutDeleted(
    mergeByKey(
      (a as any).financeSources || [],
      (b as any).financeSources || [],
      (row: any) => String(row.id || row.name || ""),
      combineEntity,
    ),
    tombstones,
  );
  out.financeSettings = b.financeSettings || a.financeSettings || undefined;
  out.profile = b.profile || a.profile || undefined;
  out.entityTypes = mergeByKey(
    (a as any).entityTypes || [],
    (b as any).entityTypes || [],
    (row: any) => String(row.id || row.name || "").toLowerCase(),
    combineEntity,
  );
  out.entities = withoutDeleted(
    mergeByKey(
      (a as any).entities || [],
      (b as any).entities || [],
      (row: any) => String(row.id || `${row.entityType}|${row.name}`),
      combineEntity,
    ),
    tombstones,
  );
  out.links = withoutDeleted(
    mergeByKey(
      a.links,
      b.links,
      (row: any) => String(row.id || ""),
      combineEntity,
    ),
    tombstones,
  );
  out.fieldNotes = withoutDeleted(
    mergeByKey(
      a.fieldNotes,
      b.fieldNotes,
      (row: any) => String(row.id || `${row.ts}|${row.detail}`),
      combineEntity,
    ),
    tombstones,
  );
  out.timelines = withoutDeleted(
    mergeByKey(
      a.timelines,
      b.timelines,
      (row: any) => String(row.id || row.name || "").toLowerCase(),
      combineTimeline,
    ),
    tombstones,
  ).map((timeline: any) => ({
    ...timeline,
    events: withoutDeleted(timeline.events, tombstones),
    pointsOfDivergence: withoutDeleted(timeline.pointsOfDivergence, tombstones),
  }));
  out.mapData = {
    ...(a.mapData || {}),
    ...(b.mapData || {}),
    anchoredShapes: withoutDeleted(
      mergeByKey(
        a.mapData?.anchoredShapes || [],
        b.mapData?.anchoredShapes || [],
        (row: any) => String(row.id || row.name || ""),
        combineEntity,
      ),
      tombstones,
    ),
    scenarios: withoutDeleted(
      mergeByKey(
        a.mapData?.scenarios || [],
        b.mapData?.scenarios || [],
        (row: any) => String(row.id || row.name || ""),
        combineEntity,
      ),
      tombstones,
    ),
    defaultMapSettings:
      b.mapData?.defaultMapSettings ||
      a.mapData?.defaultMapSettings || {
        baseMap: "standard",
        showBorders: true,
        showLabels: true,
        defaultZoom: 2,
        defaultCenter: { lat: 30, lng: 0 },
      },
  };
  out.updatedAt = new Date().toISOString();
  return out as ProjectType;
}

export function projectSignature(project: ProjectType): string {
  const normalized = normalizedProject(project as LooseProject);
  const clone: any = { ...normalized };
  delete clone.updatedAt;
  delete clone.sourceDocuments;
  delete clone.narratives;
  return JSON.stringify(clone);
}

export function projectContentCount(project: ProjectType): number {
  const events = (project.timelines || []).reduce(
    (sum, timeline) => sum + (timeline.events?.length || 0),
    0,
  );
  return (
    events +
    (project.locations?.length || 0) +
    (project.characters?.length || 0) +
    (project.sources?.length || 0) +
    (project.reports?.length || 0) +
    (project.tasks?.length || 0) +
    (project.caseDocuments?.length || 0)
  );
}
