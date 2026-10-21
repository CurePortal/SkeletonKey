#!/usr/bin/env bash
set -euo pipefail
log() { printf '[setup/ollama] %s\n' "$*"; }

if command -v ollama >/dev/null 2>&1; then
  log "Ollama is already installed: $(ollama --version 2>/dev/null | head -1 || true)"
else
  log "Installing Ollama from the official installer..."
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to install Ollama." >&2
    exit 2
  fi
  if ! curl -fsSL https://ollama.com/install.sh | sh; then
    echo "Ollama installer failed. Open a terminal and run: curl -fsSL https://ollama.com/install.sh | sh" >&2
    exit 2
  fi
fi

if systemctl --user list-unit-files ollama.service >/dev/null 2>&1; then
  systemctl --user enable --now ollama.service || true
fi

if ! curl -fsS --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  log "Starting Ollama in the background..."
  mkdir -p "$HOME/.local/state/skeletonkey"
  nohup ollama serve >"$HOME/.local/state/skeletonkey/ollama.log" 2>&1 &
  for _ in $(seq 1 30); do
    sleep 1
    if curl -fsS --max-time 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
      break
    fi
  done
fi

if curl -fsS --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  log "Ollama is running."
else
  echo "Ollama did not start. Check ~/.local/state/skeletonkey/ollama.log" >&2
  exit 3
fi
