// geo MCP server: exposes the local `geo` CLI (Valhalla) as read-only tools so
// agents can do geocoding/routing WITHOUT shell access. Mirrors the pattern of
// the beacon/whatsapp MCP servers: spawned by opencode over stdio, stdout
// carries MCP frames only.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { lookup, reverse, nearby } from "./overlay/gazetteer.mjs";

const run = promisify(execFile);
const GEO = process.env.GEO_BIN || new URL("./geo", import.meta.url).pathname;

// Valhalla has no geocoder in this build, so name<->coords use the local
// gazetteer (overlay store) instead.
function fmt(rows) {
  if (rows == null) return "The context gazetteer isn't built yet (no overlay store).";
  if (!rows.length) return "No matching named features.";
  return rows
    .map((r) =>
      `${r.lat.toFixed(5)},${r.lon.toFixed(5)}  ${r.name ?? "(unnamed)"}  ` +
      `[${r.category ?? "?"}${r.subcat ? "/" + r.subcat : ""}]` +
      (r.dist != null ? `  ${r.dist}m` : ""))
    .join("\n");
}

async function geo(args) {
  try {
    const { stdout, stderr } = await run(GEO, args, {
      timeout: 120000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const out = (stdout || "").trim();
    return out || (stderr || "").trim() || "(no output)";
  } catch (err) {
    const msg = (err.stderr || "").toString().trim() || err.message;
    return `geo error: ${msg}`;
  }
}

const server = new McpServer({ name: "geo", version: "0.1.0" });

const VALHALLA = process.env.VALHALLA_URL || "http://localhost:8002";
async function valhalla(path, body) {
  try {
    const r = await fetch(`${VALHALLA}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    return await r.text();
  } catch (e) {
    return `valhalla error: ${e.message}`;
  }
}

server.registerTool(
  "geo_height",
  {
    title: "Elevation / terrain",
    description:
      "Elevation at one or more points, or elevation gain/loss along a path (range:true). " +
      "Offline (a DEM is loaded for California). Use to judge climb, grade, and steep ground.",
    inputSchema: {
      points: z
        .array(z.object({ lat: z.number(), lon: z.number() }))
        .min(1)
        .describe("One or more points"),
      range: z
        .boolean()
        .optional()
        .describe("true = also return cumulative distance + elevation along the path"),
    },
  },
  async ({ points, range }) => ({
    content: [{ type: "text", text: await valhalla("/height", { shape: points, range: !!range }) }],
  }),
);

server.registerTool(
  "geo_status",
  {
    title: "Valhalla engine status",
    description: "Health/version of the local offline routing engine. Use to check whether routing/geocoding is available.",
    inputSchema: {},
  },
  async () => ({ content: [{ type: "text", text: await geo(["status"]) }] }),
);

server.registerTool(
  "geo_reverse",
  {
    title: "Coordinates -> nearest named places",
    description:
      "Reverse-lookup a lat/lon against the local gazetteer: the named places and POIs " +
      "nearest to that point, closest first (name, category, distance). Use with " +
      "beacon_position to describe where the operative is and what is around them.",
    inputSchema: {
      lat: z.number().describe("Latitude"),
      lon: z.number().describe("Longitude"),
      radius_m: z.number().int().optional().describe("Search radius in metres (default 2500)"),
    },
  },
  async ({ lat, lon, radius_m }) => ({
    content: [{ type: "text", text: fmt(reverse(lat, lon, radius_m ?? 2500)) }],
  }),
);

server.registerTool(
  "geo_lookup",
  {
    title: "Place name -> coordinates",
    description:
      "Forward-lookup a place name against the local gazetteer (cities, towns, POIs) and " +
      "return matching coordinates. Use to turn a place name into a point for geo_route.",
    inputSchema: {
      name: z.string().describe("Place or POI name to look up"),
      limit: z.number().int().optional().describe("Max results (default 10)"),
    },
  },
  async ({ name, limit }) => ({
    content: [{ type: "text", text: fmt(lookup(name, limit ?? 10)) }],
  }),
);

server.registerTool(
  "geo_nearby",
  {
    title: "What's around a point",
    description:
      "List named features within a radius of a point, optionally filtered by category " +
      "(e.g. amenity, shop, tourism, healthcare, place, natural, waterway). Use to build a " +
      "picture of the operative's surroundings.",
    inputSchema: {
      lat: z.number(),
      lon: z.number(),
      radius_m: z.number().int().optional().describe("Radius in metres (default 3000)"),
      category: z.string().optional().describe("Filter to one category, e.g. amenity"),
      limit: z.number().int().optional().describe("Max results (default 50)"),
    },
  },
  async ({ lat, lon, radius_m, category, limit }) => ({
    content: [{ type: "text", text: fmt(nearby(lat, lon, radius_m ?? 3000, category ?? null, limit ?? 50)) }],
  }),
);

server.registerTool(
  "geo_route",
  {
    title: "Directions A -> B",
    description:
      "Turn-by-turn route between two points, each a free-text place or 'lat,lon'. " +
      "Returns distance (km/mi), time and maneuvers. Costing: auto|pedestrian|bicycle|truck|bus.",
    inputSchema: {
      from: z.string().describe("Start: place name or 'lat,lon'"),
      to: z.string().describe("End: place name or 'lat,lon'"),
      costing: z.enum(["auto", "pedestrian", "bicycle", "truck", "bus"]).optional(),
    },
  },
  async ({ from, to, costing }) => {
    const args = [];
    if (costing) args.push("--costing", costing);
    args.push("route", from, to);
    return { content: [{ type: "text", text: await geo(args) }] };
  },
);

server.registerTool(
  "geo_find",
  {
    title: "Place name -> coordinates",
    description: "Forward geocode a place name to coordinates and labels.",
    inputSchema: { query: z.string().describe("Place name to look up") },
  },
  async ({ query }) => ({ content: [{ type: "text", text: await geo(["find", query]) }] }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
