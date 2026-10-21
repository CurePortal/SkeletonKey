#!/usr/bin/env node
// MCP server exposing the wallet watcher to opencode agents.
// Tools: wallet_status, wallet_events, wallet_notify.
import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const HOME = homedir();
const XDG_STATE = process.env.XDG_STATE_HOME || join(HOME, ".local/state");
const XDG_CONFIG = process.env.XDG_CONFIG_HOME || join(HOME, ".config");
const STATE = process.env.CRYPTO_WATCH_STATE_DIR || join(XDG_STATE, "crypto-watch");
const EVENTS = process.env.CRYPTO_WATCH_EVENTS || join(STATE, "events.jsonl");
const CONF = process.env.CRYPTO_WATCH_CONFIG || join(XDG_CONFIG, "crypto-watch/config.json");
const RPC = process.env.XMR_RPC || "http://127.0.0.1:18083/json_rpc";
const CRYPTO_EVENT = process.env.CRYPTO_EVENT || join(HOME, ".local/bin/crypto-event");
const HERE = fileURLToPath(new URL(".", import.meta.url));
function eventBin() {
  const local = join(HERE, "crypto-event");
  return existsSync(local) ? local : CRYPTO_EVENT;
}

const server = new McpServer({ name: "crypto-watch", version: "0.1.0" });

function readEvents(limit = 20) {
  if (!existsSync(EVENTS)) return [];
  const lines = readFileSync(EVENTS, "utf8").trim().split("\n").filter(Boolean);
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try { out.push(JSON.parse(lines[i])); } catch {}
  }
  return out;
}

async function rpc(method, params = {}) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "0", method, params }),
    signal: AbortSignal.timeout(4000),
  });
  const json = await res.json();
  return json.result;
}

function active(unit) {
  try {
    const out = execFileSync("systemctl", ["--user", "is-active", unit], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out === "active";
  } catch (err) {
    if (String(err.stderr || err.message).includes("bus")) return null;
    return false;
  }
}

server.registerTool(
  "wallet_status",
  {
    title: "Wallet watcher status",
    description:
      "Status of the crypto watchers: XMR wallet height/balance, BTC/ETH/LTC config, services, last events.",
    inputSchema: {},
  },
  async () => {
    const status = {
      xmr_service: active("xmr-watch.service"),
      poll_timer: active("crypto-watch.timer"),
      addresses: existsSync(CONF) ? JSON.parse(readFileSync(CONF, "utf8")) : {},
      last_events: readEvents(3),
    };
    try {
      const h = await rpc("get_height");
      const b = await rpc("get_balance", { account_index: 0 });
      status.xmr = {
        height: h?.height,
        balance: b?.balance ?? null,
        unlocked: b?.unlocked_balance ?? null,
      };
      if (status.xmr_service === null) status.xmr_service = true;
    } catch (err) {
      status.xmr = { error: String(err).slice(0, 200) };
    }
    return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
  },
);

server.registerTool(
  "wallet_events",
  {
    title: "Recent wallet events",
    description: "Recent money-in/money-out events recorded by the watcher, newest first.",
    inputSchema: { limit: z.number().int().min(1).max(200).optional() },
  },
  async ({ limit }) => {
    const events = readEvents(limit ?? 20);
    return {
      content: [{
        type: "text",
        text: events.length ? JSON.stringify(events, null, 2) : "No wallet events recorded yet.",
      }],
    };
  },
);

server.registerTool(
  "wallet_notify",
  {
    title: "Broadcast a wallet event",
    description:
      "Send a wallet event through the notifiers: desktop, phone (beacon TTS), WhatsApp from HQ, and the event log.",
    inputSchema: {
      chain: z.string().describe("Asset, e.g. XMR, BTC, ETH, LTC"),
      direction: z.enum(["in", "out"]).describe("in = received, out = sent"),
      amount: z.string().describe("Human amount, e.g. 0.5"),
      txid: z.string().optional(),
      note: z.string().optional(),
    },
  },
  async ({ chain, direction, amount, txid, note }) => {
    const args = [eventBin(), "--chain", chain,
      "--direction", direction, "--amount", String(amount)];
    if (txid) args.push("--txid", txid);
    if (note) args.push("--note", note);
    const result = await new Promise((resolve) => {
      execFile(args[0], args.slice(1), { timeout: 30000 }, (err, stdout, stderr) => {
        resolve({ ok: !err, code: err?.code ?? 0, stderr: String(stderr || "").trim() });
      });
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ ...result, chain, direction, amount }) }],
      isError: !result.ok,
    };
  },
);

await server.connect(new StdioServerTransport());
