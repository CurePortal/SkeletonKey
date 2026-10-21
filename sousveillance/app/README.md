# SkeletonKey Beacon

**The phone sensor for the SkeletonKey sousveillance hub.**

This Android app streams GPS, battery, and barometric altitude to your own
`beacond`, receives spoken messages from HQ, and does on-device speech-to-text
and text-to-speech. It is the field end of the same system as the SkeletonKey
desktop app: the phone reports the ground, SkeletonKey keeps the record.

- No account, no vendor cloud, no analytics.
- The phone talks only to the `beacond` URL you give it.
- With `BEACON_KEY`, position pings and downlink messages are AES-256-GCM
  encrypted end to end. A Cloudflare Tunnel then sees only ciphertext.


## Screens

| Live | Settings |
|---|---|
| ![Beacon home](../../docs/screenshots/phone-home.png) | ![Beacon settings](../../docs/screenshots/phone-settings.png) |
| Live fix, link status, ambient stream, and an HQ message. | Server URL, token, optional encryption key, and voice. |

Screenshots use a synthetic demo record; no real location or token is shown.

---

## 1. What you need

On the computer running the hub:

- `beacond` (in `sousveillance/server`), listening on `127.0.0.1:8787`.
- A `BEACON_TOKEN` (shared bearer secret).
- Optional but recommended: a 32-byte `BEACON_KEY` for end-to-end encryption.
- `cloudflared` for a public HTTPS/WSS tunnel.
- SkeletonKey desktop running from the repo root, with the local services
  bridge (`npm run geo`) and MCP (`npm run mcp`) if you want HQ.

On the phone:

- Android 8+. No Google Play Services required; location uses the platform
  location manager, so it also works on de-Googled phones.
- Location permission set to **Allow all the time**, and notifications allowed.
- Battery optimization disabled for SkeletonKey Beacon (otherwise Android may
  stop the foreground service).

---

## 2. Build and install the app

From this folder:

```bash
flutter pub get

flutter build apk --release \
  --dart-define=BEACON_URL=https://beacon.example.com \
  --dart-define=BEACON_TOKEN=paste-the-token \
  --dart-define=BEACON_KEY=paste-the-64-hex-key

adb install -r build/app/outputs/flutter-apk/app-release.apk
```

You can also leave the URL/token/key blank at build time and enter them in the
app's Settings screen.

`BEACON_URL` must be the **base URL only**:

- good: `https://beacon.example.com`
- bad: `https://beacon.example.com/beacon`
- bad: trailing slash

The app derives `https://.../beacon`, `wss://.../stream`, and the rest.

The launcher name is **SkeletonKey Beacon**. The icon is generated from the
SkeletonKey logo in `assets/icon/logo.svg`. Regenerate after changing it:

```bash
dart run flutter_launcher_icons
```

---

## 3. Put `beacond` behind a Cloudflare Tunnel

Do not expose port 8787 directly. Keep `beacond` on loopback and let
Cloudflare Tunnel carry HTTPS/WSS.

### Install and log in

```bash
# Arch
sudo pacman -S cloudflared
# or follow https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

cloudflared tunnel login
```

A browser opens; choose the zone (for example `example.com`).

### Create the tunnel and DNS route

```bash
cloudflared tunnel create skeletonkey-beacon
cloudflared tunnel route dns skeletonkey-beacon beacon.example.com
```

`create` prints a tunnel UUID and writes credentials to
`~/.cloudflared/<UUID>.json`.

### Configure ingress

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL-UUID>
credentials-file: /home/YOUR_USER/.cloudflared/<TUNNEL-UUID>.json

ingress:
  - hostname: beacon.example.com
    service: http://127.0.0.1:8787
  - service: http_status:404
```

Make sure `beacond` is listening on `127.0.0.1:8787`:

```bash
curl -s http://127.0.0.1:8787/health
```

### Run the tunnel

Foreground test:

```bash
cloudflared tunnel run skeletonkey-beacon
```

Then from another terminal:

```bash
curl -s https://beacon.example.com/health
```

If that returns the beacon health JSON, the tunnel works.

Install it as a service (root-managed, simplest):

```bash
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

Or run it as a user service with your own unit pointing at
`~/.cloudflared/config.yml`.

### Quick temporary tunnel (no custom DNS)

For a quick test only:

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

Cloudflare prints a `https://something.trycloudflare.com` URL. Use that as
`BEACON_URL`. The URL changes each run, so use the named tunnel for daily use.

---

## 4. Configure the hub secrets

In `sousveillance/server/.env`:

```dotenv
BEACON_TOKEN=<a long random token>
BEACON_KEY=<64 hex characters>
```

Generate values with:

```bash
openssl rand -hex 32   # BEACON_TOKEN
openssl rand -hex 32   # BEACON_KEY
```

Restart `beacond`:

```bash
systemctl --user restart beacond
systemctl --user status beacond
```

If `BEACON_KEY` is set on the server, the phone **must** use the same key. If
they differ you will see encrypted-payload or decryption errors.

---

## 5. First run on the phone

1. Open **SkeletonKey Beacon**.
2. Open Settings.
3. Set **URL** to `https://beacon.example.com`.
4. Paste **BEACON_TOKEN**.
5. Paste **BEACON_KEY** if the hub uses one.
6. Save, then start the beacon.
7. Grant **location** (all the time) and **notifications**.
8. Disable battery optimization for the app.
9. Confirm the app shows a live link/status.

Test the round trip:

- Move the phone; the hub should log positions.
- From SkeletonKey **Map Editor → Local map services → Live**, the phone
  position and track should appear.
- Ask HQ to speak; the phone should display and read the message aloud.
- Press the mic and speak; the app sends on-device STT text to `/ask`.

When a phone is connected, SkeletonKey automatically creates a **Beacon**
timeline. HQ telemetry writes go there by default, separate from your main
record.

---

## 6. SkeletonKey side

```bash
cd /path/to/SkeletonKey
npm run geo       # map / beacon / opencode bridge on 127.0.0.1:8788
npm run mcp       # SkeletonKey MCP + HQ project bridge on 127.0.0.1:8799
npm run dev       # or: npm run tauri dev
```

In SkeletonKey:

- **Settings → Set up this machine** checks Ollama, maps, and services.
- **Map Editor → Local map services** reads position, track, gazetteer,
  Valhalla routes, and elevation.
- **Tasks / Documents** hold the practical record.
- The MCP lets HQ add locations/events/notes and ingest beacon positions into
  the same project.

---

## Troubleshooting

| Symptom | Check |
|---|---|
| `401 unauthorized` | `BEACON_TOKEN` on the phone and hub must match |
| `encrypted payload required` | set the same `BEACON_KEY` on phone and hub |
| WebSocket never connects | tunnel hostname points to `http://127.0.0.1:8787`; use `https` base URL; no trailing slash |
| Health works but positions don't | token on the app; beacond logs; firewall not blocking loopback |
| App stops in background | allow background location, disable battery optimization, keep notification permission |
| Tunnel URL works on laptop but not phone | Cloudflare DNS/proxy status; try mobile data; check the named tunnel is running |
| `cloudflared` service fails | `journalctl -u cloudflared -n 100`; validate `~/.cloudflared/config.yml` |
| Mixed content / connection refused | use the HTTPS tunnel, not plain `http://` from the phone |

## Security notes

- Keep `beacond` on `127.0.0.1`; only the tunnel is public.
- The tunnel URL is still an attack surface. Use a long random `BEACON_TOKEN`.
- With `BEACON_KEY`, Cloudflare cannot read position payloads or spoken
  downlink messages. The token still travels in the Authorization header, so
  treat the tunnel URL and token as secrets.
- Do not put real tokens or keys in source control; use app Settings or build
  `--dart-define` values from a private environment.
- The beacon is a one-person sensor. Do not use it to track other people.

## License

Part of the Sousveillance / SkeletonKey project. See the repository license.
