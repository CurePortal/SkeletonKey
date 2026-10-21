#!/usr/bin/env bash
#
# setup-valhalla.sh -- offline directions + location lookup from OSM
#
# Downloads OpenStreetMap data and builds Valhalla routing tiles so a local
# agent can ask for directions and geocode places with no internet.
#
# Everything lives under $MAPS_HOME (default ~/maps) as normal files, so the
# agent can read the config and the source .osm.pbf directly.
#
# Usage:
#   ./setup-valhalla.sh --americas                # N+Central+S America (~23G pbf)
#   ./setup-valhalla.sh --region europe
#   ./setup-valhalla.sh --region north-america/us/california --keep-pbf
#   ./setup-valhalla.sh --region europe --region africa   # merges both
#   ./setup-valhalla.sh --planet                  # whole world (~80G pbf, huge tiles)
#
# Options:
#   --region <geofabrik/path>   Geofabrik extract path (repeatable, merged)
#   --americas                  Preset: north-america + central-america + south-america
#   --planet                    Use the full planet file
#   --keep-pbf                  Keep .osm.pbf file(s) after building tiles
#   --with-admin                Also build admin + timezone databases
#   --no-deps                   Skip package installation
#   --no-service                Do not install/enable the systemd user service
#   -h, --help                  Show this help
#
set -euo pipefail

MAPS_HOME="${MAPS_HOME:-$HOME/maps}"
DATA_DIR="$MAPS_HOME/data"
TILE_DIR="$MAPS_HOME/valhalla_tiles"
TILE_TAR="$MAPS_HOME/valhalla_tiles.tar"
CONFIG="$MAPS_HOME/valhalla.json"
TZ_DB="$MAPS_HOME/timezones.sqlite"
ADMIN_DB="$MAPS_HOME/admins.sqlite"
SERVICE_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE_FILE="$SERVICE_DIR/valhalla.service"
PORT="${VALHALLA_PORT:-8002}"

MODE=""
REGIONS=()
# Keep the source .osm.pbf by DEFAULT: it is the shared raw material for every
# overlay layer (context/POIs/hazards), so deleting it forces a costly re-pull.
KEEP_PBF=1
WITH_ADMIN=0
DO_DEPS=1
DO_SERVICE=1

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!!\033[0m  %s\n' "$*" >&2; }
die()  { printf '\033[1;31mxx\033[0m  %s\n' "$*" >&2; exit 1; }

usage() { sed -n '3,26p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --region)   MODE="regions"; REGIONS+=("${2:?--region needs a value}"); shift 2 ;;
    --americas) MODE="regions"; REGIONS+=(north-america central-america south-america); shift ;;
    --planet)   MODE="planet"; shift ;;
    --keep-pbf) KEEP_PBF=1; shift ;;
    --discard-pbf) KEEP_PBF=0; shift ;;
    --with-admin) WITH_ADMIN=1; shift ;;
    --no-deps)  DO_DEPS=0; shift ;;
    --no-service) DO_SERVICE=0; shift ;;
    -h|--help)  usage; exit 0 ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
done

[ -n "$MODE" ] || { usage; die "specify --americas, --planet or --region <path>"; }

command -v sudo >/dev/null || die "sudo not found"

# ---------------------------------------------------------------- dependencies
if [ "$DO_DEPS" -eq 1 ]; then
  log "Installing packages (valhalla, osmium-tool, aria2, jq)"
  if ! command -v valhalla_build_tiles >/dev/null 2>&1 || ! command -v osmium >/dev/null 2>&1; then
    if command -v yay >/dev/null 2>&1; then
      yay -S --needed --noconfirm valhalla osmium-tool aria2 jq
    elif command -v paru >/dev/null 2>&1; then
      paru -S --needed --noconfirm valhalla osmium-tool aria2 jq
    else
      warn "No yay/paru found. Install the AUR 'valhalla' package + osmium-tool, aria2, jq manually,"
      warn "then re-run with --no-deps."
      exit 1
    fi
  else
    log "valhalla + osmium already installed, skipping package step"
  fi
fi

command -v valhalla_build_tiles >/dev/null 2>&1 \
  || die "valhalla_build_tiles not on PATH. Install the AUR 'valhalla' package."
for t in valhalla_build_config curl jq; do
  command -v "$t" >/dev/null 2>&1 || die "missing required tool: $t"
done
DL_TOOL="$(command -v aria2c || command -v curl)" || die "need aria2c or curl to download"

mkdir -p "$DATA_DIR" "$TILE_DIR"

download() { # <url> <out-name>
  local url="$1" name="$2" dest="$DATA_DIR/$2"
  if [ -s "$dest" ]; then
    log "Using existing $dest ($(du -h "$dest" | cut -f1))"
    return
  fi
  log "Downloading $url"
  if [ "${DL_TOOL##*/}" = "aria2c" ]; then
    aria2c -x8 -s8 -k1M -c --file-allocation=none --dir "$DATA_DIR" --out "$name" "$url"
  else
    curl -fL --retry 5 -C - -o "$dest" "$url"
  fi
  [ -s "$dest" ] || die "download failed: $dest"
}

# --------------------------------------------------------------- download data
PBF=""
if [ "$MODE" = "planet" ]; then
  NEED_GB=200
  URL="https://planet.openstreetmap.org/pbf/planet-latest.osm.pbf"
  download "$URL" "planet-latest.osm.pbf"
  PBF="$DATA_DIR/planet-latest.osm.pbf"
else
  command -v osmium >/dev/null 2>&1 || die "osmium (osmium-tool) required to merge regions"
  # rough peak estimate: source files + merged copy + tiles (~2.5x source)
  NEED_GB=20
  [ "${#REGIONS[@]}" -gt 1 ] && NEED_GB=90

  # Work out the target file name up front so an existing merge short-circuits
  # re-downloading every extract.
  joined="$(IFS=_; echo "${REGIONS[*]}")"; joined="${joined//\//_}"
  if [ "${#REGIONS[@]}" -eq 3 ] && [ "${REGIONS[0]}" = north-america ] \
     && [ "${REGIONS[1]}" = central-america ] && [ "${REGIONS[2]}" = south-america ]; then
    joined="americas"
  fi

  if [ "${#REGIONS[@]}" -gt 1 ] && [ -s "$DATA_DIR/${joined}-latest.osm.pbf" ]; then
    PBF="$DATA_DIR/${joined}-latest.osm.pbf"
    log "Using existing merged file $PBF ($(du -h "$PBF" | cut -f1))"
  else
    PBFS=()
    for r in "${REGIONS[@]}"; do
      r="${r%/}"
      name="${r//\//_}-latest.osm.pbf"
      download "https://download.geofabrik.de/${r}-latest.osm.pbf" "$name"
      PBFS+=("$DATA_DIR/$name")
    done
    if [ "${#PBFS[@]}" -eq 1 ]; then
      PBF="${PBFS[0]}"
    else
      PBF="$DATA_DIR/${joined}-latest.osm.pbf"
      log "Merging ${#PBFS[@]} extracts -> $PBF"
      osmium merge "${PBFS[@]}" -o "$PBF" --overwrite
      if [ "$KEEP_PBF" -eq 0 ]; then
        rm -f "${PBFS[@]}"
        log "Removed individual extracts to free space"
      fi
    fi
  fi
fi

AVAIL_GB=$(df -Pk "$DATA_DIR" | awk 'NR==2{print int($4/1024/1024)}')
log "Free space under $DATA_DIR: ${AVAIL_GB}G (recommend ~${NEED_GB}G for this mode)"
[ "$AVAIL_GB" -ge "$NEED_GB" ] || warn "low disk: this may fail or fill the disk"
[ -s "$PBF" ] || die "no input data at $PBF"

# ---------------------------------------------------------------------- config
log "Writing Valhalla config -> $CONFIG"
nproc_val="$(nproc 2>/dev/null || echo 4)"
valhalla_build_config \
  --mjolnir-tile-dir "$TILE_DIR" \
  --mjolnir-tile-extract "$TILE_TAR" \
  --mjolnir-concurrency "$nproc_val" \
  > "$CONFIG"

# Pin the HTTP listen address used by valhalla_service (default is 8002).
jq --arg l "tcp://*:$PORT" '.httpd.service.listen = $l' "$CONFIG" > "$CONFIG.tmp" \
  && mv "$CONFIG.tmp" "$CONFIG"

# --------------------------------------------------- optional admin + timezone
if [ "$WITH_ADMIN" -eq 1 ]; then
  log "Building admin database (best effort)"
  valhalla_build_admins -c "$CONFIG" "$PBF" 2>/dev/null || warn "admins build failed; continuing"
  log "Building timezone database (best effort)"
  if valhalla_build_timezones >"$TZ_DB" 2>/dev/null && [ -s "$TZ_DB" ]; then
    jq --arg p "$TZ_DB" '.mjolnir.timezone = $p' "$CONFIG" > "$CONFIG.tmp" \
      && mv "$CONFIG.tmp" "$CONFIG"
  else
    warn "timezone build failed; continuing without timezone data"
    rm -f "$TZ_DB"
  fi
fi

# ------------------------------------------------------------------ build tiles
log "Building routing tiles (this can take a long time)"
valhalla_build_tiles -c "$CONFIG" "$PBF"

log "Tiles ready under $TILE_DIR ($(du -sh "$TILE_DIR" 2>/dev/null | cut -f1))"

# --------------------------------------------------------------------- cleanup
if [ "$KEEP_PBF" -eq 0 ]; then
  log "Removing source file $PBF (kept by default; --discard-pbf to remove)"
  rm -f "$PBF"
else
  log "Keeping source file $PBF (readable by osmium)"
fi

# --------------------------------------------------------------------- service
if [ "$DO_SERVICE" -eq 1 ] && command -v valhalla_service >/dev/null 2>&1; then
  log "Installing systemd user service -> $SERVICE_FILE"
  mkdir -p "$SERVICE_DIR"
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Valhalla offline routing + geocoding
After=network.target

[Service]
Type=simple
ExecStart=$(command -v valhalla_service) $CONFIG 2
Restart=on-failure

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now valhalla.service || warn "could not start service"
  log "Service status:"
  systemctl --user --no-pager status valhalla.service || true
  log "To survive logout: loginctl enable-linger $USER"
else
  [ "$DO_SERVICE" -eq 1 ] && warn "valhalla_service not found; skipping service install"
fi

log "Done."
log "Try:  geo status"
log "      geo find \"Eiffel Tower\""
log "      geo route \"Berlin Hbf\" \"Alexanderplatz\""
