// src/components/ImprovedVectorDrawingSystem.tsx - Simplified single drawing system
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Coordinates } from "../types";

interface VectorPoint extends Coordinates {
  id: string;
  controlHandle?: Coordinates;
  hasHandle?: boolean;
  isSelected?: boolean;
}

interface DrawingState {
  points: VectorPoint[];
  selectedPointId: string | null;
  dragState: {
    type: "point" | "handle" | null;
    pointId: string | null;
    startPos: Coordinates | null;
  };
  isDrawing: boolean;
  drawingType: "polygon" | "polyline" | "marker" | "circle" | null;
}

interface VectorDrawingSystemProps {
  isEnabled: boolean;
  drawingType: "polygon" | "polyline" | "marker" | "circle" | null;
  onShapeComplete: (coordinates: Coordinates[], type: string) => void;
  onCancel: () => void;
  newPointTrigger?: { coords: Coordinates; id: number } | null; // FIX: Add trigger prop
}

const ImprovedVectorDrawingSystem: React.FC<VectorDrawingSystemProps> = ({
  isEnabled,
  drawingType,
  onShapeComplete,
  onCancel,
  newPointTrigger,
}) => {
  const map = useMap();
  const [drawingState, setDrawingState] = useState<DrawingState>({
    points: [],
    selectedPointId: null,
    dragState: { type: null, pointId: null, startPos: null },
    isDrawing: false,
    drawingType: null,
  });

  const svgOverlayRef = useRef<SVGElement | null>(null);
  const isDragging = useRef(false);
  const lastClickTime = useRef(0);

  const generatePointId = () =>
    `point_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const latLngToPoint = useCallback(
    (coords: Coordinates): { x: number; y: number } => {
      const point = map.latLngToContainerPoint([coords.lat, coords.lng]);
      return { x: point.x, y: point.y };
    },
    [map],
  );

  const pointToLatLng = useCallback(
    (point: { x: number; y: number }): Coordinates => {
      const latLng = map.containerPointToLatLng([point.x, point.y]);
      return { lat: latLng.lat, lng: latLng.lng };
    },
    [map],
  );

  const addPointToDrawing = useCallback(
    (coords: Coordinates) => {
      const newPoint: VectorPoint = {
        id: generatePointId(),
        lat: coords.lat,
        lng: coords.lng,
        hasHandle: false,
        isSelected: false,
      };

      setDrawingState((prev) => ({
        ...prev,
        points: [...prev.points, newPoint],
        isDrawing: true,
        drawingType,
        selectedPointId: null,
      }));
    },
    [drawingType],
  );

  // FIX: Use effect to add points from the trigger prop (location clicks)
  useEffect(() => {
    if (isEnabled && newPointTrigger) {
      addPointToDrawing(newPointTrigger.coords);
    }
  }, [newPointTrigger, isEnabled, addPointToDrawing]);

  const calculateDefaultHandle = (
    point: VectorPoint,
    prevPoint?: VectorPoint,
    nextPoint?: VectorPoint,
  ) => {
    const handleLength = 60;
    const screenPos = latLngToPoint(point);

    if (!prevPoint && !nextPoint) {
      return pointToLatLng({ x: screenPos.x + handleLength, y: screenPos.y });
    }

    let angle = 0;
    if (prevPoint && nextPoint) {
      const prevScreen = latLngToPoint(prevPoint);
      const nextScreen = latLngToPoint(nextPoint);
      const inAngle = Math.atan2(
        prevScreen.y - screenPos.y,
        prevScreen.x - screenPos.x,
      );
      const outAngle = Math.atan2(
        nextScreen.y - screenPos.y,
        nextScreen.x - screenPos.x,
      );
      angle = outAngle;
    } else if (prevPoint) {
      const prevScreen = latLngToPoint(prevPoint);
      angle = Math.atan2(
        screenPos.y - prevScreen.y,
        screenPos.x - prevScreen.x,
      );
    } else if (nextPoint) {
      const nextScreen = latLngToPoint(nextPoint);
      angle = Math.atan2(
        nextScreen.y - screenPos.y,
        nextScreen.x - screenPos.x,
      );
    }

    return pointToLatLng({
      x: screenPos.x + Math.cos(angle) * handleLength,
      y: screenPos.y + Math.sin(angle) * handleLength,
    });
  };

  const generateSmoothPath = useCallback(
    (points: VectorPoint[]): string => {
      if (points.length < 2) return "";

      let pathData = "";
      const firstPoint = latLngToPoint(points[0]);
      pathData += `M ${firstPoint.x} ${firstPoint.y}`;

      for (let i = 1; i < points.length; i++) {
        const currentPoint = points[i];
        const prevPoint = points[i - 1];
        const currentScreen = latLngToPoint(currentPoint);

        if (prevPoint.hasHandle && prevPoint.controlHandle) {
          const controlScreen = latLngToPoint(prevPoint.controlHandle);
          pathData += ` Q ${controlScreen.x} ${controlScreen.y}, ${currentScreen.x} ${currentScreen.y}`;
        } else {
          pathData += ` L ${currentScreen.x} ${currentScreen.y}`;
        }
      }

      if (drawingType === "polygon" && points.length > 2) {
        const lastPoint = points[points.length - 1];
        const firstPoint = points[0];

        if (lastPoint.hasHandle && lastPoint.controlHandle) {
          const controlScreen = latLngToPoint(lastPoint.controlHandle);
          const firstScreen = latLngToPoint(firstPoint);
          pathData += ` Q ${controlScreen.x} ${controlScreen.y}, ${firstScreen.x} ${firstScreen.y}`;
        }
        pathData += " Z";
      }

      return pathData;
    },
    [latLngToPoint, drawingType],
  );

  // Handle map clicks with double-click detection
  useMapEvents({
    click(e) {
      if (!isEnabled || !drawingType || isDragging.current) return;

      const now = Date.now();
      const isDoubleClick = now - lastClickTime.current < 300;
      lastClickTime.current = now;

      const coords = { lat: e.latlng.lat, lng: e.latlng.lng };

      // Double-click to finish (except for markers which finish immediately)
      if (isDoubleClick && drawingState.isDrawing && drawingType !== "marker") {
        finishDrawing();
        return;
      }

      // Handle marker tool
      if (drawingType === "marker") {
        onShapeComplete([coords], "marker");
        return;
      }

      // Handle circle tool
      if (drawingType === "circle") {
        if (!drawingState.isDrawing) {
          // First click sets center, auto-finish with default radius
          onShapeComplete([coords], "circle");
        }
        return;
      }

      // Add new point for polygon/polyline
      addPointToDrawing(coords);
    },

    contextmenu(e) {
      if (!isEnabled || !drawingState.isDrawing) return;
      e.originalEvent.preventDefault();
      finishDrawing();
    },
  });

  const handlePointClick = (pointId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    setDrawingState((prev) => {
      const newPoints = prev.points.map((point, index) => {
        if (point.id === pointId) {
          const wasSelected = point.isSelected;
          const shouldHaveHandle = !wasSelected;

          if (shouldHaveHandle && !point.hasHandle) {
            const prevPoint = index > 0 ? prev.points[index - 1] : undefined;
            const nextPoint =
              index < prev.points.length - 1
                ? prev.points[index + 1]
                : undefined;
            const handle = calculateDefaultHandle(point, prevPoint, nextPoint);

            return {
              ...point,
              hasHandle: true,
              controlHandle: handle,
              isSelected: true,
            };
          } else if (!shouldHaveHandle) {
            return {
              ...point,
              hasHandle: false,
              controlHandle: undefined,
              isSelected: false,
            };
          }

          return { ...point, isSelected: shouldHaveHandle };
        }
        return { ...point, isSelected: false };
      });

      return {
        ...prev,
        points: newPoints,
        selectedPointId: prev.selectedPointId === pointId ? null : pointId,
      };
    });
  };

  const handleMouseDown = (
    type: "point" | "handle",
    pointId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    e.preventDefault();

    isDragging.current = true;
    const startPos = pointToLatLng({ x: e.clientX, y: e.clientY });

    setDrawingState((prev) => ({
      ...prev,
      dragState: { type, pointId, startPos },
    }));

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const mapContainer = map.getContainer();
      const rect = mapContainer.getBoundingClientRect();
      const x = moveEvent.clientX - rect.left;
      const y = moveEvent.clientY - rect.top;
      const newCoords = pointToLatLng({ x, y });

      setDrawingState((prev) => {
        const newPoints = prev.points.map((point) => {
          if (point.id === pointId) {
            if (type === "point") {
              const deltaLat = newCoords.lat - point.lat;
              const deltaLng = newCoords.lng - point.lng;

              const newControlHandle = point.controlHandle
                ? {
                    lat: point.controlHandle.lat + deltaLat,
                    lng: point.controlHandle.lng + deltaLng,
                  }
                : undefined;

              return {
                ...point,
                lat: newCoords.lat,
                lng: newCoords.lng,
                controlHandle: newControlHandle,
              };
            } else if (type === "handle") {
              return {
                ...point,
                controlHandle: newCoords,
              };
            }
          }
          return point;
        });
        return { ...prev, points: newPoints };
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      setDrawingState((prev) => ({
        ...prev,
        dragState: { type: null, pointId: null, startPos: null },
      }));
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const finishDrawing = useCallback(() => {
    if (drawingState.points.length < 2) return;

    const finalCoords: Coordinates[] = [];

    if (drawingState.points.some((p) => p.hasHandle)) {
      const sampleCount = Math.max(drawingState.points.length * 8, 32);
      for (let i = 0; i <= sampleCount; i++) {
        const t = i / sampleCount;
        const coord = sampleCurveAtT(drawingState.points, t);
        if (coord) finalCoords.push(coord);
      }
    } else {
      finalCoords.push(
        ...drawingState.points.map((p) => ({ lat: p.lat, lng: p.lng })),
      );
    }

    onShapeComplete(finalCoords, drawingState.drawingType || "polygon");

    setDrawingState({
      points: [],
      selectedPointId: null,
      dragState: { type: null, pointId: null, startPos: null },
      isDrawing: false,
      drawingType: null,
    });
  }, [drawingState, onShapeComplete]);

  const sampleCurveAtT = (
    points: VectorPoint[],
    t: number,
  ): Coordinates | null => {
    if (points.length < 2) return null;

    const totalSegments =
      drawingType === "polygon" ? points.length : points.length - 1;
    const segmentT = t * totalSegments;
    const segmentIndex = Math.floor(segmentT) % points.length;
    const localT = segmentT - Math.floor(segmentT);

    const p1 = points[segmentIndex];
    const p2 = points[(segmentIndex + 1) % points.length];

    if (drawingType === "polyline" && segmentIndex >= points.length - 1) {
      return {
        lat: points[points.length - 1].lat,
        lng: points[points.length - 1].lng,
      };
    }

    if (p1.hasHandle && p1.controlHandle) {
      return quadraticBezier(p1, p1.controlHandle, p2, localT);
    } else {
      return {
        lat: p1.lat + (p2.lat - p1.lat) * localT,
        lng: p1.lng + (p2.lng - p1.lng) * localT,
      };
    }
  };

  const quadraticBezier = (
    p0: Coordinates,
    p1: Coordinates,
    p2: Coordinates,
    t: number,
  ): Coordinates => {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;

    return {
      lat: uu * p0.lat + 2 * u * t * p1.lat + tt * p2.lat,
      lng: uu * p0.lng + 2 * u * t * p1.lng + tt * p2.lng,
    };
  };

  useEffect(() => {
    if (!isEnabled) {
      setDrawingState({
        points: [],
        selectedPointId: null,
        dragState: { type: null, pointId: null, startPos: null },
        isDrawing: false,
        drawingType: null,
      });
    } else {
      setDrawingState((prev) => ({ ...prev, drawingType }));
    }
  }, [isEnabled, drawingType]);

  useEffect(() => {
    if (!isEnabled || !map) return;

    const mapContainer = map.getContainer();
    const overlay = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "1000";

    mapContainer.appendChild(overlay);
    svgOverlayRef.current = overlay;

    return () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };
  }, [isEnabled, map]);

  useEffect(() => {
    if (!svgOverlayRef.current || !drawingState.isDrawing) return;

    const svg = svgOverlayRef.current;
    svg.innerHTML = "";

    if (drawingState.points.length > 1) {
      const pathElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      pathElement.setAttribute("d", generateSmoothPath(drawingState.points));
      pathElement.setAttribute("stroke", "#3388ff");
      pathElement.setAttribute("stroke-width", "3");
      pathElement.setAttribute(
        "fill",
        drawingType === "polygon" ? "rgba(51, 136, 255, 0.1)" : "none",
      );
      pathElement.setAttribute("stroke-linecap", "round");
      pathElement.setAttribute("stroke-linejoin", "round");
      svg.appendChild(pathElement);
    }

    drawingState.points.forEach((point, index) => {
      const screenPoint = latLngToPoint(point);

      if (point.isSelected && point.hasHandle && point.controlHandle) {
        const handleScreen = latLngToPoint(point.controlHandle);

        const handleLine = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "line",
        );
        handleLine.setAttribute("x1", screenPoint.x.toString());
        handleLine.setAttribute("y1", screenPoint.y.toString());
        handleLine.setAttribute("x2", handleScreen.x.toString());
        handleLine.setAttribute("y2", handleScreen.y.toString());
        handleLine.setAttribute("stroke", "#ff6b35");
        handleLine.setAttribute("stroke-width", "2");
        handleLine.setAttribute("stroke-dasharray", "4,4");
        svg.appendChild(handleLine);

        const handle = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "circle",
        );
        handle.setAttribute("cx", handleScreen.x.toString());
        handle.setAttribute("cy", handleScreen.y.toString());
        handle.setAttribute("r", "6");
        handle.setAttribute("fill", "#ff6b35");
        handle.setAttribute("stroke", "white");
        handle.setAttribute("stroke-width", "2");
        handle.style.cursor = "move";
        handle.style.pointerEvents = "all";
        handle.addEventListener("mousedown", (e) => {
          handleMouseDown("handle", point.id, e as any);
        });
        svg.appendChild(handle);
      }

      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      circle.setAttribute("cx", screenPoint.x.toString());
      circle.setAttribute("cy", screenPoint.y.toString());
      circle.setAttribute("r", point.isSelected ? "10" : "8");
      circle.setAttribute("fill", point.hasHandle ? "#ff6b35" : "#3388ff");
      circle.setAttribute("stroke", "white");
      circle.setAttribute("stroke-width", "3");
      circle.style.cursor = "pointer";
      circle.style.pointerEvents = "all";

      circle.addEventListener("click", (e) => {
        handlePointClick(point.id, e as any);
      });

      circle.addEventListener("mousedown", (e) => {
        if (!point.isSelected) {
          handlePointClick(point.id, e as any);
        } else {
          handleMouseDown("point", point.id, e as any);
        }
      });

      svg.appendChild(circle);

      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      text.setAttribute("x", (screenPoint.x + 15).toString());
      text.setAttribute("y", (screenPoint.y - 10).toString());
      text.setAttribute("font-family", "system-ui, -apple-system, sans-serif");
      text.setAttribute("font-size", "12");
      text.setAttribute("font-weight", "600");
      text.setAttribute("fill", "#666");
      text.textContent = (index + 1).toString();
      svg.appendChild(text);
    });
  }, [
    drawingState,
    latLngToPoint,
    generateSmoothPath,
    drawingType,
    handlePointClick,
    handleMouseDown,
  ]);

  if (!isEnabled) return null;

  return (
    <div className="improved-vector-drawing-system">
      {drawingState.isDrawing && (
        <div
          className="absolute bottom-12 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 pointer-events-auto"
          style={{ zIndex: 10000 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Drawing {drawingType}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div>• Click points to make them smooth</div>
            <div>• Drag orange handles to adjust curves</div>
            <div>• Double-click or right-click to finish</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="mt-3 px-3 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default ImprovedVectorDrawingSystem;
