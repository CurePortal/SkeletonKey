import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import type { FinanceSourceType } from "../types/project";
import { hqUrl } from "./hqBridgeService";

export type WatcherChain = "btc" | "ltc" | "eth" | "xmr";

export interface WatcherConfig {
  btc?: string;
  ltc?: string;
  eth?: string;
  [key: string]: string | undefined;
}

export interface WatcherState {
  config: WatcherConfig;
  addresses: Partial<Record<WatcherChain, string>>;
  configReadable: boolean;
  xmrError: string;
}

export interface WatcherReconcilePlan {
  create: Array<Omit<FinanceSourceType, "id" | "createdAt" | "updatedAt">>;
  update: Array<{ id: string; patch: Partial<FinanceSourceType> }>;
  remove: string[];
}

const CHAIN_LABELS: Record<WatcherChain, { name: string; account: string }> = {
  btc: { name: "Bitcoin", account: "Assets:Crypto:Bitcoin" },
  ltc: { name: "Litecoin", account: "Assets:Crypto:Litecoin" },
  eth: { name: "Ethereum", account: "Assets:Crypto:Ethereum" },
  xmr: { name: "Monero", account: "Assets:Crypto:Monero" },
};

export function chainLabel(chain: WatcherChain): string {
  return CHAIN_LABELS[chain].name;
}

const isTauri = () =>
  typeof window !== "undefined" &&
  Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);

export function watcherChain(value: string | undefined): WatcherChain | null {
  const text = String(value || "").toLowerCase();
  if (text.includes("xmr") || text.includes("monero")) return "xmr";
  if (text.includes("btc") || text.includes("bitcoin")) return "btc";
  if (text.includes("ltc") || text.includes("litecoin")) return "ltc";
  if (text.includes("eth") || text.includes("ethereum")) return "eth";
  return null;
}

export const isAddressWatcherChain = (
  chain: WatcherChain | null,
): chain is Exclude<WatcherChain, "xmr"> => chain === "btc" || chain === "ltc" || chain === "eth";

async function configPath(): Promise<string> {
  const home = await homeDir();
  return `${home.replace(/\/+$/, "")}/.config/crypto-watch/config.json`;
}

export async function readCryptoWatcherConfig(): Promise<WatcherConfig> {
  return (await readCryptoWatcherConfigFile()).config;
}

async function readCryptoWatcherConfigFile(): Promise<{
  config: WatcherConfig;
  readable: boolean;
}> {
  if (!isTauri()) return { config: {}, readable: false };
  try {
    const path = await configPath();
    if (!(await exists(path))) return { config: {}, readable: false };
    return {
      config: JSON.parse(await readTextFile(path)) as WatcherConfig,
      readable: true,
    };
  } catch {
    return { config: {}, readable: false };
  }
}

export async function readXmrWalletAddress(): Promise<{
  address: string;
  error: string;
}> {
  try {
    const response = await fetch("http://127.0.0.1:18083/json_rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "0",
        method: "get_address",
        params: { account_index: 0 },
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      return { address: "", error: `Wallet RPC returned ${response.status}.` };
    }
    const json = await response.json();
    const address = String(json?.result?.address || "").trim();
    return {
      address,
      error: address ? "" : "Wallet RPC did not return an address.",
    };
  } catch (error) {
    return {
      address: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function readViaBridge(): Promise<WatcherState | null> {
  try {
    const response = await fetch(`${hqUrl()}/crypto/watchers`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const json = await response.json();
    const addresses = (json?.addresses || {}) as Partial<
      Record<WatcherChain, string>
    >;
    return {
      config: (json?.config || {}) as WatcherConfig,
      addresses: {
        btc: addresses.btc,
        ltc: addresses.ltc,
        eth: addresses.eth,
        xmr: addresses.xmr,
      },
      configReadable: Boolean(json?.configReadable),
      xmrError: String(json?.xmrError || ""),
    };
  } catch {
    return null;
  }
}

export async function readWatcherState(): Promise<WatcherState> {
  const bridged = await readViaBridge();
  if (bridged) return bridged;
  const { config, readable } = await readCryptoWatcherConfigFile();
  const addresses: Partial<Record<WatcherChain, string>> = {};
  for (const [key, value] of Object.entries(config)) {
    const chain = watcherChain(key);
    if (chain && chain !== "xmr" && value) addresses[chain] = String(value).trim();
  }
  const xmr = await readXmrWalletAddress();
  if (xmr.address) addresses.xmr = xmr.address;
  return { config, addresses, configReadable: readable, xmrError: xmr.error };
}

export async function writeCryptoWatcherAddress(
  chain: WatcherChain,
  address: string,
): Promise<WatcherConfig> {
  if (!isAddressWatcherChain(chain)) {
    throw new Error("Monero is watched by xmr-watch, not the address config.");
  }
  const value = address.trim();
  if (!value) throw new Error("Wallet address is required.");
  try {
    const response = await fetch(`${hqUrl()}/crypto/watchers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ chain, address: value }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const json = await response.json();
      return (json?.config || {}) as WatcherConfig;
    }
  } catch {
    // Fall back to the desktop filesystem below.
  }
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
  const next = { ...current, [chain]: value };
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

const sameAddress = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

const hasTag = (source: FinanceSourceType, tag: string) =>
  (source.tags || []).some((value) => value.toLowerCase() === tag);

/**
 * Reconcile the finance sources in the project with what the watchers actually
 * watch. Watcher state is authoritative: BTC/LTC/ETH from the address config,
 * XMR from the local view-only wallet RPC.
 */
export function planWatcherReconcile(
  sources: FinanceSourceType[],
  addresses: Partial<Record<WatcherChain, string>>,
  prunable: WatcherChain[] = [],
): WatcherReconcilePlan {
  const plan: WatcherReconcilePlan = { create: [], update: [], remove: [] };
  const crypto = (sources || []).filter((source) => source.kind === "crypto");
  const claimed = new Set<string>();

  for (const [chainKey, address] of Object.entries(addresses) as Array<
    [WatcherChain, string | undefined]
  >) {
    const addressValue = String(address || "").trim();
    if (!addressValue) continue;
    const label = CHAIN_LABELS[chainKey];
    const candidates = crypto.filter(
      (source) =>
        !claimed.has(source.id) &&
        watcherChain(source.chain || source.name) === chainKey,
    );
    const exact =
      candidates.find((source) => sameAddress(source.reference || "", addressValue)) ||
      candidates[0];

    if (!exact) {
      plan.create.push({
        name: `${label.name} wallet`,
        kind: "crypto",
        status: "active",
        ledgerAccount: label.account,
        envVar: "",
        reference: addressValue,
        chain: chainKey.toUpperCase(),
        notes: "Managed by the local crypto watcher.",
        tags: ["watcher"],
        lastSync: "",
      });
      continue;
    }

    claimed.add(exact.id);
    const patch: Partial<FinanceSourceType> = {};
    if ((exact.chain || "").toUpperCase() !== chainKey.toUpperCase()) {
      patch.chain = chainKey.toUpperCase();
    }
    if (!sameAddress(exact.reference || "", addressValue)) {
      patch.reference = addressValue;
    }
    if (!(exact.tags || []).some((tag) => tag.toLowerCase() === "watcher")) {
      patch.tags = [...(exact.tags || []), "watcher"];
    }
    if (Object.keys(patch).length) {
      plan.update.push({ id: exact.id, patch });
    }
  }

  const watchedChains = new Set(
    Object.entries(addresses)
      .filter(([, value]) => String(value || "").trim())
      .map(([chain]) => chain),
  );
  for (const source of crypto) {
    const chain = watcherChain(source.chain || source.name);
    if (!chain) continue;
    if (!watchedChains.has(chain)) {
      if (hasTag(source, "watcher") && prunable.includes(chain)) {
        plan.remove.push(source.id);
      }
      continue;
    }
    if (claimed.has(source.id)) continue;
    if (hasTag(source, "watcher") && prunable.includes(chain)) {
      plan.remove.push(source.id);
      continue;
    }
    if (!String(source.reference || "").trim()) {
      plan.remove.push(source.id);
    }
  }

  return plan;
}
