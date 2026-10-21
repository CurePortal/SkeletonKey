#!/usr/bin/env bash
# Build EVERY OSM-tag overlay layer in one pass over the retained source:
# places, POIs, land use/cover, water, utilities (power), rail, roads, transit,
# comms towers, emergency services, admin boundaries, and more. All rows land in
# overlay.sqlite (table `features`, keyed by category).
#
# Run DETACHED. Downloads resume; the DB is rebuilt from scratch each run.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MAPS_HOME="${MAPS_HOME:-$HOME/maps}"
DIR="$MAPS_HOME/data"
OVERLAY="$MAPS_HOME/overlay"
DB="${OVERLAY_DB:-$OVERLAY/overlay.sqlite}"
INGEST="$HERE/ingest_all.py"
LOG="${OVERLAY_LOG:-$OVERLAY/build_overlay.log}"
BASE="https://download.geofabrik.de"
if [ -n "${OVERLAY_REGIONS:-}" ]; then read -r -a REGIONS <<<"$OVERLAY_REGIONS"; else
  REGIONS=(north-america central-america south-america)
fi
TMP="$DIR/.filtered.osm.pbf"

# Current-focus set (Safety + Context). Land-cover and utilities are DEFERRED in
# the plan, so we do not pull the heavy landuse/power way layers now.
NODE_F=(n/place n/amenity n/shop n/tourism n/leisure n/historic n/healthcare \
        n/office n/emergency n/man_made n/natural n/waterway n/railway \
        n/aeroway n/military n/barrier n/public_transport)
WAY_F=(w/waterway w/natural=water w/leisure=nature_reserve w/boundary=protected_area)
REL_F=(r/boundary r/waterway)

mkdir -p "$DIR" "$OVERLAY"
exec >>"$LOG" 2>&1
log() { echo "[$(date '+%F %T')] $*"; }

log "=== build_overlay start (pid $$) ==="
rm -f "$DB"

for r in "${REGIONS[@]}"; do
  src="$DIR/$r-latest.osm.pbf"
  if [ ! -f "$src.done" ]; then
    log "downloading/resuming $r (have $(du -h "$src" 2>/dev/null | cut -f1 || echo 0)) ..."
    curl -fL --retry 3 -C - -o "$src" "$BASE/$r-latest.osm.pbf" || { log "DOWNLOAD FAILED: $r"; exit 1; }
    touch "$src.done"
    log "downloaded $r ($(du -h "$src" | cut -f1))"
  fi
  log "region $r: filtering ..."
  osmium tags-filter -o "$TMP" --overwrite "$src" \
    "${NODE_F[@]}" "${WAY_F[@]}" "${REL_F[@]}" 2>>"$LOG" || { log "FILTER FAILED: $r"; exit 1; }
  log "region $r: export+ingest ($(du -h "$TMP" | cut -f1)) ..."
  osmium export -f geojsonseq "$TMP" 2>>"$LOG" | python3 "$INGEST" 2>>"$LOG" || { log "INGEST FAILED: $r"; exit 1; }
  rm -f "$TMP"
  log "region $r: done"
done

log "=== build_overlay done: overlay.sqlite = $(du -h "$DB" | cut -f1) ==="
