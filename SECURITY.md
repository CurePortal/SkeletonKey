# Security policy

SkeletonKey handles location history, documents, and a record of one person's
life. Treat security reports seriously, and treat the local services as
sensitive even though they bind to loopback.

## Reporting a vulnerability

Do not open a public issue containing exploit details, tokens, or personal data.

Report privately to the maintainer through the upstream repository (or the
contact method published there). Include:

- the affected component and version;
- a minimal reproduction;
- the impact you believe it has;
- any suggested fix, if you have one.

You will get an acknowledgement when the report is seen. Please give a
reasonable window to fix the issue before publishing details.

## In scope

- `beacond` authentication, payload encryption, and the outbox
- the local bridges (`tools/geo-http.mjs`, `tools/setup-http.mjs`) and MCP servers
- the Tauri app, its capabilities, and the renderer/webview boundary
- the agent permission and override model
- the optional WhatsApp bridge
- the optional crypto wallet watch and its MCP
- self-extension proposals and their approval boundary
- leaks of `.env`, state, database, wallet, or record data

## Baseline hardening

- Keep `beacond` and the bridges on `127.0.0.1`; expose the phone only through
  your own tunnel.
- Use a long random `BEACON_TOKEN` and, where possible, a `BEACON_KEY` for
  end-to-end payload encryption.
- Rotate both if a tunnel URL, phone, or credential is lost.
- Run the agent with `WA_PERMISSION_MODE=reject` unless every person in the chat
  is trusted with this machine.
- A WhatsApp agent chat is a remote control for a tool-capable agent; keep the
  participant list tight.
- Review `src-tauri/capabilities/default.json` before distributing a build. The
  desktop app intentionally has broad filesystem scope so it can open your own
  projects.
- Never commit `.env`, `state/`, `*.db`, `*.ark`, map data, or phone credentials.
  They are git-ignored; keep them that way.
- If you use a cloud model, remember that the context the agent sends leaves the
  machine. Do not put secrets in the record.

## Out of scope

- Vulnerabilities in third-party models, providers, WhatsApp/Meta, Cloudflare,
  Valhalla, OSM data, or other dependencies (report those upstream).
- Attacks that require an already-compromised machine or an already-granted
  shell.
- The consequences of deliberately using a cloud model with sensitive data.
