#!/usr/bin/env python3
# Ingest an osmium `geojsonseq` stream into the overlay store as feature rows:
# one row per named/categorised OSM feature (node, way or relation), with a
# representative point (centroid). Appends -- safe to run once per region.
#
# All layers live in ONE table (`features`) keyed by category, so a single pass
# over the retained source builds every OSM-tag layer at once (context, POIs,
# land use, water, utilities, roads, rail, transit, comms, ...).
import os, sys, json, sqlite3

DB = os.environ.get("OVERLAY_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "overlay.sqlite"))

# category keys in priority order
CAT_KEYS = (
    "place", "amenity", "shop", "tourism", "leisure", "historic", "healthcare",
    "office", "emergency", "man_made", "natural", "waterway", "highway",
    "railway", "power", "aeroway", "landuse", "barrier", "military", "boundary",
)
# a few extra tags worth carrying (bounded, to keep the DB small)
EXTRA = (
    "ref", "brand", "operator", "opening_hours", "website", "phone",
    "emergency", "crossing", "ford", "sac_scale", "trail_visibility",
    "surface", "lanes", "maxspeed", "oneway", "tower:type", "boundary",
    "admin_level", "religion", "denomination", "cuisine", "network",
)

con = sqlite3.connect(DB)
con.executescript("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
cur = con.cursor()
cur.executescript("""
CREATE TABLE IF NOT EXISTS features(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  osm_type TEXT, osm_id INTEGER,
  name TEXT, category TEXT, subcat TEXT,
  lat REAL, lon REAL, tags TEXT
);
-- Drop indexes for a fast bulk insert; rebuilt once at the end of this run.
DROP INDEX IF EXISTS idx_f_name;
DROP INDEX IF EXISTS idx_f_cat;
DROP INDEX IF EXISTS idx_f_lat;
DROP INDEX IF EXISTS idx_f_lon;
""")

def classify(tags):
    for k in CAT_KEYS:
        if k in tags:
            return k, tags[k]
    return None, None

def centroid(geom):
    t = geom.get("type")
    c = geom.get("coordinates")
    if t == "Point":
        return c[1], c[0]
    pts = []
    def flat(x):
        if isinstance(x, list) and x and isinstance(x[0], (int, float)):
            pts.append(x); return
        if isinstance(x, list):
            for y in x:
                flat(y)
    flat(c)
    if not pts:
        return None, None
    return sum(p[1] for p in pts) / len(pts), sum(p[0] for p in pts) / len(pts)

seen = kept = 0
batch = []
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    if line[0] == "\x1e":  # geojsonseq record separator
        line = line[1:]
    try:
        f = json.loads(line)
    except Exception:
        continue
    if f.get("type") != "Feature":
        continue
    seen += 1
    props = f.get("properties") or {}
    name = props.get("name")
    cat, sub = classify(props)
    if not name and not cat:
        continue
    lat, lon = centroid(f.get("geometry") or {})
    if lat is None:
        continue
    extra = {k: props[k] for k in EXTRA if k in props}
    batch.append((
        props.get("@type"), props.get("@id"), name, cat, sub, lat, lon,
        json.dumps(extra) if extra else None,
    ))
    kept += 1
    if len(batch) >= 5000:
        cur.executemany(
            "INSERT INTO features(osm_type,osm_id,name,category,subcat,lat,lon,tags) VALUES(?,?,?,?,?,?,?,?)",
            batch)
        batch.clear()

if batch:
    cur.executemany(
        "INSERT INTO features(osm_type,osm_id,name,category,subcat,lat,lon,tags) VALUES(?,?,?,?,?,?,?,?)",
        batch)
con.commit()
# Rebuild indexes once, after the bulk insert — unless this run is a shard that
# will be merged (INGEST_INDEX=0), in which case the merge builds them once.
if os.environ.get("INGEST_INDEX", "1") != "0":
    cur.executescript("""
CREATE INDEX IF NOT EXISTS idx_f_name ON features(name);
CREATE INDEX IF NOT EXISTS idx_f_cat  ON features(category);
CREATE INDEX IF NOT EXISTS idx_f_lat  ON features(lat);
CREATE INDEX IF NOT EXISTS idx_f_lon  ON features(lon);
""")
    con.commit()
print(f"ingest_all: seen {seen}, kept {kept}; db now {os.path.getsize(DB)} bytes")
con.close()
