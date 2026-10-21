# Sousveillance

**A local-first personal intelligence layer. Point the eye at yourself — by your own
consent, for your own sake.**

Surveillance is _someone else_ watching you: centralized, asymmetric, coercive.
*Sousveillance* is the inverse — you watch over yourself, and the picture belongs to
you. This project turns a phone into a beacon and a machine into a handler: it knows
where you are, what's around you, what's changed, and what's worth warning you about —
all locally, none of it routed through anyone else's servers.

> The goal is not to replace power. It is to hold your own eye: your own picture of
> your own life, unmediated.

---

## The idea

Big Brother's power isn't only _seeing_ — it's owning the frame. This is the small,
personal counter-move:

- **Local by construction.** Position, history, and context live on your machine.
  Payloads are end-to-end encrypted; the network hop sees only ciphertext.
- **A watch, not a nag.** It speaks only when it matters. No news is good news.
- **Memory as narrative.** Raw data rolls off; meaning is compacted upward into prose.
  Narrative is the highest-density lossy codec for lived experience.
- **You keep the pen.** It serves your attention and freedom; it never substitutes for
  them. No guru, no isolation, an off-ramp always.

---

## Models — read this first

The system's intelligence (the **HQ** agent) was **field-tested and works best with
frontier-grade models — specifically DeepSeek v4.1-Flash**. The agent drives real tools,
reasons over location and context, and must not hallucinate facts; small local models
(≤ 8B) were **not** sufficient for that role in testing — they produced unreliable tool
calls and false statements.

- **Fully offline?** To keep the whole loop on your own hardware, you would need a
  **fairly powerful local cluster** capable of running a **frontier-grade model**
  locally. A single consumer CPU (or a small GPU) will not get you there.
- **Hybrid** is the practical middle: run a capable model you trust (self-hosted if you
  can, or a reputable API), and accept that inference is the one component that may not
  be local. Everything *about you* — position, history, context, memory — still stays
  local and encrypted; only the model's reasoning leaves, if you don't run it yourself.
- The model is **swappable** (a local `ollama` provider is supported); change one line
  to move it in or out.

---

## What it does

- **Senses** — a phone app streams GPS + battery + barometric altitude to your machine,
  and speaks and listens with **on-device** text-to-speech and speech-to-text.
- **Watch** — a proactive watcher (*Raven Protocol*) notices when something's actually
  wrong: lost signal, reconnect, unusual movement (a fast ground track with a sustained
  climb reads as *airborne*), geofences, and dusk. Silent otherwise.
- **Ambient stream** — the phone can run continuous on-device speech-to-text.
  Transcripts are sent as background observations, not questions: the beacon does
  not speak back. HQ silently extracts people, places, and events into SkeletonKey
  and tags uncertain entities `needs-definition` for a later WhatsApp check-in.
  Conversational replies stay in WhatsApp.
- **Self-extension** — HQ can notice a capability gap in ambient context and
  propose a small local tool/MCP/skill; it asks yes/no and never adds one
  silently. See the root README.
- **Memory** — a tiered *Field Log*: raw → daily digest → narrative → private legend.
  Compaction, not expiry.
- **World** — offline routing (Valhalla) + a local gazetteer of named places, POIs,
  water, and boundaries, plus offline elevation for terrain.
- **Mind** — an agent (*HQ*) that reads your position and the world, reasons about the
  ground, and answers — spoken into an earpiece or over chat.
- **Dark-watch** — while you're dark, it assesses your last known location and stays a
  silent vigil unless the ground or conditions turn dangerous.

---

## Architecture

```
        ┌───────────────┐        position (E2E-encrypted)         ┌────────────────────┐
        │  Beacon app   │ ───────────────────────────────────────► │ beacond            │
        │ (Flutter/     │                                          │  • ingest / store  │
        │  Android)     │ ◄───────── spoken text (WebSocket) ───── │  • outbox (say)    │
        │  GPS · mic ·  │                                          │  • /ask → HQ       │
        │  TTS · STT    │                                          └─────────┬──────────┘
        └───────────────┘                                                    │
                                                                             │  MCP
                        ┌────────────────────────────────────────────────────┼───────────────┐
                        ▼                        ▼                           ▼               ▼
                 ┌────────────┐          ┌──────────────┐            ┌────────────┐  ┌────────────┐
                 │ HQ agent   │          │ Raven watch  │            │ geo tools  │  │ beacon     │
                 │ (reasoning)│          │ (proactive)  │            │ + gazetteer│  │ tools      │
                 └─────┬──────┘          └──────┬───────┘            └─────┬──────┘  └─────┬──────┘
                       │                        │                          │               │
                       └──────────┬─────────────┴───────────┬──────────────┘               │
                                  ▼                          ▼                             ▼
                        ┌───────────────────┐      ┌──────────────────┐          ┌──────────────────┐
                        │ Field Log (memory)│      │ Valhalla routing │          │ weather / hazards│
                        │ raw→digest→narrative│     │ + elevation DEM  │          │ (open feeds)     │
                        └───────────────────┘      └──────────────────┘          └──────────────────┘
```

Everything on the right runs on **your** machine. The only outbound calls are the model
(swap it for a local one if you can) and the explicitly-allowed public data feeds.

---

## Repository layout

| Path | What |
|---|---|
| `server/` | The Node home base: `beacond.mjs` (ingest + WebSocket + outbox + `/ask`), `mcp-server.mjs` (agent tools), `raven.mjs` (the watch), `fieldlog.mjs` (narrative memory), `weather.mjs`, `hazards.mjs`, `config.mjs`, `lib/`, and `systemd/` units. |
| `maps/` | Offline routing + geocoding: `geo-mcp.mjs` (read-only MCP: lookup/reverse/nearby/route/height), `geo` (CLI), `overlay/` (gazetteer builder + query engine), `setup-valhalla.sh` (build tiles). See `maps/README.md`. |
| `../agents/` | The agent personas (`hq.md`, `hq-cloud.md`, `whatsapp.md`). Copy them into your opencode `agent/` dir. |
| `app/` | **SkeletonKey Beacon** (Flutter/Android): background GPS/battery/barometer, on-device TTS + STT, push-to-talk, live transcript. Setup + Cloudflare Tunnel: [`app/README.md`](app/README.md). |
| `../integrations/crypto-watch/` | Optional wallet watch: BTC/LTC/ETH polling and a view-only XMR watcher, with an MCP. |

---

## Quick start

> Requirements: **Node ≥ 22**, a **Valhalla** build + `osmium-tool` (for maps), and
> **Flutter + the Android SDK** (for the app). Services run as **systemd user units**.
> The conventions below assume you cloned the SkeletonKey monorepo and this
> directory is `SkeletonKey/sousveillance`.

```bash
git clone <your-fork> ~/SkeletonKey
cd ~/SkeletonKey/sousveillance

# 1. secrets
cp .env.example server/.env
openssl rand -hex 32   # paste into BEACON_TOKEN
openssl rand -hex 32   # paste into BEACON_KEY  (enables E2E encryption)

# 2. server (beacond + the MCP it feeds)
cd server && npm install && cd ..

# 3. maps: routing tiles + gazetteer (see maps/README.md)
maps/setup-valhalla.sh --region <your-region>       # build routing tiles

# 4. the watch + memory timers, and the server, as user services
cp server/systemd/*.service server/systemd/*.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now beacond raven fieldlog.timer weather-update.timer hazards-update.timer

# 5. the app
cd app && flutter build apk --release \
  --dart-define=BEACON_URL=https://your-host \
  --dart-define=BEACON_TOKEN=... \
  --dart-define=BEACON_KEY=...
adb install -r build/app/outputs/flutter-apk/app-release.apk
```

Expose `beacond` (default `127.0.0.1:8787`) through your own tunnel (Cloudflare,
Tailscale, …). The phone reaches it; nothing is exposed to the open internet beyond
what you choose.

---

## Configuration

Secrets and server settings live in `server/.env`:

| Var | Purpose |
|---|---|
| `BEACON_TOKEN` | shared bearer secret (auth). |
| `BEACON_KEY` | 32-byte key; enables **AES-256-GCM** end-to-end payload encryption. |
| `BEACON_PORT` / `BEACON_HOST` | where `beacond` listens (keep it loopback). |
| `OPENCODE_URL` | the agent server the `/ask` path drives (`opencode serve`). |

The watch's thresholds live in `server/raven.json` (lost/reconnect/stall/motion, quiet
hours, geofences, danger zones). The operator profile (codename, normal travel modes,
home area) lives at the top of `agents/hq.md` in the repository root.

---

## Privacy & threat model

- **In transit:** everything is HTTPS/WSS; with `BEACON_KEY`, position pings and
  agent→phone messages are **AES-256-GCM encrypted** with a pre-shared key. A tunnel
  edge (e.g. Cloudflare) sees only ciphertext.
- **At rest:** local SQLite. Nothing is sold or shared.
- **Outbound exceptions (explicit):** the **model** (run it locally to close this), and a
  small set of **public data feeds** — weather (Open-Meteo) and hazards (USGS/NIFC) — with
  coordinates **truncated to a ~5 km cell** before every request and everything cached
  locally.
- **Not a people-tracking tool.** No dossiers on private individuals; public records and
  public officials in their official role only.

---

## Design principles

These are load-bearing, not decoration:

1. **Everything local** — nothing about you leaves your machine without explicit,
   one-off authorisation.
2. **No demographics-as-danger** — income is never a proxy for risk.
3. **No dossiers on private individuals.**
4. **Every record carries source, date, confidence — and expires.**
5. **Layers are overlays** keyed to geography — never baked into the routing graph.
6. **Every alert traces to real data.** No invented threats, names, or coordinates.
7. **State changes require a manual override** from the operator.
8. **Signal, not noise** — never tell the operator what they can already see; speak only
   when it matters.

---

## Status & roadmap

**Working:** live position + battery + altitude; the watch (lost/reconnect/motion/
geofence/dusk) + dark-watch; narrative memory; offline routing + gazetteer; offline
elevation (region-scoped); cached weather + hazards; on-device TTS/STT; agent persona +
tooling.

**Known limits:** the agent's model may be a cloud call, which sends your context to
that provider and breaks local-only (run a local model to close it; see *Models and
agency quality* in the root README); elevation is region-scoped (continent-wide DEMs are tens of
GB); weather/hazard coverage depends on free public feeds; a phone with no signal can't
reach the brain (use on-device maps as the true no-signal fallback).

**Roadmap:** richer context layers (place profiles, land access, institutions, events);
incidents/traffic; habits/baseline; dead-zone learning; a layer-health view; an optional
encrypted "station" broadcast layer.

---

## License

Source-available under a copyleft-style, non-commercial license — see
[`LICENSE`](LICENSE). Personal and non-profit use is free; corporate/for-profit
use, resale, or paid hosting requires a separate license. Forks and remixes must
keep the license, attribute SkeletonKey, and notify the maintainer. This is not
OSI-approved open source. Contributions are accepted under the same license;
keep the principles above intact.
