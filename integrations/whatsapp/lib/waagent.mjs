// WhatsApp Agent Platform API client.
// Docs: WhatsApp Agent Platform Developer Manual, base https://api.whatsapp.com/agent/v1
//
// This is the OFFICIAL in-app agent API (the /bean, /bella chats created in
// WhatsApp Settings > Agents). It replaces the unofficial Baileys "message
// yourself" bridge. Auth is a Bearer token (the agent's API key); inbound is a
// long-poll GET /updates, outbound is POST /messages.

const BASE = process.env.WA_AGENT_BASE || "https://api.whatsapp.com/agent/v1";

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

async function api(token, path, options = {}) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...authHeader(token),
      ...(options.headers || {}),
    },
  });
}

// Long-poll for inbound messages + receipts.
// Returns { status, updates, nextOffset }. status 204 means nothing to deliver.
export async function getUpdates(token, { offset, limit = 50, timeout = 25 } = {}) {
  const params = new URLSearchParams();
  if (offset !== undefined && offset !== null) params.set("offset", String(offset));
  params.set("limit", String(limit));
  params.set("timeout", String(timeout));

  const res = await api(token, `/updates?${params.toString()}`);
  if (res.status === 204) return { status: 204, updates: null, nextOffset: offset ?? null };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`getUpdates ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  return { status: 200, updates: json, nextOffset: json.next_offset ?? offset ?? null };
}

// The Agent Platform caps a text body at ~4096 characters; a longer body is
// rejected with HTTP 400 code 100 ("body"). Chunk on paragraph/word boundaries
// so long agent replies still get through.
const MAX_TEXT_CHARS = 3500;

async function sendOne(token, to, body) {
  const res = await api(token, "/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`sendText ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

// Send a text message to the agent's creator. `to` is the participant id
// (user:<id>) taken verbatim from an inbound message. Long bodies are split.
export async function sendText(token, to, body) {
  const s = String(body ?? "");
  if (s.length <= MAX_TEXT_CHARS) return sendOne(token, to, s);

  let out = {};
  let rest = s;
  while (rest.length > MAX_TEXT_CHARS) {
    let cut = rest.lastIndexOf("\n", MAX_TEXT_CHARS);
    if (cut < MAX_TEXT_CHARS * 0.6) cut = rest.lastIndexOf(" ", MAX_TEXT_CHARS);
    if (cut < MAX_TEXT_CHARS * 0.6) cut = MAX_TEXT_CHARS;
    out = await sendOne(token, to, rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^[\s]+/, "");
    await new Promise((r) => setTimeout(r, 400));
  }
  if (rest.length) out = await sendOne(token, to, rest);
  return out;
}

// Mark an inbound message read, optionally showing a typing indicator.
export async function markRead(token, messageId, { typing = false } = {}) {
  const payload = { messaging_product: "whatsapp", status: "read", message_id: messageId };
  if (typing) payload.typing_indicator = { type: "text" };
  const res = await api(token, "/statuses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}

// Fetch metadata for a media object (incoming or uploaded).
export async function getMediaMeta(token, mediaId) {
  const res = await api(token, `/media/${mediaId}`);
  if (!res.ok) throw new Error(`getMediaMeta ${res.status}`);
  return res.json();
}

// Download raw bytes for a media id (metadata -> url -> bytes).
export async function downloadMedia(token, mediaId) {
  const meta = await getMediaMeta(token, mediaId);
  const res = await fetch(meta.url, { headers: authHeader(token) });
  if (!res.ok) throw new Error(`downloadMedia ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: meta.mime_type || "application/octet-stream" };
}

// Upload media for outbound sending; returns the media id.
export async function uploadMedia(token, filePath, mimeType) {
  const { readFile } = await import("node:fs/promises");
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  if (mimeType) form.append("type", mimeType);
  form.append("file", new Blob([bytes], { type: mimeType || "application/octet-stream" }), filePath.split("/").pop());
  const res = await api(token, "/media", { method: "POST", body: form });
  if (!res.ok) throw new Error(`uploadMedia ${res.status}`);
  const json = await res.json();
  return json.id;
}

// Send an image (by uploaded media id) with optional caption.
export async function sendImage(token, to, mediaId, caption) {
  const payload = { messaging_product: "whatsapp", to, type: "image", image: { id: mediaId } };
  if (caption) payload.image.caption = caption;
  const res = await api(token, "/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`sendImage ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}
