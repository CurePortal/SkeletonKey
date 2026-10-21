# Offline maps / directions for agents

Everything here is plain files on disk. No cloud, no API keys. A local
[Valhalla](https://valhalla.github.io/valhalla/) engine reads the tiles and answers
routing + geocoding questions over a local HTTP API.

## Layout

```
maps/
  setup-valhalla.sh      one-time build: download OSM data -> routing tiles
  valhalla.json          engine config (tile dir, port, concurrency)
  valhalla_tiles/        the routing/geocoding graph (the actual data)
  data/                  source .osm.pbf files (only kept with --keep-pbf)
  README.md              this file
maps/geo         CLI wrapper around the engine
~/.config/systemd/user/valhalla.service   runs the engine at login
```

The default build covers **North America + Central America + South America**
(Geofabrik `north-america`, `central-america`, `south-america`). Pick any
Geofabrik region you need.
The engine listens on `http://localhost:8002`.

## Build / rebuild

```bash
maps/setup-valhalla.sh --americas          # current region (Americas)
maps/setup-valhalla.sh --region europe     # any Geofabrik path
maps/setup-valhalla.sh --planet            # whole world (needs ~200G free)
```

Re-running resumes downloads; add `--keep-pbf` to retain the raw OSM file.

## Use (agents)

Prefer the `geo` CLI:

```bash
geo status                                  # is the engine up?
geo find "Golden Gate Bridge"               # name -> lat,lon
geo reverse 37.8199 -122.4783               # lat,lon -> address
geo route "SF Ferry Building" "SFO Airport" # turn-by-turn + distance/time
geo route 37.7749,-122.4194 37.6213,-122.3790
geo --costing pedestrian route "A" "B"      # walk (also: bicycle, truck, bus)
geo --json route "A" "B"                    # raw Valhalla JSON
```

### Raw HTTP API (if you need fields the CLI hides)

All endpoints take JSON, POST to `http://localhost:8002/<endpoint>`:

| Endpoint | Purpose |
|---|---|
| `/status` | health / version |
| `/locate` | nearest road: `{"locations":[{"lat":48.8,"lon":2.3}],"verbose":true}` |
| `/route` | `{"locations":[{lat,lon},{lat,lon}],"costing":"auto"}` |
| `/sources_to_targets` | travel-time matrix |
| `/isochrone` | reachable area, returns GeoJSON |

The response for `/route` includes `trip.summary.length` (km), `trip.summary.time`
(seconds) and `trip.legs[].maneuvers[]` (instructions). All units default to km.

## Geocoding (name <-> coordinates)

This Valhalla build has **no geocoder** (`/search`, `/reverse` are not actions — they
404). Geocoding is served instead by a local **gazetteer** built from the OSM source:
`$MAPS_HOME/overlay/overlay.sqlite` (default `~/maps/overlay/overlay.sqlite`;
table `features`), queried by `overlay/gazetteer.mjs`. `geo find` / `geo reverse` and the MCP tools
`geo_lookup` / `geo_reverse` / `geo_nearby` use it. Rebuild it with
`overlay/build_overlay.sh` (runs detached; reads the retained source).

## Storage budget

| Store | Cap |
|---|---|
| `valhalla_tiles/` (routing) | ~30 GB (built) |
| `data/*.pbf` (retained source) | ~24 GB |
| `overlay/overlay.sqlite` (context/maps layers) | **≤ 8 GB** |
| `enrich/*` (timeline/narrative) | ≤ 3 GB |
| `spiderfoot/` (raw scans) | ≤ 1 GB |
| **hyperlayer total** | **≤ 12 GB** |

Raw position history is bounded by `BEACON_TRACK_MAX`; the field log compacts
old digests into narrative rather than growing forever.

## Notes

- `geo find`/`route` accept either a free-text place or `lat,lon`.
- Data is from OpenStreetMap (ODbL). Attribution required if redistributed.
- To also resolve admin regions / timezones, rebuild with `--with-admin`.
- Engine control: `geo serve|stop|restart|logs` (systemd user service).
