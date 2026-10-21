import { LocationType, AnchoredShape, Coordinates } from "../types";

function haversineDistance(p1: Coordinates, p2: Coordinates): number {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
  const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * (Math.PI / 180)) *
      Math.cos(p2.lat * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getCenter(coords: Coordinates[]): Coordinates {
  if (coords.length === 0) return { lat: 0, lng: 0 };
  if (coords.length === 1) return coords[0];
  const sum = coords.reduce(
    (acc, curr) => ({ lat: acc.lat + curr.lat, lng: acc.lng + curr.lng }),
    { lat: 0, lng: 0 },
  );
  return {
    lat: sum.lat / coords.length,
    lng: sum.lng / coords.length,
  };
}

export function findBestAnchor(
  coordinates: Coordinates[],
  locations: LocationType[],
): LocationType | null {
  if (locations.length === 0 || coordinates.length === 0) {
    return null;
  }
  const shapeCenter = getCenter(coordinates);
  let bestLocation: LocationType | null = null;
  let minDistance = Infinity;
  for (const location of locations) {
    if (location.coordinates) {
      const distance = haversineDistance(shapeCenter, location.coordinates);
      if (distance < minDistance) {
        minDistance = distance;
        bestLocation = location;
      }
    }
  }
  return bestLocation;
}

export function createAnchoredShape(
  coordinates: Coordinates[],
  anchorLocation: LocationType,
  type: AnchoredShape["type"],
  properties: Omit<AnchoredShape["properties"], "dateCreated"> & {
    dateCreated: string;
  },
): AnchoredShape {
  const anchorCoords = anchorLocation.coordinates;
  if (!anchorCoords) {
    throw new Error(`Anchor location ${anchorLocation.id} has no coordinates.`);
  }

  const shapeCenter = getCenter(coordinates);
  const offsetLat = shapeCenter.lat - anchorCoords.lat;
  const offsetLng = shapeCenter.lng - anchorCoords.lng;

  const id = `shape_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  let geometry: AnchoredShape["geometry"];
  switch (type) {
    case "marker":
      geometry = {};
      break;
    case "polygon":
    case "polyline":
      geometry = {
        points: coordinates.map((c) => ({
          lat: c.lat - anchorCoords.lat,
          lng: c.lng - anchorCoords.lng,
        })),
      };
      break;
    case "circle":
      geometry = { radius: 1000 };
      break;
    case "rectangle":
      geometry = { width: 1000, height: 500 };
      break;
    default:
      geometry = {};
  }
  return {
    id: id,
    type: type,
    anchor: {
      locationId: anchorLocation.id,
      offsetLat: offsetLat,
      offsetLng: offsetLng,
      anchorType: "center",
    },
    geometry: geometry,
    style: {
      color: "#3388ff",
      fillColor: "#3388ff",
      opacity: 1,
      fillOpacity: 0.2,
      strokeWidth: 3,
    },
    properties: {
      name: properties.name || "Migrated Shape",
      description: properties.description || "",
      category: "custom",
      timelineId: properties.timelineId,
      dateCreated: properties.dateCreated,
      dateModified: new Date().toISOString(),
      tags: [],
      visibilityRules: {},
    },
  };
}
