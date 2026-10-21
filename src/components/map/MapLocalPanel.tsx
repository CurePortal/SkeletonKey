import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BeaconPosition,
  GeoPlace,
  GeoRoute,
  LocalHealth,
  beaconHealth,
  beaconHistory,
  bridgeUrl,
  findPlaces,
  formatCoord,
  heightAt,
  localHealth,
  nearbyPlaces,
  reversePlace,
  routeBetween,
} from "../../services/mapIntelligenceService";

interface AddLocationInput {
  name: string;
  lat: number;
  lng: number;
  category?: string;
  description?: string;
}

interface MapLocalPanelProps {
  center: { lat: number; lng: number };
  onCenterChange: (center: { lat: number; lng: number }) => void;
  onZoomChange: (zoom: number) => void;
  onRoute: (route: GeoRoute | null) => void;
  onBeacon: (position: BeaconPosition | null) => void;
  onTrack: (track: BeaconPosition[]) => void;
  onFocus: (point: { lat: number; lng: number; name: string } | null) => void;
  onAddLocation?: (input: AddLocationInput) => void;
  timelineId?: string | null;
}

type Tab = "live" | "search" | "route" | "nearby" | "height";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "live", label: "Live" },
  { id: "search", label: "Search" },
  { id: "route", label: "Route" },
  { id: "nearby", label: "Nearby" },
  { id: "height", label: "Height" },
];

const inputClass =
  "w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500";
const buttonClass =
  "px-2.5 py-1.5 text-xs rounded font-medium bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed";
const secondaryClass =
  "px-2.5 py-1.5 text-xs rounded font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50";
const labelClass = "block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1";

const distanceKm = (track: BeaconPosition[]): number => {
  let km = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    km += 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  return km;
};

const MapLocalPanel: React.FC<MapLocalPanelProps> = ({
  center,
  onCenterChange,
  onZoomChange,
  onRoute,
  onBeacon,
  onTrack,
  onFocus,
  onAddLocation,
  timelineId,
}) => {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("live");
  const [health, setHealth] = useState<LocalHealth | null>(null);
  const [healthError, setHealthError] = useState("");
  const [beacon, setBeacon] = useState<BeaconPosition | null>(null);
  const [track, setTrack] = useState<BeaconPosition[]>([]);
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem("sk-beacon-token") || "";
    } catch {
      return "";
    }
  });
  const [tokenSaved, setTokenSaved] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem("sk-beacon-token"));
    } catch {
      return false;
    }
  });
  const [follow, setFollow] = useState(false);
  const [historyDays, setHistoryDays] = useState(() => {
    try {
      return Number(localStorage.getItem("sk-track-days")) || 7;
    } catch {
      return 7;
    }
  });
  const [historyCount, setHistoryCount] = useState(0);
  const [historyKm, setHistoryKm] = useState(0);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showTrack, setShowTrack] = useState(true);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoPlace[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const [routeFrom, setRouteFrom] = useState("");
  const [routeTo, setRouteTo] = useState("");
  const [costing, setCosting] = useState<
    "auto" | "bicycle" | "pedestrian" | "truck" | "bus"
  >("auto");
  const [route, setRoute] = useState<GeoRoute | null>(null);
  const [routeError, setRouteError] = useState("");
  const [routing, setRouting] = useState(false);

  const [radius, setRadius] = useState(1500);
  const [nearby, setNearby] = useState<GeoPlace[]>([]);
  const [nearbyError, setNearbyError] = useState("");

  const [heightLat, setHeightLat] = useState(String(center.lat.toFixed(5)));
  const [heightLon, setHeightLon] = useState(String(center.lng.toFixed(5)));
  const [heightValue, setHeightValue] = useState<string>("");
  const [heightError, setHeightError] = useState("");

  const beaconPoint = beacon
    ? { lat: beacon.lat, lon: beacon.lon }
    : null;

  const refreshHealth = useCallback(async () => {
    setHealthError("");
    try {
      setHealth(await localHealth());
    } catch (error) {
      setHealth(null);
      setHealthError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const refreshBeacon = useCallback(async () => {
    try {
      const h = await beaconHealth();
      setBeacon(h.latest ?? null);
      onBeacon(h.latest ?? null);
    } catch {
      // health is best-effort; the panel shows the service chip
    }
  }, [onBeacon]);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const snapshot = await beaconHistory(historyDays, 5000);
      const rows = snapshot.track ?? [];
      setTrack(rows);
      onTrack(showTrack ? rows : []);
      setHistoryCount(rows.length);
      setHistoryKm(distanceKm(rows));
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDays, onTrack, showTrack]);

  useEffect(() => {
    void refreshHealth();
    const timer = setInterval(() => void refreshHealth(), 20_000);
    return () => clearInterval(timer);
  }, [refreshHealth]);

  useEffect(() => {
    void refreshBeacon();
    const timer = setInterval(() => void refreshBeacon(), 12_000);
    return () => clearInterval(timer);
  }, [refreshBeacon]);

  useEffect(() => {
    try {
      localStorage.setItem("sk-track-days", String(historyDays));
    } catch {
      // Ignore storage failures.
    }
    void refreshHistory();
    const timer = setInterval(() => void refreshHistory(), 60_000);
    return () => clearInterval(timer);
  }, [refreshHistory, historyDays]);

  useEffect(() => {
    if (follow && beacon) {
      onCenterChange({ lat: beacon.lat, lng: beacon.lon });
    }
  }, [follow, beacon, onCenterChange]);

  const saveToken = () => {
    try {
      if (token.trim()) sessionStorage.setItem("sk-beacon-token", token.trim());
      else sessionStorage.removeItem("sk-beacon-token");
    } catch {
      // sessionStorage may be unavailable
    }
    setTokenSaved(Boolean(token.trim()));
    void refreshBeacon();
  };

  const centerOn = (lat: number, lng: number, zoom = 14) => {
    onCenterChange({ lat, lng });
    onZoomChange(zoom);
  };

  const addPlace = (place: GeoPlace) => {
    onAddLocation?.({
      name: place.name,
      lat: place.lat,
      lng: place.lon,
      category: place.category,
      description: `Local gazetteer: ${place.category}${
        place.subcat ? ` / ${place.subcat}` : ""
      }`,
    });
  };

  const addBeacon = () => {
    if (!beacon) return;
    onAddLocation?.({
      name: `Beacon ${new Date(beacon.ts).toLocaleTimeString()}`,
      lat: beacon.lat,
      lng: beacon.lon,
      category: "beacon",
      description: `Phone position, accuracy ${beacon.accuracy ?? "?"}m`,
    });
  };

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      setSearchResults(await findPlaces(query.trim(), 12));
    } catch (error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : String(error));
    } finally {
      setSearching(false);
    }
  };

  const doReverse = async () => {
    setSearching(true);
    setSearchError("");
    try {
      const point = beaconPoint ?? { lat: center.lat, lon: center.lng };
      setSearchResults(await reversePlace(point.lat, point.lon, radius));
    } catch (error) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : String(error));
    } finally {
      setSearching(false);
    }
  };

  const doRoute = async () => {
    if (!routeFrom.trim() || !routeTo.trim()) return;
    setRouting(true);
    setRouteError("");
    try {
      const result = await routeBetween(routeFrom.trim(), routeTo.trim(), costing);
      setRoute(result);
      onRoute(result);
      onFocus(null);
      onCenterChange({ lat: result.from.lat, lng: result.from.lon });
      onZoomChange(11);
    } catch (error) {
      setRoute(null);
      onRoute(null);
      setRouteError(error instanceof Error ? error.message : String(error));
    } finally {
      setRouting(false);
    }
  };

  const doNearby = async () => {
    setNearbyError("");
    try {
      const point = beaconPoint ?? { lat: center.lat, lon: center.lng };
      setNearby(await nearbyPlaces(point.lat, point.lon, radius));
    } catch (error) {
      setNearby([]);
      setNearbyError(error instanceof Error ? error.message : String(error));
    }
  };

  const doHeight = async () => {
    setHeightError("");
    setHeightValue("");
    const lat = Number(heightLat);
    const lon = Number(heightLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setHeightError("Use decimal latitude and longitude.");
      return;
    }
    try {
      const value = await heightAt(lat, lon);
      setHeightValue(value == null ? "—" : `${value} m`);
    } catch (error) {
      setHeightError(error instanceof Error ? error.message : String(error));
    }
  };

  const statusChips = useMemo(
    () => [
      { label: "Valhalla", on: Boolean(health?.valhalla) },
      { label: "Gazetteer", on: Boolean(health?.gazetteer) },
      { label: "Beacon", on: Boolean(health?.beacon) },
    ],
    [health],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 shadow-sm text-gray-700 dark:text-gray-200 text-left"
      >
        Local map services
      </button>
    );
  }

  return (
    <div
      id="map-local-panel"
      className="w-full shrink-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Local map services
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              health?.ok ? "bg-green-500" : "bg-red-500"
            }`}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void refreshHealth()}
            className="px-1.5 py-1 text-[11px] rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            title="Refresh service status"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-1.5 py-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            aria-label="Collapse local map services"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        {statusChips.map((chip) => (
          <span
            key={chip.label}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              chip.on
                ? "border-green-600 text-green-700 dark:text-green-400"
                : "border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400"
            }`}
          >
            {chip.label}
          </span>
        ))}
      </div>

      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            data-tab={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 px-1 py-1.5 text-[11px] font-medium ${
              tab === item.id
                ? "text-blue-700 dark:text-blue-300 border-b-2 border-blue-600"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-3">
        {healthError && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            {healthError}
          </p>
        )}

        {tab === "live" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Phone beacon
              </span>
              <label className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={follow}
                  onChange={(event) => setFollow(event.target.checked)}
                />
                Follow
              </label>
            </div>
            {beacon ? (
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1">
                  <div className="text-gray-500 dark:text-gray-400">Latitude</div>
                  <div className="font-medium">{beacon.lat.toFixed(5)}</div>
                </div>
                <div className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1">
                  <div className="text-gray-500 dark:text-gray-400">Longitude</div>
                  <div className="font-medium">{beacon.lon.toFixed(5)}</div>
                </div>
                <div className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1">
                  <div className="text-gray-500 dark:text-gray-400">Speed</div>
                  <div className="font-medium">
                    {beacon.speed != null ? `${beacon.speed.toFixed(2)} m/s` : "—"}
                  </div>
                </div>
                <div className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1">
                  <div className="text-gray-500 dark:text-gray-400">Accuracy</div>
                  <div className="font-medium">
                    {beacon.accuracy != null ? `${Math.round(beacon.accuracy)} m` : "—"}
                  </div>
                </div>
                <div className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1">
                  <div className="text-gray-500 dark:text-gray-400">Battery</div>
                  <div className="font-medium">
                    {beacon.battery != null ? `${Math.round(beacon.battery)}%` : "—"}
                  </div>
                </div>
                <div className="rounded bg-gray-100 dark:bg-gray-700 px-2 py-1">
                  <div className="text-gray-500 dark:text-gray-400">Altitude</div>
                  <div className="font-medium">
                    {beacon.altitude != null ? `${Math.round(beacon.altitude)} m` : "—"}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                No position yet. The phone may be offline.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={secondaryClass}
                disabled={!beacon}
                onClick={() => beacon && centerOn(beacon.lat, beacon.lon)}
              >
                Center
              </button>
              <button
                type="button"
                className={secondaryClass}
                disabled={!beacon}
                onClick={addBeacon}
              >
                Add as location
              </button>
              <button
                type="button"
                className={secondaryClass}
                disabled={!beacon}
                onClick={() => {
                  if (!beacon) return;
                  setRouteFrom(formatCoord({ lat: beacon.lat, lon: beacon.lon }));
                }}
              >
                Use as route start
              </button>
            </div>

            <div className="rounded border border-gray-200 dark:border-gray-700 p-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                  Track history
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {historyLoading
                    ? "loading…"
                    : `${historyCount} points · ${historyKm.toFixed(1)} km`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {[1, 7, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={
                      historyDays === days
                        ? "px-2 py-0.5 text-[10px] rounded bg-blue-600 text-white"
                        : "px-2 py-0.5 text-[10px] rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                    }
                    onClick={() => setHistoryDays(days)}
                  >
                    {days === 1 ? "Today" : `${days} days`}
                  </button>
                ))}
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() => setShowTrack((value) => !value)}
                >
                  {showTrack ? "Hide route" : "Show route"}
                </button>
                <button
                  type="button"
                  className={secondaryClass}
                  onClick={() => void refreshHistory()}
                >
                  Refresh
                </button>
              </div>
              {historyError && (
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  {historyError}
                </p>
              )}
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                Saved locally from the phone beacon · {bridgeUrl()}
              </p>
            </div>

            <div>
              <label className={labelClass} htmlFor="beacon-token">
                Beacon token (session only)
              </label>
              <div className="flex gap-1.5">
                <input
                  id="beacon-token"
                  type="password"
                  className={inputClass}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder={tokenSaved ? "••••••••" : "paste token"}
                  autoComplete="off"
                />
                <button type="button" className={buttonClass} onClick={saveToken}>
                  Save
                </button>
              </div>
              <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                Only needed to send messages. Never saved to the project.
              </p>
            </div>
          </div>
        )}

        {tab === "search" && (
          <div className="space-y-2">
            <label className={labelClass} htmlFor="geo-search">
              Gazetteer place search
            </label>
            <div className="flex gap-1.5">
              <input
                id="geo-search"
                className={inputClass}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void doSearch();
                }}
                placeholder="Golden Gate Bridge"
              />
              <button type="button" className={buttonClass} onClick={() => void doSearch()}>
                Find
              </button>
            </div>
            <div className="flex gap-1.5">
              <button type="button" className={secondaryClass} onClick={() => void doReverse()}>
                Reverse at beacon / center
              </button>
            </div>
            {searching && <p className="text-[11px] text-gray-500">Searching…</p>}
            {searchError && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">{searchError}</p>
            )}
            <div className="space-y-1">
              {searchResults.map((place) => (
                <div
                  key={`${place.name}-${place.lat}-${place.lon}`}
                  className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5"
                >
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-100">
                    {place.name}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    [{place.category}] {formatCoord(place)} {place.distanceM != null ? `· ${Math.round(place.distanceM)} m` : ""}
                  </div>
                  <div className="mt-1 flex gap-1.5">
                    <button
                      type="button"
                      className={secondaryClass}
                      onClick={() => {
                        onFocus({ lat: place.lat, lng: place.lon, name: place.name });
                        centerOn(place.lat, place.lon);
                      }}
                    >
                      Go
                    </button>
                    <button type="button" className={buttonClass} onClick={() => addPlace(place)}>
                      Add location
                    </button>
                    <button
                      type="button"
                      className={secondaryClass}
                      onClick={() => setRouteTo(formatCoord(place))}
                    >
                      Route to
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "route" && (
          <div className="space-y-2">
            <label className={labelClass} htmlFor="route-from">
              From (place or lat,lon)
            </label>
            <input
              id="route-from"
              className={inputClass}
              value={routeFrom}
              onChange={(event) => setRouteFrom(event.target.value)}
              placeholder="Ferry Building"
            />
            <label className={labelClass} htmlFor="route-to">
              To (place or lat,lon)
            </label>
            <input
              id="route-to"
              className={inputClass}
              value={routeTo}
              onChange={(event) => setRouteTo(event.target.value)}
              placeholder="SFO Airport"
            />
            <div className="flex items-center gap-1.5">
              <select
                className={inputClass}
                value={costing}
                onChange={(event) => setCosting(event.target.value as typeof costing)}
              >
                <option value="auto">auto</option>
                <option value="pedestrian">pedestrian</option>
                <option value="bicycle">bicycle</option>
                <option value="truck">truck</option>
                <option value="bus">bus</option>
              </select>
              <button type="button" className={buttonClass} onClick={() => void doRoute()} disabled={routing}>
                {routing ? "Routing…" : "Route"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={secondaryClass}
                disabled={!beacon}
                onClick={() => beacon && setRouteFrom(formatCoord({ lat: beacon.lat, lon: beacon.lon }))}
              >
                Start at beacon
              </button>
              <button
                type="button"
                className={secondaryClass}
                disabled={!beacon}
                onClick={() => beacon && setRouteTo(formatCoord({ lat: beacon.lat, lon: beacon.lon }))}
              >
                End at beacon
              </button>
              <button
                type="button"
                className={secondaryClass}
                onClick={() => {
                  setRoute(null);
                  onRoute(null);
                }}
              >
                Clear
              </button>
            </div>
            {routeError && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">{routeError}</p>
            )}
            {route && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-gray-800 dark:text-gray-100">
                  {route.distanceKm.toFixed(1)} km · {route.durationMin} min
                </div>
                <ol className="text-[11px] text-gray-600 dark:text-gray-300 list-decimal pl-4 space-y-0.5">
                  {route.maneuvers.slice(0, 12).map((maneuver, index) => (
                    <li key={`${index}-${maneuver.instruction}`}>
                      {maneuver.instruction}{" "}
                      <span className="text-gray-400">({maneuver.lengthKm.toFixed(1)} km)</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {tab === "nearby" && (
          <div className="space-y-2">
            <label className={labelClass} htmlFor="nearby-radius">
              Radius (m)
            </label>
            <input
              id="nearby-radius"
              type="number"
              className={inputClass}
              value={radius}
              onChange={(event) => setRadius(Number(event.target.value))}
            />
            <button type="button" className={buttonClass} onClick={() => void doNearby()}>
              Nearby beacon / center
            </button>
            {nearbyError && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">{nearbyError}</p>
            )}
            <div className="space-y-1">
              {nearby.map((place) => (
                <div
                  key={`${place.name}-${place.lat}-${place.lon}`}
                  className="flex items-center justify-between gap-2 rounded border border-gray-200 dark:border-gray-700 px-2 py-1"
                >
                  <span className="min-w-0">
                    <span className="block text-xs text-gray-800 dark:text-gray-100 truncate">
                      {place.name}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {place.category} · {place.distanceM != null ? `${Math.round(place.distanceM)} m` : ""}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <button
                      type="button"
                      className={secondaryClass}
                      onClick={() => {
                        onFocus({ lat: place.lat, lng: place.lon, name: place.name });
                        centerOn(place.lat, place.lon, 15);
                      }}
                    >
                      Go
                    </button>
                    <button type="button" className={buttonClass} onClick={() => addPlace(place)}>
                      Add
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "height" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className={labelClass} htmlFor="height-lat">
                  Latitude
                </label>
                <input
                  id="height-lat"
                  className={inputClass}
                  value={heightLat}
                  onChange={(event) => setHeightLat(event.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="height-lon">
                  Longitude
                </label>
                <input
                  id="height-lon"
                  className={inputClass}
                  value={heightLon}
                  onChange={(event) => setHeightLon(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={secondaryClass}
                onClick={() => {
                  setHeightLat(center.lat.toFixed(5));
                  setHeightLon(center.lng.toFixed(5));
                }}
              >
                Use map center
              </button>
              <button
                type="button"
                className={secondaryClass}
                disabled={!beacon}
                onClick={() => {
                  if (!beacon) return;
                  setHeightLat(beacon.lat.toFixed(5));
                  setHeightLon(beacon.lon.toFixed(5));
                }}
              >
                Use beacon
              </button>
              <button type="button" className={buttonClass} onClick={() => void doHeight()}>
                Height
              </button>
            </div>
            {heightValue && (
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                Elevation: {heightValue}
              </p>
            )}
            {heightError && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">{heightError}</p>
            )}
            {timelineId && (
              <p className="text-[10px] text-gray-400 dark:text-gray-500">
                New locations attach to timeline {timelineId.slice(0, 8)}…
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MapLocalPanel;
