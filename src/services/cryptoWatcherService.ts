import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";

export type WatcherChain = "btc" | "ltc" | "eth";

export interface WatcherConfig {
  btc?: string;
  ltc?: string;
  eth?: string;
  [key: string]: string | undefined;
}

const isTauri = () =>
  typeof window !== "undefined" &&
  Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);

export function watcherChain(value: string | undefined): WatcherChain | null {
  const text = String(value || "").toLowerCase();
  if (text.includes("btc") || text.includes("bitcoin")) return "btc";
  if (text.includes("ltc") || text.includes("litecoin")) return "ltc";
  if (text.includes("eth") || text.includes("ethereum")) return "eth";
  return null;
}

async function configPath(): Promise<string> {
  const home = await homeDir();
  return `${home.replace(/\/+$/, "")}/.config/crypto-watch/config.json`;
}

export async function readCryptoWatcherConfig(): Promise<WatcherConfig> {
  if (!isTauri()) return {};
  try {
    const path = await configPath();
    if (!(await exists(path))) return {};
    return JSON.parse(await readTextFile(path)) as WatcherConfig;
  } catch {
    return {};
  }
}

export async function writeCryptoWatcherAddress(
  chain: WatcherChain,
  address: string,
): Promise<WatcherConfig> {
  if (!isTauri()) {
    throw new Error("The crypto watcher config is only available in the desktop app.");
  }
  const path = await configPath();
  const dir = path.replace(/\/[^/]+$/, "");
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  const current = (await exists(path))
    ? (JSON.parse(await readTextFile(path)) as WatcherConfig)
    : {};
  const next = { ...current, [chain]: address.trim() };
  await writeTextFile(path, `${JSON.stringify(next, null, 1)}\n`);
  return next;
}

export async function removeCryptoWatcherAddress(
  chain: WatcherChain,
): Promise<WatcherConfig> {
  if (!isTauri()) return {};
  const path = await configPath();
  if (!(await exists(path))) return {};
  const current = JSON.parse(await readTextFile(path)) as WatcherConfig;
  const next = { ...current };
  delete next[chain];
  await writeTextFile(path, `${JSON.stringify(next, null, 1)}\n`);
  return next;
}
