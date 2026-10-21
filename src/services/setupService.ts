export const DEFAULT_SETUP_URL = "http://127.0.0.1:8797";

export function setupUrl(): string {
  try {
    return (localStorage.getItem("sk-setup-url") || DEFAULT_SETUP_URL).replace(/\/+$/, "");
  } catch {
    return DEFAULT_SETUP_URL;
  }
}

export function setSetupUrl(url: string): void {
  try {
    localStorage.setItem("sk-setup-url", url.trim().replace(/\/+$/, ""));
  } catch {
    // Ignore.
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeout = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${setupUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init.headers || {}) },
    });
    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text.slice(0, 300) };
    }
    if (!response.ok) {
      throw new Error(
        typeof data === "object" && data !== null && "error" in data
          ? String((data as { error: unknown }).error)
          : `setup HTTP ${response.status}`,
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The local setup service took too long to answer.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "The setup service is not running. In the desktop app it should start automatically; otherwise run `npm run setup`.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface SetupStatus {
  ok: boolean;
  repoDir: string;
  mapsHome: string;
  defaults: { region: string };
  runtime: Record<string, string>;
  ollama: { installed: boolean; running: boolean; models: string[] };
  maps: {
    tileDir: string;
    tilesBuilt: boolean;
    tileSize: number;
    gazetteer: string;
    gazetteerBuilt: boolean;
    gazetteerSize: number;
    valhallaRunning: boolean;
    built: boolean;
  };
  services: { bridge: boolean; mcp: boolean; opencode: boolean };
  jobs: SetupJob[];
}

export interface SetupJob {
  id: string;
  target: string;
  status: "running" | "done" | "error" | "cancelled";
  started: string;
  finished?: string;
  exitCode?: number | null;
  region?: string;
  log: string;
  tail?: string;
}

export function setupStatus(): Promise<SetupStatus> {
  return request<SetupStatus>("/status", {}, 20000);
}

export function startSetup(
  target: "ollama" | "maps" | "services" | "hq",
  options: { region?: string } = {},
): Promise<{ ok: boolean; job: SetupJob }> {
  return request(
    "/install",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, ...options }),
    },
    30000,
  );
}

export function setupJob(id: string): Promise<SetupJob> {
  return request<SetupJob>(`/jobs/${encodeURIComponent(id)}`, {}, 10000);
}

export function cancelSetupJob(id: string): Promise<{ ok: boolean }> {
  return request(`/jobs/${encodeURIComponent(id)}`, { method: "DELETE" }, 10000);
}
