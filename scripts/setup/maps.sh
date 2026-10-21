#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
MAPS_HOME="${MAPS_HOME:-$HOME/maps}"
REGION="${REGION:-north-america}"
export MAPS_HOME REGION
log() { printf '[setup/maps] %s\n' "$*"; }

mkdir -p "$MAPS_HOME/overlay" "$MAPS_HOME/data"
SETUP="$REPO_DIR/sousveillance/maps/setup-valhalla.sh"

if ! command -v valhalla_build_tiles >/dev/null 2>&1 || ! command -v osmium >/dev/null 2>&1; then
  log "Valhalla or osmium is missing. Attempting the bundled installer (may ask for sudo)."
  bash "$SETUP" --region "$REGION" --keep-pbf
else
  log "Valhalla tools found; building/updating tiles for $REGION"
  bash "$SETUP" --region "$REGION" --keep-pbf --no-deps
fi

log "Building the local gazetteer / overlay for $REGION (this can take a while)..."
OVERLAY_REGIONS="$REGION" MAPS_HOME="$MAPS_HOME" \
  bash "$REPO_DIR/sousveillance/maps/overlay/build_overlay.sh"

if systemctl --user list-unit-files valhalla.service >/dev/null 2>&1; then
  log "Starting Valhalla user service"
  systemctl --user enable --now valhalla.service || true
fi

if curl -fsS --max-time 3 -X POST http://127.0.0.1:8002/status -H 'content-type: application/json' -d '{}' >/dev/null 2>&1; then
  log "Valhalla is answering on 127.0.0.1:8002."
else
  log "Tiles are built, but Valhalla is not answering yet. Check the valhalla user service."
fi
