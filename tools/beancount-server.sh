#!/usr/bin/env bash
# Start SkeletonKey's own Fava server for the personal Beancount books.
set -uo pipefail

LEDGER_DIR="${SK_BEANCOUNT_DIR:-$HOME/Documents/SkeletonKey/finances}"
LEDGER_FILE="${BEANCOUNT_FILE:-$LEDGER_DIR/main.beancount}"
HOST="${SK_FAVA_HOST:-127.0.0.1}"
PORT="${SK_FAVA_PORT:-5001}"
VENV="${BEANCOUNT_VENV:-$HOME/beancount/.venv}"
STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/skeletonkey"
LOG_FILE="$STATE_DIR/fava.log"

if [[ "${1:-}" == "--foreground" ]]; then
  exec "$VENV/bin/fava" "$LEDGER_FILE" --host "$HOST" --port "$PORT"
fi

if ! [[ -x "$VENV/bin/fava" ]]; then
  echo "Fava not found at $VENV/bin/fava" >&2
  echo "Set BEANCOUNT_VENV or install: python3 -m venv .venv && .venv/bin/pip install beancount fava mcp-beancount" >&2
  exit 1
fi
if [[ ! -f "$LEDGER_FILE" ]]; then
  echo "SkeletonKey ledger not found: $LEDGER_FILE" >&2
  exit 1
fi

if curl -fsS --max-time 3 -o /dev/null "http://$HOST:$PORT/" 2>/dev/null; then
  echo "Fava already serving at http://$HOST:$PORT"
  exit 0
fi

mkdir -p "$STATE_DIR"
setsid --fork "$VENV/bin/fava" "$LEDGER_FILE" --host "$HOST" --port "$PORT" >> "$LOG_FILE" 2>&1 < /dev/null
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 -o /dev/null "http://$HOST:$PORT/" 2>/dev/null; then
    echo "SkeletonKey Fava is up at http://$HOST:$PORT"
    echo "Ledger: $LEDGER_FILE"
    echo "Log: $LOG_FILE"
    exit 0
  fi
  sleep 1
done

echo "Fava did not come up; see $LOG_FILE" >&2
exit 1
