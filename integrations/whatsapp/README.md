# WhatsApp → opencode bridge

Drive a local **opencode** agent (normally `hq`, the mission handler) from a
WhatsApp chat using Meta's WhatsApp Agent Platform API. The bridge long-polls
inbound messages, prompts opencode, and sends the reply back. It also relays
permission requests and attaches images to a vision-capable model.

This is an optional transport. SkeletonKey and Sousveillance work without it;
the phone beacon, MCP servers, desktop app, and agent all run locally.

## What it does

- **Inbound** — long-poll `GET /agent/v1/updates`, one WhatsApp agent key per
  chat (use a separate key for each silo).
- **Outbound** — `POST /agent/v1/messages`, chunked to the ~4 KB body limit.
- **Routing** — `/bean` and `/bella` prefixes pick an opencode agent;
  otherwise the default agent for that bridge is used. `WA_AGENT_ONLY` pins a
  bridge to one agent.
- **Images** — an attached image is passed as a file part. Because local
  text-only models reject image parts, media turns use `WA_MEDIA_MODEL` (a
  vision model) and that session stays on it.
- **Approvals** — if the agent asks for a command/edit/fetch, the request is
  texted to the chat ("reply yes/no") and the answer is returned to opencode.
  Without this a turn blocks forever.
- **Sessions** — each participant × agent pair keeps one long-lived opencode
  session. `/new` starts fresh.

## Setup

Requirements: Node ≥ 22, an opencode server (`opencode serve --port 4096`), and
an agent API key from **WhatsApp → Settings → Agents**.

```bash
cd integrations/whatsapp
cp .env.example .env      # fill in WA_AGENT_API_KEY
node wa-agent-bridge.mjs
```

Run one process per agent key. Keep separate `WA_AGENT_STATE_FILE` values so
the bridges do not share session state.

### Systemd (user service)

Create `~/.config/systemd/user/opencode-waagent.service`:

```ini
[Unit]
Description=opencode <-> WhatsApp Agent Platform bridge
After=network-online.target opencode-server.service
Requires=opencode-server.service

[Service]
Type=simple
WorkingDirectory=/path/to/SkeletonKey/integrations/whatsapp
ExecStart=/usr/bin/env node wa-agent-bridge.mjs
Environment=WA_AGENT_ENV=/path/to/SkeletonKey/integrations/whatsapp/.env
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

For an HQ silo add:

```ini
Environment=WA_AGENT_ONLY=hq
Environment=WA_AGENT_STATE_FILE=%h/.local/state/wa-agent-bridge-hq.json
```

Then `systemctl --user daemon-reload && systemctl --user enable --now opencode-waagent`.

## Security

Anyone who can message the WhatsApp agent chat can drive an opencode session on
this machine with the tools that agent has. Treat the agent key like a shell
credential.

- `WA_PERMISSION_MODE=reject` makes sessions read-only; `ask` relays each
  request; `once`/`always` auto-approve and should only be used when every
  person in the chat is trusted with the machine.
- The HQ agent has no tool-level prompts and gates state changes in its own
  spoken override protocol — see `agents/hq.md`.
- The bridge stores no message bodies beyond what opencode keeps in its session
  store. The token lives in `.env` (git-ignored).

## Status

Tested with the WhatsApp Agent Platform in-app agent API and opencode's
`/session/:id/prompt_async` endpoint. The WhatsApp API is not a stable public
contract; check the inbound update shape if Meta changes it.
