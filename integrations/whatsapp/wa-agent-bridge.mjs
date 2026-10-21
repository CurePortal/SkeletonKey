// WhatsApp Agent Platform bridge (OFFICIAL in-app agent API).
//
// Replaces the Baileys "message yourself" bridge with Meta's WhatsApp Agent
// Platform: the chat named in WhatsApp > Settings > Agents. Inbound is a
// long-poll GET /agent/v1/updates; outbound is POST /agent/v1/messages.
//
// Routing: /bean -> the books agent, /bella -> the CRM agent, anything else ->
// the default assistant. Each domain keeps its own opencode session.
//
// Permission handling: opencode raises a permission whenever the agent wants to
// run a command / edit / fetch. Those are relayed to the chat ("reply yes/no")
// and the answer is sent back, exactly like the Baileys bridge. Without this a
// turn blocks forever waiting on an approval nobody can see.
//
// Turns run per-participant so the long-poll keeps reading while a turn is in
// flight (a blocked turn must not stall new messages).
//
// Usage:
//   node wa-agent-bridge.mjs                 # run
//   node wa-agent-bridge.mjs --test "hi"     # one-shot: prompt opencode, print reply
//
// Env (loaded from ~/opencode-whatsapp/.wa-agent.env):
//   WA_AGENT_API_KEY   required, the agent API token (WAA...)
//   WA_AGENT_BASE      default https://api.whatsapp.com/agent/v1
//   OPENCODE_URL       default http://127.0.0.1:4096

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  getUpdates,
  sendText,
  markRead,
  downloadMedia,
} from "./lib/waagent.mjs";
import {
  AGENT_ROUTES,
  AGENT_ONLY,
  WHATSAPP_AGENT,
  PROJECT_DIR,
  RECEIPT_INBOX,
  BEANCOUNT_DIR,
  PETBOOK_DIR,
  MEDIA_INBOX,
  MEDIA_MODEL,
  PERMISSION_MODE,
  PERMISSION_REPLY_MODE,
} from "./config.mjs";
import {
  createSession,
  abortSession,
  promptAsync,
  promptPartsAsync,
  waitForReply,
  listMessages,
  replyPermission,
  listPermissions,
  getSession,
} from "./lib/opencode.mjs";

const AGENT_TITLES = { bean: "Books", bella: "CRM", petbook: "Pets", whatsapp: "Assistant", hq: "HQ" };
// Per-instance overrides so several bridges (one per WhatsApp agent key) can
// run side by side without sharing state. Defaults are relative to this dir.
const STORE_FILE = process.env.WA_AGENT_STATE_FILE || join(homedir(), ".local/state/wa-agent-bridge.json");
const OPENCODE_URL = process.env.OPENCODE_URL || "http://127.0.0.1:4096";

// Load the agent env (key + optional base) if not already in the environment.
// WA_AGENT_ENV lets a second instance point at its own key file.
const AGENT_ENV = process.env.WA_AGENT_ENV || join(PROJECT_DIR, ".env");
if (existsSync(AGENT_ENV)) {
  try {
    process.loadEnvFile(AGENT_ENV);
  } catch {
    // Node < 20.12; rely on the caller exporting the vars.
  }
}

const TOKEN = process.env.WA_AGENT_API_KEY;
if (!TOKEN) {
  console.error("WA_AGENT_API_KEY is not set (see ~/opencode-whatsapp/.wa-agent.env)");
  process.exit(1);
}

mkdirSync(RECEIPT_INBOX, { recursive: true });
mkdirSync(MEDIA_INBOX, { recursive: true });

// --- poll state ------------------------------------------------------------

function loadState() {
  try {
    const s = JSON.parse(readFileSync(STORE_FILE, "utf8"));
    return {
      offset: s.offset ?? 0,
      handled: Array.isArray(s.handled) ? s.handled : [],
      sessions: s.sessions && typeof s.sessions === "object" ? s.sessions : {},
      // Sessions that have an image part in their history. They must keep
      // using the vision model on later turns too: the local text-only model
      // would choke on the stored image parts.
      mediaSessions:
        s.mediaSessions && typeof s.mediaSessions === "object" ? s.mediaSessions : {},
    };
  } catch {
    return { offset: 0, handled: [], sessions: {}, mediaSessions: {} };
  }
}

function saveState(state) {
  try {
    mkdirSync(join(homedir(), ".local/state"), { recursive: true });
    state.handled = state.handled.slice(-500);
    writeFileSync(STORE_FILE, JSON.stringify(state));
  } catch {
    // best effort
  }
}

// --- routing / sessions ----------------------------------------------------

function matchAgentRoute(text) {
  for (const [prefix, agent] of Object.entries(AGENT_ROUTES)) {
    if (text === prefix || text.startsWith(`${prefix} `)) {
      return { prefix, agent, rest: text.slice(prefix.length).trim() };
    }
  }
  return null;
}

// Strip any known agent prefix so an approval answer like "/bella yes" parses,
// and so a route doesn't leak into the prompt.
function stripAgentPrefix(text) {
  return text.replace(/^\/(bean|ben|bella|petbook)\s+/i, "");
}

const seenAssistant = new Set();
const activeSessions = new Map(); // sessionId -> from
const jidForSession = new Map(); // sessionId -> from
const pendingPermissions = new Map(); // from -> [{sessionId, permissionId, title}]
const chains = new Map(); // from -> promise chain (serialize per participant)

// Persistent state (offset, handled ids, session map). Loaded at startup so a
// bridge restart keeps conversation continuity per agent.
let STATE = loadState();

function enqueue(from, fn) {
  const prev = chains.get(from) || Promise.resolve();
  const next = prev.then(fn).catch((err) => console.error("turn error:", String(err).slice(0, 200)));
  chains.set(from, next);
  return next;
}

async function sessionFor(from, agent) {
  const key = `${from}#${agent}`;
  const existing = STATE.sessions[key];
  if (existing) {
    const live = await getSession(existing);
    if (live) {
      jidForSession.set(existing, from);
      return existing;
    }
  }
  const title = AGENT_TITLES[agent] || (agent === WHATSAPP_AGENT ? "Assistant" : agent);
  const created = await createSession(title);
  STATE.sessions[key] = created.id;
  jidForSession.set(created.id, from);
  saveState(STATE);
  return created.id;
}

async function resetSession(from, agent) {
  const key = `${from}#${agent}`;
  const existing = STATE.sessions[key];
  if (existing) {
    try {
      await abortSession(existing);
    } catch {
      // ignore
    }
    delete STATE.sessions[key];
    delete STATE.mediaSessions[existing];
    jidForSession.delete(existing);
    saveState(STATE);
  }
}

function replyFor(text) {
  const route = matchAgentRoute(text);
  if (route) return { agent: route.agent, text: route.rest };
  // Silos a bridge to one agent (e.g. a company runs its own WhatsApp key/chat).
  if (AGENT_ONLY) return { agent: AGENT_ONLY, text };
  return { agent: WHATSAPP_AGENT, text };
}

// --- control messages (approval answers) -----------------------------------

// A pending-approval answer MUST run outside the per-participant queue: the
// running turn is blocked inside waitForReply on that same chain, so queueing
// the answer behind it would deadlock. Returns true if it handled the message.
async function handleControl(from, text) {
  // "/new" (optionally prefixed) resets the session for whichever agent the
  // message is addressed to, without prompting the model.
  const trimmed = text.trim();
  if (/^(\/(bean|ben|bella)\s+)?\/new$/i.test(trimmed)) {
    const route = matchAgentRoute(trimmed);
    const agent = route ? route.agent : AGENT_ONLY || WHATSAPP_AGENT;
    await resetSession(from, agent);
    await sendText(TOKEN, from, `Started a fresh ${AGENT_TITLES[agent] || agent} session.`);
    return true;
  }

  const pending = pendingPermissions.get(from) || [];
  if (!pending.length) return false;

  const answer = stripAgentPrefix(trimmed).toLowerCase();
  const yes = ["y", "yes", "allow", "approve", "ok", "once"].includes(answer);
  const no = ["n", "no", "deny", "reject", "cancel"].includes(answer);
  if (!yes && !no) {
    const list = pending.map((p) => `- ${p.title}`).join("\n");
    await sendText(TOKEN, from, `Answer the pending request(s) first: reply yes or no.\n${list}`);
    return true;
  }
  pendingPermissions.delete(from);
  let ok = 0;
  for (const p of pending) {
    try {
      await replyPermission(p.sessionId, p.permissionId, yes ? "once" : "reject");
      ok++;
    } catch (err) {
      console.error("failed to answer permission:", String(err).slice(0, 150));
    }
  }
  await sendText(TOKEN, from, `${yes ? "Approved" : "Denied"} ${ok}/${pending.length} request${pending.length === 1 ? "" : "s"}.`);
  return true;
}

// --- turns -----------------------------------------------------------------

async function refreshTyping(from, messageId, stop) {
  // The typing indicator expires after 25s; re-arm it while a turn runs.
  const tick = async () => {
    if (stop.done) return;
    try {
      await markRead(TOKEN, messageId, { typing: true });
    } catch {
      // ignore
    }
    setTimeout(tick, 15000);
  };
  if (messageId) tick();
}

async function handleText(from, text, messageId) {
  const { agent, text: body } = replyFor(text.trim());
  if (!body) {
    await sendText(TOKEN, from, `${AGENT_TITLES[agent] || agent} mode. Send a question after the prefix.`);
    return;
  }
  const sessionId = await sessionFor(from, agent);
  try {
    const existing = await listMessages(sessionId);
    for (const m of existing) if (m.info.role === "assistant") seenAssistant.add(m.info.id);
  } catch {
    // fresh session
  }
  const stop = { done: false };
  refreshTyping(from, messageId, stop);
  activeSessions.set(sessionId, from);
  try {
    // Once a session has seen an image, keep it on the vision model: the
    // stored image parts would break a text-only local model on later turns.
    const model = STATE.mediaSessions[sessionId] ? MEDIA_MODEL : undefined;
    await promptAsync(sessionId, body, { agent, model });
    const reply = await waitForReply(sessionId, seenAssistant);
    await sendText(TOKEN, from, reply);
  } catch (err) {
    // A timeout (e.g. a hung tool) must not leave the session running: abort
    // it and tell the user, so the chat isn't silently stuck and /new works.
    if (/timed out|aborted/i.test(String(err))) {
      try {
        await abortSession(sessionId);
      } catch {
        // best effort
      }
      await sendText(TOKEN, from, "That turn took too long and I stopped it. The chat is clear — try again or send /new.");
    } else {
      await sendText(TOKEN, from, `Something went wrong: ${String(err.message || err).slice(0, 160)}`);
    }
  } finally {
    stop.done = true;
    activeSessions.delete(sessionId);
  }
}

async function handleMedia(from, msg) {
  const media = msg.image || msg.document;
  const mediaId = media?.id;
  const caption = (media?.caption || "").trim();
  if (!mediaId) {
    await sendText(TOKEN, from, "I can only handle images/documents here.");
    return;
  }

  // Route by prefix: a /petbook photo is a card/receipt for the pets agent;
  // anything else keeps the receipt behavior (bean). A siloed bridge
  // (AGENT_ONLY) sends every attachment to its one agent.
  const route = matchAgentRoute(caption);
  const targetAgent = route ? route.agent : AGENT_ONLY || "bean";

  // Company agents (bean, petbook) have specialized image pipelines (receipt OCR,
  // cardscan). The general assistant just *looks* at the image — attach it
  // directly to the model like any image-aware chat app.
  const companyAgents = new Set(["bean", "petbook"]);
  const isGeneral = !companyAgents.has(targetAgent);

  let saved;
  let buffer;
  let mimeType;
  try {
    ({ buffer, mimeType } = await downloadMedia(TOKEN, mediaId));
    const ext = mimeType.includes("png") ? ".png" : mimeType.includes("pdf") ? ".pdf" : mimeType.includes("webp") ? ".webp" : ".jpg";
    const inbox = targetAgent === "petbook"
      ? (process.env.WA_PETBOOK_INBOX || join(PETBOOK_DIR, "inbox"))
      : isGeneral
        ? MEDIA_INBOX
        : RECEIPT_INBOX;
    mkdirSync(inbox, { recursive: true });
    saved = join(inbox, `wa-${Date.now()}${ext}`);
    writeFileSync(saved, buffer);
  } catch (err) {
    await sendText(TOKEN, from, `Could not download that attachment: ${String(err).slice(0, 120)}`);
    return;
  }

  const extra = route ? route.rest : stripAgentPrefix(caption);
  const sessionId = await sessionFor(from, targetAgent);
  const stop = { done: false };
  refreshTyping(from, msg.id, stop);
  activeSessions.set(sessionId, from);
  try {
    if (isGeneral && mimeType.startsWith("image/")) {
      // Attach the image to the prompt so the assistant sees it directly. The
      // local models are text-only, so hand image turns to the vision model.
      const guidance =
        `The operative sent this image over WhatsApp${saved ? ` (also saved at ${saved})` : ""}.\n` +
        (extra ? `Their note: ${extra}\n` : "") +
        `You CAN see images: look at it, say what it shows, and handle it with whichever ` +
        `tool/MCP fits (geo, beacon, SkeletonKey, a company MCP, etc.). If the right route ` +
        `is genuinely unclear, ask the operative which MCP to use and why.`;
      const parts = [
        { type: "text", text: guidance },
        { type: "file", mime: mimeType, url: `data:${mimeType};base64,${buffer.toString("base64")}` },
      ];
      await promptPartsAsync(sessionId, parts, { agent: targetAgent, model: MEDIA_MODEL });
      STATE.mediaSessions[sessionId] = true;
      saveState(STATE);
    } else if (isGeneral) {
      // Non-image attachment (PDF etc.): no vision model needed, but never
      // route it to the bean receipt pipeline — tell this agent where it is.
      const prompt =
        `An attachment was sent and saved at ${saved} (${mimeType}).\n` +
        (extra ? `Sender's note: ${extra}\n` : "") +
        `Read it if useful and handle it with the appropriate tool/MCP. If the right ` +
        `route is unclear, ask the operative which MCP to use and why.`;
      await promptAsync(sessionId, prompt, { agent: targetAgent });
    } else {
      const prompt =
        targetAgent === "petbook"
          ? `A photo was sent and saved at ${saved}.\n` +
            (extra ? `Sender's note: ${extra}\n` : "") +
            `Read it. If it is a business card, use the cardscan tool ` +
            `(cd ${PETBOOK_DIR}/growth && node scripts/cardscan.mjs ${saved}) and draft the CRM lead ` +
            `(company + person) for me to confirm; do not create or delete without approval. ` +
            `If it is a receipt, run the configured receipt importer and reply with the draft ledger entry.`
          : `A receipt photo was sent and saved at ${saved}.\n` +
            (extra ? `Sender's note: ${extra}\n` : "") +
            `Run: cd ${BEANCOUNT_DIR} && .venv/bin/python importers/receipt.py ${saved} ` +
            `(add --trip <tag> only if the note names a trip). Then reply with the draft ` +
            `ledger entry for me to approve. Do not append or commit anything.`;
      await promptAsync(sessionId, prompt, { agent: targetAgent });
    }
    const reply = await waitForReply(sessionId, seenAssistant);
    await sendText(TOKEN, from, reply);
  } catch (err) {
    if (/timed out|aborted/i.test(String(err))) {
      try {
        await abortSession(sessionId);
      } catch {
        // best effort
      }
      await sendText(TOKEN, from, "That took too long and I stopped it. The chat is clear — try again or send /new.");
    } else {
      await sendText(TOKEN, from, `Something went wrong: ${String(err.message || err).slice(0, 160)}`);
    }
  } finally {
    stop.done = true;
    activeSessions.delete(sessionId);
  }
}

// --- dispatch (non-blocking per participant) -------------------------------

async function dispatchMessage(from, msg, messageId) {
  if (msg.type === "text") {
    await handleText(from, msg.text?.body || "", messageId);
  } else if (msg.type === "image" || msg.type === "document") {
    await handleMedia(from, msg);
  } else if (msg.type === "audio") {
    await sendText(TOKEN, from, "Voice notes aren't handled yet — send text or a photo.");
  }
}

function dispatch(update, state) {
  const value = update?.entry?.[0]?.changes?.[0]?.value;
  if (!value) return;
  for (const msg of value.messages || []) {
    if (msg.id && state.handled.includes(msg.id)) continue;
    if (msg.id) state.handled.push(msg.id);
    const from = msg.from;

    // Control messages (approval answers, /new) run IMMEDIATELY, outside the
    // per-participant queue — the blocked turn they unblock is sitting on that
    // queue, so queueing them would deadlock. Everything else is serialized per
    // participant so turns don't race, but never blocks the poll loop.
    if (msg.type === "text") {
      const body = msg.text?.body || "";
      handleControl(from, body)
        .then((handled) => {
          if (!handled) enqueue(from, () => dispatchMessage(from, msg, msg.id));
        })
        .catch((err) => {
          // A control-handler failure must never drop the message.
          console.error("control error:", String(err).slice(0, 200));
          enqueue(from, () => dispatchMessage(from, msg, msg.id));
        });
    } else {
      enqueue(from, () => dispatchMessage(from, msg, msg.id));
    }
  }
}

// --- permission relay ------------------------------------------------------

const announcedPermissions = new Set(); // permission ids already relayed

async function pollPermissions() {
  for (;;) {
    try {
      const pending = await listPermissions();
      for (const p of pending) {
        const from = activeSessions.get(p.sessionID) || jidForSession.get(p.sessionID);
        if (!from) continue; // not a session this bridge started
        if (announcedPermissions.has(p.id)) continue;
        announcedPermissions.add(p.id);
        if (announcedPermissions.size > 200) {
          // keep the set bounded
          const first = announcedPermissions.values().next().value;
          announcedPermissions.delete(first);
        }
        await handlePermission(p, from);
      }
    } catch (err) {
      console.error("permission poll error:", String(err).slice(0, 150));
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function handlePermission(permission, from) {
  const kind = permission.permission || permission.type || "action";
  const detail =
    permission.metadata?.command ||
    (permission.patterns || []).join(", ") ||
    permission.pattern ||
    "";
  const label = detail ? `${kind}: ${detail}` : kind;
  // Local HQ runs on the on-device model; when a turn is beyond it, it hands the
  // work to its DeepSeek arm via the task tool. That call shows up here as a
  // "task" permission, and we put it to the operative as a plain yes/no.
  const isEscalation = kind === "task";

  if (PERMISSION_MODE === "ask") {
    const queue = pendingPermissions.get(from) || [];
    queue.push({ sessionId: permission.sessionID, permissionId: permission.id, title: label });
    pendingPermissions.set(from, queue);
    const ask = isEscalation
      ? "This one's beyond the on-device model — escalate to the cloud? Reply yes to send it up, or no to keep it local."
      : `Approval needed - ${label}\nReply yes to allow once, or no to deny.`;
    await sendText(
      TOKEN,
      from,
      `${ask}${queue.length > 1 ? `\n(${queue.length} requests pending)` : ""}`,
    );
    return;
  }

  await sendText(TOKEN, from, `${label}\n(auto-${PERMISSION_REPLY_MODE})`);
  try {
    await replyPermission(permission.sessionID, permission.id, PERMISSION_REPLY_MODE);
  } catch (err) {
    console.error("auto permission reply failed:", String(err).slice(0, 150));
  }
}

// --- poll loop -------------------------------------------------------------

async function pollLoop() {
  console.log(`wa-agent-bridge: polling (offset=${STATE.offset}, handled=${STATE.handled.length})`);
  for (;;) {
    try {
      const { status, updates, nextOffset } = await getUpdates(TOKEN, { offset: STATE.offset, timeout: 25 });
      if (status === 200 && updates) {
        STATE.offset = nextOffset;
        dispatch(updates, STATE); // enqueues; does not block the next poll
        saveState(STATE);
      }
    } catch (err) {
      const s = err.status;
      if (s === 409) {
        console.error("poll 409: another poll is active for this agent; backing off 10s");
        await new Promise((r) => setTimeout(r, 10000));
      } else if (s === 429) {
        await new Promise((r) => setTimeout(r, 5000));
      } else {
        console.error("poll error:", String(err).slice(0, 200));
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
}

// --- one-shot test mode ----------------------------------------------------

const args = process.argv.slice(2);
const testIdx = args.indexOf("--test");

async function runTest(text) {
  const { agent, text: body } = replyFor(text);
  console.log(`[test] agent=${agent} prompt=${JSON.stringify(body)}`);
  const sessionId = await sessionFor("test", agent);
  const existing = await listMessages(sessionId);
  for (const m of existing) if (m.info.role === "assistant") seenAssistant.add(m.info.id);
  await promptAsync(sessionId, body, { agent });
  const reply = await waitForReply(sessionId, seenAssistant);
  console.log("[test] reply:", reply);
}

if (testIdx !== -1) {
  runTest(args[testIdx + 1] || "hello")
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  pollPermissions();
  pollLoop();
}
