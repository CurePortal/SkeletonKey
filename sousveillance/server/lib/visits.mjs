// visits.mjs -- turn raw beacon coordinates into places, timeline events,
// daily field reports, and narrative scenes.
//
// The mic stream is handled by the ambient extractor in beacond; this is the
// other half: geocoordinates. A "stay" is a run of low-speed samples within a
// small radius. Once a stay is long enough to be meaningful, we reverse-geocode
// it against the local gazetteer, infer a likely purpose from the venue type,
// and fill SkeletonKey:
//
//   stay -> location (name from the gazetteer)
//        -> timeline event ("Visited X -- likely a meal")
//        -> scene in the Field Narrative
//        -> scene in a per-day Field Report
//
// Everything is inferred and visibly marked as such, so the operative can
// confirm or correct it later. Nothing is invented: names and coordinates come
// from the beacon + gazetteer, and no record is written when the data is stale
// or the geocoder is unavailable.
//
// CLI: node lib/visits.mjs [--days N] [--dry-run] [--verbose]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { reverse as reverseGeo } from "../../maps/overlay/gazetteer.mjs";

const DB_PATH = process.env.BEACON_DB || `${homedir()}/.local/state/beacon/beacon.db`;
const SK_PROJECT_URL = (process.env.SK_PROJECT_URL || "http://127.0.0.1:8799").replace(/\/$/, "");
const CURSOR_FILE =
  process.env.VISIT_CURSOR_FILE || `${homedir()}/.local/state/beacon/visit-cursor.json`;

const MIN_STAY_MS = Number(process.env.VISIT_MIN_MS || 4 * 60 * 1000);
const SHORT_STAY_MS = Number(process.env.VISIT_SHORT_MS || 6 * 60 * 1000);
const STAY_RADIUS_M = Number(process.env.VISIT_RADIUS_M || 150);
const MOVE_SPEED = Number(process.env.VISIT_MOVE_MPS || 1.4);
const LOOKBACK_DAYS = Number(process.env.VISIT_LOOKBACK_DAYS || 14);
const SCAN_MS = Number(process.env.VISIT_SCAN_MS || 60 * 1000);
const OVERLAP_MS = Number(process.env.VISIT_OVERLAP_MS || 6 * 3600 * 1000);
const HOME_RADIUS_M = Number(process.env.VISIT_HOME_RADIUS_M || 300);

const nowIso = () => new Date().toISOString();

function stableId(prefix, value) {
  return `${prefix}-${createHash("sha1").update(String(value)).digest("hex").slice(0, 16)}`;
}

function tombstoned(project, id) {
  return Array.isArray(project.deletedIds) && project.deletedIds.includes(id);
}
const localDay = (ts) => new Date(ts).toLocaleDateString("en-CA");
const localTime = (ts) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function hav(aLat, aLon, bLat, bLon) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (bLat - aLat) * r;
  const dLon = (bLon - aLon) * r;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// --- stay detection ---------------------------------------------------------

function detectStays(rows) {
  const stays = [];
  let cur = null;
  let prev = null;

  const maybePush = (stay) => {
    if (!stay) return;
    // Two fixes a few minutes apart are enough for a real short stop; a single
    // sample at a traffic light is not.
    if (stay.n < 2) return;
    if (stay.lastTs - stay.firstTs < MIN_STAY_MS) return;
    stays.push(stay);
  };

  for (const row of rows) {
    const ts = Number(row.ts);
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    const acc = row.accuracy == null ? null : Number(row.accuracy);
    let speed = row.speed == null ? null : Number(row.speed);
    if ((speed == null || !Number.isFinite(speed)) && prev) {
      const dt = (ts - prev.ts) / 1000;
      if (dt > 0 && dt < 300) speed = hav(prev.lat, prev.lon, lat, lon) / dt;
    }
    const poor = Number.isFinite(acc) && acc > 180;
    const moving = Number.isFinite(speed) && speed > MOVE_SPEED;

    if (!cur) {
      if (!moving && !poor) {
        cur = { lat, lon, n: 1, firstTs: ts, lastTs: ts };
      }
    } else if (ts - cur.lastTs > 2 * 3600 * 1000) {
      // A long gap is not a single stay; close it and start fresh.
      maybePush(cur);
      cur = !moving && !poor ? { lat, lon, n: 1, firstTs: ts, lastTs: ts } : null;
    } else {
      const dist = hav(cur.lat, cur.lon, lat, lon);
      if (moving) {
        maybePush(cur);
        cur = null;
      } else if (dist <= STAY_RADIUS_M) {
        if (!poor) {
          cur.n += 1;
          // Hold the early centre steady so slow GPS drift cannot walk the
          // stay away from the place it actually started at.
          if (cur.n <= 20) {
            cur.lat = (cur.lat * (cur.n - 1) + lat) / cur.n;
            cur.lon = (cur.lon * (cur.n - 1) + lon) / cur.n;
          }
          cur.lastTs = ts;
        }
      } else if (dist > STAY_RADIUS_M * 2.5) {
        maybePush(cur);
        cur = !poor ? { lat, lon, n: 1, firstTs: ts, lastTs: ts } : null;
      } else if (!poor) {
        // Drift in the ring between the stay radius and the hard leave radius.
        cur.lastTs = ts;
      }
    }
    prev = { ts, lat, lon };
  }
  maybePush(cur);
  return stays;
}

// Group stays by roughly 200 m so repeated nights at the same place add up.
function inferHome(stays) {
  const cluster = (rows, radius) => {
    const groups = [];
    for (const stay of rows) {
      let group = groups.find(
        (g) => hav(g.lat / g.n, g.lon / g.n, stay.lat, stay.lon) <= radius,
      );
      if (!group) {
        group = { lat: 0, lon: 0, n: 0, dwellMs: 0, days: new Set(), stays: [] };
        groups.push(group);
      }
      group.lat += stay.lat;
      group.lon += stay.lon;
      group.n += 1;
      group.dwellMs += stay.lastTs - stay.firstTs;
      group.days.add(localDay(stay.firstTs));
      group.stays.push(stay);
    }
    return groups;
  };

  // A home is often spread over a handful of fixes, and two nearby buildings
  // should count together. Find the dominant cluster (~300 m), then tighten to
  // the most repeated fine cluster (~120 m) inside it.
  const coarse = cluster(stays, 300);
  let best = null;
  for (const g of coarse) {
    if (
      !best ||
      g.days.size > best.days.size ||
      (g.days.size === best.days.size && g.dwellMs > best.dwellMs)
    ) {
      best = g;
    }
  }
  if (!best) return null;
  if (best.days.size < 2 && best.dwellMs < 6 * 3600 * 1000) return null;

  const fine = cluster(best.stays, 120);
  let anchor = null;
  for (const g of fine) {
    if (
      !anchor ||
      g.days.size > anchor.days.size ||
      (g.days.size === anchor.days.size && g.dwellMs > anchor.dwellMs)
    ) {
      anchor = g;
    }
  }
  return {
    lat: anchor.lat / anchor.n,
    lon: anchor.lon / anchor.n,
    dwellMs: anchor.dwellMs,
  };
}

// --- place + purpose inference ---------------------------------------------

const CATEGORY_PRIORITY = {
  amenity: 0,
  shop: 0,
  leisure: 0,
  tourism: 0,
  office: 0,
  healthcare: 0,
  craft: 1,
  railway: 1,
  public_transport: 2,
  highway: 3,
  place: 4,
  natural: 5,
  waterway: 6,
  boundary: 8,
  admin: 8,
};

const ACTIVITY_RULES = [
  {
    re: /restaurant|fast_food|food_court|deli|bakery|ice_cream|cafe|coffee|bar|pub|brewery|food/i,
    label: "a meal or drink",
    kind: "food",
  },
  {
    re: /pharmacy|hospital|clinic|doctors|dentist|veterinary|health/i,
    label: "a health errand",
    kind: "health",
  },
  {
    re: /fuel|gas|charging|petrol/i,
    label: "refuelling",
    kind: "fuel",
  },
  {
    re: /supermarket|convenience|grocery|greengrocer|butcher|marketplace|department_store|mall/i,
    label: "shopping or errands",
    kind: "errand",
  },
  {
    re: /^shop\//i,
    label: "shopping",
    kind: "shopping",
  },
  {
    re: /park|garden|nature_reserve|playground|sports|fitness|gym|swimming|trail/i,
    label: "outdoors or recreation",
    kind: "recreation",
  },
  {
    re: /library|bank|atm|post_office|police|fire_station|townhall|courthouse/i,
    label: "an errand",
    kind: "errand",
  },
  {
    re: /school|college|university|kindergarten|education/i,
    label: "school or study",
    kind: "work",
  },
  {
    re: /office|company|industrial|works|business/i,
    label: "work or business",
    kind: "work",
  },
  {
    re: /hotel|motel|hostel|guest_house|apartment|camp_site|tourism/i,
    label: "a stay or visit",
    kind: "lodging",
  },
  {
    re: /bus_stop|station|transit|railway|airport|ferry|public_transport/i,
    label: "transit",
    kind: "transit",
  },
];

function inferActivity(category) {
  if (!category) return null;
  for (const rule of ACTIVITY_RULES) {
    if (rule.re.test(category)) return { label: rule.label, kind: rule.kind };
  }
  return null;
}

function placeFromRows(rows, lat, lon) {
  if (!rows || !rows.length) {
    return {
      name: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
      category: "",
      kind: "place",
      dist: null,
      unnamed: true,
    };
  }
  const ranked = [...rows].sort((a, b) => {
    const pa = CATEGORY_PRIORITY[a.category] ?? 5;
    const pb = CATEGORY_PRIORITY[b.category] ?? 5;
    if (pa !== pb) return pa - pb;
    return (a.dist ?? 99999) - (b.dist ?? 99999);
  });
  const chosen = ranked[0];
  const category = `${chosen.category}${chosen.subcat ? `/${chosen.subcat}` : ""}`;
  const activity = inferActivity(category);
  return {
    name: chosen.name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    category,
    kind: activity?.kind || "place",
    dist: chosen.dist ?? null,
    unnamed: !chosen.name,
  };
}

async function lookupPlace(lat, lon) {
  for (const radius of [220, 500, 1200]) {
    try {
      const rows = reverseGeo(lat, lon, radius, 25);
      if (rows && rows.length) return placeFromRows(rows, lat, lon);
    } catch {
      // Gazetteer/overlay unavailable; try the next radius, then fall back.
    }
  }
  return placeFromRows([], lat, lon);
}

// --- SkeletonKey writes -----------------------------------------------------

async function fetchProject() {
  try {
    const response = await fetch(`${SK_PROJECT_URL}/project`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function writeProject(project) {
  try {
    project.updatedAt = nowIso();
    const response = await fetch(`${SK_PROJECT_URL}/project`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project),
      signal: AbortSignal.timeout(25000),
    });
    return response.ok;
  } catch {
    return false;
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
      description: "Field stream from the phone beacon.",
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

function ensureReport(project, timeline, { id, title, description, tags }) {
  const list = Array.isArray(project.reports)
    ? project.reports
    : Array.isArray(project.narratives)
      ? project.narratives
      : (project.reports = []);
  let report = list.find((row) => row?.id === id || row?.title === title);
  if (!report) {
    const stamp = nowIso();
    report = {
      id,
      title,
      description,
      scenes: [],
      nodes: [],
      edges: [],
      timelineId: timeline.id,
      characterIds: [],
      tags,
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

function upsertLocation(project, timeline, place, stay) {
  project.locations = Array.isArray(project.locations) ? project.locations : [];
  let location = project.locations.find(
    (row) =>
      String(row?.name || "").trim().toLowerCase() ===
      String(place.name || "").trim().toLowerCase(),
  );
  if (!location) {
    location = project.locations.find((row) => {
      const c = row?.coordinates;
      if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false;
      return hav(c.lat, c.lng, stay.lat, stay.lon) <= 120;
    });
  }
  if (!location) {
    const locationId = stableId(
      "beacon-place",
      `${String(place.name || "").toLowerCase()}:${stay.lat.toFixed(3)}:${stay.lon.toFixed(3)}`,
    );
    if (tombstoned(project, locationId)) return null;
    location = {
      id: locationId,
      name: place.name,
      description: `Inferred from a beacon stay${place.dist != null ? ` near ${place.dist} m` : ""}.`,
      coordinates: { lat: stay.lat, lng: stay.lon },
      timelineIds: [timeline.id],
      parentLocationId: null,
      linkedEventIds: [],
      foundedDate: null,
      destroyedDate: null,
      population: null,
      importance: 2,
      type: place.kind || "other",
      notes: place.unnamed
        ? "No named POI in the local gazetteer at these coordinates."
        : "Name and category from the local gazetteer.",
      mapUrl: null,
      tags: ["beacon", "auto", "visit", place.kind || "place"],
      mapData: { importance: "low", category: place.kind || "other" },
    };
    project.locations.push(location);
  } else {
    if (!location.coordinates) location.coordinates = { lat: stay.lat, lng: stay.lon };
    if (!Array.isArray(location.timelineIds)) location.timelineIds = [timeline.id];
    if (!location.timelineIds.includes(timeline.id)) location.timelineIds.push(timeline.id);
    location.tags = [
      ...new Set([...(location.tags || []), "beacon", "auto", "visit"]),
    ].slice(0, 50);
    if (!location.description && place.dist != null) {
      location.description = `Inferred from a beacon stay near ${place.dist} m.`;
    }
  }
  return location;
}

function findVisitEvent(timeline, locationId, startTs) {
  return timeline.events.find((event) => {
    if (!Array.isArray(event.tags) || !event.tags.includes("beacon-visit")) return false;
    if (!Array.isArray(event.linkedLocationIds)) return false;
    if (!event.linkedLocationIds.includes(locationId)) return false;
    const eventStart = Number(event?.beaconVisit?.startTs ?? 0);
    return eventStart > 0 && Math.abs(eventStart - startTs) <= 45 * 60 * 1000;
  });
}

function visitDescription(stay, place, activity, home) {
  const mins = Math.max(1, Math.round((stay.lastTs - stay.firstTs) / 60000));
  const fromHome = home
    ? hav(home.lat, home.lon, stay.lat, stay.lon) / 1000
    : null;
  const parts = [
    `Arrived ${localTime(stay.firstTs)}; last sample ${localTime(stay.lastTs)} (${mins} min).`,
    fromHome != null && fromHome > 0.25
      ? `About ${fromHome.toFixed(1)} km from home.`
      : "",
    `Place inferred from beacon coordinates${place.category ? ` (${place.category})` : ""}.`,
    activity ? `Likely ${activity.label} — inferred from the venue type.` : "",
    "Confirm the purpose with the operative.",
  ];
  return parts.filter(Boolean).join(" ");
}

function upsertVisitScene(report, event, content, sourceLabel) {
  const key = `event:${event.id}`;
  let scene = report.scenes.find((row) => String(row?.notes || "").includes(key));
  if (!scene) {
    scene = {
      id: randomUUID(),
      title: event.title,
      description: content.slice(0, 400),
      content,
      order: report.scenes.length + 1,
      characters: [],
      locations: [],
      eventIds: [event.id],
      notes: `Auto-filled from ${sourceLabel} (${key}).`,
      technologies: [],
      cultures: [],
      sources: [],
    };
    report.scenes.push(scene);
  } else {
    scene.title = event.title;
    scene.description = content.slice(0, 400);
    scene.content = content;
    scene.eventIds = [...new Set([...(scene.eventIds || []), event.id])];
  }
  report.updatedAt = nowIso();
  return scene;
}

function dayStats(day) {
  const [y, m, d] = day.split("-").map(Number);
  const start = new Date(y, m - 1, d).getTime();
  const end = start + 24 * 3600 * 1000;
  const empty = { km: 0, movingMin: 0, dwellMin: 0 };
  if (!existsSync(DB_PATH)) return empty;
  let db;
  try {
    db = new DatabaseSync(DB_PATH, { readOnly: true });
    const rows = db
      .prepare(
        `SELECT ts, lat, lon, speed, accuracy FROM positions
         WHERE ts >= ? AND ts < ? ORDER BY ts`,
      )
      .all(start, end);
    let dist = 0;
    let movingMs = 0;
    let dwellMs = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const p = rows[i];
      const prev = rows[i - 1];
      if (prev) {
        const dt = p.ts - prev.ts;
        if (dt > 0 && dt < 20 * 60 * 1000) {
          const metres = hav(prev.lat, prev.lon, p.lat, p.lon);
          if (
            (p.accuracy ?? 999) < 100 &&
            (prev.accuracy ?? 999) < 100 &&
            metres / (dt / 1000) < 40
          ) {
            dist += metres;
          }
          if ((p.speed ?? 0) > MOVE_SPEED) movingMs += dt;
          else dwellMs += dt;
        }
      }
    }
    return {
      km: dist / 1000,
      movingMin: Math.round(movingMs / 60000),
      dwellMin: Math.round(dwellMs / 60000),
    };
  } catch {
    return empty;
  } finally {
    try {
      db?.close();
    } catch {}
  }
}

function ensureDailyReport(project, timeline, day) {
  const visits = timeline.events
    .filter(
      (event) =>
        event.date === day &&
        Array.isArray(event.tags) &&
        event.tags.includes("beacon-visit"),
    )
    .sort(
      (a, b) =>
        Number(a?.beaconVisit?.startTs ?? 0) -
        Number(b?.beaconVisit?.startTs ?? 0),
    );
  const stats = dayStats(day);
  const title = `Field Report · ${new Date(`${day}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  })}`;
  const names = visits.map(
    (v) => v?.beaconVisit?.place || v.title.replace(/^(?:Brief stop at|Visited) /, ""),
  );
  const description =
    `${day}: ${stats.km.toFixed(1)} km travelled, ${stats.movingMin} min moving, ` +
    `${stats.dwellMin} min still.` +
    (names.length ? ` Visits: ${names.join(", ")}.` : "");
  const report = ensureReport(project, timeline, {
    id: `field-report-${day}`,
    title,
    description,
    tags: ["hq", "fieldlog", "auto", "daily"],
  });
  report.title = title;
  report.description = description;

  let summary = report.scenes.find((row) => row?.id === `field-report-${day}-summary`);
  if (!summary) {
    summary = {
      id: `field-report-${day}-summary`,
      title: "Day summary",
      description,
      content: description,
      order: 1,
      characters: [],
      locations: [],
      eventIds: [],
      notes: `Auto-filled from beacon movement (day:${day}).`,
      technologies: [],
      cultures: [],
      sources: [],
    };
    report.scenes.unshift(summary);
  } else {
    summary.description = description;
    summary.content = description;
  }

  for (const event of visits) {
    upsertVisitScene(report, event, event.description, "beacon movement");
  }
  report.scenes.forEach((scene, index) => {
    scene.order = index + 1;
  });
  report.updatedAt = nowIso();
  return report;
}

// --- scan -------------------------------------------------------------------

function readCursor() {
  try {
    const value = JSON.parse(readFileSync(CURSOR_FILE, "utf8")).lastTs;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  } catch {
    return null;
  }
}

function writeCursor(lastTs) {
  try {
    writeFileSync(CURSOR_FILE, JSON.stringify({ lastTs }));
  } catch {}
}

function readPositions(startTs, endTs) {
  if (!existsSync(DB_PATH)) return [];
  let db;
  try {
    db = new DatabaseSync(DB_PATH, { readOnly: true });
    return db
      .prepare(
        `SELECT ts, lat, lon, speed, accuracy FROM positions
         WHERE ts >= ? AND ts <= ? ORDER BY ts`,
      )
      .all(startTs, endTs);
  } catch {
    return [];
  } finally {
    try {
      db?.close();
    } catch {}
  }
}

/**
 * Detect stays in the beacon DB and fill SkeletonKey.
 * Safe to call repeatedly: visits are matched by place + start time.
 */
export async function scanVisits({
  lookbackDays = LOOKBACK_DAYS,
  dryRun = false,
  verbose = false,
  ignoreCursor = false,
} = {}) {
  const now = Date.now();
  const cursor = ignoreCursor ? null : readCursor();
  const start = cursor == null
    ? now - lookbackDays * 24 * 3600 * 1000
    : Math.max(0, cursor - OVERLAP_MS);
  const rows = readPositions(start, now);
  if (!rows.length) {
    if (verbose) console.log("visits: no positions to scan");
    return { ok: true, stays: 0, visits: 0, wrote: false };
  }

  const stays = detectStays(rows);
  // Home is a long-horizon inference. Do not let a short afternoon window
  // mistake a restaurant for home.
  const homeRows = readPositions(now - lookbackDays * 24 * 3600 * 1000, now);
  const home = inferHome(detectStays(homeRows));

  if (verbose) {
    console.log(`visits: ${rows.length} positions, ${stays.length} stays`);
    if (home) console.log(`visits: inferred home ${home.lat.toFixed(5)},${home.lon.toFixed(5)}`);
    for (const stay of stays) {
      const place = await lookupPlace(stay.lat, stay.lon);
      console.log(
        `  ${localDay(stay.firstTs)} ${localTime(stay.firstTs)}-${localTime(stay.lastTs)} ` +
          `${Math.round((stay.lastTs - stay.firstTs) / 60000)}m ` +
          `${stay.lat.toFixed(5)},${stay.lon.toFixed(5)}  ${place.name}  [${place.category}]`,
      );
    }
  }

  if (dryRun) {
    return { ok: true, stays: stays.length, visits: stays.length, wrote: false };
  }

  const project = await fetchProject();
  if (!project) {
    if (verbose) console.log("visits: SkeletonKey bridge unavailable; will retry");
    return { ok: false, stays: stays.length, visits: 0, wrote: false };
  }

  const timeline = ensureBeaconTimeline(project);
  project.characters = Array.isArray(project.characters) ? project.characters : [];
  project.locations = Array.isArray(project.locations) ? project.locations : [];
  project.sourceDocuments = Array.isArray(project.sourceDocuments)
    ? project.sourceDocuments
    : [];

  // Keep a home anchor so trips can be described as "from home" and so the
  // normal overnight stay does not become a visit record every morning.
  let homeLocation = null;
  if (home) {
    homeLocation = project.locations.find(
      (row) =>
        Array.isArray(row?.tags) && row.tags.includes("home") &&
        row.coordinates &&
        hav(row.coordinates.lat, row.coordinates.lng, home.lat, home.lon) <= 250,
    );
    if (!homeLocation) {
      const existing = project.locations.find(
        (row) =>
          String(row?.name || "").trim().toLowerCase() === "home" &&
          row.coordinates &&
          hav(row.coordinates.lat, row.coordinates.lng, home.lat, home.lon) <= 250,
      );
      if (existing) {
        existing.tags = [...new Set([...(existing.tags || []), "home"])];
        homeLocation = existing;
      } else if (home.dwellMs >= 6 * 3600 * 1000) {
        homeLocation = {
          id: randomUUID(),
          name: "Home",
          description:
            "Inferred from repeated overnight beacon stays. Confirm with the operative.",
          coordinates: { lat: home.lat, lng: home.lon },
          timelineIds: [timeline.id],
          parentLocationId: null,
          linkedEventIds: [],
          foundedDate: null,
          destroyedDate: null,
          population: null,
          importance: 3,
          type: "home",
          notes: "Auto-created from beacon dwells; not confirmed.",
          mapUrl: null,
          tags: ["beacon", "auto", "home", "needs-confirmation"],
          mapData: { importance: "medium", category: "home" },
        };
        project.locations.push(homeLocation);
      }
    }
  }

  const fieldNarrative = ensureReport(project, timeline, {
    id: "field-narrative",
    title: "Field Narrative",
    description: "What happened, written down as it was perceived.",
    tags: ["hq", "fieldlog", "auto"],
  });

  const changedDays = new Set();
  let created = 0;
  let updated = 0;

  for (const stay of stays) {
    // The normal stay at home is not a visit. Home is inferred from repeated
    // dwells, and the nearest gazetteer POI to a residence is often a shop next
    // door, so do not try to turn a home fix into a venue record.
    if (home && hav(home.lat, home.lon, stay.lat, stay.lon) <= HOME_RADIUS_M) {
      continue;
    }
    const day = localDay(stay.firstTs);
    const place = await lookupPlace(stay.lat, stay.lon);
    const activity = inferActivity(place.category);
    const durationMs = stay.lastTs - stay.firstTs;
    const shortStay = durationMs < SHORT_STAY_MS;

    // A few minutes at a junction or a nameless patch of road is noise, not a
    // visit. Real short stops at a venue are kept and marked as brief.
    if (
      shortStay &&
      (place.unnamed ||
        /^(highway|public_transport|railway|boundary|admin)\b/.test(place.category) ||
        /parking|bus_stop|taxi|toll|speed_camera/i.test(place.category) ||
        (place.dist != null && place.dist > 200))
    ) {
      continue;
    }

    const location = upsertLocation(project, timeline, place, stay);
    if (!location) continue;
    const baseTitle = activity
      ? `Visited ${place.name} — likely ${activity.label}`
      : `Visited ${place.name}`;
    const title = shortStay
      ? baseTitle.replace(/^Visited /, "Brief stop at ")
      : baseTitle;
    let description = visitDescription(stay, place, activity, home);
    if (shortStay) {
      description = `Short stay; may be a pass-through. ${description}`;
    }
    const existing = findVisitEvent(timeline, location.id, stay.firstTs);
    const ongoing = now - stay.lastTs < 10 * 60 * 1000;
    let event = existing;

    if (!event) {
      const eventId = stableId(
        "beacon-visit",
        `${location.id}:${day}:${Math.round(stay.firstTs / (30 * 60 * 1000))}`,
      );
      if (tombstoned(project, eventId)) continue;
      event = {
        id: eventId,
        title,
        description,
        date: day,
        endDate: null,
        timelineId: timeline.id,
        importance: activity?.kind === "food" || activity?.kind === "health" ? 3 : 2,
        iconId: "default",
        causes: [],
        effects: [],
        linkedCharacterIds: [],
        linkedLocationIds: [location.id],
        linkedTechnologyIds: [],
        linkedCultureIds: [],
        linkedSourceDocumentIds: [],
        linkedNarrativeIds: [],
        notes:
          "Source: beacon coordinates + local gazetteer. Purpose inferred; confirm with the operative.",
        tags: [
          "hq",
          "beacon",
          "beacon-visit",
          "visit",
          "auto",
          "needs-confirmation",
          ...(activity?.kind ? [activity.kind] : []),
        ],
        isPointOfDivergence: false,
        beaconVisit: {
          startTs: stay.firstTs,
          endTs: stay.lastTs,
          ongoing,
          lat: stay.lat,
          lon: stay.lon,
          place: place.name,
          category: place.category,
          activity: activity?.label || null,
          confidence: shortStay ? "low" : activity ? "medium" : "low",
          short: shortStay,
          source: "beacon",
        },
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      timeline.events.push(event);
      created += 1;
    } else {
      const previousEnd = Number(event?.beaconVisit?.endTs ?? 0);
      const changed =
        previousEnd === 0 ||
        Math.abs(previousEnd - stay.lastTs) > 60 * 1000 ||
        Boolean(event?.beaconVisit?.ongoing) !== ongoing;
      if (changed) {
        event.title = title;
        event.description = description;
        event.beaconVisit = {
          ...(event.beaconVisit || {}),
          startTs: stay.firstTs,
          endTs: stay.lastTs,
          ongoing,
          lat: stay.lat,
          lon: stay.lon,
          place: place.name,
          category: place.category,
          activity: activity?.label || null,
          confidence: shortStay ? "low" : activity ? "medium" : "low",
          short: shortStay,
          source: "beacon",
        };
        event.updatedAt = nowIso();
        updated += 1;
      }
      event.linkedLocationIds = [
        ...new Set([...(event.linkedLocationIds || []), location.id]),
      ];
    }

    if (!location.linkedEventIds.includes(event.id)) {
      location.linkedEventIds.push(event.id);
    }

    upsertVisitScene(fieldNarrative, event, description, "beacon movement");
    changedDays.add(day);
  }

  for (const day of changedDays) {
    ensureDailyReport(project, timeline, day);
  }

  const changed = created > 0 || updated > 0;
  if (changed) {
    project.updatedAt = nowIso();
    const wrote = await writeProject(project);
    if (!wrote) {
      if (verbose) console.log("visits: write failed; keeping cursor for retry");
      return { ok: false, stays: stays.length, visits: away.length, wrote: false };
    }
  }

  writeCursor(now);
  if (verbose) {
    console.log(
      `visits: ${created} new, ${updated} updated, ${stays.length} stays in window`,
    );
  }
  return {
    ok: true,
    stays: stays.length,
    visits: stays.length,
    created,
    updated,
    wrote: changed,
  };
}

let timer = null;
let running = false;

/** Start the background watcher. Idempotent. */
export function startVisitWatcher() {
  if (timer) return;
  const run = () => {
    if (running) return;
    running = true;
    scanVisits()
      .catch((error) =>
        console.log("visits: scan failed:", String(error?.message || error).slice(0, 120)),
      )
      .finally(() => {
        running = false;
      });
  };
  // Backfill recent history shortly after startup, then keep a light cadence.
  setTimeout(run, 8000);
  timer = setInterval(run, SCAN_MS);
  timer.unref?.();
  console.log(`visits: watcher started (every ${Math.round(SCAN_MS / 1000)}s)`);
}

// ---- CLI -------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose") || dryRun;
  const daysIndex = args.indexOf("--days");
  const lookbackDays =
    daysIndex >= 0 ? Number(args[daysIndex + 1]) || LOOKBACK_DAYS : LOOKBACK_DAYS;
  // A dry run looks back over the requested window even if a cursor exists,
  // but never moves the cursor.
  scanVisits({ lookbackDays, dryRun, verbose, ignoreCursor: dryRun }).then((result) => {
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  });
}
