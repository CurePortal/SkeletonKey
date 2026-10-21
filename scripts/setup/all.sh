#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
REGION="${REGION:-north-america}"
log() { printf '\n[setup/all] %s\n' "$*"; }

log "1/3 Ollama"
bash "$REPO_DIR/scripts/setup/ollama.sh"
log "2/3 Offline maps: $REGION"
REGION="$REGION" bash "$REPO_DIR/scripts/setup/maps.sh"
log "3/3 Local services"
bash "$REPO_DIR/scripts/setup/services.sh"
log "All setup steps finished."
