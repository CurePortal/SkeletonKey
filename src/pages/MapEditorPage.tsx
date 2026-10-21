// src/pages/EnhancedMapEditorPage.tsx - FIXED
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useAppState } from "../contexts/AppStateContext";
import { useNotification } from "../contexts/NotificationContext";
import MainContentArea from "../components/layout/MainContentArea";
import Button from "../components/common/Button";
import MessageBox from "../components/common/MessageBox";
import InputField from "../components/common/InputField";
import Modal from "../components/common/Modal"; // Import the Modal component
import {
  LocationType,
  AnchoredShape,
  MapScenario,
  ID,
  Coordinates,
} from "../types";
import EnhancedKMZImportModal from "../components/common/KMZImportModal";
import EnhancedMapDisplay from "./MapDisplay";
import MapLocalPanel from "../components/map/MapLocalPanel";
import {
  findPlaces,
  type BeaconPosition,
  type GeoRoute,
} from "../services/mapIntelligenceService";
import RichTextEditor from "../components/common/RichTextEditor";

import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";

// Pagination constants
const LOCATIONS_PER_PAGE = 8;
const SHAPES_PER_LOCATION_PAGE = 8;

// --- Helper function to calculate shape coordinates ---
const calculateAbsoluteCoordinates = (
  shape: AnchoredShape,
  anchorLocation: LocationType | undefined,
): Coordinates[] => {
  if (shape.anchor.locationId === "origin") {
    const pointsToUse = shape.geometry.points;
    if (!pointsToUse || pointsToUse.length === 0) {
      // For markers/circles without geometry points
      return [{ lat: shape.anchor.offsetLat, lng: shape.anchor.offsetLng }];
    }
    return pointsToUse.map((point) => ({ lat: point.lat, lng: point.lng }));
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
      return [
        {
          lat: anchorCoords.lat + offsetLat,
          lng: anchorCoords.lng + offsetLng,
        },
      ];
    }
    return [];
  }

  return pointsToUse.map((relativePoint) => ({
    lat: anchorCoords.lat + offsetLat + relativePoint.lat,
    lng: anchorCoords.lng + offsetLng + relativePoint.lng,
  }));
};

// --- Enhanced Global Location Search Component ---
const IntegratedGlobalSearch: React.FC<{
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onLocationSelect: (
    coords: { lat: number; lng: number },
    name: string,
    fullResult: any,
  ) => void;
  onViewChange?: (center: { lat: number; lng: number }, zoom?: number) => void;
  placeholder?: string;
  className?: string;
  onAddLocationFromSearch?: (searchResult: any) => void;
}> = ({
  searchTerm,
  onSearchChange,
  onLocationSelect,
  onViewChange,
  placeholder = "Search worldwide locations...",
  className = "",
  onAddLocationFromSearch,
}) => {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search function
  const searchLocation = async (query: string) => {
    if (!query.trim() || query.length < 3) {
      setSearchResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    try {
      // Prefer the same local gazetteer the right-hand panel uses, so both
      // searches return consistent places. Fall back to Nominatim for
      // locations outside the offline dataset.
      let results: any[] = [];
      try {
        const local = await findPlaces(query.trim(), 8);
        results = local.map((place) => ({
          lat: String(place.lat),
          lon: String(place.lon),
          name: place.name,
          display_name: [place.name, place.subcat || place.category]
            .filter(Boolean)
            .join(", "),
          type: place.category,
          class: place.subcat,
          distanceM: place.distanceM,
          source: "gazetteer",
        }));
      } catch {
        results = [];
      }

      if (results.length === 0) {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query,
          )}&limit=8&addressdetails=1&accept-language=en`,
        );
        const data = await response.json();
        results = (Array.isArray(data) ? data : []).map((row: any) => ({
          ...row,
          source: "osm",
        }));
      }

      setSearchResults(results);
      setIsOpen(results.length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error("Error searching location:", error);
      setSearchResults([]);
      setIsOpen(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchTerm.trim().length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        searchLocation(searchTerm);
      }, 500);
    } else {
      setSearchResults([]);
      setIsOpen(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" && searchResults.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < searchResults.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && searchResults[selectedIndex]) {
          handleResultSelect(searchResults[selectedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleResultSelect = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const name =
      result.name || result.display_name.split(",")[0] || result.display_name;

    onLocationSelect({ lat, lng }, name, result);
    onViewChange?.({ lat, lng }, 12);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleAddLocationFromResult = (result: any) => {
    onAddLocationFromSearch?.(result);
    onSearchChange("");
    setSearchResults([]);
    setIsOpen(false);
  };

  const formatDisplayName = (displayName: string) => {
    const parts = displayName.split(",");
    if (parts.length <= 3) return displayName;
    return `${parts[0]}, ${parts[1]}, ${parts[parts.length - 1]}`;
  };

  // --- MODIFICATION START ---
  // Handle clicks outside dropdown, but ignore clicks on the map itself
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // If the click is inside the Leaflet map container, do nothing.
      if (target.closest(".leaflet-container")) {
        return;
      }

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  // --- MODIFICATION END ---

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => searchResults.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all duration-200"
        />

        {/* Search icon */}
        <div className="absolute left-4 top-3.5 h-5 w-5 text-gray-400">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Loading spinner */}
        {isSearching && (
          <div className="absolute right-12 top-3.5 h-5 w-5">
            <svg
              className="animate-spin h-5 w-5 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        )}

        {/* Clear button */}
        {searchTerm && !isSearching && (
          <button
            onClick={() => {
              onSearchChange("");
              setSearchResults([]);
              setIsOpen(false);
            }}
            className="absolute right-4 top-3.5 h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Enhanced Search Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-lg shadow-xl z-[9999] max-h-80 overflow-y-auto">
          {searchResults.length > 0 ? (
            searchResults.map((result, index) => (
              <div
                key={index}
                className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                  index === selectedIndex
                    ? "bg-blue-50 dark:bg-blue-900/20"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {result.display_name.split(",")[0]}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {formatDisplayName(result.display_name)}
                    </div>
                    {result.source === "gazetteer" ? (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 capitalize">
                        Local gazetteer · {result.type}
                        {result.distanceM != null
                          ? ` · ${Math.round(result.distanceM)} m`
                          : ""}
                      </div>
                    ) : result.type ? (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 capitalize">
                        {result.type} {result.class && `• ${result.class}`}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 ml-3 flex-shrink-0">
                    <button
                      onClick={() => handleResultSelect(result)}
                      className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                    >
                      <svg
                        className="h-4 w-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      View
                    </button>
                    {onAddLocationFromSearch && (
                      <button
                        onClick={() => handleAddLocationFromResult(result)}
                        className="flex items-center text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-sm"
                      >
                        <svg
                          className="h-4 w-4 mr-1"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                        Add
                      </button>
                    )}
                    <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
                      {parseFloat(result.lat).toFixed(4)},{" "}
                      {parseFloat(result.lon).toFixed(4)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : searchTerm.trim() && searchTerm.length >= 3 && !isSearching ? (
            <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">
              No locations found for "{searchTerm}"
            </div>
          ) : searchTerm.trim() && searchTerm.length < 3 ? (
            <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-sm">
              Type at least 3 characters to search...
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

// --- MODIFICATION START: Updated LocationEditModal with Custom Icon Support ---
const LocationEditModal: React.FC<{
  isOpen: boolean;
  location: LocationType | Partial<LocationType>;
  onSave: (location: LocationType | Partial<LocationType>) => void;
  onCancel: () => void;
  onOpenFullForm?: () => void;
}> = ({ isOpen, location, onSave, onCancel, onOpenFullForm }) => {
  const [editedLocation, setEditedLocation] = useState<
    LocationType | Partial<LocationType> | null
  >(location);

  // State for the custom icon
  const [customIcon, setCustomIcon] = useState<{
    url: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    setEditedLocation(location);
    // Initialize custom icon state from the location data
    if (location?.properties?.customIcon) {
      setCustomIcon(location.properties.customIcon);
    } else {
      setCustomIcon(null);
    }
  }, [location]);

  // Handle custom icon file upload
  const handleCustomIconUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newCustomIcon = {
          url: reader.result as string,
          name: file.name,
        };
        setCustomIcon(newCustomIcon);
        // Update the location state immediately
        setEditedLocation((prev) => ({
          ...prev,
          properties: { ...prev?.properties, customIcon: newCustomIcon },
        }));
      };
      reader.readAsDataURL(file);
    }
    event.target.value = ""; // Allow re-uploading the same file
  };

  // Handle custom icon removal
  const handleRemoveCustomIcon = () => {
    setCustomIcon(null);
    // Update the location state to remove the custom icon
    setEditedLocation((prev) => {
      const newProps = { ...prev?.properties };
      delete newProps.customIcon;
      return { ...prev, properties: newProps };
    });
  };

  if (!isOpen || !editedLocation) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editedLocation);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center"
      style={{ zIndex: 10000 }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Quick Edit Location
          </h3>
          <div className="flex items-center gap-2">
            {onOpenFullForm && (
              <button
                type="button"
                onClick={onOpenFullForm}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Full Edit in Knowledge Base
              </button>
            )}
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ×
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ... other form fields ... */}
          {/* Name field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={editedLocation.name || ""}
              onChange={(e) =>
                setEditedLocation({ ...editedLocation, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          {/* Type field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={editedLocation.type || ""}
              onChange={(e) =>
                setEditedLocation({ ...editedLocation, type: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select type...</option>
              <option value="Planet">Planet</option>
              <option value="Continent">Continent</option>
              <option value="Country">Country</option>
              <option value="State/Province">State/Province</option>
              <option value="Region">Region</option>
              <option value="City">City</option>
              <option value="Town">Town</option>
              <option value="Village">Village</option>
              <option value="District/Borough">District/Borough</option>
              <option value="Neighborhood">Neighborhood</option>
              <option value="Building">Building</option>
              <option value="Room">Room</option>
              <option value="Landmark">Landmark</option>
              <option value="Natural Feature">Natural Feature</option>
              <option value="Point of Interest">Point of Interest</option>
              <option value="Fictional Location">Fictional Location</option>
              <option value="Historical Site">Historical Site</option>
              <option value="Geographical Area">Geographical Area</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={editedLocation.coordinates?.lat || ""}
                onChange={(e) =>
                  setEditedLocation({
                    ...editedLocation,
                    coordinates: {
                      ...(editedLocation.coordinates || { lng: 0 }),
                      lat: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={editedLocation.coordinates?.lng || ""}
                onChange={(e) =>
                  setEditedLocation({
                    ...editedLocation,
                    coordinates: {
                      ...(editedLocation.coordinates || { lat: 0 }),
                      lng: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Description with RichTextEditor */}
          <div>
            <RichTextEditor
              label="Description"
              value={editedLocation.description || ""}
              onChange={(value) =>
                setEditedLocation({ ...editedLocation, description: value })
              }
              placeholder="Describe this location..."
              rows={4}
              helpText="Use the toolbar to format your description with bold, italic, lists, and more"
            />
          </div>

          {/* Icon selection - now a grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Standard Icon
              </label>
              <select
                value={editedLocation.properties?.iconId || ""}
                onChange={(e) =>
                  setEditedLocation({
                    ...editedLocation,
                    properties: {
                      ...editedLocation.properties,
                      iconId: e.target.value,
                    },
                  })
                }
                disabled={!!customIcon}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Auto-select based on type</option>
                <option value="place-generic">Generic Place</option>
                <option value="building">Building</option>
                <option value="home">Home</option>
                {/* ... other options */}
              </select>
              {customIcon && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Disabled while a custom icon is active.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custom Icon
              </label>
              {customIcon ? (
                <div className="flex items-center space-x-3">
                  <img
                    src={customIcon.url}
                    alt="Custom icon preview"
                    className="w-10 h-10 object-contain rounded-md border dark:border-gray-600 bg-gray-50 dark:bg-gray-700"
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm text-gray-800 dark:text-gray-200 truncate"
                      title={customIcon.name}
                    >
                      {customIcon.name}
                    </p>
                    <button
                      type="button"
                      onClick={handleRemoveCustomIcon}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    id="custom-icon-upload-modal"
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    onChange={handleCustomIconUpload}
                  />
                  <label
                    htmlFor="custom-icon-upload-modal"
                    className="cursor-pointer w-full text-center px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                  >
                    Upload an Image
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
            </label>
            <input
              type="text"
              value={
                Array.isArray(editedLocation.tags)
                  ? editedLocation.tags.join(", ")
                  : ""
              }
              onChange={(e) => {
                const tagsString = e.target.value;
                const tagsArray = tagsString
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter((tag) => tag.length > 0);
                setEditedLocation({ ...editedLocation, tags: tagsArray });
              }}
              placeholder="tag1, tag2, tag3"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Separate tags with commas
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
// --- MODIFICATION END ---

// --- Pagination Controls Component ---
const PaginationControls: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  itemName: string;
}> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  itemName,
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-600">
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {startItem}-{endItem} of {totalItems} {itemName}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span className="text-xs px-2 py-1 bg-white dark:bg-gray-800 rounded border">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

// --- LocationLayerGroup Component with Pagination ---
const LocationLayerGroup: React.FC<{
  location: LocationType;
  shapes: AnchoredShape[];
  totalShapes: number;
  selectedShapeId: ID | null;
  onShapeSelect: (id: ID) => void;
  onShapeUpdate: (updatedShape: AnchoredShape) => void;
  onShapeDelete: (id: ID) => void;
  onLocationClick: (location: LocationType) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  shapePage: number;
  onShapePageChange: (page: number) => void;
  shapeTotalPages: number;
}> = ({
  location,
  shapes,
  totalShapes,
  selectedShapeId,
  onShapeSelect,
  onShapeUpdate,
  onShapeDelete,
  onLocationClick,
  isExpanded,
  onToggleExpanded,
  shapePage,
  onShapePageChange,
  shapeTotalPages,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(location.name);

  useEffect(() => {
    setName(location.name);
  }, [location.name]);

  const handleNameUpdate = () => {
    if (name.trim() !== location.name) {
      // Handle location name update if needed
      // This would require a location update function from context
    }
    setIsEditingName(false);
  };

  return (
    <div
      className={`border border-gray-200 dark:border-gray-600 rounded-lg mb-2 ${
        totalShapes > 0
          ? "bg-gray-50 dark:bg-gray-800/50"
          : "bg-white dark:bg-gray-800"
      }`}
    >
      {/* Location header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-t-lg"
        onClick={() => onLocationClick(location)}
      >
        <div className="flex items-center flex-1 min-w-0">
          {totalShapes > 0 && (
            <button
              className="mr-2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded();
              }}
            >
              <svg
                className={`h-4 w-4 text-gray-600 dark:text-gray-300 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          )}

          {/* Location icon indicator */}
          <div
            className={`w-3 h-3 rounded-full mr-2 flex-shrink-0 ${
              totalShapes > 0 ? "bg-blue-500" : "bg-gray-400"
            }`}
          />

          {isEditingName ? (
            <InputField
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameUpdate}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNameUpdate();
                if (e.key === "Escape") setIsEditingName(false);
              }}
              className="!text-sm !py-0"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="truncate font-medium text-gray-900 dark:text-white"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              title="Double-click to rename, click to focus on map"
            >
              {location.name}
            </div>
          )}

          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            {totalShapes > 0
              ? `(${totalShapes} shape${totalShapes !== 1 ? "s" : ""})`
              : location.coordinates
                ? "(no shapes)"
                : "(no coordinates)"}
          </span>
        </div>

        <div className="flex gap-1 ml-2 flex-shrink-0">
          {location.coordinates && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLocationClick(location);
              }}
              className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 p-0.5 rounded"
              title="Focus on location"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0021 8.618v-6.236A1 1 0 0019.553.106L15 2.382m0 7.618V2.382m0 7.618L10.447 7.724A1 1 0 009 8.618v6.236a1 1 0 001.447.894L15 13.382"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Shapes list - only show if location has shapes AND is expanded */}
      {totalShapes > 0 && isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-600">
          <div className="px-3 py-2">
            <Droppable droppableId={`location-${location.id}`}>
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-1"
                >
                  {shapes.map((shape, index) => (
                    <Draggable
                      key={shape.id}
                      draggableId={shape.id}
                      index={index}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                        >
                          <ShapeListItem
                            shape={shape}
                            isSelected={selectedShapeId === shape.id}
                            onSelect={onShapeSelect}
                            onUpdate={onShapeUpdate}
                            onDelete={onShapeDelete}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Shape pagination */}
          <PaginationControls
            currentPage={shapePage}
            totalPages={shapeTotalPages}
            onPageChange={onShapePageChange}
            totalItems={totalShapes}
            itemsPerPage={SHAPES_PER_LOCATION_PAGE}
            itemName="shapes"
          />
        </div>
      )}
    </div>
  );
};

// --- ShapeListItem Component with Inline Editing and Visibility Toggle ---
const ShapeListItem: React.FC<{
  shape: AnchoredShape;
  isSelected: boolean;
  onSelect: (id: ID) => void;
  onUpdate: (updatedShape: AnchoredShape) => void;
  onDelete: (id: ID) => void;
}> = ({ shape, isSelected, onSelect, onUpdate, onDelete }) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(shape.properties.name || "");

  useEffect(() => {
    setName(shape.properties.name || "");
  }, [shape.properties.name]);

  const handleNameUpdate = () => {
    if (name.trim() !== (shape.properties.name || "")) {
      onUpdate({
        ...shape,
        properties: { ...shape.properties, name: name.trim() },
      });
    }
    setIsEditingName(false);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    onUpdate({
      ...shape,
      style: { ...shape.style, color: newColor, fillColor: newColor },
    });
  };

  const handleVisibilityToggle = () => {
    const currentOpacity = shape.style.opacity ?? 0.5; // FIXED: Default to 50%

    if (currentOpacity > 0) {
      // Hide: Store current opacity in a custom property and set to 0
      onUpdate({
        ...shape,
        properties: { ...shape.properties, previousOpacity: currentOpacity },
        style: {
          ...shape.style,
          opacity: 0,
          fillOpacity: 0,
        },
      });
    } else {
      // Show: Restore previous opacity or default to 50%
      const previousOpacity = shape.properties.previousOpacity ?? 0.5; // FIXED: Default to 50%
      onUpdate({
        ...shape,
        style: {
          ...shape.style,
          opacity: previousOpacity,
          fillOpacity:
            shape.type === "polygon" || shape.type === "circle"
              ? previousOpacity * 0.6 // FIXED: Increase fill ratio to 60% for better visibility
              : previousOpacity,
        },
      });
    }
  };

  const isVisible = (shape.style.opacity ?? 0.5) > 0; // FIXED: Default to 50%

  return (
    <div
      className={`flex items-center justify-between text-sm rounded p-2 cursor-pointer ${
        isSelected
          ? "bg-blue-100 dark:bg-blue-900/50 ring-1 ring-blue-500"
          : "bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600"
      }`}
      onClick={() => onSelect(shape.id)}
    >
      <div className="flex items-center flex-1 min-w-0">
        {/* Visibility toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleVisibilityToggle();
          }}
          className="mr-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded flex-shrink-0"
          title={isVisible ? "Hide layer" : "Show layer"}
        >
          {isVisible ? (
            <svg
              className="h-4 w-4 text-gray-600 dark:text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
              />
            </svg>
          )}
        </button>

        <input
          type="color"
          value={shape.style.color || "#3388ff"}
          onChange={handleColorChange}
          className="w-4 h-4 p-0 border-none rounded-sm bg-transparent cursor-pointer mr-2 flex-shrink-0"
          title="Change shape color"
          onClick={(e) => e.stopPropagation()}
        />

        {/* Shape type icon */}
        <div className="mr-2 text-gray-400 dark:text-gray-500 flex-shrink-0">
          {shape.type === "polygon" && (
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18l8-8-8-8-8 8 8 8z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {shape.type === "polyline" && (
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          )}
          {shape.type === "marker" && (
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {shape.type === "circle" && (
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <circle cx="10" cy="10" r="8" />
            </svg>
          )}
        </div>

        {isEditingName ? (
          <InputField
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameUpdate}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameUpdate();
              if (e.key === "Escape") setIsEditingName(false);
            }}
            className="!text-xs !py-0.5 !px-1"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="truncate w-full text-xs"
            onDoubleClick={() => setIsEditingName(true)}
            title="Double-click to rename"
          >
            {shape.properties.name || `Untitled ${shape.type}`}
          </div>
        )}
      </div>
      <div className="flex gap-1 ml-2 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(shape.id);
          }}
          className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 p-0.5 rounded"
          title="Delete shape"
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

const EnhancedMapEditorPage: React.FC = () => {
  const {
    project,
    updateAnchoredShape,
    setAnchoredShapes,
    deleteAnchoredShape,
    addMapScenario,
    deleteMapScenario,
    updateLocation,
    addLocation,
  } = useProjectData();
  const { appState, setViewMode, setSelectedKnowledgeBaseEntityId } =
    useAppState();
  const { showInfo, showSuccess, showError } = useNotification();
  const [showKMZImportModal, setShowKMZImportModal] = useState<boolean>(false);
  const [localRoute, setLocalRoute] = useState<GeoRoute | null>(null);
  const [beaconPosition, setBeaconPosition] = useState<BeaconPosition | null>(null);
  const [beaconTrack, setBeaconTrack] = useState<BeaconPosition[]>([]);
  const [focusPoint, setFocusPoint] = useState<{ lat: number; lng: number; name: string } | null>(null);

  // Location edit state
  const [editingLocation, setEditingLocation] = useState<
    LocationType | Partial<LocationType> | null
  >(null);
  const [showLocationEditModal, setShowLocationEditModal] = useState(false);

  // ENHANCED: Global search state
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");

  // Map state
  const [selectedTimelineId, setSelectedTimelineId] = useState<string | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [zoom, setZoom] = useState<number>(2);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 30,
    lng: 0,
  });
  const [selectedBaseMap, setSelectedBaseMap] = useState<string>("standard");
  const [focusedLocationId, setFocusedLocationId] = useState<string | null>(
    null,
  );
  const [boundsToFit, setBoundsToFit] = useState<Coordinates[] | null>(null);
  const [drawingTrigger, setDrawingTrigger] = useState(0); // FIX: Add trigger state for drawing

  // Panel state
  const [activePanel, setActivePanel] = useState<"layers" | "scenarios">(
    "layers",
  );

  // Scenario management state
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    null,
  );
  const [scenarioName, setScenarioName] = useState<string>("");
  const [scenarioDescription, setScenarioDescription] = useState<string>("");
  const [scenarioTimelineId, setScenarioTimelineId] = useState<string>("");
  const [scenarioDate, setScenarioDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );

  // Shape layer state
  const [selectedShapeId, setSelectedShapeId] = useState<ID | null>(null);
  const [shapeToDelete, setShapeToDelete] = useState<AnchoredShape | null>(
    null,
  );
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(
    new Set(),
  );

  // Pagination and search state
  const [locationsPage, setLocationsPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [locationShapePages, setLocationShapePages] = useState<
    Record<string, number>
  >({});

  // ENHANCED: Global search handlers
  const handleGlobalLocationSelect = (
    coords: { lat: number; lng: number },
    name: string,
    fullResult: any,
  ) => {
    setCenter(coords);
    setZoom(12);
    setFocusPoint({ lat: coords.lat, lng: coords.lng, name });
    setFocusedLocationId(null);
    showSuccess(`Mapped to ${name}`);
  };

  const handleViewChange = (
    center: { lat: number; lng: number },
    zoom?: number,
  ) => {
    setCenter(center);
    if (zoom !== undefined) {
      setZoom(zoom);
    }
  };

  const handleAddLocationFromSearch = (searchResult: any) => {
    const lat = parseFloat(searchResult.lat);
    const lng = parseFloat(searchResult.lon);
    const name =
      searchResult.name ||
      searchResult.display_name.split(",")[0] ||
      searchResult.display_name;

    const newLocationData = {
      name,
      coordinates: { lat, lng },
      description: `Location imported from search: ${searchResult.display_name}`,
      type: searchResult.type || "Point of Interest",
      properties: { iconId: "place-generic" },
      tags: [],
      timelineIds: [],
      linkedEventIds: [],
      foundedDate: "",
      destroyedDate: "",
      population: null,
      importance: 5,
      notes: "",
      parentLocationId: null,
    };

    setEditingLocation(newLocationData);
    setShowLocationEditModal(true);
    showInfo(`Preparing to add location: ${name}`);
  };

  // Location edit handlers
  const handleEditLocation = (location: LocationType) => {
    setEditingLocation(location);
    setShowLocationEditModal(true);
  };

  const handleSaveLocationEdit = (updatedLocation: any) => {
    if (!editingLocation?.id && !updatedLocation.id) {
      try {
        const locationData = {
          name: updatedLocation.name,
          coordinates: updatedLocation.coordinates,
          description: updatedLocation.description,
          type: updatedLocation.type,
          properties: updatedLocation.properties || { iconId: "place-generic" },
          tags: updatedLocation.tags || [],
          foundedDate: updatedLocation.foundedDate || "",
          destroyedDate: updatedLocation.destroyedDate || "",
          population: updatedLocation.population || null,
          importance: updatedLocation.importance || 5,
          notes: updatedLocation.notes || "",
          timelineIds: updatedLocation.timelineIds || [],
          parentLocationId: updatedLocation.parentLocationId || null,
          linkedEventIds: updatedLocation.linkedEventIds || [],
          mapUrl: null, // Add this line
        };
        addLocation(locationData);
        showSuccess(`Location "${updatedLocation.name}" added successfully`);
      } catch (error) {
        showError(`Failed to add location: ${error}`);
        return;
      }
    } else {
      if (updateLocation) {
        updateLocation(updatedLocation);
        showSuccess(`Location "${updatedLocation.name}" updated successfully`);
      } else {
        showError("Location update functionality not available");
        return;
      }
    }
    setShowLocationEditModal(false);
    setEditingLocation(null);
  };

  const handleCancelLocationEdit = () => {
    setShowLocationEditModal(false);
    setEditingLocation(null);
  };

  const handleOpenInKnowledgeBase = (
    locationToEdit: LocationType | Partial<LocationType> | null,
  ) => {
    if (!locationToEdit?.id) return;
    setShowLocationEditModal(false);
    setEditingLocation(null);
    sessionStorage.setItem(
      "editEntity",
      JSON.stringify({ category: "locations", id: locationToEdit.id }),
    );
    setViewMode("knowledge-base");
  };

  // Memoize the selected shape
  const selectedShape = useMemo(() => {
    if (!selectedShapeId) return null;
    return (
      project?.mapData?.anchoredShapes.find((s) => s.id === selectedShapeId) ||
      null
    );
  }, [selectedShapeId, project?.mapData?.anchoredShapes]);

  // Group shapes by their anchor location
  const shapesByLocation = useMemo(() => {
    if (!project?.mapData?.anchoredShapes || !project?.locations) return {};
    const groups: Record<string, AnchoredShape[]> = {};
    project.locations.forEach((location) => {
      groups[location.id] = [];
    });
    groups["origin"] = [];
    project.mapData.anchoredShapes.forEach((shape) => {
      const locationId = shape.anchor.locationId;
      if (groups[locationId]) {
        groups[locationId].push(shape);
      } else {
        groups["origin"].push(shape);
      }
    });
    const scenario = selectedScenarioId
      ? project.mapData?.scenarios.find((row) => row.id === selectedScenarioId)
      : null;
    if (scenario) {
      const allowed = new Set(scenario.shapeIds || []);
      Object.keys(groups).forEach((locationId) => {
        groups[locationId] = groups[locationId].filter((shape) => allowed.has(shape.id));
      });
    } else if (selectedTimelineId) {
      Object.keys(groups).forEach((locationId) => {
        groups[locationId] = groups[locationId].filter(
          (shape) =>
            !shape.properties.timelineId ||
            shape.properties.timelineId === selectedTimelineId,
        );
      });
    }
    Object.keys(groups).forEach((locationId) => {
      groups[locationId].sort((a, b) => {
        const orderA = a.properties.order ?? 0;
        const orderB = b.properties.order ?? 0;
        return orderB - orderA;
      });
    });
    return groups;
  }, [
    project?.mapData?.anchoredShapes,
    project?.locations,
    project?.mapData?.scenarios,
    selectedTimelineId,
    selectedScenarioId,
  ]);

  // Add filtered and paginated locations
  const filteredLocations = useMemo(() => {
    if (!project?.locations) return [];
    let filtered = project.locations;
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (location) =>
          location.name.toLowerCase().includes(search) ||
          location.type?.toLowerCase().includes(search) ||
          location.tags?.some((tag) => tag.toLowerCase().includes(search)),
      );
    }
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [project?.locations, searchTerm]);

  const paginatedLocations = useMemo(() => {
    const startIndex = (locationsPage - 1) * LOCATIONS_PER_PAGE;
    const endIndex = startIndex + LOCATIONS_PER_PAGE;
    return filteredLocations.slice(startIndex, endIndex);
  }, [filteredLocations, locationsPage]);

  const totalLocationPages = Math.ceil(
    filteredLocations.length / LOCATIONS_PER_PAGE,
  );

  const getPaginatedShapes = (locationId: string) => {
    const shapes = shapesByLocation[locationId] || [];
    const page = locationShapePages[locationId] || 1;
    const startIndex = (page - 1) * SHAPES_PER_LOCATION_PAGE;
    const endIndex = startIndex + SHAPES_PER_LOCATION_PAGE;
    return {
      shapes: shapes.slice(startIndex, endIndex),
      totalShapes: shapes.length,
      currentPage: page,
      totalPages: Math.ceil(shapes.length / SHAPES_PER_LOCATION_PAGE),
    };
  };

  useEffect(() => {
    setLocationsPage(1);
  }, [searchTerm]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    if (destination.droppableId === source.droppableId) {
      const locationId = source.droppableId.replace("location-", "");
      const locationShapes = [...(shapesByLocation[locationId] || [])];
      const [movedShape] = locationShapes.splice(source.index, 1);
      locationShapes.splice(destination.index, 0, movedShape);
      const totalShapes = locationShapes.length;
      const updatedShapes = locationShapes.map((shape, uiIndex) => ({
        ...shape,
        properties: { ...shape.properties, order: totalShapes - 1 - uiIndex },
      }));
      const allShapes = project?.mapData?.anchoredShapes || [];
      const otherShapes = allShapes.filter(
        (shape) => shape.anchor.locationId !== locationId,
      );
      const newAllShapes = [...otherShapes, ...updatedShapes];
      if (setAnchoredShapes) {
        setAnchoredShapes(newAllShapes);
        showSuccess("Shape order updated.");
      }
    }
  };

  useEffect(() => {
    if (appState.currentTimelineId && project?.timelines) {
      setSelectedTimelineId(appState.currentTimelineId);
      setFocusedLocationId(null);
    } else if (
      project?.timelines &&
      project.timelines.length > 0 &&
      !selectedTimelineId
    ) {
      setSelectedTimelineId(project.timelines[0].id);
      setScenarioTimelineId(project.timelines[0].id);
    }
  }, [appState.currentTimelineId, project?.timelines, selectedTimelineId]);

  const handleUpdateShape = useCallback(
    (updatedShape: AnchoredShape) => {
      if (updateAnchoredShape) {
        updateAnchoredShape(updatedShape);
      }
    },
    [updateAnchoredShape],
  );

  const handleStyleChange = (styleChanges: Partial<AnchoredShape["style"]>) => {
    if (selectedShape) {
      if ("opacity" in styleChanges) {
        const newOpacity = styleChanges.opacity!;
        const updatedStyle = {
          ...selectedShape.style,
          opacity: newOpacity,
          fillOpacity:
            selectedShape.type === "polygon" || selectedShape.type === "circle"
              ? newOpacity * 0.6
              : newOpacity,
          ...styleChanges,
        };
        handleUpdateShape({ ...selectedShape, style: updatedStyle });
      } else {
        handleUpdateShape({
          ...selectedShape,
          style: { ...selectedShape.style, ...styleChanges },
        });
      }
    }
  };

  const handleDeleteShape = (shapeId: ID) => {
    const shape = project?.mapData?.anchoredShapes.find(
      (s) => s.id === shapeId,
    );
    if (shape) {
      setShapeToDelete(shape);
    }
  };

  const handleConfirmDelete = () => {
    if (!shapeToDelete || !deleteAnchoredShape) return;
    if (selectedShapeId === shapeToDelete.id) {
      setSelectedShapeId(null);
    }
    deleteAnchoredShape(shapeToDelete.id);
    showSuccess("Shape deleted.");
    setShapeToDelete(null);
  };

  const handleLocationClick = (location: LocationType) => {
    if (location.coordinates) {
      setCenter({
        lat: location.coordinates.lat,
        lng: location.coordinates.lng,
      });
      setZoom(10);
      setFocusedLocationId(location.id);
    }
  };

  const handleShapeSelect = (shapeId: ID) => {
    setSelectedShapeId(shapeId);
    const shape = project?.mapData?.anchoredShapes.find(
      (s) => s.id === shapeId,
    );
    if (!shape) return;
    const anchorLocation = project?.locations.find(
      (l) => l.id === shape.anchor.locationId,
    );
    if (!anchorLocation && shape.anchor.locationId !== "origin") return;
    const absoluteCoords = calculateAbsoluteCoordinates(shape, anchorLocation);
    if (absoluteCoords && absoluteCoords.length > 0) {
      setBoundsToFit(absoluteCoords);
    }
  };

  const toggleLocationExpanded = (locationId: string) => {
    const newExpanded = new Set(expandedLocations);
    if (newExpanded.has(locationId)) {
      newExpanded.delete(locationId);
    } else {
      newExpanded.add(locationId);
    }
    setExpandedLocations(newExpanded);
  };

  const handleLocationShapePageChange = (locationId: string, page: number) => {
    setLocationShapePages((prev) => ({ ...prev, [locationId]: page }));
  };

  const saveCurrentScenario = async () => {
    if (!project) return;
    if (!scenarioTimelineId) {
      showError("Please select a timeline for this scenario.");
      return;
    }
    if (!scenarioName.trim()) {
      showError("Please enter a scenario name");
      return;
    }
    try {
      const currentShapes = (project.mapData?.anchoredShapes || []).filter(
        (shape) =>
          !shape.properties.timelineId ||
          shape.properties.timelineId === scenarioTimelineId,
      );
      const scenarioData: Omit<MapScenario, "id"> = {
        name: scenarioName.trim(),
        description: scenarioDescription.trim(),
        timelineId: scenarioTimelineId,
        date: scenarioDate,
        viewSettings: {
          center,
          zoom,
          baseMap: selectedBaseMap as any,
          showBorders: true,
          showLabels: true,
        },
        shapeIds: currentShapes.map((shape) => shape.id),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
      };
      addMapScenario(scenarioData);
      setScenarioName("");
      setScenarioDescription("");
      showSuccess(`Scenario "${scenarioData.name}" saved successfully`);
    } catch (error) {
      showError("Failed to save scenario");
    }
  };

  const availableScenarios = useMemo(() => {
    return project?.mapData?.scenarios || [];
  }, [project?.mapData]);

  const loadScenario = (scenario: MapScenario) => {
    setSelectedTimelineId(scenario.timelineId);
    setSelectedDate(scenario.date);
    setScenarioTimelineId(scenario.timelineId);
    setScenarioDate(scenario.date);
    setCenter(scenario.viewSettings.center);
    setZoom(scenario.viewSettings.zoom);
    setSelectedBaseMap(scenario.viewSettings.baseMap);
    setSelectedScenarioId(scenario.id);
    showSuccess(`Loaded scenario: ${scenario.name}`);
  };

  const handleDeleteScenario = (scenarioId: string) => {
    if (confirm("Are you sure you want to delete this scenario?")) {
      deleteMapScenario(scenarioId);
      if (selectedScenarioId === scenarioId) setSelectedScenarioId(null);
      showSuccess("Scenario deleted successfully");
    }
  };

  const handleShapesChange = useCallback(
    (shapes: AnchoredShape[]) => {
      if (setAnchoredShapes) {
        setAnchoredShapes(shapes);
      }
    },
    [setAnchoredShapes],
  );

  if (!project) {
    return (
      <MainContentArea title="Sousveillance">
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500 dark:text-gray-400">
            No project is currently loaded.
          </p>
        </div>
      </MainContentArea>
    );
  }

  return (
    <MainContentArea
      title="Sousveillance"
      actions={
        project.locations.length > 0 ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDrawingTrigger((t) => t + 1)}
            >
              Draw Shapes
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowKMZImportModal(true)}
            >
              Import KMZ
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
          <div className="space-y-4 mb-4">
            <div>
              <IntegratedGlobalSearch
                searchTerm={globalSearchTerm}
                onSearchChange={setGlobalSearchTerm}
                onLocationSelect={handleGlobalLocationSelect}
                onViewChange={handleViewChange}
                onAddLocationFromSearch={handleAddLocationFromSearch}
                placeholder="Search worldwide locations... (e.g., 'Rome', 'Mount Fuji', '123 Main St')"
              />
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
            <div className="h-full lg:col-span-3">
              <EnhancedMapDisplay
                timelineId={selectedTimelineId}
                date={selectedDate}
                mapDisplayLocations={project.locations}
                allTimelineLocations={project.locations}
                zoom={zoom}
                center={center}
                baseMap={selectedBaseMap}
                onZoomChange={setZoom}
                onCenterChange={setCenter}
                onLocationClick={handleLocationClick}
                onClearFocus={() => {
                  setCenter({ lat: 30, lng: 0 });
                  setZoom(2);
                  setFocusedLocationId(null);
                }}
                onShapesChange={handleShapesChange}
                savedShapes={project.mapData?.anchoredShapes || []}
                onBaseMapChange={setSelectedBaseMap}
                showBorders={false}
                showLabels={false}
                selectedShapeId={selectedShapeId}
                onShapeSelect={setSelectedShapeId}
                onShapeUpdate={handleUpdateShape}
                onEditLocation={handleEditLocation}
                boundsToFit={boundsToFit}
                onBoundsFit={() => setBoundsToFit(null)}
                drawingTrigger={drawingTrigger}
                localRoute={localRoute}
                beaconPosition={beaconPosition}
                beaconTrack={beaconTrack}
                focusPoint={focusPoint}
              />
            </div>

            <div className="h-full min-h-0 flex flex-col gap-4 overflow-y-auto pr-1">
              <MapLocalPanel
                center={center}
                onCenterChange={setCenter}
                onZoomChange={setZoom}
                onRoute={setLocalRoute}
                onBeacon={setBeaconPosition}
                onTrack={setBeaconTrack}
                onFocus={setFocusPoint}
                onAddLocation={(input) =>
                  handleAddLocationFromSearch({
                    lat: String(input.lat),
                    lon: String(input.lng),
                    display_name: input.name,
                    type: input.category,
                  })
                }
                timelineId={selectedTimelineId}
              />
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col flex-1 overflow-hidden">
                <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 mb-4">
                  <div className="flex">
                    <button
                      onClick={() => setActivePanel("layers")}
                      className={`px-4 py-2 text-sm font-medium ${
                        activePanel === "layers"
                          ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      }`}
                    >
                      Layers
                    </button>
                    <button
                      onClick={() => setActivePanel("scenarios")}
                      className={`px-4 py-2 text-sm font-medium ${
                        activePanel === "scenarios"
                          ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                          : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      }`}
                    >
                      Scenarios
                    </button>
                  </div>
                </div>

                {activePanel === "layers" && (
                  <>
                    {selectedShape && (
                      <div className="mb-4 flex-shrink-0 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="mb-3">
                          <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                            Selected:{" "}
                            {selectedShape.properties.name ||
                              `Untitled ${selectedShape.type}`}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                            Opacity
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={selectedShape.style.opacity ?? 0.5}
                              onChange={(e) =>
                                handleStyleChange({
                                  opacity: parseFloat(e.target.value),
                                })
                              }
                              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
                            />
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={Math.round(
                                  (selectedShape.style.opacity ?? 0.5) * 100,
                                )}
                                onChange={(e) => {
                                  const value = Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      parseInt(e.target.value) || 0,
                                    ),
                                  );
                                  handleStyleChange({
                                    opacity: value / 100,
                                  });
                                }}
                                className="w-12 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                              />
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mb-4 flex-shrink-0">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Filter Project Locations..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                        <svg
                          className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-2.5 top-2.5 h-4 w-4 text-gray-400 hover:text-gray-600"
                          >
                            <svg
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    {/* ========================= FIX START ========================= */}
                    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                      {/* ========================== FIX END ========================== */}
                      {filteredLocations.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <svg
                              className="mx-auto h-12 w-12 text-gray-400 mb-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                              />
                            </svg>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                              {searchTerm
                                ? "No matching locations"
                                : "No locations"}
                            </h3>
                            <p className="text-sm">
                              {searchTerm
                                ? "Try adjusting your search terms."
                                : "Add locations in the Knowledge Base to begin mapping."}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 overflow-y-auto pr-2">
                            <DragDropContext onDragEnd={onDragEnd}>
                              <div className="space-y-2">
                                {paginatedLocations.map((location) => {
                                  const {
                                    shapes,
                                    totalShapes,
                                    currentPage,
                                    totalPages,
                                  } = getPaginatedShapes(location.id);
                                  return (
                                    <LocationLayerGroup
                                      key={location.id}
                                      location={location}
                                      shapes={shapes}
                                      totalShapes={totalShapes}
                                      selectedShapeId={selectedShapeId}
                                      onShapeSelect={handleShapeSelect}
                                      onShapeUpdate={handleUpdateShape}
                                      onShapeDelete={handleDeleteShape}
                                      onLocationClick={handleLocationClick}
                                      isExpanded={expandedLocations.has(
                                        location.id,
                                      )}
                                      onToggleExpanded={() =>
                                        toggleLocationExpanded(location.id)
                                      }
                                      shapePage={currentPage}
                                      onShapePageChange={(page) =>
                                        handleLocationShapePageChange(
                                          location.id,
                                          page,
                                        )
                                      }
                                      shapeTotalPages={totalPages}
                                    />
                                  );
                                })}
                                {shapesByLocation["origin"] &&
                                  shapesByLocation["origin"].length > 0 && (
                                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800/50 mb-2">
                                      <div className="flex items-center justify-between p-3">
                                        <div className="flex items-center flex-1 min-w-0">
                                          <button
                                            className="mr-2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                            onClick={() =>
                                              toggleLocationExpanded("origin")
                                            }
                                          >
                                            <svg
                                              className={`h-4 w-4 text-gray-600 dark:text-gray-300 transition-transform ${
                                                expandedLocations.has("origin")
                                                  ? "rotate-90"
                                                  : ""
                                              }`}
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 5l7 7-7 7"
                                              />
                                            </svg>
                                          </button>
                                          <div className="w-3 h-3 rounded-full bg-orange-500 mr-2 flex-shrink-0" />
                                          <div className="truncate font-medium text-gray-900 dark:text-white">
                                            Imported Shapes
                                          </div>
                                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                            ({shapesByLocation["origin"].length}{" "}
                                            shape
                                            {shapesByLocation["origin"]
                                              .length !== 1
                                              ? "s"
                                              : ""}
                                            )
                                          </span>
                                        </div>
                                      </div>
                                      {expandedLocations.has("origin") && (
                                        <div className="border-t border-gray-200 dark:border-gray-600">
                                          <div className="px-3 py-2">
                                            <Droppable droppableId="location-origin">
                                              {(provided) => (
                                                <div
                                                  {...provided.droppableProps}
                                                  ref={provided.innerRef}
                                                  className="space-y-1"
                                                >
                                                  {shapesByLocation[
                                                    "origin"
                                                  ].map((shape, index) => (
                                                    <Draggable
                                                      key={shape.id}
                                                      draggableId={shape.id}
                                                      index={index}
                                                    >
                                                      {(provided) => (
                                                        <div
                                                          ref={
                                                            provided.innerRef
                                                          }
                                                          {...provided.draggableProps}
                                                          {...provided.dragHandleProps}
                                                        >
                                                          <ShapeListItem
                                                            shape={shape}
                                                            isSelected={
                                                              selectedShapeId ===
                                                              shape.id
                                                            }
                                                            onSelect={
                                                              handleShapeSelect
                                                            }
                                                            onUpdate={
                                                              handleUpdateShape
                                                            }
                                                            onDelete={
                                                              handleDeleteShape
                                                            }
                                                          />
                                                        </div>
                                                      )}
                                                    </Draggable>
                                                  ))}
                                                  {provided.placeholder}
                                                </div>
                                              )}
                                            </Droppable>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                              </div>
                            </DragDropContext>
                          </div>

                          <PaginationControls
                            currentPage={locationsPage}
                            totalPages={totalLocationPages}
                            onPageChange={setLocationsPage}
                            totalItems={filteredLocations.length}
                            itemsPerPage={LOCATIONS_PER_PAGE}
                            itemName="locations"
                          />
                        </>
                      )}
                    </div>
                  </>
                )}

                {activePanel === "scenarios" && (
                  <div className="flex flex-col h-full">
                    <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg flex-shrink-0">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Save Current View as Scenario
                      </h4>
                      <div className="space-y-2">
                        <InputField
                          type="text"
                          placeholder="Scenario name..."
                          value={scenarioName}
                          onChange={(e) => setScenarioName(e.target.value)}
                          fullWidth
                          containerClassName="m-0"
                        />
                        <InputField
                          type="text"
                          placeholder="Description (optional)..."
                          value={scenarioDescription}
                          onChange={(e) =>
                            setScenarioDescription(e.target.value)
                          }
                          fullWidth
                          containerClassName="m-0"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm text-gray-700 dark:text-gray-300 dark:bg-gray-700"
                            value={scenarioTimelineId}
                            onChange={(e) => setScenarioTimelineId(e.target.value)}
                          >
                            <option value="">Timeline…</option>
                            {(project.timelines || []).map((timeline) => (
                              <option key={timeline.id} value={timeline.id}>
                                {timeline.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm text-gray-700 dark:text-gray-300 dark:bg-gray-700"
                            value={scenarioDate}
                            onChange={(e) => setScenarioDate(e.target.value)}
                          />
                        </div>
                        <select
                          className="w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm text-gray-700 dark:text-gray-300 dark:bg-gray-700"
                          value={selectedBaseMap}
                          onChange={(e) => setSelectedBaseMap(e.target.value)}
                        >
                          <option value="standard">Standard layer</option>
                          <option value="humanitarian">Humanitarian layer</option>
                          <option value="transport">Transport layer</option>
                        </select>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={saveCurrentScenario}
                          disabled={!scenarioTimelineId || !scenarioName.trim()}
                          fullWidth
                        >
                          Save Scenario
                        </Button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-shrink-0">
                        Saved Scenarios ({availableScenarios.length})
                      </h4>
                      {availableScenarios.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          No scenarios saved.
                        </p>
                      ) : (
                        availableScenarios.map((scenario) => (
                          <div
                            key={scenario.id}
                            className={`p-3 border rounded-lg cursor-pointer ${
                              selectedScenarioId === scenario.id
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                : "border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div
                                className="flex-1 min-w-0"
                                onClick={() => loadScenario(scenario)}
                              >
                                <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                                  {scenario.name}
                                </div>
                                {scenario.description && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {scenario.description}
                                  </div>
                                )}
                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                  Date: {scenario.date} • Shapes:{" "}
                                  {scenario.shapeIds.length}
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteScenario(scenario.id);
                                }}
                                className="ml-2 text-red-500 hover:text-red-700 p-1"
                                title="Delete scenario"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* Modals are placed here, outside the conditional logic, so they can be opened from anywhere */}
      {editingLocation && (
        <LocationEditModal
          isOpen={showLocationEditModal}
          location={editingLocation}
          onSave={handleSaveLocationEdit}
          onCancel={handleCancelLocationEdit}
          onOpenFullForm={() => handleOpenInKnowledgeBase(editingLocation)}
        />
      )}

      {showKMZImportModal && (
        <EnhancedKMZImportModal
          isOpen={showKMZImportModal}
          onClose={() => setShowKMZImportModal(false)}
          onImport={(shapes) => {
            if (setAnchoredShapes && project?.mapData?.anchoredShapes) {
              const newShapes = [...project.mapData.anchoredShapes, ...shapes];
              setAnchoredShapes(newShapes);
              showSuccess(`Imported ${shapes.length} shapes from KMZ file.`);
            }
          }}
        />
      )}

      {shapeToDelete && (
        <Modal
          isOpen={!!shapeToDelete}
          onClose={() => setShapeToDelete(null)}
          title="Confirm Deletion"
          size="sm"
        >
          <div className="p-4">
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete "
              <span className="font-medium">
                {shapeToDelete.properties.name ||
                  `Untitled ${shapeToDelete.type}`}
              </span>
              "? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShapeToDelete(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </MainContentArea>
  );
  // ========================== FIX END ==========================
};

export default EnhancedMapEditorPage;
