import {
  OPENCODE_URL,
  OPENCODE_DIRECTORY,
  OPENCODE_AGENT,
  OPENCODE_MODEL,
  POLL_INTERVAL_MS,
  REPLY_TIMEOUT_MS,
} from "../config.mjs";

const base = OPENCODE_URL;

function headers(extra = {}) {
  const h = { ...extra };
  if (OPENCODE_DIRECTORY) h["x-opencode-directory"] = OPENCODE_DIRECTORY;
  return h;
}

async function api(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: headers({ "content-type": "application/json", ...(options.headers || {}) }),
  });
  return res;
}

export async function healthy() {
  try {
    const res = await api("/global/health");
    return res.ok;
  } catch {
    return false;
  }
}

export async function getSession(sessionId) {
  try {
    const res = await api(`/session/${sessionId}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function createSession(title) {
  const res = await api("/session", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`createSession failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function abortSession(sessionId) {
  try {
    await api(`/session/${sessionId}/abort`, { method: "POST" });
  } catch {
    // best effort
  }
}

export async function listMessages(sessionId) {
  const res = await api(`/session/${sessionId}/message`);
  if (!res.ok) throw new Error(`listMessages failed: ${res.status}`);
  return res.json();
}

export function messageText(message) {
  const parts = (message.parts || []).filter((p) => p.type === "text" && p.text && !p.synthetic);
  return parts.map((p) => p.text).join("\n\n").trim();
}

export async function promptAsync(sessionId, text, { agent, noReply, model } = {}) {
  return promptPartsAsync(sessionId, [{ type: "text", text }], { agent, noReply, model });
}

// "provider/model" -> { providerID, modelID }. Objects pass through.
function parseModel(model) {
  if (!model) return null;
  if (typeof model === "object") return model;
  const [providerID, ...rest] = String(model).split("/");
  if (!providerID || !rest.length) return null;
  return { providerID, modelID: rest.join("/") };
}

// Send arbitrary message parts (text and/or file attachments) asynchronously.
// File parts look like { type: "file", mime, url: "data:<mime>;base64,<data>", filename? }.
// `model` ("provider/model") overrides the agent's pinned model for this turn —
// needed for image parts, which the local models reject.
export async function promptPartsAsync(sessionId, parts, { agent, noReply, model } = {}) {
  const body = { parts };
  const useAgent = agent || OPENCODE_AGENT;
  if (useAgent) body.agent = useAgent;
  if (noReply) body.noReply = true;
  const useModel = parseModel(model || OPENCODE_MODEL);
  if (useModel) body.model = useModel;
  const res = await api(`/session/${sessionId}/prompt_async`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`promptAsync failed: ${res.status} ${await res.text()}`);
  }
}

// Wait for the next completed assistant message that was not already present.
export async function sessionStatus(sessionId) {
  try {
    const res = await api("/session/status");
    if (!res.ok) return null;
    const all = await res.json();
    return all[sessionId] ?? null;
  } catch {
    return null;
  }
}

// Wait for the whole turn to finish, then return all assistant text it produced.
// A single turn emits several assistant messages (one per step); tool-only steps
// carry no text, so returning on the first completed message drops the answer.
export async function waitForReply(sessionId, seenIds, signal) {
  const deadline = Date.now() + REPLY_TIMEOUT_MS;
  const texts = [];
  let seenThisTurn = 0;
  let idleSince = 0;
  let turnError = null;

  for (;;) {
    if (Date.now() > deadline) throw new Error("timed out waiting for a reply");
    if (signal?.aborted) throw new Error("aborted");

    let messages = [];
    try {
      messages = await listMessages(sessionId);
    } catch {
      // server may be mid-restart; retry
    }

    for (const m of messages) {
      if (m.info.role !== "assistant") continue;
      if (seenIds.has(m.info.id)) continue;
      if (m.info.time?.completed === undefined) continue;
      seenIds.add(m.info.id);
      seenThisTurn++;
      const t = messageText(m);
      if (t) texts.push(t);
      if (m.info.error) turnError = m.info.error;
    }

    const status = await sessionStatus(sessionId);
    // /session/status only lists busy sessions; a missing entry means idle.
    const idle = status == null || status.type === "idle";

    // A turn raised at least one assistant message and the session has gone
    // quiet: settle briefly to catch trailing messages, then return.
    if (idle && seenThisTurn > 0) {
      if (idleSince === 0) idleSince = Date.now();
      if (Date.now() - idleSince >= 600) {
        if (turnError) {
          return `[opencode error] ${turnError.name}: ${turnError.data?.message ?? ""}`.trim();
        }
        return texts.join("\n\n").trim() || "[no text response]";
      }
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

export async function replyPermission(sessionId, permissionId, response) {
  await api(`/session/${sessionId}/permissions/${permissionId}`, {
    method: "POST",
    body: JSON.stringify({ response }),
  });
}

// List all pending permission requests across sessions. The event stream does
// not reliably emit permission events on every build, so poll this instead.
export async function listPermissions() {
  try {
    const res = await api("/permission");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// Subscribe to the server event stream. Returns an async iterator of event objects.
export async function* subscribeEvents(signal) {
  const res = await fetch(`${base}/event`, { headers: headers(), signal });
  if (!res.ok || !res.body) throw new Error(`event stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let index;
    while ((index = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const dataLines = raw
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());
      if (!dataLines.length) continue;
      try {
        yield JSON.parse(dataLines.join("\n"));
      } catch {
        // ignore keepalives / partial frames
      }
    }
  }
}
