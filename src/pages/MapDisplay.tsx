// src/components/MapDisplay.tsx - Corrected & Enhanced
import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
  Circle,
  CircleMarker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { createLeafletIcon, MAP_ICONS } from "../utils/mapIcons";
import { useLocationIcons } from "../utils/optimizedIconManagement";
import {
  getMapTileSettings,
  mapTileAttribution,
  mapTileUrl,
  type MapTileSettings,
} from "../services/mapTiles";
import L, { LatLngExpression, LatLngTuple } from "leaflet";
import { LocationType, AnchoredShape, Coordinates } from "../types";
import type {
  BeaconPosition,
  GeoRoute,
} from "../services/mapIntelligenceService";
import ImprovedVectorDrawingSystem from "../components/VectorDrawingSystem";
import DrawingToolsPanel from "../components/DrawingToolsPanel";

// World wrapping utilities
const normalizeCoordinates = (coords: Coordinates): Coordinates => {
  let { lat, lng } = coords;
  lat = Math.max(-90, Math.min(90, lat));
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return { lat, lng };
};

const getWrappedCoordinates = (
  coords: Coordinates[],
  bounds?: L.LatLngBounds | null,
): Coordinates[][] => {
  const normalized = coords.map(normalizeCoordinates);
  const wrapped: Coordinates[][] = [];

  if (!bounds) {
    wrapped.push(normalized);
    wrapped.push(normalized.map((c) => ({ ...c, lng: c.lng + 360 })));
    wrapped.push(normalized.map((c) => ({ ...c, lng: c.lng - 360 })));
    return wrapped;
  }

  const west = bounds.getWest();
  const east = bounds.getEast();
  const startWorld = Math.floor(west / 360);
  const endWorld = Math.ceil(east / 360);

  for (let worldOffset = startWorld; worldOffset <= endWorld; worldOffset++) {
    const offsetCoords = normalized.map((c) => ({
      ...c,
      lng: c.lng + worldOffset * 360,
    }));
    wrapped.push(offsetCoords);
  }

  return wrapped;
};

const getWrappedMarkers = (
  coord: Coordinates,
  bounds?: L.LatLngBounds | null,
): Coordinates[] => {
  const normalized = normalizeCoordinates(coord);
  const wrapped: Coordinates[] = [];

  if (!bounds) {
    return [
      normalized,
      { ...normalized, lng: normalized.lng + 360 },
      { ...normalized, lng: normalized.lng - 360 },
    ];
  }

  const west = bounds.getWest();
  const east = bounds.getEast();
  const startWorld = Math.floor(west / 360);
  const endWorld = Math.ceil(east / 360);

  for (let worldOffset = startWorld; worldOffset <= endWorld; worldOffset++) {
    wrapped.push({
      ...normalized,
      lng: normalized.lng + worldOffset * 360,
    });
  }

  return wrapped;
};

// Leaflet Icon Fix
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadowUrl from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: iconUrl,
  shadowUrl: iconShadowUrl,
  iconSize: [20, 33],
  iconAnchor: [10, 33],
  popupAnchor: [1, -28],
  shadowSize: [33, 33],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapDisplayProps {
  timelineId: string | null;
  date: string;
  mapDisplayLocations: LocationType[];
  allTimelineLocations: LocationType[];
  zoom: number;
  center: { lat: number; lng: number };
  baseMap: string;
  showBorders: boolean;
  showLabels: boolean;
  onZoomChange: (zoom: number) => void;
  onCenterChange: (center: { lat: number; lng: number }) => void;
  onLocationClick: (location: LocationType) => void;
  onClearFocus: () => void;
  onShapesChange?: (shapes: AnchoredShape[]) => void;
  savedShapes?: AnchoredShape[];
  onBaseMapChange?: (baseMap: string) => void;
  onEditLocation?: (location: LocationType) => void;
  selectedShapeId?: string | null;
  onShapeSelect?: (shapeId: string | null) => void;
  onShapeUpdate?: (updatedShape: AnchoredShape) => void;
  boundsToFit?: Coordinates[] | null;
  onBoundsFit?: () => void;
  drawingTrigger?: number;
  localRoute?: GeoRoute | null;
  beaconPosition?: BeaconPosition | null;
  beaconTrack?: BeaconPosition[];
  focusPoint?: { lat: number; lng: number; name: string } | null;
}

export type DrawingMode = "vector" | "classic" | null;
export type DrawingTool = "polygon" | "polyline" | "marker" | "circle" | null;

export interface DrawingState {
  mode: DrawingMode;
  tool: DrawingTool;
  isActive: boolean;
  classicPoints: Coordinates[];
}

const calculateAbsoluteCoordinates = (
  shape: AnchoredShape,
  anchorLocation: LocationType,
): LatLngExpression[] => {
  if (shape.anchor.locationId === "origin") {
    const pointsToUse = shape.geometry.points;
    if (!pointsToUse || pointsToUse.length === 0) {
      return [[shape.anchor.offsetLat, shape.anchor.offsetLng]];
    }
    return pointsToUse.map((point) => [point.lat, point.lng] as LatLngTuple);
  }

  if (!anchorLocation?.coordinates) {
    console.warn(
      `Shape ${shape.id}: Anchor ${anchorLocation?.id} (${anchorLocation?.name}) has no coordinates.`,
    );
    return [];
  }

  const anchorCoords = anchorLocation.coordinates;
  const { offsetLat, offsetLng } = shape.anchor;
  const pointsToUse = shape.geometry.points;

  if (!pointsToUse || pointsToUse.length === 0) {
    if (shape.type === "marker" || shape.type === "circle") {
      return [[anchorCoords.lat + offsetLat, anchorCoords.lng + offsetLng]];
    }
    return [];
  }

  return pointsToUse.map((relativePoint) => [
    anchorCoords.lat + offsetLat + relativePoint.lat,
    anchorCoords.lng + offsetLng + relativePoint.lng,
  ]);
};

// Map bounds hook for wrapping detection
const useMapBounds = (map: L.Map | null) => {
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);

  useEffect(() => {
    if (!map) return;
    const updateBounds = () => setBounds(map.getBounds());
    updateBounds();
    map.on("moveend zoomend", updateBounds);
    return () => {
      map.off("moveend zoomend", updateBounds);
    };
  }, [map]);

  return bounds;
};

// Component to handle map events
const MapEventsHandler: React.FC<{
  drawingState: DrawingState;
  onMapClick: (coords: Coordinates) => void;
  onViewChange: () => void;
  setMapInstance: (map: L.Map) => void;
}> = ({ drawingState, onMapClick, onViewChange, setMapInstance }) => {
  const map = useMap();

  useEffect(() => {
    setMapInstance(map);
  }, [map, setMapInstance]);

  useMapEvents({
    click(e) {
      if (
        drawingState.isActive &&
        drawingState.mode === "classic" &&
        drawingState.tool
      ) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
    zoomend: onViewChange,
    moveend: onViewChange,
  });

  useEffect(() => {
    map.getContainer().style.cursor = drawingState.isActive ? "crosshair" : "";
  }, [drawingState.isActive, map]);

  return null;
};

// Wrapped Shape Components
const WrappedMarker: React.FC<{
  position: Coordinates;
  icon: L.Icon;
  bounds: L.LatLngBounds | null;
  children?: React.ReactNode;
  eventHandlers?: any;
}> = ({ position, icon, bounds, children, eventHandlers }) => {
  const wrappedPositions = getWrappedMarkers(position, bounds);
  return (
    <>
      {wrappedPositions
        .filter((pos) => !bounds || bounds.contains([pos.lat, pos.lng]))
        .map((pos, index) => (
          <Marker
            key={`wrapped-marker-${Math.floor(pos.lng / 360)}-${index}`}
            position={[pos.lat, pos.lng]}
            icon={icon}
            eventHandlers={eventHandlers}
          >
            {children}
          </Marker>
        ))}
    </>
  );
};

const WrappedPolygon: React.FC<{
  positions: LatLngExpression[];
  bounds: L.LatLngBounds | null;
  pathOptions: any;
  eventHandlers?: any;
}> = ({ positions, bounds, pathOptions, eventHandlers }) => {
  const coords = positions.map((pos) =>
    Array.isArray(pos) ? { lat: pos[0], lng: pos[1] } : pos,
  ) as Coordinates[];
  const wrappedCoords = getWrappedCoordinates(coords, bounds);
  return (
    <>
      {wrappedCoords
        .filter(
          (coordSet) =>
            !bounds ||
            coordSet.some((coord) => bounds.contains([coord.lat, coord.lng])),
        )
        .map((coordSet, index) => (
          <Polygon
            key={`wrapped-polygon-${
              coordSet.length > 0 ? Math.floor(coordSet[0].lng / 360) : 0
            }-${index}`}
            positions={coordSet.map((c) => [c.lat, c.lng] as LatLngTuple)}
            pathOptions={pathOptions}
            eventHandlers={eventHandlers}
          />
        ))}
    </>
  );
};

const WrappedPolyline: React.FC<{
  positions: LatLngExpression[];
  bounds: L.LatLngBounds | null;
  pathOptions: any;
  eventHandlers?: any;
}> = ({ positions, bounds, pathOptions, eventHandlers }) => {
  const coords = positions.map((pos) =>
    Array.isArray(pos) ? { lat: pos[0], lng: pos[1] } : pos,
  ) as Coordinates[];
  const wrappedCoords = getWrappedCoordinates(coords, bounds);
  return (
    <>
      {wrappedCoords
        .filter(
          (coordSet) =>
            !bounds ||
            coordSet.some((coord) => bounds.contains([coord.lat, coord.lng])),
        )
        .map((coordSet, index) => (
          <Polyline
            key={`wrapped-polyline-${
              coordSet.length > 0 ? Math.floor(coordSet[0].lng / 360) : 0
            }-${index}`}
            positions={coordSet.map((c) => [c.lat, c.lng] as LatLngTuple)}
            pathOptions={pathOptions}
            eventHandlers={eventHandlers}
          />
        ))}
    </>
  );
};

const WrappedCircle: React.FC<{
  center: Coordinates;
  radius: number;
  bounds: L.LatLngBounds | null;
  pathOptions: any;
  eventHandlers?: any;
}> = ({ center, radius, bounds, pathOptions, eventHandlers }) => {
  const wrappedCenters = getWrappedMarkers(center, bounds);
  return (
    <>
      {wrappedCenters
        .filter((pos) => !bounds || bounds.contains([pos.lat, pos.lng]))
        .map((pos, index) => (
          <Circle
            key={`wrapped-circle-${Math.floor(pos.lng / 360)}-${index}`}
            center={[pos.lat, pos.lng]}
            radius={radius}
            pathOptions={pathOptions}
            eventHandlers={eventHandlers}
          />
        ))}
    </>
  );
};

const ClassicDrawingOverlay: React.FC<{
  points: Coordinates[];
  type: string | null;
  bounds: L.LatLngBounds | null;
}> = ({ points, type, bounds }) => {
  if (points.length === 0) return null;
  return (
    <>
      {points.map((point, i) => (
        <WrappedMarker
          key={`draw-pt-${i}`}
          position={point}
          icon={DefaultIcon}
          bounds={bounds}
        />
      ))}
      {type === "polyline" && points.length > 1 && (
        <WrappedPolyline
          positions={points.map((p) => [p.lat, p.lng] as LatLngTuple)}
          bounds={bounds}
          pathOptions={{ color: "red", dashArray: "5, 5" }}
        />
      )}
      {type === "polygon" && points.length > 1 && (
        <WrappedPolygon
          positions={points.map((p) => [p.lat, p.lng] as LatLngTuple)}
          bounds={bounds}
          pathOptions={{
            color: "red",
            dashArray: "5, 5",
            fillColor: "rgba(255,0,0,0.1)",
          }}
        />
      )}
    </>
  );
};

const IconPickerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (iconId: string) => void;
}> = ({ isOpen, onClose, onSelectIcon }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("pushpins");

  const iconsByCategory = useMemo(() => {
    return MAP_ICONS.reduce(
      (acc, icon) => {
        if (!acc[icon.category]) acc[icon.category] = [];
        acc[icon.category].push(icon);
        return acc;
      },
      {} as Record<string, typeof MAP_ICONS>,
    );
  }, []);

  const categories = Object.keys(iconsByCategory);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
      style={{ zIndex: 1002 }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl w-full mx-4 max-h-96 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Choose Icon
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>
        <div className="flex space-x-2 mb-4 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded text-sm whitespace-nowrap ${
                selectedCategory === category
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-4">
          <div className="grid grid-cols-8 gap-3">
            {iconsByCategory[selectedCategory]?.map((icon) => (
              <button
                key={icon.id}
                onClick={() => {
                  onSelectIcon(icon.id);
                  onClose();
                }}
                className="flex flex-col items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 group"
                title={icon.name}
              >
                {React.createElement(icon.icon, {
                  size: 24,
                  color: icon.color,
                  className: "mb-1",
                })}
                <span className="text-xs text-gray-600 dark:text-gray-400 text-center leading-tight">
                  {icon.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const BaseMapSelector: React.FC<{
  currentBaseMap: string;
  onBaseMapChange: (baseMap: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ currentBaseMap, onBaseMapChange, isOpen, onToggle }) => {
  const BASE_MAP_OPTIONS = [
    {
      id: "standard",
      name: "Standard",
      description: "OpenStreetMap default view",
    },
    {
      id: "satellite",
      name: "Satellite",
      description: "ESRI World Imagery satellite view",
    },
    {
      id: "terrain",
      name: "Terrain",
      description: "OpenTopoMap with contour lines",
    },
  ];
  const currentMapInfo = BASE_MAP_OPTIONS.find(
    (map) => map.id === currentBaseMap,
  );
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
        title="Change base map"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 13l-6-3m6 3V4"
          />
        </svg>
        {currentMapInfo?.name || "Standard"}
        <svg
          className={`h-3 w-3 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {BASE_MAP_OPTIONS.map((mapOption) => (
              <button
                key={mapOption.id}
                onClick={() => {
                  onBaseMapChange(mapOption.id);
                  onToggle();
                }}
                className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  currentBaseMap === mapOption.id
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                    : ""
                }`}
              >
                <div className="font-medium">{mapOption.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {mapOption.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const MapResizeHandler: React.FC<{
  mapInstance: L.Map | null;
  setMapInstance: (map: L.Map) => void;
}> = ({ mapInstance, setMapInstance }) => {
  const map = useMap();
  useEffect(() => setMapInstance(map), [map, setMapInstance]);
  useEffect(() => {
    if (!map) return;
    const handleResize = () => setTimeout(() => map.invalidateSize(), 100);
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    const container = map.getContainer().parentElement;
    if (container) resizeObserver.observe(container);
    window.addEventListener("resize", handleResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);
  return null;
};

const EnhancedMapDisplay: React.FC<MapDisplayProps> = ({
  timelineId,
  date,
  mapDisplayLocations = [],
  allTimelineLocations = [],
  zoom,
  center,
  baseMap,
  onZoomChange,
  onCenterChange,
  onLocationClick,
  onClearFocus,
  onShapesChange,
  savedShapes = [],
  onBaseMapChange,
  onEditLocation,
  selectedShapeId,
  onShapeSelect,
  onShapeUpdate,
  boundsToFit,
  onBoundsFit,
  drawingTrigger,
  localRoute = null,
  beaconPosition = null,
  beaconTrack = [],
  focusPoint = null,
}) => {
  const [drawingState, setDrawingState] = useState<DrawingState>({
    mode: null,
    tool: null,
    isActive: false,
    classicPoints: [],
  });
  const [vectorDrawPoint, setVectorDrawPoint] = useState<{
    coords: Coordinates;
    id: number;
  } | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showAnchorSelector, setShowAnchorSelector] = useState(false);
  const [selectedIconForMarker, setSelectedIconForMarker] =
    useState<string>("place-generic");
  const precomputedLocationIcons = useLocationIcons(mapDisplayLocations);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [isBaseMapSelectorOpen, setIsBaseMapSelectorOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(
    typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );
  const [tileSettings, setTileSettings] = useState<MapTileSettings>(() =>
    getMapTileSettings(),
  );
  useEffect(() => {
    const syncTiles = () => setTileSettings(getMapTileSettings());
    const syncTheme = () =>
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    window.addEventListener("sk-map-tiles-changed", syncTiles);
    window.addEventListener("storage", syncTiles);
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      window.removeEventListener("sk-map-tiles-changed", syncTiles);
      window.removeEventListener("storage", syncTiles);
      observer.disconnect();
    };
  }, []);
  const bounds = useMapBounds(mapInstance);

  const safeAllTimelineLocations = useMemo(
    () => (Array.isArray(allTimelineLocations) ? allTimelineLocations : []),
    [allTimelineLocations],
  );

  // --- MODIFICATION START ---
  const locationIcons = useMemo(() => {
    const newIcons = new Map<string, L.Icon>();
    mapDisplayLocations.forEach((loc) => {
      if (loc.properties?.customIcon?.url) {
        newIcons.set(
          loc.id,
          L.icon({
            iconUrl: loc.properties.customIcon.url,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32],
          }),
        );
      } else {
        const precomputedIcon = precomputedLocationIcons.get(loc.id);
        if (precomputedIcon) {
          newIcons.set(loc.id, precomputedIcon);
        }
      }
    });
    return newIcons;
  }, [mapDisplayLocations, precomputedLocationIcons]);
  // --- MODIFICATION END ---

  const generateShapeId = () =>
    `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const visibleShapes = useMemo(() => {
    return (savedShapes || [])
      .filter((shape) => {
        if ((shape.style.opacity ?? 0.5) <= 0) return false;
        if (shape.anchor.locationId === "origin") return true;
        if (!shape.anchor?.locationId || !shape.geometry) return false;

        const rules = shape.properties.visibilityRules;
        if (
          timelineId &&
          rules?.showOnTimelines &&
          !rules.showOnTimelines.includes(timelineId)
        )
          return false;
        if (rules?.showAfterDate && date < rules.showAfterDate) return false;
        if (rules?.hideAfterDate && date > rules.hideAfterDate) return false;

        return true;
      })
      .sort((a, b) => (a.properties.order ?? 0) - (b.properties.order ?? 0));
  }, [savedShapes, timelineId, date]);

  const handleViewChangeByMapEvent = useCallback(() => {
    if (mapInstance) {
      const newZoom = mapInstance.getZoom();
      const newMapCenter = mapInstance.getCenter();
      if (Math.abs(newZoom - zoom) >= 0.1) onZoomChange(newZoom);
      if (
        Math.abs(newMapCenter.lat - center.lat) > 0.00001 ||
        Math.abs(newMapCenter.lng - center.lng) > 0.00001
      )
        onCenterChange({ lat: newMapCenter.lat, lng: newMapCenter.lng });
    }
  }, [mapInstance, onZoomChange, onCenterChange, zoom, center]);

  useEffect(() => {
    if (mapInstance && boundsToFit && boundsToFit.length > 0) {
      const latLngs = boundsToFit.map((c) => [c.lat, c.lng] as L.LatLngTuple);
      const leafletBounds = L.latLngBounds(latLngs);
      if (leafletBounds.isValid()) {
        if (latLngs.length === 1) {
          mapInstance.setView(leafletBounds.getCenter(), 15);
        } else {
          mapInstance.fitBounds(leafletBounds, { padding: [50, 50] });
        }
        onBoundsFit?.();
      }
    }
  }, [boundsToFit, mapInstance, onBoundsFit]);

  const handleStartDrawing = () => {
    setDrawingState({
      mode: "classic",
      tool: "polygon",
      isActive: true,
      classicPoints: [],
    });
  };

  useEffect(() => {
    if (drawingTrigger && drawingTrigger > 0) handleStartDrawing();
  }, [drawingTrigger]);

  const handleModeChange = (mode: DrawingMode) =>
    setDrawingState((prev) => ({ ...prev, mode }));

  const handleToolChange = (tool: DrawingTool) =>
    setDrawingState((prev) => ({ ...prev, tool, classicPoints: [] }));

  const handleClassicMapClick = (coords: Coordinates) => {
    if (drawingState.tool === "marker") {
      setDrawingState((prev) => ({ ...prev, classicPoints: [coords] }));
      setShowIconPicker(true);
    } else if (drawingState.tool === "circle") {
      setDrawingState((prev) => ({ ...prev, classicPoints: [coords] }));
      setShowAnchorSelector(true);
    } else {
      setDrawingState((prev) => ({
        ...prev,
        classicPoints: [...prev.classicPoints, coords],
      }));
    }
  };

  const handleLocationOrMapClick = (location: LocationType) => {
    if (drawingState.isActive && location.coordinates) {
      if (drawingState.mode === "classic") {
        handleClassicMapClick(location.coordinates);
      } else if (drawingState.mode === "vector") {
        setVectorDrawPoint({ coords: location.coordinates, id: Date.now() });
      }
    } else {
      onLocationClick(location);
    }
  };

  const handleFinishClassicDrawing = () => {
    if (drawingState.classicPoints.length >= 1) {
      setShowAnchorSelector(true);
    }
  };

  const handleVectorShapeComplete = (
    coordinates: Coordinates[],
    type: string,
  ) => {
    setDrawingState((prev) => ({ ...prev, classicPoints: coordinates }));
    setShowAnchorSelector(true);
  };

  const handleCancelDrawing = () => {
    setDrawingState({
      mode: null,
      tool: null,
      isActive: false,
      classicPoints: [],
    });
    setShowIconPicker(false);
    setShowAnchorSelector(false);
    setSelectedIconForMarker("place-generic");
  };

  const handleIconSelection = (iconId: string) => {
    setSelectedIconForMarker(iconId);
    setShowAnchorSelector(true);
  };

  const createAnchoredShape = (anchorLocation: LocationType) => {
    if (
      !drawingState.tool ||
      drawingState.classicPoints.length === 0 ||
      !anchorLocation.coordinates
    )
      return;

    const anchorCoords = anchorLocation.coordinates;
    const refPoint = drawingState.classicPoints[0];
    const offsetLat = refPoint.lat - anchorCoords.lat;
    const offsetLng = refPoint.lng - anchorCoords.lng;
    const relativePoints = drawingState.classicPoints.map((point) => ({
      lat: point.lat - refPoint.lat,
      lng: point.lng - refPoint.lng,
    }));

    const newShape: AnchoredShape = {
      id: generateShapeId(),
      type: drawingState.tool,
      geometry: {
        points: relativePoints,
        ...(drawingState.tool === "circle" && { radius: 500 }),
      },
      anchor: {
        locationId: anchorLocation.id,
        offsetLat,
        offsetLng,
        anchorType: "center",
      },
      style: {
        color: "#3388ff",
        fillColor: "#3388ff",
        fillOpacity: 0.3,
        strokeWidth: 2,
        opacity: 0.5,
      },
      properties: {
        name: `${drawingState.tool} near ${anchorLocation.name}`,
        category: "custom",
        timelineId: timelineId || undefined,
        dateCreated: new Date().toISOString(),
        visibilityRules: {
          showOnTimelines: timelineId ? [timelineId] : undefined,
        },
        ...(drawingState.tool === "marker" && {
          iconId: selectedIconForMarker,
        }),
      },
    };

    onShapesChange?.([...(savedShapes || []), newShape]);
    handleCancelDrawing();
  };

  const getTileLayerUrl = () => mapTileUrl(tileSettings, isDarkMode);
  const getTileLayerAttribution = () => mapTileAttribution(tileSettings);

  useEffect(() => {
    if (mapInstance) {
      const currentMapCenter = mapInstance.getCenter();
      const currentMapZoom = mapInstance.getZoom();
      const centerChanged =
        Math.abs(currentMapCenter.lat - center.lat) > 0.00001 ||
        Math.abs(currentMapCenter.lng - center.lng) > 0.00001;
      const zoomChanged = Math.abs(currentMapZoom - zoom) > 0.1;

      if (centerChanged || zoomChanged) {
        mapInstance.setView([center.lat, center.lng], zoom);
      }
    }
  }, [center, zoom, mapInstance]);

  return (
    <div className="relative h-full w-full border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
        minZoom={2.8}
        maxZoom={19}
        worldCopyJump={false}
        maxBounds={undefined}
        maxBoundsViscosity={0}
        zoomSnap={0.25}
        zoomDelta={1}
        whenReady={() => {
          setTimeout(() => {
            if (mapInstance) mapInstance.invalidateSize();
          }, 100);
        }}
      >
        <TileLayer
          key={getTileLayerUrl()}
          url={getTileLayerUrl()}
          attribution={getTileLayerAttribution()}
          maxZoom={19}
          noWrap={false}
        />
        <MapResizeHandler
          mapInstance={mapInstance}
          setMapInstance={setMapInstance}
        />
        <MapEventsHandler
          drawingState={drawingState}
          onMapClick={handleClassicMapClick}
          onViewChange={handleViewChangeByMapEvent}
          setMapInstance={() => {}}
        />
        <ImprovedVectorDrawingSystem
          isEnabled={drawingState.isActive && drawingState.mode === "vector"}
          drawingType={drawingState.tool}
          onShapeComplete={handleVectorShapeComplete}
          onCancel={handleCancelDrawing}
          newPointTrigger={vectorDrawPoint}
        />

        {mapDisplayLocations.map((loc) =>
          loc.coordinates ? (
            <WrappedMarker
              key={loc.id}
              position={loc.coordinates}
              icon={locationIcons.get(loc.id) || DefaultIcon}
              bounds={bounds}
              eventHandlers={{ click: () => handleLocationOrMapClick(loc) }}
            >
              {!drawingState.isActive && (
                <Popup
                  maxWidth={320}
                  minWidth={320}
                  autoPan={true}
                  keepInView={true}
                >
                  <div className="p-2">
                    <h3 className="font-medium text-gray-900 mb-2">
                      {loc.name}
                    </h3>
                    {loc.description && (
                      <p
                        className="text-sm text-gray-600 mb-2"
                        dangerouslySetInnerHTML={{ __html: loc.description }}
                      />
                    )}
                    {onEditLocation && (
                      <button
                        onClick={() => onEditLocation(loc)}
                        className="w-full px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                      >
                        Edit Location
                      </button>
                    )}
                  </div>
                </Popup>
              )}
            </WrappedMarker>
          ) : null,
        )}

        {visibleShapes.map((shape, renderIndex) => {
          const anchorLoc = safeAllTimelineLocations.find(
            (l) => l.id === shape.anchor.locationId,
          );
          if (!anchorLoc && shape.anchor.locationId !== "origin") return null;

          const absoluteCoords = calculateAbsoluteCoordinates(
            shape,
            anchorLoc!,
          );
          if (absoluteCoords.length === 0) return null;

          const isSelected = selectedShapeId === shape.id;
          const pathOptions = {
            color: isSelected ? "#ff0000" : shape.style.color || "#3388ff",
            weight: isSelected
              ? (shape.style.strokeWidth || 2) + 2
              : shape.style.strokeWidth || 2,
            opacity: shape.style.opacity || 1,
            fillColor: shape.style.fillColor || "#3388ff",
            fillOpacity: shape.style.fillOpacity || 0.3,
          };
          const eventHandlers = { click: () => onShapeSelect?.(shape.id) };
          const uniqueKey = `${shape.id}-${renderIndex}-${
            shape.properties.order || 0
          }`;

          switch (shape.type) {
            case "marker":
              const markerIcon = createLeafletIcon(
                shape.properties.iconId || "place-generic",
              );
              const markerCoord = Array.isArray(absoluteCoords[0])
                ? { lat: absoluteCoords[0][0], lng: absoluteCoords[0][1] }
                : (absoluteCoords[0] as Coordinates);
              return (
                <WrappedMarker
                  key={uniqueKey}
                  position={markerCoord}
                  icon={markerIcon}
                  bounds={bounds}
                  eventHandlers={eventHandlers}
                >
                  <Popup>{shape.properties.name || "Marker"}</Popup>
                </WrappedMarker>
              );
            case "circle":
              const circleCoord = Array.isArray(absoluteCoords[0])
                ? { lat: absoluteCoords[0][0], lng: absoluteCoords[0][1] }
                : (absoluteCoords[0] as Coordinates);
              return (
                <WrappedCircle
                  key={uniqueKey}
                  center={circleCoord}
                  radius={shape.geometry.radius || 500}
                  bounds={bounds}
                  pathOptions={pathOptions}
                  eventHandlers={eventHandlers}
                />
              );
            case "polygon":
              return (
                <WrappedPolygon
                  key={uniqueKey}
                  positions={absoluteCoords}
                  bounds={bounds}
                  pathOptions={pathOptions}
                  eventHandlers={eventHandlers}
                />
              );
            case "polyline":
              return (
                <WrappedPolyline
                  key={uniqueKey}
                  positions={absoluteCoords}
                  bounds={bounds}
                  pathOptions={pathOptions}
                  eventHandlers={eventHandlers}
                />
              );
            default:
              return null;
          }
        })}

        {drawingState.mode === "classic" && (
          <ClassicDrawingOverlay
            points={drawingState.classicPoints}
            type={drawingState.tool}
            bounds={bounds}
          />
        )}
        {beaconTrack.length > 1 && (
          <Polyline
            positions={beaconTrack.map((point) => [point.lat, point.lon] as LatLngTuple)}
            color="#22c55e"
            weight={4}
            opacity={0.8}
          />
        )}
        {localRoute && localRoute.geometry.length > 1 && (
          <Polyline
            positions={localRoute.geometry.map(
              (point) => [point.lat, point.lon] as LatLngTuple,
            )}
            color="#f59e0b"
            weight={5}
            opacity={0.9}
          />
        )}
        {focusPoint && (
          <CircleMarker
            center={[focusPoint.lat, focusPoint.lng]}
            radius={8}
            pathOptions={{ color: "#60a5fa", fillColor: "#60a5fa", fillOpacity: 0.8 }}
          >
            <Popup>{focusPoint.name}</Popup>
          </CircleMarker>
        )}
        {beaconPosition && (
          <CircleMarker
            center={[beaconPosition.lat, beaconPosition.lon]}
            radius={9}
            pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 0.9 }}
          >
            <Popup>
              <div className="text-xs">
                <div className="font-medium">Phone beacon</div>
                <div>
                  {beaconPosition.lat.toFixed(5)}, {beaconPosition.lon.toFixed(5)}
                </div>
                <div>±{beaconPosition.accuracy ?? "?"} m</div>
              </div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>

      <div
        className="absolute top-4 left-16 flex items-center gap-2"
        style={{ zIndex: 1000 }}
      >
        {onBaseMapChange && (
          <BaseMapSelector
            currentBaseMap={baseMap}
            onBaseMapChange={onBaseMapChange}
            isOpen={isBaseMapSelectorOpen}
            onToggle={() => setIsBaseMapSelectorOpen(!isBaseMapSelectorOpen)}
          />
        )}
      </div>

      {/* ========================= FIX START ========================= */}
      <div
        className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-md shadow-md p-2 flex flex-col gap-2"
        style={{ zIndex: 1000 }}
      >
        <button
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="Reset view"
          onClick={() => {
            if (mapInstance) {
              mapInstance.invalidateSize();
              mapInstance.setView([30, 0], 2);
            } else {
              onClearFocus();
            }
          }}
        >
          <svg
            className="h-6 w-6 text-gray-600 dark:text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
            />
          </svg>
        </button>
        <div className="w-full border-t border-gray-200 dark:border-gray-700 my-1"></div>
        <button
          className={`p-1 rounded ${
            drawingState.isActive
              ? "bg-blue-100 dark:bg-blue-900"
              : "hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
          title={
            drawingState.isActive ? "Exit drawing mode" : "Enter drawing mode"
          }
          onClick={
            drawingState.isActive ? handleCancelDrawing : handleStartDrawing
          }
        >
          <svg
            className="h-6 w-6 text-gray-600 dark:text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      </div>
      {/* ========================== FIX END ========================== */}

      <DrawingToolsPanel
        drawingState={drawingState}
        onToolChange={handleToolChange}
        onCancelDrawing={handleCancelDrawing}
      />

      <div
        className="absolute bottom-2 left-2 bg-white dark:bg-gray-800 rounded-md shadow-md p-2 text-xs max-w-xs"
        style={{ zIndex: 1000 }}
      >
        <div>
          Locations: {mapDisplayLocations.length} | Shapes:{" "}
          {visibleShapes.length}
        </div>
        {timelineId && <div>Timeline: {timelineId.substring(0, 8)}...</div>}
        {date && <div>Date: {date}</div>}
        <div className="text-gray-500">Zoom: {zoom.toFixed(1)}</div>
      </div>

      <IconPickerModal
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        onSelectIcon={handleIconSelection}
      />

      {showAnchorSelector && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
          style={{ zIndex: 1001 }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full mx-4 max-h-96 flex flex-col">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Select Anchor Location
            </h3>
            <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded mb-4">
              {safeAllTimelineLocations
                .filter((loc) => loc.coordinates)
                .map((location) => (
                  <button
                    key={location.id}
                    onClick={() => createAnchoredShape(location)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                  >
                    {location.name}
                  </button>
                ))}
            </div>
            <button
              onClick={handleCancelDrawing}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedMapDisplay;
