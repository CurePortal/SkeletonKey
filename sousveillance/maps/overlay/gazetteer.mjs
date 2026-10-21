// Gazetteer queries over the overlay store (~/maps/overlay/overlay.sqlite).
// Forward lookup (name -> coords), reverse (coords -> nearest named places) and
// nearby (features within radius). Read-only. Used by the geo MCP and the `geo`
// CLI, since Valhalla itself has no geocoder.
//
// Schema: new builds use a single `features` table. Older builds have
// `places` + `pois`. Both are supported.
import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";

const DB = process.env.OVERLAY_DB || `${homedir()}/maps/overlay/overlay.sqlite`;

let _db;
function db() {
  if (!_db) _db = new DatabaseSync(DB, { readOnly: true });
  return _db;
}
function has(table) {
  try {
    return !!db().prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
  } catch {
    return false;
  }
}
function source() {
  if (has("features")) return "features";
  if (has("places") || has("pois")) return "legacy";
  return null;
}

function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function lookup(name, limit = 10) {
  const src = source();
  if (!src) return null;
  const like = `%${name}%`;
  if (src === "features") {
    return db().prepare(
      `SELECT name, category, subcat, lat, lon FROM features
       WHERE name LIKE ?
       ORDER BY (name = ?) DESC, length(name), name LIMIT ?`,
    ).all(like, name, limit);
  }
  return db().prepare(
    `SELECT name, category, subcat, lat, lon FROM places WHERE name LIKE ?
       UNION ALL
     SELECT name, category, subcat, lat, lon FROM pois WHERE name LIKE ?
     ORDER BY length(name), name LIMIT ?`,
  ).all(like, like, limit);
}

export function reverse(lat, lon, radiusM = 2500, limit = 15) {
  const src = source();
  if (!src) return null;
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.max(0.15, Math.cos((lat * Math.PI) / 180)));
  const q = (t) =>
    db().prepare(
      `SELECT name, category, subcat, lat, lon FROM ${t}
       WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? AND name IS NOT NULL`,
    ).all(lat - dLat, lat + dLat, lon - dLon, lon + dLon);
  let rows = [];
  if (src === "features") rows = q("features");
  else rows = q("places").concat(q("pois"));
  return rows
    .map((r) => ({ ...r, dist: Math.round(hav(lat, lon, r.lat, r.lon)) }))
    .filter((r) => r.dist <= radiusM)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit);
}

export function nearby(lat, lon, radiusM = 3000, category = null, limit = 50) {
  const rows = reverse(lat, lon, radiusM, 500) || [];
  const filtered = category ? rows.filter((r) => r.category === category) : rows;
  return filtered.slice(0, limit);
}

// ---- CLI --------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...args] = process.argv.slice(2);
  const fmt = (r) =>
    `${r.lat.toFixed(5)},${r.lon.toFixed(5)}  ${r.name}` +
    `  [${r.category}${r.subcat ? "/" + r.subcat : ""}]` +
    (r.dist != null ? `  ${r.dist}m` : "");
  if (cmd === "lookup") {
    const rows = lookup(args[0] || "", Number(args[1]) || 10);
    if (rows == null) { console.error("gazetteer: no overlay store"); process.exit(1); }
    if (!rows.length) { console.log("no results"); process.exit(0); }
    for (const r of rows) console.log(fmt(r));
  } else if (cmd === "reverse") {
    const rows = reverse(Number(args[0]), Number(args[1]), Number(args[2]) || 2500);
    if (rows == null) { console.error("gazetteer: no overlay store"); process.exit(1); }
    if (!rows.length) { console.log("no nearby named features"); process.exit(0); }
    for (const r of rows) console.log(fmt(r));
  } else if (cmd === "nearby") {
    const rows = nearby(Number(args[0]), Number(args[1]), Number(args[2]) || 3000, args[3] || null, Number(args[4]) || 50);
    if (rows == null) { console.error("gazetteer: no overlay store"); process.exit(1); }
    if (!rows.length) { console.log("nothing nearby"); process.exit(0); }
    for (const r of rows) console.log(fmt(r));
  } else {
    console.error("usage: gazetteer.mjs lookup <name> | reverse <lat> <lon> [radius] | nearby <lat> <lon> [radius] [category]");
    process.exit(2);
  }
}
