import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_DIR = process.env.WA_PROJECT_DIR || dirname(fileURLToPath(import.meta.url));
const ENV_FILE = join(PROJECT_DIR, ".env");

try {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
} catch {
  // process.loadEnvFile is available on Node >= 20.12; ignore if absent.
}

function env(name, fallback = undefined) {
  const value = process.env[name];
  return value === undefined || value === "" ? fallback : value;
}

export const STATE_DIR = env("WA_STATE_DIR", join(PROJECT_DIR, "state"));
export const DB_PATH = env("WA_DB", join(STATE_DIR, "bridge.db"));

export const OPENCODE_URL = env("OPENCODE_URL", "http://127.0.0.1:4096").replace(/\/$/, "");
export const OPENCODE_DIRECTORY = env("OPENCODE_DIRECTORY");
export const OPENCODE_AGENT = env("OPENCODE_AGENT");
export const OPENCODE_MODEL = env("OPENCODE_MODEL");

// Default agent for unprefixed WhatsApp messages.
export const WHATSAPP_AGENT = env("WA_AGENT", "whatsapp");

// Where inbound receipt photos/PDFs are dropped for the beancount pipeline.
export const BEANCOUNT_DIR = env("WA_BEANCOUNT_DIR", join(homedir(), "beancount"));
export const PETBOOK_DIR = env("WA_PETBOOK_DIR", join(homedir(), "petbook"));
export const RECEIPT_INBOX = env("WA_RECEIPT_INBOX", join(BEANCOUNT_DIR, "inbox"));

// Where attachments for general/HQ agents are saved (kept out of the beancount
// receipt inbox so stray photos aren't picked up by the importer).
export const MEDIA_INBOX = env("WA_MEDIA_INBOX", join(homedir(), ".local/state/wa-media"));

// Vision model for general/HQ image turns. The local HQ model (Qwen 3.6 MLX)
// is text-only, so an attached image is handed to this cloud model instead.
// Must be a model whose capabilities include image input.
export const MEDIA_MODEL = env(
  "WA_MEDIA_MODEL",
  "ollama-cloud/deepseek-v4.1-flash",
);

// Prefixes that route a WhatsApp message to a specific agent instead of the
// default one. Keys are the literal prefixes users type; values are agent names.
//
// WA_AGENT_ONLY silos a bridge to a single agent: it clears every prefix route
// so the chat only ever talks to that one agent (e.g. a company bridge with its
// own WhatsApp agent key and chat).
const ONLY = env("WA_AGENT_ONLY");
export const AGENT_ROUTES = ONLY
  ? {}
  : {
      [env("WA_BEN_PREFIX", "/ben")]: env("WA_BEN_AGENT", "bean"),
      [env("WA_BELLA_PREFIX", "/bella")]: env("WA_BELLA_AGENT", "bella"),
    };

// When WA_AGENT_ONLY is set, every message goes to that agent.
export const AGENT_ONLY = ONLY || null;

// Only these numbers may drive opencode. Empty means "nobody" (fail closed):
// anyone who can message this WhatsApp account must not get shell access.
export const ALLOWED_NUMBERS = (env("WA_ALLOWED_NUMBERS", "") || "")
  .split(",")
  .map((n) => n.replace(/[^0-9]/g, ""))
  .filter(Boolean);

export const OWNER_NUMBER = env("WA_OWNER_NUMBER", ALLOWED_NUMBERS[0]);

// Numbers the send_whatsapp tool may message. Empty means any recipient.
export const SEND_ALLOWLIST = (env("WA_SEND_ALLOWLIST", "") || "")
  .split(",")
  .map((n) => n.replace(/[^0-9]/g, ""))
  .filter(Boolean);

// What to do when opencode asks to run a command from a WhatsApp-driven session:
// "reject" | "once" | "always". Default reject; opt in explicitly.
export const PERMISSION_MODE = env("WA_PERMISSION_MODE", "reject");
export const PERMISSION_REPLY_MODE =
  PERMISSION_MODE === "always" ? "always" : PERMISSION_MODE === "once" ? "once" : "reject";

export const REPLY_TIMEOUT_MS = Number(env("WA_REPLY_TIMEOUT_MS", "600000"));
export const POLL_INTERVAL_MS = Number(env("WA_POLL_INTERVAL_MS", "500"));

export function normalizeNumber(input) {
  return String(input || "").replace(/[^0-9]/g, "");
}

export function numberToJid(input) {
  const digits = normalizeNumber(input);
  if (!digits) return null;
  if (digits.endsWith("@s.whatsapp.net")) return digits;
  return `${digits}@s.whatsapp.net`;
}

export function jidToNumber(jid) {
  return String(jid || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
}
