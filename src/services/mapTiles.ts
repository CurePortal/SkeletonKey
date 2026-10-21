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
