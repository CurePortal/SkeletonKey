// Minimal opencode-server client for beacond: drives the HQ agent for the
// phone's /ask text uplink. Mirrors the pattern used by the WhatsApp bridge.
const BASE = (process.env.OPENCODE_URL || "http://127.0.0.1:4096").replace(/\/$/, "");

async function api(path, opts = {}) {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
  });
}

export async function healthy() {
  try {
    return (await api("/global/health")).ok;
  } catch {
    return false;
  }
}

export async function createSession(title) {
  const r = await api("/session", { method: "POST", body: JSON.stringify({ title }) });
  if (!r.ok) throw new Error(`createSession ${r.status}`);
  return r.json();
}

export async function getSession(id) {
  try {
    const r = await api(`/session/${id}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function listMessages(id) {
  const r = await api(`/session/${id}/message`);
  if (!r.ok) throw new Error(`listMessages ${r.status}`);
  return r.json();
}

export async function promptAsync(id, text, { agent } = {}) {
  const body = { parts: [{ type: "text", text }] };
  if (agent) body.agent = agent;
  const r = await api(`/session/${id}/prompt_async`, { method: "POST", body: JSON.stringify(body) });
  if (!r.ok && r.status !== 204) throw new Error(`promptAsync ${r.status} ${await r.text()}`);
}

function messageText(m) {
  return (m.parts || [])
    .filter((p) => p.type === "text" && p.text && !p.synthetic)
    .map((p) => p.text)
    .join("\n\n")
    .trim();
}

// Wait for the whole turn to finish, then return all assistant text it produced.
export async function waitForReply(id, seen, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  const texts = [];
  let seenThisTurn = 0;
  let idleSince = 0;
  let err = null;

  for (;;) {
    if (Date.now() > deadline) throw new Error("timed out waiting for a reply");
    let messages = [];
    try {
      messages = await listMessages(id);
    } catch {
      // server may be mid-restart; retry
    }
    for (const m of messages) {
      if (m.info.role !== "assistant") continue;
      if (seen.has(m.info.id)) continue;
      if (m.info.time?.completed === undefined) continue;
      seen.add(m.info.id);
      seenThisTurn++;
      const t = messageText(m);
      if (t) texts.push(t);
      if (m.info.error) err = m.info.error;
    }
    const st = await api("/session/status")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    const idle = !st || !st[id] || st[id].type === "idle";
    if (idle && seenThisTurn > 0) {
      if (!idleSince) idleSince = Date.now();
      if (Date.now() - idleSince >= 600) {
        if (err) return `[opencode error] ${err.name}: ${err.data?.message ?? ""}`.trim();
        return texts.join("\n\n").trim() || "[no response]";
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
