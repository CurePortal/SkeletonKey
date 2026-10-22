import type { ProjectType } from "../types";

// The SkeletonKey MCP exposes the same local project over HTTP so the app and
// HQ share one record. No account, no cloud; this is loopback only.
export const DEFAULT_HQ_URL = "http://127.0.0.1:8799";

export function hqUrl(): string {
  try {
    return (
      localStorage.getItem("sk-hq-url") || DEFAULT_HQ_URL
    ).replace(/\/+$/, "");
  } catch {
    return DEFAULT_HQ_URL;
  }
}

export function setHqUrl(url: string): void {
  try {
    localStorage.setItem("sk-hq-url", url.trim().replace(/\/+$/, ""));
  } catch {
    // Ignore storage failures.
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeout = 20000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${hqUrl()}${path}`, {
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
          : `HQ bridge HTTP ${response.status}`,
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The HQ bridge took too long to answer.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the SkeletonKey MCP. Run `npm run mcp` and check the HQ URL.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export interface HqStatus {
  ok: boolean;
  project: { id: string; name: string; updatedAt: string };
  counts: {
    timelines: number;
    events: number;
    locations: number;
    characters: number;
    sourceDocuments: number;
    narratives: number;
  };
  storage: { projectFile: string; bridge: string; http: string };
  beaconTokenConfigured: boolean;
}

export function hqStatus(): Promise<HqStatus> {
  return request<HqStatus>("/health", {}, 5000);
}

export function hqPullProject(): Promise<ProjectType> {
  return request<ProjectType>("/project", {}, 15000);
}

export interface HqProjectAction {
  kind: string;
  args?: Record<string, unknown>;
}

export interface HqActionResponse {
  ok: boolean;
  results: Array<{
    ok: boolean;
    kind?: string;
    result?: unknown;
    error?: string;
  }>;
}

export interface BeancountStatus {
  ok: boolean;
  reachable?: boolean;
  error?: string | null;
  favaUrl: string;
  root: string;
  ledgerFile: string;
}

export function beancountStatus(): Promise<BeancountStatus> {
  return request<BeancountStatus>("/beancount/status", {}, 10000);
}

export function beancountReport(
  report: "balance_sheet" | "income_statement",
): Promise<any> {
  return request<any>(`/beancount/${report}`, {}, 20000);
}

export function beancountQuery(query: string): Promise<any> {
  return request<any>(
    `/beancount/query?query_string=${encodeURIComponent(query)}`,
    {},
    20000,
  );
}

export function runHqActions(
  actions: HqProjectAction[],
): Promise<HqActionResponse> {
  return request<HqActionResponse>(
    "/actions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actions }),
    },
    30000,
  );
}

export function hqPushProject(project: ProjectType): Promise<HqStatus> {
  return request<HqStatus>(
    "/project",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    },
    30000,
  );
}
