#!/usr/bin/env bash
set -euo pipefail
MODEL="${MODEL:-llama3.2:3b}"
log() { printf '[setup/model] %s\n' "$*"; }

if ! command -v ollama >/dev/null 2>&1; then
  echo "Ollama is not installed. Run the Ollama setup first." >&2
  exit 2
fi
if ! curl -fsS --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  log "Ollama is not running; starting it..."
  nohup ollama serve >"$HOME/.local/state/skeletonkey/ollama.log" 2>&1 &
  sleep 3
fi
log "Pulling model: $MODEL"
ollama pull "$MODEL"
log "Model ready: $MODEL"
