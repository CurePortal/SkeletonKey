#!/usr/bin/env node
// Case Worker -> SkeletonKey importer.
//
// Case Worker (github: local-first Flask case app) keeps one folder with
// state.json and documents/. This maps that record into the SkeletonKey main
// project:
//
//   roadmap[]      -> tasks[]
//   documents[]    -> caseDocuments[]  (+ files copied beside the project)
//   transactions[] -> events on a "Case Worker ledger" timeline
//   expected[]     -> events on the same timeline
//   chat[]         -> one source document (the assistant transcript)
//   profile        -> named in the source document
//
// It is idempotent: every row gets a stable `cw-` id, so re-running updates
// instead of duplicating. Money is not invented: rows become dated ledger
// events with the amount and category in the description.
//
// Writes through the local SkeletonKey bridge (default http://127.0.0.1:8799)
// so the running app and MCP stay in sync, or directly to a project JSON with
// --file.
//
//   node tools/import-caseworker.mjs --source "$HOME/Downloads/case-worker/data"
//   node tools/import-caseworker.mjs --source ... --dry-run
//   node tools/import-caseworker.mjs --source ... --file ~/.local/state/skeletonkey/project.json

import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, join, resolve } from "node:path";

const BRIDGE = (process.env.SK_HQ_URL || "http://127.0.0.1:8799").replace(/\/$/, "");
const args = process.argv.slice(2);

function arg(name, fallback = "") {
  const index = args.findIndex((value) => value === `--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) {
    return args[index + 1];
  }
  const inline = args.find((value) => value.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  return fallback;
}

const RAW_SOURCE = resolve(
  arg("source", join(homedir(), "Downloads", "case-worker", "data")),
);
const PROJECT_FILE = arg("file", "");
const DOCS_DIR = arg("docs-dir", join(homedir(), "Documents", "SkeletonKey", "case-worker-documents"));
const MILESTONES_FILE = arg("milestones", "");
const DRY_RUN = args.includes("--dry-run");
const SKIP_CHAT = args.includes("--no-chat");
const NO_TEXT = args.includes("--no-text");
const NOW = new Date().toISOString();

function findDataDir(root) {
  const direct = [root, join(root, "data"), join(root, "recovery_app", "data")];
  for (const candidate of direct) {
    if (existsSync(join(candidate, "state.json"))) return candidate;
  }
  const queue = [{ dir: root, depth: 0 }];
  while (queue.length) {
    const { dir, depth } = queue.shift();
    if (depth > 3) continue;
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }
      const child = join(dir, entry.name);
      if (existsSync(join(child, "state.json"))) return child;
      queue.push({ dir: child, depth: depth + 1 });
    }
  }
  return root;
}

const SOURCE = findDataDir(RAW_SOURCE);

const uid = (value) => `cw-${String(value).trim()}`;
const text = (value, max = 20000) => {
  const body = String(value ?? "").trim();
  return body.length > max ? `${body.slice(0, max)}…` : body;
};
const isoDate = (value) => {
  const body = String(value || "").trim();
  if (!body) return "";
  const parsed = Date.parse(body.replace(" ", "T"));
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return body.slice(0, 10);
};
const mimeFor = (name) => {
  const ext = extname(String(name || "")).toLowerCase();
  return (
    {
      ".pdf": "application/pdf",
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".csv": "text/csv",
      ".json": "application/json",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    }[ext] || "application/octet-stream"
  );
};

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `${url} -> HTTP ${response.status}`);
  }
  return payload;
}

function taskIds(state) {
  return new Set(
    (state.roadmap || []).map((row, index) => uid(row.id || `task-${index + 1}`)),
  );
}

function docId(row, index) {
  return uid(row.id || row.stored || `doc-${index + 1}`);
}

function mapTasks(state) {
  return (state.roadmap || []).map((row, index) => {
    const id = uid(row.id || `task-${index + 1}`);
    const notes = (Array.isArray(row.notes) ? row.notes : [])
      .map((note) => ({
        ts: String(note?.ts || ""),
        text: text(note?.text, 4000),
      }))
      .filter((note) => note.text);
    const docIds = (Array.isArray(row.docs) ? row.docs : [])
      .map((doc, docIndex) =>
        typeof doc === "string" ? uid(doc) : docId(doc, docIndex),
      )
      .filter(Boolean);
    const created = String(row.created || row.updated || NOW);
    return {
      id,
      title: text(row.title, 300) || "Untitled task",
      section: text(row.section, 120) || "Other",
      status: ["todo", "doing", "blocked", "done"].includes(row.status)
        ? row.status
        : "todo",
      due: isoDate(row.due),
      notes,
      documentIds: docIds,
      createdAt: created,
      updatedAt: String(row.updated || created),
      tags: ["case-worker", "import"],
      importedFrom: { app: "case-worker", id: String(row.id || ""), at: NOW },
    };
  });
}

function pdfText(path) {
  try {
    return execFileSync("pdftotext", [path, "-"], {
      encoding: "utf8",
      maxBuffer: 30 * 1024 * 1024,
      timeout: 20000,
    }).slice(0, 60000);
  } catch {
    return "";
  }
}

function mapDocuments(state, copyFiles) {
  return (state.documents || []).map((row, index) => {
    const id = docId(row, index);
    const stored = basename(String(row.stored || ""));
    const sourcePath = stored ? join(SOURCE, "documents", stored) : "";
    let copiedPath = "";
    if (copyFiles && sourcePath && existsSync(sourcePath)) {
      mkdirSync(DOCS_DIR, { recursive: true });
      const target = join(DOCS_DIR, `${id}-${stored}`);
      copyFileSync(sourcePath, target);
      copiedPath = target;
    }
    return {
      id,
      name: text(row.name || stored || "Untitled document", 300),
      storedName: stored,
      mimeType: String(row.mime || mimeFor(row.name || stored)),
      size: Number(row.size) || 0,
      uploaded: String(row.uploaded || row.processed_at || NOW),
      status:
        row.status === "reviewed" || row.status === "processed" ? "reviewed" : "new",
      analyzedAt: String(row.processed_at || row.analyzed_at || ""),
      analysis: text(row.analysis || row.note, 20000),
      extractedText:
        text(row.extracted_text || row.text, 60000) ||
        (!NO_TEXT && copyFiles && /\.pdf$/i.test(stored) && existsSync(copiedPath || sourcePath)
          ? pdfText(copiedPath || sourcePath)
          : ""),
      note: text(row.analysis || row.note, 4000),
      sourcePath: copiedPath || sourcePath || "",
      tags: ["case-worker", "import"],
      importedFrom: { app: "case-worker", id: String(row.id || ""), at: NOW },
    };
  });
}

function ledgerEvents(state) {
  const rows = [];
  for (const row of state.transactions || []) {
    const amount = Math.abs(Number(row.amount) || 0);
    rows.push({
      id: uid(`tx-${row.id || `${row.date}-${row.desc}-${amount}`}`),
      title: `${row.kind === "income" ? "Received" : "Paid"} — ${text(row.desc, 120) || row.category || "item"}`,
      description: [
        row.kind === "income" ? "Income" : "Expense",
        `${amount.toFixed(2)} USD`,
        row.category || "Other",
        row.account ? `account ${row.account}` : "",
        row.note ? text(row.note, 500) : "",
      ]
        .filter(Boolean)
        .join(" · "),
      date: isoDate(row.date),
      kind: "transaction",
    });
  }
  const expected = Array.isArray(state.expected)
    ? state.expected
    : Array.isArray(state.ledger)
      ? state.ledger
      : [];
  for (const row of expected) {
    const amount = Math.abs(Number(row.amount) || 0);
    rows.push({
      id: uid(`expected-${row.id || `${row.date}-${row.desc}-${amount}`}`),
      title: `Expected — ${text(row.desc, 120) || row.category || "money"}`,
      description: [
        "Expected money",
        `${amount.toFixed(2)} USD`,
        row.category || "Other",
        row.status ? `status ${row.status}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      date: isoDate(row.date),
      kind: "expected",
    });
  }
  return rows.filter((row) => row.title);
}

function chatSource(state) {
  const messages = (state.chat || []).filter(
    (message) => message && ["user", "assistant"].includes(message.role) && text(message.text),
  );
  if (!messages.length || SKIP_CHAT) return null;
  const name = text(state.profile?.name, 120) || "unidentified";
  const body = messages
    .map((message) => {
      const who = message.role === "assistant" ? "Assistant" : "Person";
      return `### ${who}${message.ts ? ` — ${message.ts}` : ""}\n\n${text(message.text, 12000)}`;
    })
    .join("\n\n");
  return {
    id: "cw-source-assistant-log",
    title: `Case Worker assistant log — ${name}`,
    description: `Imported from the Case Worker project (${SOURCE}).`,
    authors: [],
    publicationDate: isoDate(state.updated) || NOW.slice(0, 10),
    type: "transcript",
    sourceType: "file",
    url: null,
    filePath: null,
    fileName: "state.json",
    notes: body,
    tags: ["case-worker", "import", "assistant-log"],
    citations: {},
    createdAt: NOW,
    updatedAt: NOW,
    importedFrom: { app: "case-worker", id: "chat", at: NOW },
  };
}

function applyLedgerEvents(project, events) {
  if (!events.length) return 0;
  project.timelines = Array.isArray(project.timelines) ? project.timelines : [];
  let timeline = project.timelines.find((row) => row.id === "cw-timeline-ledger");
  if (!timeline) {
    timeline = {
      id: "cw-timeline-ledger",
      name: "Case Worker ledger",
      description: "Money rows imported from the Case Worker project.",
      events: [],
      pointsOfDivergence: [],
      startDate: "",
      endDate: "",
      isMainTimeline: false,
      parentTimelineId: null,
      branchFromEventId: null,
      color: "#a855f7",
      tags: ["case-worker", "import", "ledger"],
    };
    project.timelines.push(timeline);
  }
  timeline.events = Array.isArray(timeline.events) ? timeline.events : [];
  const existing = new Map(timeline.events.map((row) => [row.id, row]));
  for (const row of events) {
    const event = {
      id: row.id,
      title: row.title,
      description: row.description,
      date: row.date,
      endDate: null,
      timelineId: timeline.id,
      importance: 2,
      iconId: "event",
      causes: [],
      effects: [],
      linkedCharacterIds: [],
      linkedLocationIds: [],
      linkedTechnologyIds: [],
      linkedCultureIds: [],
      linkedSourceDocumentIds: [],
      linkedNarrativeIds: [],
      notes: "Imported from Case Worker.",
      tags: ["case-worker", "import", "ledger", row.kind],
      isPointOfDivergence: false,
    };
    existing.set(event.id, { ...(existing.get(event.id) || {}), ...event });
  }
  timeline.events = [...existing.values()];
  return events.length;
}

function caseTimelineEvents(state, tasks) {
  const fallbackDate = isoDate(state.updated) || NOW.slice(0, 10);
  const events = [];
  for (const task of tasks) {
    task.notes.forEach((note, index) => {
      events.push({
        id: `cw-tl-note-${task.id}-${index}`,
        date: isoDate(note.ts) || fallbackDate,
        title: task.title,
        description: note.text,
        iconId: "briefcase",
        tags: ["case-worker", "import", "plan", task.status],
        linkedSourceDocumentIds: task.documentIds,
      });
    });
  }
  // Documents live in caseDocuments. They are not timeline events: importing
  // one event per file floods a timeline that is meant to group activity by
  // day. A document can still be reached from its task or the Documents page.
  return events.sort((left, right) => left.date.localeCompare(right.date));
}

function applyCaseTimeline(project, events) {
  if (!events.length) return 0;
  project.timelines = Array.isArray(project.timelines) ? project.timelines : [];
  let timeline = project.timelines.find((row) => row.id === "cw-timeline-case");
  if (!timeline) {
    timeline = {
      id: "cw-timeline-case",
      name: "Case history",
      description: "Tasks, notes, and documents imported from the case record.",
      events: [],
      pointsOfDivergence: [],
      startDate: "",
      endDate: "",
      isMainTimeline: false,
      parentTimelineId: null,
      branchFromEventId: null,
      color: "#0ea5e9",
      tags: ["case-worker", "import", "case"],
    };
    project.timelines.push(timeline);
  }
  timeline.events = Array.isArray(timeline.events) ? timeline.events : [];
  const existing = new Map(timeline.events.map((row) => [row.id, row]));
  for (const row of events) {
    const event = {
      id: row.id,
      title: row.title,
      description: row.description,
      date: row.date,
      endDate: null,
      timelineId: timeline.id,
      importance: 2,
      iconId: row.iconId,
      causes: [],
      effects: [],
      linkedCharacterIds: [],
      linkedLocationIds: [],
      linkedTechnologyIds: [],
      linkedCultureIds: [],
      linkedSourceDocumentIds: row.linkedSourceDocumentIds || [],
      linkedNarrativeIds: [],
      notes: "Imported from Case Worker.",
      tags: row.tags,
      isPointOfDivergence: false,
    };
    existing.set(event.id, { ...(existing.get(event.id) || {}), ...event });
  }
  timeline.events = [...existing.values()].sort((left, right) =>
    String(left.date).localeCompare(String(right.date)),
  );
  const dates = timeline.events.map((event) => String(event.date || "")).filter(Boolean).sort();
  timeline.startDate = dates[0] || "";
  timeline.endDate = dates[dates.length - 1] || "";
  return events.length;
}

function applyMilestones(project, rows) {
  if (!rows.length) return 0;
  project.timelines = Array.isArray(project.timelines) ? project.timelines : [];
  let timeline = project.timelines.find((row) => row.id === "cw-timeline-milestones");
  if (!timeline) {
    timeline = {
      id: "cw-timeline-milestones",
      name: "Case milestones",
      description: "Key dates and deadlines from the case documentation.",
      events: [],
      pointsOfDivergence: [],
      startDate: "",
      endDate: "",
      isMainTimeline: false,
      parentTimelineId: null,
      branchFromEventId: null,
      color: "#f59e0b",
      tags: ["case-worker", "import", "milestones"],
    };
    project.timelines.push(timeline);
  }
  timeline.events = Array.isArray(timeline.events) ? timeline.events : [];
  const existing = new Map(timeline.events.map((row) => [row.id, row]));
  rows.forEach((row, index) => {
    const id = `cw-milestone-${row.id || index + 1}`;
    const event = {
      id,
      title: row.title,
      description: row.description || "",
      date: isoDate(row.date),
      endDate: null,
      timelineId: timeline.id,
      importance: Number(row.importance) || 3,
      iconId: row.iconId || "flag",
      causes: [],
      effects: [],
      linkedCharacterIds: [],
      linkedLocationIds: [],
      linkedTechnologyIds: [],
      linkedCultureIds: [],
      linkedSourceDocumentIds: [],
      linkedNarrativeIds: [],
      notes: "Synthesized from the imported case record; verify deadlines against the notices.",
      tags: ["case-worker", "import", "milestone", ...(row.tags || [])],
      isPointOfDivergence: false,
    };
    existing.set(id, { ...(existing.get(id) || {}), ...event });
  });
  timeline.events = [...existing.values()].sort((left, right) =>
    String(left.date).localeCompare(String(right.date)),
  );
  const dates = timeline.events.map((event) => String(event.date || "")).filter(Boolean).sort();
  timeline.startDate = dates[0] || "";
  timeline.endDate = dates[dates.length - 1] || "";
  return rows.length;
}

function upsertById(list, rows) {
  const out = Array.isArray(list) ? [...list] : [];
  const index = new Map(out.map((row, position) => [String(row.id), position]));
  for (const row of rows) {
    const key = String(row.id);
    if (index.has(key)) {
      const position = index.get(key);
      out[position] = { ...out[position], ...row };
    } else {
      index.set(key, out.length);
      out.push(row);
    }
  }
  return out;
}

async function main() {
  const stateFile = join(SOURCE, "state.json");
  if (!existsSync(stateFile)) {
    throw new Error(`No state.json in ${SOURCE}. Pass --source <case-worker data folder>.`);
  }
  const state = JSON.parse(await readFile(stateFile, "utf8"));

  let project;
  let apply;
  if (PROJECT_FILE) {
    project = JSON.parse(await readFile(PROJECT_FILE, "utf8"));
    apply = async (next) => {
      await writeFile(PROJECT_FILE, JSON.stringify(next, null, 2));
    };
  } else {
    project = await getJson(`${BRIDGE}/project`);
    apply = (next) => postJson(`${BRIDGE}/project`, next);
  }

  const tasks = mapTasks(state);
  const documents = mapDocuments(state, !DRY_RUN);
  const ledger = ledgerEvents(state);
  const source = chatSource(state);

  const next = {
    ...project,
    tasks: upsertById(project.tasks, tasks),
    caseDocuments: upsertById(project.caseDocuments, documents),
  };
  if (source) {
    next.sources = upsertById(next.sources, [source]);
    next.sourceDocuments = upsertById(next.sourceDocuments, [source]);
  }
  const ledgerCount = applyLedgerEvents(next, ledger);
  const caseEvents = caseTimelineEvents(state, tasks);
  const timelineCount = applyCaseTimeline(next, caseEvents);
  const milestones = MILESTONES_FILE
    ? JSON.parse(await readFile(MILESTONES_FILE, "utf8"))
    : [];
  const milestoneCount = applyMilestones(next, milestones);

  console.error(`case-worker: ${SOURCE}`);
  console.error(
    `case-worker: ${tasks.length} task(s), ${documents.length} document(s), ` +
      `${ledgerCount} money event(s), ${timelineCount} case event(s), ` +
      `${milestoneCount} milestone(s), ${source ? 1 : 0} transcript source`,
  );

  if (DRY_RUN) {
    console.error("case-worker: dry run, nothing written.");
    process.stdout.write(
      JSON.stringify(
        { tasks, documents, ledger, caseEvents, milestones, source: source ? source.title : null },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  await apply(next);
  console.error(
    PROJECT_FILE
      ? `case-worker: wrote ${PROJECT_FILE}`
      : `case-worker: posted to ${BRIDGE}/project (the app pulls it within 15s)`,
  );
}

main().catch((error) => {
  console.error(`case-worker: ${error.message}`);
  process.exit(1);
});
