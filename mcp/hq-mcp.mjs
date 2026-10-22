#!/usr/bin/env node
// SkeletonKey HQ MCP — the control plane for the unified sousveillance suite.
//
// One stdio MCP server that can:
//   - read the SkeletonKey record through the local bridge's sanitized mirror;
//   - propose changes (plan, money, documents, places, entities, timelines,
//     events, narratives, links, field notes) that the app applies only while
//     the person has HQ link enabled;
//   - drive the phone beacon (position, track, memory, weather, hazards, say);
//   - call the offline geo stack (find, reverse, nearby, route, height);
//   - list and delegate to the local opencode agent fleet.
//
// Nothing leaves the machine. No server, no account, no telemetry.
//
// Run:  node mcp/hq-mcp.mjs          (opencode spawns it over stdio)
//
// Environment:
//   SK_BRIDGE_URL        default http://127.0.0.1:8788
//   SOUSVEILLANCE_DIR    default ~/Projects/sousveillance/server
//   BEACON_TOKEN         optional; only for the HTTP beacon fallback
//   BEACON_TOKEN_FILE    optional file containing the token
//   SK_AGENT_TIMEOUT_MS  default 180000

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const BRIDGE = (process.env.SK_BRIDGE_URL || "http://127.0.0.1:8788").replace(/\/$/, "");
const SOUS_DIRS = [
  process.env.SOUSVEILLANCE_DIR,
  join(HERE, "..", "sousveillance", "server"),
  join(homedir(), "beacon"),
  join(homedir(), "SkeletonKey", "sousveillance", "server"),
  join(homedir(), "Projects", "sousveillance", "server"),
].filter(Boolean);
let sousDir = SOUS_DIRS[0] || join(homedir(), "beacon");
const AGENT_TIMEOUT_MS = Number(process.env.SK_AGENT_TIMEOUT_MS || 180_000);

const server = new McpServer({ name: "skeletonkey-hq", version: "0.1.0" });

function text(value) {
  return { content: [{ type: "text", text: String(value) }] };
}

function json(value) {
  return text(JSON.stringify(value, null, 2));
}

function fail(message) {
  return { isError: true, content: [{ type: "text", text: String(message) }] };
}

async function guard(fn) {
  try {
    return await fn();
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

function trim(value, max = 500) {
  const body = String(value ?? "").replace(/\s+/g, " ").trim();
  return body.length > max ? `${body.slice(0, max)}…` : body;
}

async function beaconToken() {
  if (process.env.BEACON_TOKEN) return process.env.BEACON_TOKEN.trim();
  const file = process.env.BEACON_TOKEN_FILE;
  if (!file) return "";
  try {
    return (await readFile(file, "utf8")).trim();
  } catch {
    return "";
  }
}

async function bridge(path, init = {}, timeout = 30_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${BRIDGE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { raw: raw.slice(0, 1000) };
    }
    if (!response.ok) {
      const message =
        data && typeof data === "object" && "error" in data
          ? data.error
          : `HTTP ${response.status}`;
      throw new Error(`local bridge: ${String(message).slice(0, 400)}`);
    }
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("local bridge timed out. Is `npm run geo` running?");
    }
    if (error instanceof Error && error.message.startsWith("local bridge:")) throw error;
    throw new Error(
      `Could not reach the local bridge at ${BRIDGE}. Start it with \`npm run geo\`.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function bridgeBeacon(path, init = {}, timeout = 15_000) {
  const token = await beaconToken();
  return bridge(
    `/beacon${path}`,
    {
      ...init,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
    },
    timeout,
  );
}

async function getState() {
  const data = await bridge("/sk/state", {}, 10_000);
  if (!data?.ok || !data.state) {
    throw new Error(
      "No SkeletonKey snapshot yet. Open SkeletonKey and enable HQ link in Settings → Local services.",
    );
  }
  return data.state;
}

function age(iso) {
  const when = Date.parse(iso || "");
  if (!Number.isFinite(when)) return "unknown age";
  const seconds = Math.max(0, Math.round((Date.now() - when) / 1000));
  if (seconds < 90) return `${seconds}s old`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m old`;
  return `${Math.round(seconds / 3600)}h old`;
}

function findById(rows, id) {
  return (rows || []).find((row) => row && row.id === id) || null;
}

function mainTimeline(state) {
  return (
    (state.timelines || []).find((row) => row.isMain) ||
    (state.timelines || [])[0] ||
    null
  );
}

async function sous() {
  let lastError;
  for (const dir of SOUS_DIRS) {
    const url = (file) => pathToFileURL(join(dir, file)).href;
    try {
      const [store, fieldlog, weather, hazards] = await Promise.all([
        import(url("lib/store.mjs")),
        import(url("fieldlog.mjs")),
        import(url("weather.mjs")),
        import(url("hazards.mjs")),
      ]);
      sousDir = dir;
      return { store, fieldlog, weather, hazards, dir };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Sousveillance modules not found");
}

async function sousSafe() {
  try {
    return await sous();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// opencode agent fleet
// ---------------------------------------------------------------------------

const sessions = new Map();

async function agentList() {
  const rows = await bridge("/opencode/agent", {}, 10_000);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && row.name)
    .map((row) => ({
      name: row.name,
      description: row.description || "",
      mode: row.mode || "",
      native: Boolean(row.native),
    }));
}

async function agentSession(agent) {
  const key = `${BRIDGE}|${agent}`;
  const existing = sessions.get(key);
  if (existing) return existing;
  const session = await bridge(
    "/opencode/session",
    { method: "POST", body: JSON.stringify({ title: `SkeletonKey HQ · ${agent}` }) },
    15_000,
  );
  if (!session?.id) throw new Error("opencode did not return a session id");
  sessions.set(key, session.id);
  return session.id;
}

function messageText(message) {
  return (message?.parts || [])
    .filter((part) => part.type === "text" && part.text && !part.synthetic)
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

async function askAgent(agent, prompt, timeoutMs = AGENT_TIMEOUT_MS) {
  const id = await agentSession(agent);
  const encoded = encodeURIComponent(id);

  // Sessions are reused per agent; do not return an earlier reply again.
  const baseline = new Set();
  try {
    const existing = await bridge(`/opencode/session/${encoded}/message`, {}, 10_000);
    for (const message of Array.isArray(existing) ? existing : []) {
      if (message?.info?.id) baseline.add(message.info.id);
    }
  } catch {
    // New session.
  }

  await bridge(
    `/opencode/session/${encoded}/prompt_async`,
    {
      method: "POST",
      body: JSON.stringify({ parts: [{ type: "text", text: prompt }], agent }),
    },
    20_000,
  );

  const deadline = Date.now() + timeoutMs;
  const seen = new Set();
  let replies = [];
  let lastError = "";
  let idleSince = 0;

  while (Date.now() < deadline) {
    let messages = [];
    try {
      messages = await bridge(`/opencode/session/${encoded}/message`, {}, 15_000);
    } catch {
      // opencode may be restarting.
    }
    if (Array.isArray(messages)) {
      for (const message of messages) {
        const info = message?.info;
        if (!info || info.role !== "assistant" || !info.id) continue;
        if (info.time?.completed === undefined) continue;
        if (baseline.has(info.id) || seen.has(info.id)) continue;
        seen.add(info.id);
        const body = messageText(message);
        if (body) replies.push(body);
        if (info.error) {
          lastError = `${info.error.name || "error"}: ${info.error.data?.message || ""}`;
        }
      }
    }

    let idle = false;
    try {
      const statuses = await bridge("/opencode/session/status", {}, 10_000);
      idle = !statuses?.[id] || statuses[id]?.type === "idle";
    } catch {
      idle = false;
    }
    if (idle && replies.length) {
      if (!idleSince) idleSince = Date.now();
      if (Date.now() - idleSince >= 600) {
        if (lastError) throw new Error(lastError);
        return replies.join("\n\n").trim();
      }
    } else {
      idleSince = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${agent} timed out after ${Math.round(timeoutMs / 1000)}s`);
}

// ---------------------------------------------------------------------------
// HQ orchestration
// ---------------------------------------------------------------------------

server.registerTool(
  "hq_status",
  {
    title: "Suite status",
    description:
      "Health of the SkeletonKey record mirror, the local bridge, Valhalla/gazetteer, " +
      "the phone beacon, opencode, and the Sousveillance field log. Start here.",
    inputSchema: {},
  },
  () =>
    guard(async () => {
      const [health, sk, agents, memory] = await Promise.all([
        bridge("/health", {}, 10_000).catch((error) => ({ error: error.message })),
        bridge("/sk/health", {}, 10_000).catch((error) => ({ error: error.message })),
        agentList().catch(() => []),
        sousSafe(),
      ]);
      const lines = [];
      lines.push(`Bridge ${BRIDGE}: ${health.error ? "offline" : "online"}`);
      if (sk.error) {
        lines.push(`SkeletonKey mirror: ${sk.error}`);
      } else if (!sk.hasState) {
        lines.push("SkeletonKey mirror: no snapshot yet (enable HQ link in Settings)");
      } else {
        lines.push(
          `SkeletonKey mirror: ${sk.receivedAt || "unknown"} (${age(sk.receivedAt)}), ` +
            `${sk.pendingCommands || 0} pending command(s)`,
        );
      }
      if (!health.error) {
        lines.push(
          `Valhalla: ${health.valhalla ? "online" : "offline"} · gazetteer: ` +
            `${health.gazetteer ? "online" : "offline"} · beacon: ${health.beacon ? "online" : "offline"} · ` +
            `opencode: ${health.opencode ? "online" : "offline"}`,
        );
      }
      lines.push(`opencode agents: ${agents.length ? agents.map((row) => row.name).join(", ") : "none listed"}`);
      lines.push(
        memory
          ? `Sousveillance field log: available (${sousDir})`
          : `Sousveillance field log: unavailable (${sousDir}); using the bridge fallback where possible`,
      );
      return text(lines.join("\n"));
    }),
);

server.registerTool(
  "hq_context",
  {
    title: "Canonical life context",
    description:
      "The same unverified life snapshot the in-app assistant and phone handler receive, " +
      "built by protocols.buildContext() in the app. Use it before reasoning about the record.",
    inputSchema: {},
  },
  () =>
    guard(async () => {
      const data = await bridge("/sk/context", {}, 10_000);
      if (!data?.ok || !data.context) {
        throw new Error(
          "No context snapshot yet. Open SkeletonKey and enable HQ link, then make a change or wait a few seconds.",
        );
      }
      return text(`Context snapshot (${age(data.receivedAt)}):\n\n${trim(data.context, 30_000)}`);
    }),
);

server.registerTool(
  "hq_brief",
  {
    title: "Cross-module brief",
    description:
      "A deterministic briefing from the record: open steps, due items, money, new documents, " +
      "recent field notes, and the latest phone position/weather when available. No model call.",
    inputSchema: {},
  },
  () =>
    guard(async () => {
      const state = await getState();
      const month = new Date().toISOString().slice(0, 7);
      let income = 0;
      let spent = 0;
      for (const row of state.transactions || []) {
        if (!String(row.date || "").startsWith(month)) continue;
        if (row.kind === "income") income += Number(row.amount) || 0;
        else spent += Number(row.amount) || 0;
      }
      const open = (state.roadmap || []).filter((row) => row.status !== "done");
      const due = open
        .filter((row) => row.due)
        .sort((a, b) => String(a.due).localeCompare(String(b.due)))
        .slice(0, 8);
      const notes = [...(state.fieldNotes || [])]
        .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
        .slice(0, 5);
      const newDocs = (state.documents || []).filter((row) => row.status === "new");
      const lines = [
        `SkeletonKey brief · ${new Date().toISOString().slice(0, 10)} · snapshot ${age(state.updated)}`,
        `Open steps: ${open.length}${due.length ? ` · next due: ${due.map((row) => `${row.title} (${row.due})`).join("; ")}` : ""}`,
        `Money this month: in ${income.toFixed(2)}, out ${spent.toFixed(2)}, net ${(income - spent).toFixed(2)}`,
        `Documents awaiting review: ${newDocs.length}`,
        `Record: ${(state.entities || []).length} entities · ${(state.places || []).length} places · ` +
          `${(state.events || []).length} events · ${(state.narratives || []).length} narratives`,
      ];
      if (notes.length) {
        lines.push("Recent field notes:");
        for (const note of notes) lines.push(`- ${note.ts} [${note.kind}] ${trim(note.detail, 180)}`);
      }
      const live = await sousSafe();
      if (live) {
        try {
          const position = live.store.latestPosition();
          if (position) {
            lines.push(
              `Phone: ${position.lat.toFixed(5)},${position.lon.toFixed(5)} (${age(new Date(position.ts).toISOString())})`,
            );
          }
        } catch {
          // Ignore a stale or locked beacon database.
        }
      }
      return text(lines.join("\n"));
    }),
);

server.registerTool(
  "hq_search",
  {
    title: "Search the record",
    description:
      "Case-insensitive search across plan steps, documents (metadata), entities, places, " +
      "timeline events, narratives, field notes, money, and owed entries.",
    inputSchema: {
      query: z.string().min(1).max(200).describe("What to look for"),
      limit: z.number().int().min(1).max(100).optional().describe("Max matches (default 30)"),
    },
  },
  ({ query, limit }) =>
    guard(async () => {
      const state = await getState();
      const needle = query.toLowerCase();
      const max = limit ?? 30;
      const hits = [];
      const push = (kind, id, title, date, detail) => {
        if (hits.length >= max) return;
        const haystack = `${title} ${detail} ${date}`.toLowerCase();
        if (!haystack.includes(needle)) return;
        hits.push({ kind, id, title: trim(title, 160), date: date || "", detail: trim(detail, 240) });
      };
      for (const row of state.roadmap || []) push("plan", row.id, row.title, row.due, `${row.section} ${row.status}`);
      for (const row of state.documents || []) push("document", row.id, row.name, row.uploaded, `${row.status} ${row.note || ""}`);
      for (const row of state.entities || []) push("entity", row.id, row.name, row.createdAt, `${row.kind} ${row.description || ""}`);
      for (const row of state.places || []) push("place", row.id, row.name, row.createdAt, `${row.kind} ${row.address || ""} ${row.notes || ""}`);
      for (const row of state.events || []) push("event", row.id, row.title, row.date, `${row.kind} ${row.description || ""}`);
      for (const row of state.narratives || []) push("narrative", row.id, row.title, row.periodStart, `${row.tier} ${row.text || ""}`);
      for (const row of state.fieldNotes || []) push("note", row.id, row.kind, row.ts, row.detail);
      for (const row of state.transactions || []) push("transaction", row.id, row.desc, row.date, `${row.category} ${row.amount}`);
      for (const row of state.expected || []) push("owed", row.id, row.desc, row.date, `${row.category} ${row.amount} ${row.status}`);
      return hits.length ? json(hits) : text(`No matches for "${query}".`);
    }),
);

server.registerTool(
  "hq_agents",
  {
    title: "List opencode agents",
    description: "List the agents the local opencode server exposes (build, hq, hq-cloud, hq-local, …).",
    inputSchema: {},
  },
  () => guard(async () => {
    const agents = await agentList();
    return agents.length ? json(agents) : text("opencode returned no agents.");
  }),
);

server.registerTool(
  "hq_agent",
  {
    title: "Delegate to an opencode agent",
    description:
      "Send a prompt to a named local opencode agent and return its reply. Use this to hand a " +
      "hard question to hq-cloud, a field question to hq, or a coding/ops job to build. " +
      "The agent runs on this machine under its own permissions and the shared guardrails.",
    inputSchema: {
      agent: z.string().min(1).max(80).describe("Agent name, e.g. hq, hq-cloud, hq-local, build"),
      prompt: z.string().min(1).max(20_000).describe("The full question or task, with context"),
      timeoutSec: z.number().int().min(5).max(600).optional().describe("Default 180"),
    },
  },
  ({ agent, prompt, timeoutSec }) =>
    guard(async () => {
      const reply = await askAgent(agent, prompt, (timeoutSec ?? 180) * 1000);
      return text(reply || "(the agent returned no text)");
    }),
);

server.registerTool(
  "hq_command",
  {
    title: "Propose a record change",
    description:
      "Queue one change for SkeletonKey. The app applies it only while HQ link is enabled. " +
      "Actions and required args: plan.add {title, section?, status?, due?, note?}; " +
      "plan.update {id, title?, status?, due?, note?}; money.add {desc, amount, kind?, date?, category?}; " +
      "owed.add {desc, amount, date?, category?}; doc.review {id, status?}; " +
      "note.add {kind, detail, lat?, lon?}; place.add {name, lat?, lon?, address?, kind?, notes?}; " +
      "entity.add {name, kind?, description?, tags?}; timeline.add {name, description?, isMain?}; " +
      "event.add {title, date?, kind?, description?, timelineId?}; " +
      "narrative.add {title, text, tier?, periodStart?, periodEnd?}; " +
      "source.upsert {title, description?, sourceType?, apiEndpoint?, streamUrl?, url?, notes?, tags?}; " +
      "link.add {fromKind, fromId, toKind, toId, relation?, note?}.",
    inputSchema: {
      action: z
        .enum([
          "plan.add",
          "plan.update",
          "money.add",
          "owed.add",
          "doc.review",
          "note.add",
          "place.add",
          "entity.add",
          "timeline.add",
          "event.add",
          "narrative.add",
          "source.upsert",
          "link.add",
        ])
        .describe("Command name"),
      args: z.record(z.string(), z.unknown()).describe("Arguments for the command"),
      summary: z.string().max(300).optional().describe("One-line human summary for the record log"),
    },
  },
  ({ action, args, summary }) =>
    guard(async () => {
      const data = await bridge(
        "/sk/commands",
        {
          method: "POST",
          body: JSON.stringify({ action, args, summary: summary || "" }),
        },
        10_000,
      );
      return text(
        `Queued ${action}${data?.command?.id ? ` (${data.command.id})` : ""}. ` +
          "SkeletonKey will apply it on its next sync if HQ link is enabled.",
      );
    }),
);

server.registerTool(
  "hq_commands",
  {
    title: "Pending HQ changes",
    description: "List queued SkeletonKey changes that have not been applied or rejected yet.",
    inputSchema: {},
  },
  () =>
    guard(async () => {
      const data = await bridge("/sk/commands", {}, 10_000);
      return json(data.items || []);
    }),
);

// ---------------------------------------------------------------------------
// Case Worker reads
// ---------------------------------------------------------------------------

server.registerTool(
  "case_plan",
  {
    title: "Read the plan",
    description:
      "Plan steps from the SkeletonKey record. Defaults to open steps. Returns ids you can " +
      "use with hq_command plan.update.",
    inputSchema: {
      status: z.enum(["todo", "doing", "done", "blocked"]).optional(),
      section: z.string().max(120).optional(),
      query: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
  },
  ({ status, section, query, limit }) =>
    guard(async () => {
      const state = await getState();
      let rows = state.roadmap || [];
      if (status) rows = rows.filter((row) => row.status === status);
      else rows = rows.filter((row) => row.status !== "done");
      if (section) rows = rows.filter((row) => row.section.toLowerCase() === section.toLowerCase());
      if (query) {
        const needle = query.toLowerCase();
        rows = rows.filter((row) => `${row.title} ${row.section}`.toLowerCase().includes(needle));
      }
      rows = [...rows].sort((a, b) => String(a.due || "9999").localeCompare(String(b.due || "9999")));
      return json(
        rows.slice(0, limit ?? 50).map((row) => ({
          id: row.id,
          section: row.section,
          title: row.title,
          status: row.status,
          due: row.due,
          lastNote: row.notes?.length ? trim(row.notes[row.notes.length - 1].text, 240) : "",
          attachments: row.docs?.length || 0,
        })),
      );
    }),
);

server.registerTool(
  "case_money",
  {
    title: "Read money",
    description:
      "Monthly income/expenses/net, expected-but-unreceived money, and recent transactions " +
      "from the SkeletonKey record.",
    inputSchema: {
      month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM (default this month)"),
      limit: z.number().int().min(1).max(200).optional(),
    },
  },
  ({ month, limit }) =>
    guard(async () => {
      const state = await getState();
      const target = month || new Date().toISOString().slice(0, 7);
      let income = 0;
      let spent = 0;
      const rows = [];
      for (const row of state.transactions || []) {
        if (!String(row.date || "").startsWith(target)) continue;
        if (row.kind === "income") income += Number(row.amount) || 0;
        else spent += Number(row.amount) || 0;
        rows.push(row);
      }
      const owed = (state.expected || []).filter((row) => row.status === "expected");
      return json({
        month: target,
        income: Math.round(income * 100) / 100,
        spent: Math.round(spent * 100) / 100,
        net: Math.round((income - spent) * 100) / 100,
        expected: owed.map((row) => ({ id: row.id, desc: row.desc, amount: row.amount, date: row.date })),
        expectedTotal: Math.round(owed.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) * 100) / 100,
        transactions: rows
          .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          .slice(0, limit ?? 50),
      });
    }),
);

server.registerTool(
  "case_documents",
  {
    title: "Read document metadata",
    description:
      "Document names, review status, dates, and notes. Never returns document contents; " +
      "contents only enter a prompt through an explicit action in the app.",
    inputSchema: {
      status: z.enum(["new", "reviewed"]).optional(),
      query: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
  },
  ({ status, query, limit }) =>
    guard(async () => {
      const state = await getState();
      let rows = state.documents || [];
      if (status) rows = rows.filter((row) => row.status === status);
      if (query) {
        const needle = query.toLowerCase();
        rows = rows.filter((row) => `${row.name} ${row.note}`.toLowerCase().includes(needle));
      }
      return json(
        rows.slice(0, limit ?? 100).map((row) => ({
          id: row.id,
          name: row.name,
          type: row.type,
          size: row.size,
          uploaded: row.uploaded,
          status: row.status,
          processedAt: row.processedAt,
          note: row.note,
        })),
      );
    }),
);

// ---------------------------------------------------------------------------
// Story reads
// ---------------------------------------------------------------------------

server.registerTool(
  "story_entities",
  {
    title: "Read entities and places",
    description: "People, organizations, accounts, things, concepts, and named places in the record.",
    inputSchema: {
      kind: z.string().max(40).optional(),
      query: z.string().max(200).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
  },
  ({ kind, query, limit }) =>
    guard(async () => {
      const state = await getState();
      const needle = (query || "").toLowerCase();
      let entities = state.entities || [];
      let places = state.places || [];
      if (kind) entities = entities.filter((row) => row.kind === kind);
      if (needle) {
        entities = entities.filter((row) => `${row.name} ${row.description}`.toLowerCase().includes(needle));
        places = places.filter((row) => `${row.name} ${row.address} ${row.notes}`.toLowerCase().includes(needle));
      }
      const max = limit ?? 50;
      return json({
        entities: entities.slice(0, max).map((row) => ({
          id: row.id,
          kind: row.kind,
          name: row.name,
          description: trim(row.description, 300),
          confidence: row.confidence,
          tags: row.tags,
        })),
        places: places.slice(0, max).map((row) => ({
          id: row.id,
          name: row.name,
          kind: row.kind,
          address: row.address,
          lat: row.lat,
          lon: row.lon,
          notes: trim(row.notes, 300),
        })),
      });
    }),
);

server.registerTool(
  "story_timeline",
  {
    title: "Read timelines and events",
    description:
      "Timelines (main/branch) and their events, sorted by date. Use ids with hq_command event.add.",
    inputSchema: {
      timelineId: z.string().max(64).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    },
  },
  ({ timelineId, limit }) =>
    guard(async () => {
      const state = await getState();
      const events = (state.events || [])
        .filter((row) => !timelineId || row.timelineId === timelineId)
        .sort((a, b) => String(a.date || "9999").localeCompare(String(b.date || "9999")));
      return json({
        timelines: (state.timelines || []).map((row) => ({
          id: row.id,
          name: row.name,
          isMain: row.isMain,
          startDate: row.startDate,
          endDate: row.endDate,
          parentTimelineId: row.parentTimelineId,
          branchFromEventId: row.branchFromEventId,
        })),
        events: events.slice(0, limit ?? 200).map((row) => ({
          id: row.id,
          title: row.title,
          date: row.date,
          kind: row.kind,
          timelineId: row.timelineId,
          placeId: row.placeId,
          description: trim(row.description, 300),
          confidence: row.confidence,
        })),
      });
    }),
);

server.registerTool(
  "story_narrative",
  {
    title: "Read narratives",
    description:
      "Narrative tiers (raw, digest, story, legend) with their scenes and links. Text is " +
      "limited to a preview unless includeText is true.",
    inputSchema: {
      tier: z.enum(["raw", "digest", "story", "legend"]).optional(),
      includeText: z.boolean().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  ({ tier, includeText, limit }) =>
    guard(async () => {
      const state = await getState();
      let rows = state.narratives || [];
      if (tier) rows = rows.filter((row) => row.tier === tier);
      return json(
        rows.slice(0, limit ?? 30).map((row) => ({
          id: row.id,
          title: row.title,
          tier: row.tier,
          voice: row.voice,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
          scenes: row.scenes?.length || 0,
          eventIds: row.eventIds?.length || 0,
          text: includeText ? trim(row.text, 6000) : trim(row.text, 300),
        })),
      );
    }),
);

// ---------------------------------------------------------------------------
// Beacon
// ---------------------------------------------------------------------------

server.registerTool(
  "beacon_position",
  {
    title: "Current phone position",
    description:
      "Latest location reported by the phone beacon (the user's live position). Returns lat/lon " +
      "plus speed/heading/accuracy/battery and how stale it is. Feed the lat,lon to geo_reverse " +
      "or geo_route for an address or directions.",
    inputSchema: {},
  },
  () =>
    guard(async () => {
      const live = await sousSafe();
      if (live) {
        const position = live.store.latestPosition();
        if (position) {
          return text(
            `${position.lat.toFixed(5)},${position.lon.toFixed(5)} ±${Math.round(position.accuracy || 0)}m ` +
              `· ${age(new Date(position.ts).toISOString())}\n\n${JSON.stringify(position, null, 2)}`,
          );
        }
      }
      const data = await bridgeBeacon("/whereami?limit=1");
      const latest = data?.latest;
      if (!latest) return text("No beacon position yet.");
      return text(`${latest.lat},${latest.lon} (${age(new Date(latest.ts).toISOString())})\n\n${JSON.stringify(latest, null, 2)}`);
    }),
);

server.registerTool(
  "beacon_track",
  {
    title: "Recent phone track",
    description:
      "The most recent N location samples from the phone, oldest first. Useful for inferring " +
      "heading, movement, or direction of travel.",
    inputSchema: {
      limit: z.number().int().min(1).max(1000).optional().describe("Default 30"),
    },
  },
  ({ limit }) =>
    guard(async () => {
      const live = await sousSafe();
      if (live) return json(live.store.recentTrack(limit ?? 30));
      const data = await bridgeBeacon(`/whereami?limit=${limit ?? 30}`);
      return json(data?.track || []);
    }),
);

server.registerTool(
  "beacon_memory",
  {
    title: "Field log memory",
    description:
      "The operative's field log: recent daily digests and the latest compacted narrative. Read " +
      "at session start for continuity.",
    inputSchema: {
      limit: z.number().int().min(1).max(30).optional().describe("Digests (default 5)"),
    },
  },
  ({ limit }) =>
    guard(async () => {
      const live = await sousSafe();
      if (!live) {
        throw new Error(`Sousveillance field log not found at ${sousDir}.`);
      }
      const data = live.fieldlog.recent(limit ?? 5);
      const lines = (data.digests || []).map((row) => `- ${row.summary}`);
      if (data.narrative) {
        lines.push("", `Narrative (${data.narrative.period_start}..${data.narrative.period_end}):`, data.narrative.text);
      }
      return text(lines.join("\n") || "Field log is empty.");
    }),
);

server.registerTool(
  "beacon_note",
  {
    title: "Log a field note",
    description:
      "Append a field-log event (and mirror it to the SkeletonKey record). It rolls into the daily " +
      "digest and, later, the narrative.",
    inputSchema: {
      kind: z.string().min(1).max(60).describe("Short kind, e.g. decision, place, hazard"),
      detail: z.string().max(4000).optional(),
      lat: z.number().min(-90).max(90).optional(),
      lon: z.number().min(-180).max(180).optional(),
    },
  },
  ({ kind, detail, lat, lon }) =>
    guard(async () => {
      const results = [];
      const live = await sousSafe();
      if (live) {
        live.fieldlog.note(kind, detail || "", lat ?? null, lon ?? null);
        results.push("field log");
      }
      const queued = await bridge(
        "/sk/commands",
        {
          method: "POST",
          body: JSON.stringify({
            action: "note.add",
            args: { kind, detail: detail || "", lat, lon, source: "fieldlog" },
            summary: `Field note: ${kind}`,
          }),
        },
        10_000,
      ).catch(() => null);
      if (queued?.ok) results.push("SkeletonKey (queued)");
      if (!results.length) throw new Error("Could not log the note: no field log and no bridge.");
      return text(`Logged "${kind}" to ${results.join(" and ")}.`);
    }),
);

server.registerTool(
  "beacon_weather",
  {
    title: "Weather at the operative",
    description:
      "Cached local weather + air quality for the operative's area (~5 km cell), with data age.",
    inputSchema: {},
  },
  () =>
    guard(async () => {
      const live = await sousSafe();
      if (!live) throw new Error(`Weather cache not found under ${sousDir}.`);
      const row = live.weather.latest();
      if (!row) return text("No weather cached yet.");
      const mins = Math.round((Date.now() - row.ts) / 60_000);
      const current = row.data?.forecast?.current || {};
      const air = row.data?.air?.current || {};
      return text(
        `(~${mins} min old, ~5 km cell) ${current.temperature_2m}°C (feels ${current.apparent_temperature}°C), ` +
          `wind ${current.wind_speed_10m} km/h (gust ${current.wind_gusts_10m}), ` +
          `precip ${current.precipitation} mm, code ${current.weather_code}; ` +
          `air: US AQI ${air.us_aqi}, PM2.5 ${air.pm2_5}.`,
      );
    }),
);

server.registerTool(
  "beacon_hazards",
  {
    title: "Hazards near the operative",
    description: "Cached seismic + wildfire hazards near the operative (USGS, NIFC), with age.",
    inputSchema: {},
  },
  () =>
    guard(async () => {
      const live = await sousSafe();
      if (!live) throw new Error(`Hazard cache not found under ${sousDir}.`);
      const row = live.hazards.latest();
      if (!row) return text("No hazards cached yet.");
      const mins = Math.round((Date.now() - row.ts) / 60_000);
      const quakes = (row.data?.quakes || []).map(
        (q) => `M${q.mag} ${q.place}${q.km != null ? ` (~${q.km}km)` : ""}`,
      );
      const fires = (row.data?.fires || []).map(
        (f) => `${f.name}${f.contained != null ? ` (${f.contained}% contained)` : ""} ${Math.round(f.acres || 0)}ac`,
      );
      return text(
        `(~${mins}m old) Quakes: ${quakes.length ? quakes.join("; ") : "none"}; ` +
          `fires: ${fires.length ? fires.join("; ") : "none"}.`,
      );
    }),
);

server.registerTool(
  "beacon_say",
  {
    title: "Speak to the phone",
    description:
      "Queue a short spoken message for the phone. The app displays it and reads it aloud with " +
      "on-device text-to-speech. One or two sentences, no markdown.",
    inputSchema: {
      message: z.string().min(1).max(600).describe("Spoken line"),
    },
  },
  ({ message }) =>
    guard(async () => {
      const live = await sousSafe();
      if (live) {
        live.store.enqueueSay(message, "say");
        return text("Queued for the phone earpiece.");
      }
      await bridgeBeacon(
        "/say",
        { method: "POST", body: JSON.stringify({ message, kind: "say" }) },
        10_000,
      );
      return text("Sent to the phone beacon.");
    }),
);

// ---------------------------------------------------------------------------
// Geo
// ---------------------------------------------------------------------------

server.registerTool(
  "geo_find",
  {
    title: "Find a place",
    description: "Forward-geocode a place name with the local offline gazetteer.",
    inputSchema: {
      query: z.string().min(1).max(200),
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  ({ query, limit }) =>
    guard(async () => {
      return json(
        await bridge(`/find?q=${encodeURIComponent(query)}&limit=${limit ?? 10}`, {}, 20_000),
      );
    }),
);

server.registerTool(
  "geo_reverse",
  {
    title: "Reverse-geocode a point",
    description: "Nearest named places to a lat/lon, from the local gazetteer.",
    inputSchema: {
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      radius: z.number().int().min(50).max(50_000).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
  },
  ({ lat, lon, radius, limit }) =>
    guard(async () => {
      return json(
        await bridge(
          `/reverse?lat=${lat}&lon=${lon}&radius=${radius ?? 800}&limit=${limit ?? 15}`,
          {},
          20_000,
        ),
      );
    }),
);

server.registerTool(
  "geo_nearby",
  {
    title: "List nearby features",
    description: "Named features within a radius of a point, optionally by category.",
    inputSchema: {
      lat: z.number().min(-90).max(90),
      lon: z.number().min(-180).max(180),
      radius: z.number().int().min(50).max(50_000).optional(),
      category: z.string().max(60).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
  },
  ({ lat, lon, radius, category, limit }) =>
    guard(async () => {
      const url = new URL(`${BRIDGE}/nearby`);
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));
      url.searchParams.set("radius", String(radius ?? 3000));
      if (category) url.searchParams.set("category", category);
      url.searchParams.set("limit", String(limit ?? 50));
      return json(await bridge(url.pathname + url.search, {}, 25_000));
    }),
);

server.registerTool(
  "geo_route",
  {
    title: "Route between two points",
    description:
      "Turn-by-turn route with the local Valhalla engine. Points may be place names or 'lat,lon'.",
    inputSchema: {
      from: z.string().min(1).max(300),
      to: z.string().min(1).max(300),
      costing: z.enum(["auto", "bicycle", "pedestrian", "truck", "bus"]).optional(),
    },
  },
  ({ from, to, costing }) =>
    guard(async () => {
      return json(
        await bridge(
          "/route",
          { method: "POST", body: JSON.stringify({ from, to, costing: costing || "auto" }) },
          150_000,
        ),
      );
    }),
);

server.registerTool(
  "geo_height",
  {
    title: "Elevation / elevation profile",
    description: "Elevation at one or more points, or cumulative distance and elevation along a path.",
    inputSchema: {
      points: z
        .array(z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }))
        .min(1)
        .max(2000),
      range: z.boolean().optional(),
    },
  },
  ({ points, range }) =>
    guard(async () => {
      return json(
        await bridge(
          "/height",
          { method: "POST", body: JSON.stringify({ points, range: Boolean(range) }) },
          60_000,
        ),
      );
    }),
);

await server.connect(new StdioServerTransport());
console.error(`skeletonkey-hq MCP ready · bridge ${BRIDGE} · sousveillance ${sousDir}`);
