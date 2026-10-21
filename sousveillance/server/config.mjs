// Beacon configuration. Values come from the environment; a .env file next to
// this module is loaded if present.
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// .env lives next to this module (the repo), so the project is self-contained.
const ENV_FILE = process.env.BEACON_ENV || join(dirname(fileURLToPath(import.meta.url)), ".env");
if (existsSync(ENV_FILE)) {
  try {
    process.loadEnvFile(ENV_FILE);
  } catch {
    // Node < 20.12; rely on the caller exporting the vars.
  }
}

export const PORT = Number(process.env.BEACON_PORT || 8787);
export const HOST = process.env.BEACON_HOST || "127.0.0.1";
export const TOKEN = process.env.BEACON_TOKEN || "";
export const DB_PATH =
  process.env.BEACON_DB || join(homedir(), ".local/state/beacon/beacon.db");

// How many position samples to keep before pruning old ones.
export const TRACK_MAX = Number(process.env.BEACON_TRACK_MAX || 20000);

// Optional 32-byte (64 hex char) pre-shared key enabling end-to-end payload
// encryption. When set, position payloads and agent->phone messages are
// AES-256-GCM encrypted, so the tunnel edge (Cloudflare) sees only ciphertext.
// The bearer BEACON_TOKEN still authenticates; this protects the *content*.
export const KEY_HEX = (process.env.BEACON_KEY || "").trim();
export const HAS_KEY = /^[0-9a-fA-F]{64}$/.test(KEY_HEX);
export const KEY = HAS_KEY ? Buffer.from(KEY_HEX, "hex") : null;
