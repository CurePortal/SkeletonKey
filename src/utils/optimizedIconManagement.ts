import { useMemo } from "react";
import { LocationType } from "../types";
import { createLeafletIcon, MAP_ICONS } from "./mapIcons";
import L from "leaflet";

// Create lookup maps for O(1) icon lookups
const ICON_ID_MAP = new Map(MAP_ICONS.map((icon) => [icon.id, icon]));

// Pre-built category mapping for faster lookups
const CATEGORY_ICON_MAP = new Map([
  // Location Types from form
  ["planet", "pin-blue"],
  ["continent", "pin-green"],
  ["country", "pin-yellow"],
  ["state/province", "pin-orange"],
  ["region", "pin-purple"],
  ["city", "building"],
  ["town", "home"],
  ["village", "home"],
  ["district/borough", "pin-pink"],
  ["neighborhood", "home"],
  ["building", "building"],
  ["room", "home"],
  ["landmark", "tourist"],
  ["natural feature", "mountain"],
  ["point of interest", "tourist"],
  ["fictional location", "pin-purple"],
  ["historical site", "tourist"],
  ["geographical area", "pin-lightblue"],
  ["other", "place-generic"],
  // Legacy mappings
  ["capital", "building"],
  ["military", "pin-red"],
  ["battle", "pin-red"],
  ["fort", "pin-red"],
  ["castle", "building"],
  ["school", "schools"],
  ["university", "university"],
  ["hospital", "hospitals"],
  ["church", "church"],
  ["park", "park"],
  ["mountain", "mountain"],
  ["restaurant", "restaurant"],
  ["hotel", "lodging"],
  ["airport", "airports"],
  ["station", "train-station"],
]);

// Cache for created Leaflet icons to avoid recreation
const ICON_CACHE = new Map<string, L.Icon>();
const DEFAULT_ICON_ID = "place-generic";

function getIconIdForLocation(location: LocationType): string {
  // PRIORITY 1: Manual icon ID
  const manualIconId = location.properties?.iconId;
  if (manualIconId && ICON_ID_MAP.has(manualIconId)) {
    return manualIconId;
  }

  // PRIORITY 2: Imported icon ID
  const importedIconId = location.properties?.importedIconId;
  if (importedIconId && ICON_ID_MAP.has(importedIconId)) {
    return importedIconId;
  }

  // PRIORITY 3: Location type mapping
  if (location.type) {
    const typeIconId = CATEGORY_ICON_MAP.get(location.type.toLowerCase());
    if (typeIconId) {
      return typeIconId;
    }
  }

  // PRIORITY 4: Tag-based mapping
  if (location.tags && location.tags.length > 0) {
    for (const tag of location.tags) {
      const tagIconId = CATEGORY_ICON_MAP.get(tag.toLowerCase());
      if (tagIconId) {
        return tagIconId;
      }
    }
  }

  // PRIORITY 5: Legacy mapData category
  if (location.mapData?.category) {
    const categoryIconId = CATEGORY_ICON_MAP.get(location.mapData.category);
    if (categoryIconId) {
      return categoryIconId;
    }
  }

  return DEFAULT_ICON_ID;
}

function getCachedLeafletIcon(iconId: string): L.Icon {
  if (!ICON_CACHE.has(iconId)) {
    try {
      const icon = createLeafletIcon(iconId);
      ICON_CACHE.set(iconId, icon);
    } catch (error) {
      console.error(`Failed to create icon for ${iconId}:`, error);
      if (!ICON_CACHE.has(DEFAULT_ICON_ID)) {
        ICON_CACHE.set(DEFAULT_ICON_ID, createLeafletIcon(DEFAULT_ICON_ID));
      }
      return ICON_CACHE.get(DEFAULT_ICON_ID)!;
    }
  }
  return ICON_CACHE.get(iconId)!;
}

export function useLocationIcons(locations: LocationType[]) {
  return useMemo(() => {
    const iconMap = new Map<string, L.Icon>();

    for (const location of locations) {
      const iconId = getIconIdForLocation(location);
      const icon = getCachedLeafletIcon(iconId);
      iconMap.set(location.id, icon);
    }

    return iconMap;
  }, [locations]);
}
