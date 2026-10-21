// Map tile provider settings. The CARTO key is never hardcoded; it is entered
// in Settings and kept in localStorage on this machine (or sessionStorage if
// the user prefers). No key = key-free OpenStreetMap tiles.

export type MapTileStyle = "osm" | "carto-voyager" | "carto-dark";

export interface MapTileSettings {
  style: MapTileStyle;
  cartoKey: string;
}

const ENV_CARTO_KEY = (import.meta.env.VITE_CARTO_KEY as string | undefined) || "";

export function getMapTileSettings(): MapTileSettings {
  try {
    const style = localStorage.getItem("sk-map-style") as MapTileStyle | null;
    const storedKey = localStorage.getItem("sk-carto-key") || "";
    const cartoKey = storedKey || ENV_CARTO_KEY;
    return {
      style:
        style === "carto-voyager" || style === "carto-dark"
          ? style
          : cartoKey
            ? "carto-voyager"
            : "osm",
      cartoKey,
    };
  } catch {
    return {
      style: ENV_CARTO_KEY ? "carto-voyager" : "osm",
      cartoKey: ENV_CARTO_KEY,
    };
  }
}

export function setMapTileSettings(settings: MapTileSettings): void {
  try {
    localStorage.setItem("sk-map-style", settings.style);
    if (settings.cartoKey.trim()) {
      localStorage.setItem("sk-carto-key", settings.cartoKey.trim());
    } else {
      localStorage.removeItem("sk-carto-key");
    }
    window.dispatchEvent(new Event("sk-map-tiles-changed"));
  } catch {
    // Ignore storage failures.
  }
}

export function mapTileUrl(
  settings: MapTileSettings,
  isDark: boolean,
): string {
  if (settings.style === "osm" || !settings.cartoKey) {
    return "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  }
  const layer =
    settings.style === "carto-dark" || isDark ? "dark_all" : "voyager";
  return `https://basemaps.cartocdn.com/rastertiles/${layer}/{z}/{x}/{y}.png?key=${encodeURIComponent(settings.cartoKey)}`;
}

export function mapTileAttribution(settings: MapTileSettings): string {
  if (settings.style === "osm" || !settings.cartoKey) {
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  }
  return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
}

// The terrain and satellite base maps are independent of the CARTO preference:
// choosing one overrides the tile source until the user switches back to
// Standard, which keeps using OSM/CARTO.
const ESRI_WORLD_IMAGERY =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const OPENTOPO_MAP = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";

export function baseMapTileUrl(
  baseMap: string,
  settings: MapTileSettings,
  isDark: boolean,
): string {
  if (baseMap === "satellite") return ESRI_WORLD_IMAGERY;
  if (baseMap === "terrain") return OPENTOPO_MAP;
  return mapTileUrl(settings, isDark);
}

export function baseMapAttribution(
  baseMap: string,
  settings: MapTileSettings,
): string {
  if (baseMap === "satellite") {
    return "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";
  }
  if (baseMap === "terrain") {
    return 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)';
  }
  return mapTileAttribution(settings);
}
