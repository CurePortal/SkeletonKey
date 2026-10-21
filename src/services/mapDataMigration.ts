import { ProjectType, AnchoredShape, LocationType } from "../types";

import * as MapAnchorUtils from "../types/mapUtils";

interface LegacyDrawnShape {
  id: string;
  type: "polygon" | "polyline" | "circle" | "rectangle" | "marker";
  coordinates: any;
  properties: {
    name?: string;
    description?: string;
    color?: string;
    timelineId?: string;
    dateCreated: string;
  };
}

export function ensureProjectHasMapData(project: any): ProjectType {
  let migratedProject = project;

  if (
    !migratedProject.narratives ||
    !Array.isArray(migratedProject.narratives)
  ) {
    migratedProject = {
      ...migratedProject,
      narratives: [],
    };
  }

  if (!migratedProject.mapData) {
    migratedProject = {
      ...migratedProject,
      mapData: {
        anchoredShapes: [],
        scenarios: [],
        defaultMapSettings: {
          baseMap: "standard" as const,
          showBorders: true,
          showLabels: true,
          defaultZoom: 2,
          defaultCenter: { lat: 30, lng: 0 },
        },
      },
    };
  }

  if (
    migratedProject.drawnShapes &&
    Array.isArray(migratedProject.drawnShapes)
  ) {
    const migratedShapes = migrateLegacyShapes(
      migratedProject.drawnShapes,
      migratedProject.locations || [],
    );

    migratedProject.mapData.anchoredShapes = [
      ...migratedProject.mapData.anchoredShapes,
      ...migratedShapes,
    ];

    delete migratedProject.drawnShapes;

    console.log(
      `Migrated ${migratedShapes.length} legacy shapes to anchored shapes`,
    );
  }

  return migratedProject as ProjectType;
}

function migrateLegacyShapes(
  legacyShapes: LegacyDrawnShape[],
  locations: LocationType[],
): AnchoredShape[] {
  const migratedShapes: AnchoredShape[] = [];

  for (const legacyShape of legacyShapes) {
    try {
      const migratedShape = migrateSingleShape(legacyShape, locations);
      if (migratedShape) {
        migratedShapes.push(migratedShape);
      }
    } catch (error) {
      console.warn(`Failed to migrate shape ${legacyShape.id}:`, error);
    }
  }

  return migratedShapes;
}

function migrateSingleShape(
  legacyShape: LegacyDrawnShape,
  locations: LocationType[],
): AnchoredShape | null {
  let coordinates: { lat: number; lng: number }[] = [];

  if (legacyShape.type === "marker") {
    if (
      legacyShape.coordinates &&
      typeof legacyShape.coordinates.lat === "number" &&
      typeof legacyShape.coordinates.lng === "number"
    ) {
      coordinates = [legacyShape.coordinates];
    }
  } else if (Array.isArray(legacyShape.coordinates)) {
    coordinates = legacyShape.coordinates.filter(
      (coord) =>
        coord && typeof coord.lat === "number" && typeof coord.lng === "number",
    );
  } else if (
    legacyShape.coordinates &&
    typeof legacyShape.coordinates.lat === "number" &&
    typeof legacyShape.coordinates.lng === "number"
  ) {
    coordinates = [legacyShape.coordinates];
  }

  if (coordinates.length === 0) {
    console.warn(`No valid coordinates found for shape ${legacyShape.id}`);
    return null;
  }

  const anchorLocation = MapAnchorUtils.findBestAnchor(coordinates, locations);
  if (!anchorLocation) {
    console.warn(
      `No suitable anchor location found for shape ${legacyShape.id}`,
    );
    return null;
  }

  try {
    const anchoredShape = MapAnchorUtils.createAnchoredShape(
      coordinates,
      anchorLocation,
      legacyShape.type,
      {
        name: legacyShape.properties.name,
        description: legacyShape.properties.description,
        timelineId: legacyShape.properties.timelineId,
        dateCreated: legacyShape.properties.dateCreated,
        dateModified: new Date().toISOString(),
        category: "custom",
      },
    );

    anchoredShape.id = legacyShape.id;

    anchoredShape.style = {
      ...anchoredShape.style,
      color: legacyShape.properties.color || "#3388ff",
    };

    return anchoredShape;
  } catch (error) {
    console.error(
      `Failed to create anchored shape for ${legacyShape.id}:`,
      error,
    );
    return null;
  }
}
