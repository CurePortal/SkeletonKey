// MCP server exposing the phone beacon to opencode.
//
// Reads the phone's position straight from the shared SQLite store (no HTTP),
// and queues spoken/text messages into the same outbox that beacond.mjs drains
// to the connected phone. Spawned by opencode over stdio -- stdout must carry
// MCP frames only.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { latestPosition, recentTrack, enqueueSay } from "./lib/store.mjs";
import { recent, note } from "./fieldlog.mjs";
import { latest as latestWeather } from "./weather.mjs";
import { latest as latestHazards } from "./hazards.mjs";
import {
  extensionList,
  proposeExtension,
  decideExtension,
} from "./lib/extensions.mjs";

const server = new McpServer({ name: "beacon", version: "0.1.0" });

function ageSeconds(ts) {
  return Math.max(0, Math.round((Date.now() - ts) / 1000));
}

function describe(p) {
  if (!p) return "no position received yet";
  const bits = [`${p.lat.toFixed(5)},${p.lon.toFixed(5)}`];
  if (p.accuracy != null) bits.push(`±${Math.round(p.accuracy)}m`);
  if (p.speed != null) bits.push(`speed ${p.speed.toFixed(1)}m/s`);
  if (p.heading != null) bits.push(`heading ${Math.round(p.heading)}°`);
  if (p.battery != null) bits.push(`battery ${Math.round(p.battery)}%`);
  bits.push(`source ${p.source || "?"}`);
  bits.push(`age ${ageSeconds(p.ts)}s`);
  return bits.join("  ");
}

server.registerTool(
  "beacon_position",
  {
    title: "Current phone position",
    description:
      "Latest location reported by the phone beacon (the user's live position). " +
      "Returns lat/lon plus speed/heading/accuracy/battery and how stale it is. " +
      "Use this to answer 'where am I' / 'how far to X' -- feed the lat,lon to the `geo` CLI " +
      "(geo reverse / geo route) for an address or directions.",
    inputSchema: {},
  },
  async () => {
    const p = latestPosition();
    if (!p) {
      return { content: [{ type: "text", text: "No beacon position yet -- the phone app may not be reporting." }] };
    }
    return {
      content: [
        { type: "text", text: describe(p) },
        { type: "text", text: JSON.stringify(p) },
      ],
    };
  },
);

server.registerTool(
  "beacon_track",
  {
    title: "Recent phone track",
    description:
      "The most recent N location samples from the phone, oldest first. Useful for " +
      "inferring heading-of-travel, whether the user is moving or stopped, or which " +
      "way they've been heading. Each row: {ts, lat, lon, speed, heading, accuracy}.",
    inputSchema: {
      limit: z.number().int().min(1).max(1000).optional().describe("How many recent samples (default 30)."),
    },
  },
  async ({ limit }) => {
    const rows = recentTrack(limit ?? 30);
    if (!rows.length) return { content: [{ type: "text", text: "No track samples yet." }] };
    return { content: [{ type: "text", text: JSON.stringify(rows) }] };
  },
);

server.registerTool(
  "beacon_memory",
  {
    title: "Field log (memory)",
    description:
      "The operative's field log: recent daily digests and the latest compacted narrative. " +
      "Read this at the start of a session for continuity — their rhythms, stay points, and " +
      "recent events — so you don't start cold.",
    inputSchema: {
      limit: z.number().int().min(1).max(30).optional().describe("How many recent digests (default 5)."),
    },
  },
  async ({ limit }) => {
    const r = recent(limit ?? 5);
    const lines = r.digests.map((d) => `- ${d.summary}`);
    if (r.narrative) {
      lines.push("", `Narrative (${r.narrative.period_start}..${r.narrative.period_end}):`, r.narrative.text);
    }
    return { content: [{ type: "text", text: lines.join("\n") || "Field log is empty." }] };
  },
);

server.registerTool(
  "beacon_note",
  {
    title: "Log a field event",
    description:
      "Append an event to the operative's field log — a notable turn, a place worth remembering, " +
      "or a watch trigger. It rolls into the daily digest and, later, the narrative.",
    inputSchema: {
      kind: z.string().describe("Short event kind, e.g. 'decision', 'place', 'hazard'"),
      detail: z.string().optional(),
      lat: z.number().optional(),
      lon: z.number().optional(),
    },
  },
  async ({ kind, detail, lat, lon }) => {
    note(kind, detail ?? "", lat ?? null, lon ?? null);
    return { content: [{ type: "text", text: `Logged: ${kind}` }] };
  },
);

server.registerTool(
  "beacon_weather",
  {
    title: "Weather at the operative",
    description:
      "Cached local weather + air quality (Open-Meteo) for the operative's area, with how fresh it is. " +
      "Coordinates were truncated to ~5 km before fetching. Use to warn about storm, heat, wind, or smoke — " +
      "and always state the data's age.",
    inputSchema: {},
  },
  async () => {
    const w = latestWeather();
    if (!w) return { content: [{ type: "text", text: "No weather cached yet." }] };
    const age = Math.round((Date.now() - w.ts) / 60000);
    const c = w.data.forecast?.current || {};
    const a = w.data.air?.current || {};
    const h = w.data.forecast?.hourly || {};
    const rainProb = Array.isArray(h.precipitation_probability)
      ? Math.max(...h.precipitation_probability.slice(0, 6))
      : null;
    return {
      content: [
        {
          type: "text",
          text:
            `Weather (~${age} min old, ~5 km cell): ` +
            `${c.temperature_2m}°C (feels ${c.apparent_temperature}°C), wind ${c.wind_speed_10m} km/h (gust ${c.wind_gusts_10m}), ` +
            `precip ${c.precipitation} mm, code ${c.weather_code}` +
            (rainProb != null ? `, max rain-chance next 6h ${rainProb}%` : "") +
            `; air: US AQI ${a.us_aqi}, PM2.5 ${a.pm2_5}.`,
        },
      ],
    };
  },
);

server.registerTool(
  "beacon_hazards",
  {
    title: "Hazards near the operative",
    description:
      "Cached seismic + wildfire hazards near the operative (USGS, NIFC), with age. " +
      "Use to warn about earthquakes or fire — state severity, distance and data age.",
    inputSchema: {},
  },
  async () => {
    const h = latestHazards();
    if (!h) return { content: [{ type: "text", text: "No hazards cached yet." }] };
    const age = Math.round((Date.now() - h.ts) / 60000);
    const q = (h.data.quakes || []).map(
      (x) => `M${x.mag} ${x.place}${x.km != null ? ` (~${x.km}km)` : ""} ${new Date(x.t).toISOString().slice(0, 10)}`,
    );
    const f = (h.data.fires || []).map(
      (x) => `${x.name}${x.contained != null ? ` (${x.contained}% contained, ` : " ("}${Math.round(x.acres || 0)}ac)`,
    );
    return {
      content: [
        {
          type: "text",
          text: `Hazards (~${age}m old): quakes: ${q.length ? q.join("; ") : "none"}; fires: ${f.length ? f.join("; ") : "none"}.`,
        },
      ],
    };
  },
);

server.registerTool(
  "beacon_say",
  {
    title: "Speak to the phone",
    description:
      "Send a text message to the user's phone; the app displays it and reads it aloud " +
      "with on-device text-to-speech. Delivery happens as soon as the phone is connected " +
      "(messages queue otherwise). This is how the agent proactively tells the user something.\n\n" +
      "VOICE — mission control. You are the handler talking into the operative's earpiece " +
      "while they are on assignment. Rules:\n" +
      "  - One or two sentences. Spoken-word, present tense, second person ('you've got…', 'move now').\n" +
      "  - Calm, competent, quietly urgent. Field-HQ framing: distance/bearing, timing windows, " +
      "position, status ('hold position', 'you're clear', 'company inbound'). A light callsign " +
      "is fine (e.g. 'Operative' or 'Echo'), but do not overdo it.\n" +
      "  - No markdown, no lists, no emoji, no code. It is read aloud, so it must sound like speech.\n" +
      "  - ACCURACY FIRST: never invent threats, names, or facts. The mission color must wrap the " +
      "real information, not replace it — the operative still needs the true bearing/distance/status.\n" +
      "  - If the news is mundane, keep the drama low and the facts exact.",
    inputSchema: {
      message: z.string().min(1).max(2000).describe("The text to display and speak."),
    },
  },
  async ({ message }) => {
    enqueueSay(message, "say");
    return { content: [{ type: "text", text: `Queued for the phone: ${message}` }] };
  },
);

server.registerTool(
  "beacon_extensions",
  {
    title: "Self-extension proposals",
    description:
      "List extension proposals HQ has noticed: a missing local tool, MCP, skill, or automation " +
      "that would close a real gap. Proposals wait for the operative's explicit yes/no. " +
      "Read the pending one before acting on a 'yes'. Read-only.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).optional(),
      status: z.enum(["pending", "approved", "denied", "expired", "all"]).optional(),
    },
  },
  async ({ limit, status }) => {
    const rows = extensionList(limit ?? 10, status ?? "all");
    if (!rows.length) {
      return { content: [{ type: "text", text: "No extension proposals recorded." }] };
    }
    const summary = rows
      .map((row) =>
        [
          `[${row.status}] ${row.kind} · risk ${row.risk || "?"} · ${new Date(row.ts).toISOString()}`,
          `Gap: ${row.gap}`,
          `Proposal: ${row.proposal}`,
          row.why ? `Why: ${row.why}` : "",
          row.requires ? `Requires: ${row.requires}` : "",
          `Id: ${row.id}`,
        ]
          .filter(Boolean)
          .join("\n"),
      )
      .join("\n\n");
    return {
      content: [
        { type: "text", text: summary },
        { type: "text", text: JSON.stringify(rows, null, 2) },
      ],
    };
  },
);

server.registerTool(
  "beacon_extension_propose",
  {
    title: "Propose a self-extension",
    description:
      "Ask the operative to authorize a small extension of HQ: a local tool, MCP, skill, or " +
      "automation that would close a real gap. Records the proposal and queues a spoken " +
      "yes/no question to the phone and WhatsApp. Does NOT build anything. Use only for a " +
      "concrete, recurring or high-value need — never for a one-off curiosity, never to profile " +
      "or track people, and never to weaken privacy or permissions.",
    inputSchema: {
      kind: z.enum(["tool", "mcp", "skill", "agent", "integration", "automation", "other"]),
      gap: z.string().min(3).max(300).describe("The capability that is missing."),
      proposal: z.string().min(3).max(300).describe("The smallest local extension that would close it."),
      why: z.string().max(500).optional().describe("How it would improve the operative's outcome."),
      risk: z.enum(["low", "medium", "high"]).optional(),
      requires: z.string().max(400).optional().describe("Access, dependencies, or restart it would need."),
    },
  },
  async (input) => {
    const result = proposeExtension(input);
    if (!result.ok) {
      const reason = result.error || `skipped: ${result.skipped}`;
      return {
        content: [{ type: "text", text: `Proposal not sent (${reason}).` }],
        isError: Boolean(result.error),
      };
    }
    return {
      content: [
        {
          type: "text",
          text:
            `Proposal recorded and the operative has been asked: ${result.message}\n` +
            `Id: ${result.proposal.id}. Do not build it until they say yes; ` +
            `then call beacon_extension_decide with approved.`,
        },
        { type: "text", text: JSON.stringify(result.proposal, null, 2) },
      ],
    };
  },
);

server.registerTool(
  "beacon_extension_decide",
  {
    title: "Decide a self-extension proposal",
    description:
      "Record the operative's explicit decision on a proposal: approved or denied. " +
      "Changes state; use only after they answer yes or no. Approving does not build it — " +
      "implement the smallest safe extension afterwards and report what changed.",
    inputSchema: {
      id: z.string().min(1).describe("Proposal id from beacon_extensions."),
      decision: z.enum(["approved", "denied"]),
      note: z.string().max(300).optional().describe("Short reason or condition from the operative."),
    },
  },
  async ({ id, decision, note: detail }) => {
    const result = decideExtension(id, decision, detail || "");
    if (!result.ok) {
      return { content: [{ type: "text", text: result.error }], isError: true };
    }
    return {
      content: [
        {
          type: "text",
          text: `Proposal ${result.proposal.id} is now ${result.proposal.status}.`,
        },
        { type: "text", text: JSON.stringify(result.proposal, null, 2) },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
