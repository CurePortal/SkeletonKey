import { bridgeUrl } from "./mapIntelligenceService";

export interface FieldLogEvent {
  id: number;
  ts: number;
  kind: string;
  lat: number | null;
  lon: number | null;
  detail: string;
}

export async function recentFieldLogEvents(
  days = 7,
  limit = 100,
): Promise<FieldLogEvent[]> {
  const response = await fetch(
    `${bridgeUrl()}/fieldlog/recent?days=${days}&limit=${limit}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!response.ok) throw new Error(`Field log HTTP ${response.status}`);
  const data = await response.json();
  return Array.isArray(data.events) ? (data.events as FieldLogEvent[]) : [];
}
