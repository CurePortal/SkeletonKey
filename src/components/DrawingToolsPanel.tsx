// src/components/DrawingToolsPanel.tsx
import React from "react";
import { DrawingState, DrawingTool } from "../pages/MapDisplay";

interface DrawingToolsPanelProps {
  drawingState: DrawingState;
  onToolChange: (tool: DrawingTool) => void;
  onCancelDrawing: () => void;
}

const DrawingToolsPanel: React.FC<DrawingToolsPanelProps> = ({
  drawingState,
  onToolChange,
  onCancelDrawing,
}) => {
  if (!drawingState.isActive) return null;

  return (
    <>
      {/* Mobile-optimized panel */}
      <div className="block sm:hidden fixed bottom-16 left-2 right-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-[1002] max-h-[40vh] overflow-y-auto">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
          <span>Drawing Tools</span>
          <button
            onClick={onCancelDrawing}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

        {/* Compact mobile layout */}
        <div className="space-y-2">
          {/* Tool Selection - Horizontal scroll on mobile */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {["marker", "polyline", "polygon"].map((tool) => (
              <button
                key={tool}
                className={`px-2 py-1 text-xs rounded border whitespace-nowrap transition-colors ${
                  drawingState.tool === tool
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                }`}
                onClick={() => onToolChange(tool as DrawingTool)}
              >
                {tool === "polyline"
                  ? "Line"
                  : tool.charAt(0).toUpperCase() + tool.slice(1)}
              </button>
            ))}
          </div>

          {/* Mobile-friendly instructions */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Tap to add points
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <button
              onClick={onCancelDrawing}
              className="flex-1 px-2 py-1 text-xs bg-gray-500 text-white rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Desktop/tablet panel - positioned fixed to viewport */}
      <div className="hidden sm:block fixed bottom-8 left-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-[1002] min-w-[18rem] max-w-sm max-h-[60vh] overflow-y-auto">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Drawing Tools
        </div>

        {/* Tool Selection */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Tool
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                drawingState.tool === "marker"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
              onClick={() => onToolChange("marker")}
            >
              Marker
            </button>
            <button
              className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                drawingState.tool === "polyline"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
              onClick={() => onToolChange("polyline")}
            >
              Line
            </button>
            <button
              className={`px-3 py-2 text-xs rounded-md border transition-colors ${
                drawingState.tool === "polygon"
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              }`}
              onClick={() => onToolChange("polygon")}
            >
              Polygon
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 space-y-1">
          <div>Click to add points, drag handles for curves</div>
          <div>Double-click or right-click to finish</div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancelDrawing}
            className="w-full px-3 py-2 text-sm bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};

export default DrawingToolsPanel;
