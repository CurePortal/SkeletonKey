# Local maps, beacon, routing, and Ollama in Sousveillance

The Sousveillance page has a **Local map services** panel. It talks to one local
bridge, which fronts the same services the rest of this machine already uses:

```
MapLocalPanel (React)
        │  http://127.0.0.1:8788
        ▼
tools/geo-http.mjs
  ├── /find /reverse /nearby      → sousveillance/maps/overlay/gazetteer.mjs
  ├── /route /height /locate      → Valhalla 127.0.0.1:8002
  ├── /beacon/*                   → beacond 127.0.0.1:8787
  ├── /opencode/*                 → opencode 127.0.0.1:4096
  ├── /ollama/models              → /api/tags + ~/.ollama/config.json
  └── /ollama/*                   → Ollama 127.0.0.1:11434
```

## Run it

```bash
cd /path/to/SkeletonKey
npm run geo          # pnpm geo also works
```

Leave it running while the app is open. The panel header shows a green dot when
the bridge answers; the chips show Valhalla, Gazetteer, and Beacon separately.

Environment overrides:

| Variable | Default |
|---|---|
| `GEO_PORT` | `8788` |
| `VALHALLA_URL` | `http://127.0.0.1:8002` |
| `GAZETTEER_MODULE` | `<repo>/sousveillance/maps/overlay/gazetteer.mjs` |
| `BEACON_URL` | `http://127.0.0.1:8787` |
| `OLLAMA_URL` | `http://127.0.0.1:11434` |
| `OLLAMA_CONFIG` | `~/.ollama/config.json` |

The app also accepts a `VITE_GEO_URL` build-time override, or a saved
`sk-geo-url` localStorage value.

## What the panel does

- **Live** — latest phone position (latitude, longitude, speed, accuracy,
  battery, altitude), a follow toggle, center, add-as-location, use-as-route-start.
  A beacon token can be pasted for track history. The token is kept in
  `sessionStorage` only; it is never written into the project or exports.
- **Search** — gazetteer name search; center, add as a project location, or set
  as a route destination. Also reverse-geocodes the beacon or current map center.
- **Route** — place name or `lat,lon` endpoints, costing (`auto`, `pedestrian`,
  `bicycle`, `truck`, `bus`), distance/time, turn list, and the route drawn on the
  map. Start/end can be filled from the beacon.
- **Nearby** — named features within a radius of the beacon or map center.
- **Height** — Valhalla elevation at a point.

Added locations become normal SkeletonKey `LocationType` records attached to the
current timeline. They save with the project and appear in the map's location
list and in the Knowledge Base.

## Ollama models

Models are installed outside the app. Settings only lists them and stores the
selection; there is no model download or pull control in the app.

Settings → AI model uses `GET /ollama/models`. The bridge merges local pulls
from `/api/tags` with the model names in `~/.ollama/config.json` (cloud models
are not listed by `/api/tags`), then asks `/api/show` for capabilities. Chat is
also proxied through `/ollama/api/chat`, so model discovery and answers do not
depend on Ollama's browser CORS settings. The `base` parameter must be loopback.

## Track and telemetry

The track requires `BEACON_TOKEN` (from `sousveillance/server/.env`). The bridge forwards the Authorization header to beacond; the app
never stores the token on disk. The track is drawn as a green polyline and the
current position as a green marker.

## Map tiles

The basemap now uses key-free OpenStreetMap tiles. In dark mode the tiles are
inverted with CSS (`.leaflet-dark-tiles`) instead of the previous keyed CARTO
dark layer, which showed "API KEY REQUIRED".

## Desktop

`tauri.conf.json` has no restrictive CSP, so the Tauri webview can call the
localhost bridge directly. Run `npm run geo` before `npm run tauri dev`; a future
sidecar can start the bridge automatically.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Red dot / "could not reach" | start `npm run geo`; check port 8788 |
| Valhalla chip gray | `curl 127.0.0.1:8002/status` |
| Gazetteer chip gray | check `~/maps/overlay/overlay.sqlite` and `GAZETTEER_MODULE` |
| Beacon chip gray | `curl 127.0.0.1:8787/health` |
| Ollama chip gray / no models | `curl 127.0.0.1:8788/ollama/models`; check `~/.ollama/config.json` |
| No track | paste the beacon token and press Save; check `BEACON_TOKEN` |
| Route 400 | a place name was not found; use `lat,lon` |
