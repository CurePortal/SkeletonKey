#!/usr/bin/env bash
# Parallel overlay builder. Shards each region's OSM source into longitude bands,
# runs N export+ingest pipelines concurrently (into per-shard DBs), then merges
# them into one overlay.sqlite and builds the indexes once. Uses many cores
# instead of one; a full Americas rebuild drops from hours to tens of minutes.
#
# Env knobs: SHARDS (bands/region, default 4), WORKERS (default nproc/2),
# OVERLAY_REGIONS (space list), OVERLAY_DB (output path).
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MAPS_HOME="${MAPS_HOME:-$HOME/maps}"
DIR="$MAPS_HOME/data"
OVERLAY="$MAPS_HOME/overlay"
INGEST="$HERE/ingest_all.py"
MERGE="$HERE/merge_shards.py"
DB="${OVERLAY_DB:-$OVERLAY/overlay.sqlite}"
LOG="${OVERLAY_LOG:-$OVERLAY/build_parallel.log}"
BASE="https://download.geofabrik.de"
SHARDS="${SHARDS:-4}"
WORKERS="${WORKERS:-$(( $(nproc) / 2 ))}"
if [ -n "${OVERLAY_REGIONS:-}" ]; then read -r -a REGIONS <<<"$OVERLAY_REGIONS"; else
  REGIONS=(north-america central-america south-america)
fi
FILTERS=(n/place n/amenity n/shop n/tourism n/leisure n/historic n/healthcare \
         n/office n/emergency n/man_made n/natural n/waterway n/railway \
         n/aeroway n/military n/barrier n/public_transport \
         w/waterway w/natural=water w/leisure=nature_reserve w/boundary=protected_area \
         r/boundary r/waterway)
WORK="$(dirname "$DB")/.work.$$"

mkdir -p "$WORK"
exec >>"$LOG" 2>&1
log() { echo "[$(date '+%F %T')] $*"; }
log "=== parallel build start -> $DB (regions: ${REGIONS[*]}; shards=$SHARDS workers=$WORKERS) ==="

JOBS="$WORK/jobs.txt"; : >"$JOBS"
for r in "${REGIONS[@]}"; do
  src="$DIR/$r-latest.osm.pbf"
  if [ ! -f "$src.done" ]; then
    log "downloading $r ..."
    curl -fL --retry 3 -C - -o "$src" "$BASE/$r-latest.osm.pbf" || { log "DOWNLOAD FAILED $r"; exit 1; }
    touch "$src.done"
  fi
  bb=$(osmium fileinfo -e -g header.boxes "$src" | tr -d '\n()' | tr ',' ' ')
  set -- $bb; minlon=$1; minlat=$2; maxlon=$3; maxlat=$4
  log "$r bbox: $minlon $minlat $maxlon $maxlat"
  i=0
  while [ "$i" -lt "$SHARDS" ]; do
    lon0=$(awk -v a="$minlon" -v b="$maxlon" -v i="$i" -v n="$SHARDS" 'BEGIN{printf "%.4f", a+(b-a)*i/n}')
    lon1=$(awk -v a="$minlon" -v b="$maxlon" -v i="$i" -v n="$SHARDS" 'BEGIN{printf "%.4f", a+(b-a)*(i+1)/n}')
    out="$WORK/$r.shard$i.pbf"
    log "  extract $r shard $i [$lon0..$lon1]"
    osmium extract --overwrite --strategy complete_ways -b "$lon0,$minlat,$lon1,$maxlat" -o "$out" "$src" >/dev/null 2>>"$LOG" || log "  extract FAILED $r shard $i"
    [ -s "$out" ] && printf '%s\t%s\n' "$out" "$WORK/$r.shard$i.sqlite" >>"$JOBS"
    i=$((i+1))
  done
done

FILTER_STR="${FILTERS[*]}"
COUNT=$(wc -l <"$JOBS")
log "running $COUNT shard pipelines, ${WORKERS} at a time ..."
run_one() {
  shard="$1"; shdb="$2"
  [ -s "$shard" ] || return 0
  local filt="${shard%.pbf}.filtered.pbf"
  # osmium export needs a real file, not a stdin pipe.
  # shellcheck disable=SC2086
  osmium tags-filter --overwrite -o "$filt" "$shard" $FILTER_STR 2>/dev/null || return 0
  osmium export -f geojsonseq "$filt" 2>/dev/null \
    | INGEST_INDEX=0 OVERLAY_DB="$shdb" python3 "$INGEST" >>"$LOG" 2>&1
  rm -f "$filt"
}
export -f run_one
export INGEST LOG FILTER_STR

xargs -P "$WORKERS" -L1 -a "$JOBS" bash -c 'run_one "$1" "$2"' _ 2>>"$LOG"

log "merging shards ..."
mapfile -t SHDB < <(cut -f2 "$JOBS")
python3 "$MERGE" "$DB" "${SHDB[@]}" >>"$LOG" 2>&1

log "=== parallel build done: $(du -h "$DB" 2>/dev/null | cut -f1) ==="
rm -rf "$WORK"
