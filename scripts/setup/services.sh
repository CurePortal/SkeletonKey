#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${REPO_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
MAPS_HOME="${MAPS_HOME:-$HOME/maps}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
mkdir -p "$UNIT_DIR"
log() { printf '[setup/services] %s\n' "$*"; }

cat >"$UNIT_DIR/skeletonkey-geo.service" <<UNIT
[Unit]
Description=SkeletonKey local map/beacon bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/env node $REPO_DIR/tools/geo-http.mjs
Environment=GEO_PORT=8788
Environment=VALHALLA_URL=http://127.0.0.1:8002
Environment=BEACON_URL=http://127.0.0.1:8787
Environment=OPENCODE_URL=http://127.0.0.1:4096
Environment=GAZETTEER_MODULE=$REPO_DIR/sousveillance/maps/overlay/gazetteer.mjs
Environment=OVERLAY_DB=$MAPS_HOME/overlay/overlay.sqlite
Restart=on-failure

[Install]
WantedBy=default.target
UNIT

cat >"$UNIT_DIR/skeletonkey-mcp.service" <<UNIT
[Unit]
Description=SkeletonKey MCP + HQ project bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=$REPO_DIR
EnvironmentFile=-$REPO_DIR/sousveillance/server/.env
ExecStart=/usr/bin/env node $REPO_DIR/mcp/skeletonkey-mcp.mjs
Environment=SK_MCP_PORT=8799
Restart=on-failure

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now skeletonkey-geo.service skeletonkey-mcp.service || true

for port in 8788 8799; do
  if curl -fsS --max-time 3 "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
    log "service on $port is up"
  else
    log "service on $port is not answering yet; check: systemctl --user status skeletonkey-${port/8788/geo}"
  fi
done
