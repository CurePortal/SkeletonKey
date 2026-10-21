#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
log() { printf '[setup/hq] %s\n' "$*"; }

bash "$REPO_DIR/scripts/setup/services.sh"

if command -v opencode >/dev/null 2>&1; then
  log "opencode found: $(command -v opencode)"
else
  log "opencode is not installed. The HQ tools still work through the MCP; install opencode to use the chat agent."
fi
log "HQ bridge ready at http://127.0.0.1:8799"
