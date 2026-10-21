# One main project

SkeletonKey is a single-record app, not a project manager.

## Desktop (Tauri)

- The main project is `~/Documents/SkeletonKey/main.ark`.
- It is created automatically on first launch and loaded every time the app
  starts.
- All edits auto-save back to that file.
- **New main project** replaces `main.ark` and reloads the app.
- **Open another project** picks a different `.ark` file, makes it the main
  project, and reloads the app. The previous file stays where it is on disk.

## Browser build

The same single project is kept in one stable localStorage slot
(`skeletonkey_project_main`). New/Open replace that slot and reload.

## Agent-filled telemetry

The main project is the shared record the local agents fill from the person's
day and travels.

- `mcp/skeletonkey-mcp.mjs` writes agent output to its local project and serves
  it over the loopback HQ bridge (`http://127.0.0.1:8799`).
- While the app is open, it checks the bridge every 15 seconds.
- If the HQ project is newer and has content, the app pulls it into the main
  project and shows a short "Updated from HQ" notice.
- If the local main project is newer and the HQ project is empty, the app pushes
  the local project to HQ.
- If the bridge is not running, the app keeps working locally and retries later.

The app also polls `GET /fieldlog/recent` on the local geo bridge. Meaningful
beacon field-log events (coffee, decisions, places, hazards) are merged into the
main project's Beacon timeline, tagged `fieldlog:<id>` so they are never imported
twice. Raw `raven:*`, `dark`, and `operative` chatter is skipped.

This keeps one record: the app is the view, the agents are the writers, and the
main project is the file they share.
