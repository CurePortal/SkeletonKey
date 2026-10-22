// Local map intelligence: one client for the SkeletonKey geo bridge.
//
// The bridge (tools/geo-http.mjs) sits in front of:
//   - Valhalla routing/height/locate
//   - the OSM gazetteer (names, places)
//   - beacond (phone position/track)
//
// Keeping the shapes here means the map component, future agent tools, and any
// other page all speak the same protocol. Nothing is sent anywhere except the
// user's own localhost bridge.

export interface GeoPlace {
  lat: number;
  lon: number;
  name: string;
  category: string;
  subcat: string;
  distanceM?: number;
}

export interface GeoPoint {
  lat: number;
  lon: number;
  matched?: string;
}

export interface GeoRoute {
  from: GeoPoint;
  to: GeoPoint;
  costing: string;
  distanceKm: number;
  durationMin: number;
  maneuvers: Array<{
    instruction: string;
    lengthKm: number;
    timeSec: number;
    street: string;
  }>;
  geometry: Array<{ lat: number; lon: number }>;
}

export interface BeaconPosition {
  id?: number | string;
  ts: number;
  lat: number;
  lon: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  altitude?: number | null;
  battery?: number | null;
  source?: string;
}

export interface BeaconSnapshot {
  ok: boolean;
  clients?: number;
  latest: BeaconPosition | null;
  track: BeaconPosition[];
}

export interface LocalHealth {
  ok: boolean;
  gazetteer: boolean;
  gazetteerError: string;
  valhalla: boolean;
  valhallaUrl: string;
  beacon: boolean;
  beaconUrl: string;
  opencode: boolean;
  opencodeUrl: string;
  ollama?: boolean;
  ollamaUrl?: string;
  fava?: boolean;
  favaUrl?: string;
  beancount?: boolean;
  beancountFile?: string;
  version: string;
}

export const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8788";

export function bridgeUrl(): string {
  try {
    return (
      localStorage.getItem("sk-geo-url") ||
      (import.meta.env.VITE_GEO_URL as string | undefined) ||
      DEFAULT_BRIDGE_URL
    ).replace(/\/+$/, "");
  } catch {
    return DEFAULT_BRIDGE_URL;
  }
}

export function setBridgeUrl(url: string): void {
  try {
    localStorage.setItem("sk-geo-url", url.trim().replace(/\/+$/, ""));
  } catch {
    // Ignore storage failures.
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 120_000,
  token = "",
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${bridgeUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text.slice(0, 300) };
    }
    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null && "error" in data
          ? String((data as { error: unknown }).error)
          : `HTTP ${response.status}`;
      throw new Error(message);
    }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The local map service took too long to answer.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Could not reach the local map bridge. Start it with `npm run geo`.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function localHealth(): Promise<LocalHealth> {
  return request<LocalHealth>("/health", {}, 15_000);
}

export async function findPlaces(
  query: string,
  limit = 10,
): Promise<GeoPlace[]> {
  const data = await request<{ places: GeoPlace[] }>(
    `/find?q=${encodeURIComponent(query)}&limit=${limit}`,
    {},
    15_000,
  );
  return data.places ?? [];
}

export async function reversePlace(
  lat: number,
  lon: number,
  radius = 800,
): Promise<GeoPlace[]> {
  const data = await request<{ places: GeoPlace[] }>(
    `/reverse?lat=${lat}&lon=${lon}&radius=${radius}`,
    {},
    15_000,
  );
  return data.places ?? [];
}

export async function nearbyPlaces(
  lat: number,
  lon: number,
  radius = 3000,
  category = "",
): Promise<GeoPlace[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius: String(radius),
  });
  if (category) params.set("category", category);
  const data = await request<{ places: GeoPlace[] }>(
    `/nearby?${params.toString()}`,
    {},
    20_000,
  );
  return data.places ?? [];
}

export function routeBetween(
  from: string,
  to: string,
  costing: "auto" | "bicycle" | "pedestrian" | "truck" | "bus" = "auto",
): Promise<GeoRoute> {
  return request<GeoRoute>(
    "/route",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, costing }),
    },
    150_000,
  );
}

export async function heightAt(
  lat: number,
  lon: number,
  range = false,
): Promise<number | null> {
  const data = await request<{ height?: number[] }>(
    "/height",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points: [{ lat, lon }], range }),
    },
    60_000,
  );
  return data.height?.[0] ?? null;
}

export function beaconHealth(): Promise<{
  ok: boolean;
  clients?: number;
  latest: BeaconPosition | null;
}> {
  return request("/beacon/health", {}, 10_000);
}

export function beaconSnapshot(
  token: string,
  limit = 120,
): Promise<BeaconSnapshot> {
  return request<BeaconSnapshot>(
    `/beacon/whereami?limit=${limit}`,
    {},
    15_000,
    token,
  );
}

export function beaconHistory(
  days = 7,
  limit = 5000,
): Promise<BeaconSnapshot & { days: number; count: number }> {
  return request<BeaconSnapshot & { days: number; count: number }>(
    `/beacon/history?days=${days}&limit=${limit}`,
    {},
    20_000,
  );
}

export function beaconSay(
  token: string,
  message: string,
): Promise<{ ok: boolean; delivered: number }> {
  return request(
    "/beacon/say",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, kind: "say" }),
    },
    15_000,
    token,
  );
}

export function formatCoord(point: { lat: number; lon: number }): string {
  return `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
}
