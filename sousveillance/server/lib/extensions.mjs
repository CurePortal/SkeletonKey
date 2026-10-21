// Self-extension proposals. HQ may notice that a small new capability would
// close a real gap, but it never adds one silently: the proposal is stored,
// spoken to the operative, and only an explicit yes lets the agent build it.
//
// Shared by beacond (ambient discovery) and the beacon MCP (agent-initiated
// proposals and decisions). All state is local SQLite.
import { randomUUID } from "node:crypto";

import {
  enqueueSay,
  getExtension,
  insertExtension,
  listExtensions,
  setExtensionStatus,
} from "./store.mjs";
import { note } from "../fieldlog.mjs";

const KINDS = new Set([
  "tool",
  "mcp",
  "skill",
  "agent",
  "integration",
  "automation",
  "other",
]);
const RISKS = new Set(["low", "medium", "high"]);

function clean(value, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function keyFor(gap, proposal) {
  return `${gap} ${proposal}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 240);
}

function pendingHours() {
  return Number(process.env.SK_EXTENSION_PENDING_HOURS || 72);
}

function cooldownHours() {
  return Number(process.env.SK_EXTENSION_COOLDOWN_HOURS || 6);
}

function dedupeDays() {
  return Number(process.env.SK_EXTENSION_DEDUPE_DAYS || 7);
}

// Create a proposal, ask the operative, and return what happened. This never
// implements anything; approval is a separate step.
export function proposeExtension(input = {}) {
  const gap = clean(input.gap, 300);
  const proposal = clean(input.proposal, 300);
  if (!gap || !proposal) {
    return { ok: false, error: "gap and proposal are required" };
  }
  const kind = KINDS.has(String(input.kind || "").toLowerCase())
    ? String(input.kind).toLowerCase()
    : "other";
  const risk = RISKS.has(String(input.risk || "").toLowerCase())
    ? String(input.risk).toLowerCase()
    : "medium";
  const why = clean(input.why, 500);
  const requires = clean(input.requires, 400);
  const source = clean(input.source, 600);
  const now = Date.now();
  const recent = listExtensions(50);

  // One live question at a time; old unanswered ones expire so they cannot
  // block the system forever.
  for (const old of recent) {
    if (old.status === "pending" && now - old.ts > pendingHours() * 3600e3) {
      setExtensionStatus(old.id, "expired");
      old.status = "expired";
    }
  }
  const pending = recent.find((row) => row.status === "pending");
  if (pending) {
    return { ok: false, skipped: "pending", proposal: pending };
  }

  const key = keyFor(gap, proposal);
  const duplicate = recent.find(
    (row) =>
      keyFor(row.gap, row.proposal) === key &&
      now - row.ts < dedupeDays() * 86400e3,
  );
  if (duplicate) {
    return { ok: false, skipped: "duplicate", proposal: duplicate };
  }
  const last = recent[0];
  if (last && now - last.ts < cooldownHours() * 3600e3) {
    return { ok: false, skipped: "cooldown", proposal: last };
  }

  const row = {
    id: randomUUID(),
    ts: now,
    kind,
    gap,
    proposal,
    why,
    risk,
    requires,
    source,
    status: "pending",
  };
  insertExtension(row);

  const message = `I found a gap: ${gap}. I can extend myself to ${proposal}. Risk ${risk}. Authorize? yes or no.`;
  try {
    enqueueSay(message, "say");
  } catch {
    // The proposal is still stored even if the phone is offline.
  }
  try {
    note("extension", `Proposed (${kind}, ${risk}): ${gap} -> ${proposal}`);
  } catch {}
  return { ok: true, proposal: row, message };
}

export function extensionList(limit = 20, status = null) {
  return listExtensions(limit, status);
}

export function decideExtension(id, decision, detail = "") {
  const wanted = String(decision || "").toLowerCase();
  if (wanted !== "approved" && wanted !== "denied") {
    return { ok: false, error: "decision must be approved or denied" };
  }
  const row = getExtension(id);
  if (!row) return { ok: false, error: "proposal not found" };
  if (row.status !== "pending") {
    return { ok: false, error: `proposal is already ${row.status}` };
  }
  const updated = setExtensionStatus(row.id, wanted);
  try {
    note(
      "extension",
      `${wanted === "approved" ? "Approved" : "Denied"}: ${row.gap} -> ${row.proposal}` +
        (detail ? ` (${clean(detail, 300)})` : ""),
    );
  } catch {}
  return { ok: true, proposal: updated };
}
