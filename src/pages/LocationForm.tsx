import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { LatLngTuple } from "leaflet";
import InputField from "../components/common/InputField";
import Button from "../components/common/Button";
import RichTextEditor from "../components/common/RichTextEditor";
import { LocationType, Coordinates } from "../types/project";
import {
  MAP_ICONS,
  createLeafletIcon,
  getIconsByCategory,
} from "../utils/mapIcons";

interface LocationFormProps {
  initialData?: LocationType | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const LOCATION_TYPES = [
  "Planet",
  "Continent",
  "Country",
  "State/Province",
  "Region",
  "City",
  "Town",
  "Village",
  "District/Borough",
  "Neighborhood",
  "Building",
  "Room",
  "Landmark",
  "Natural Feature",
  "Point of Interest",
  "Fictional Location",
  "Historical Site",
  "Geographical Area",
  "Other",
];

// Icon Selection Component
const IconSelector: React.FC<{
  selectedIconId: string;
  onIconSelect: (iconId: string) => void;
  className?: string;
  disabled?: boolean;
}> = ({ selectedIconId, onIconSelect, className = "", disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("pushpins");

  const iconsByCategory = useMemo(() => getIconsByCategory(), []);
  const categories = Object.keys(iconsByCategory);

  const selectedIcon = MAP_ICONS.find((icon) => icon.id === selectedIconId);

  return (
    <div className={`relative ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Standard Icon
      </label>

      {/* Icon Preview Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center space-x-3">
          {selectedIcon && (
            <div className="flex-shrink-0">
              {React.createElement(selectedIcon.icon, {
                size: 20,
                color: selectedIcon.color,
                className: "flex-shrink-0",
              })}
            </div>
          )}
          <span className="text-sm text-gray-900 dark:text-gray-100">
            {selectedIcon ? selectedIcon.name : "Select an icon"}
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${
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

      {/* Icon Selection Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-25"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-96 flex flex-col">
            {/* Category Tabs */}
            <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 p-2 space-x-1">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </button>
              ))}
            </div>

            {/* Icon Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-6 gap-2">
                {iconsByCategory[selectedCategory]?.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => {
                      onIconSelect(icon.id);
                      setIsOpen(false);
                    }}
                    className={`flex flex-col items-center p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      selectedIconId === icon.id
                        ? "bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500"
                        : ""
                    }`}
                    title={icon.name}
                  >
                    <div className="mb-1">
                      {React.createElement(icon.icon, {
                        size: 18,
                        color: icon.color,
                      })}
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 text-center leading-tight truncate w-full">
                      {icon.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Helper component to update map view when coordinates change externally
const ChangeView: React.FC<{ center: LatLngTuple; zoom: number }> = ({
  center,
  zoom,
}) => {
  const map = useMap();
  useEffect(() => {
    if (
      map &&
      center &&
      center.length === 2 &&
      center.every((c) => typeof c === "number")
    ) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
};

// Helper component to handle map clicks for setting coordinates
const MapClickHandler: React.FC<{ onClick: (coords: Coordinates) => void }> = ({
  onClick,
}) => {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const LocationForm: React.FC<LocationFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formState, setFormState] = useState({
    name: "",
    description: "",
    type: LOCATION_TYPES[0],
    coordinates: { lat: "", lng: "" }, // Keep as string for input fields
    foundedDate: "",
    destroyedDate: "",
    population: "",
    importance: 5,
    notes: "",
    tags: "",
    iconId: "place-generic",
  });
  // --- MODIFICATION START ---
  const [customIcon, setCustomIcon] = useState<{
    url: string;
    name: string;
  } | null>(null);
  // --- MODIFICATION END ---

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [mapCenter, setMapCenter] = useState<LatLngTuple>([51.505, -0.09]);
  const [mapZoom, setMapZoom] = useState<number>(2);
  const [markerPosition, setMarkerPosition] = useState<LatLngTuple | null>(
    null,
  );

  // --- MODIFICATION START ---
  const handleCustomIconUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomIcon({
          url: reader.result as string,
          name: file.name,
        });
      };
      reader.readAsDataURL(file);
    } else if (file) {
      // Basic error handling for non-image files
      alert("Please select a valid image file (e.g., PNG, JPG, GIF).");
    }
    // Clear the input value to allow re-uploading the same file
    event.target.value = "";
  };

  const handleRemoveCustomIcon = () => {
    setCustomIcon(null);
  };
  // --- MODIFICATION END ---

  const markerIcon = useMemo(() => {
    // --- MODIFICATION START ---
    if (customIcon?.url) {
      return L.icon({
        iconUrl: customIcon.url,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });
    }
    // --- MODIFICATION END ---
    try {
      return createLeafletIcon(formState.iconId);
    } catch (error) {
      console.error("Error creating marker icon:", error);
      return createLeafletIcon("place-generic");
    }
  }, [formState.iconId, customIcon]); // --- MODIFICATION: Added customIcon dependency

  useEffect(() => {
    if (initialData) {
      const initialLat = initialData.coordinates?.lat;
      const initialLng = initialData.coordinates?.lng;
      setFormState({
        name: initialData.name || "",
        description: initialData.description || "",
        type: initialData.type || LOCATION_TYPES[0],
        coordinates: {
          lat:
            initialLat !== undefined && initialLat !== null
              ? String(initialLat)
              : "",
          lng:
            initialLng !== undefined && initialLng !== null
              ? String(initialLng)
              : "",
        },
        foundedDate: initialData.foundedDate || "",
        destroyedDate: initialData.destroyedDate || "",
        population: initialData.population
          ? String(initialData.population)
          : "",
        importance: initialData.importance || 5,
        notes: initialData.notes || "",
        tags: Array.isArray(initialData.tags)
          ? initialData.tags.join(", ")
          : initialData.tags || "",
        iconId:
          initialData.properties?.iconId ||
          initialData.properties?.importedIconId ||
          "place-generic",
      });
      // --- MODIFICATION START ---
      setCustomIcon(initialData.properties?.customIcon || null);
      // --- MODIFICATION END ---

      if (
        initialLat !== undefined &&
        initialLat !== null &&
        initialLng !== undefined &&
        initialLng !== null
      ) {
        const latNum = Number(initialLat);
        const lngNum = Number(initialLng);
        if (!isNaN(latNum) && !isNaN(lngNum)) {
          setMapCenter([latNum, lngNum]);
          setMarkerPosition([latNum, lngNum]);
          setMapZoom(13);
        }
      } else {
        setMapCenter([30, 0]);
        setMarkerPosition(null);
        setMapZoom(2);
      }
    } else {
      setFormState({
        name: "",
        description: "",
        type: LOCATION_TYPES[0],
        coordinates: { lat: "", lng: "" },
        foundedDate: "",
        destroyedDate: "",
        population: "",
        importance: 5,
        notes: "",
        tags: "",
        iconId: "place-generic",
      });
      // --- MODIFICATION START ---
      setCustomIcon(null);
      // --- MODIFICATION END ---
      setMapCenter([30, 0]);
      setMarkerPosition(null);
      setMapZoom(2);
    }
  }, [initialData]);

  useEffect(() => {
    const latNum = parseFloat(formState.coordinates.lat);
    const lngNum = parseFloat(formState.coordinates.lng);

    if (!isNaN(latNum) && !isNaN(lngNum)) {
      setMarkerPosition([latNum, lngNum]);
    } else {
      setMarkerPosition(null);
    }
  }, [formState.coordinates]);

  const searchLocation = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery,
        )}&limit=5&addressdetails=1`,
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error searching location:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    setFormState({
      ...formState,
      name: result.display_name.split(",")[0] || formState.name,
      coordinates: { lat: String(lat), lng: String(lng) },
    });
    setMapCenter([lat, lng]);
    setMarkerPosition([lat, lng]);
    setMapZoom(13);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleCoordinateChange = (field: "lat" | "lng", value: string) => {
    if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
      setFormState((prev) => ({
        ...prev,
        coordinates: { ...prev.coordinates, [field]: value },
      }));
    }
  };

  const handleMapClickSetCoordinates = useCallback((coords: Coordinates) => {
    setFormState((prev) => ({
      ...prev,
      coordinates: { lat: String(coords.lat), lng: String(coords.lng) },
    }));
    setMarkerPosition([coords.lat, coords.lng]);
  }, []);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setFormState((prev) => ({
          ...prev,
          coordinates: { lat: String(lat), lng: String(lng) },
        }));
        setMapCenter([lat, lng]);
        setMarkerPosition([lat, lng]);
        setMapZoom(13);
      },
      (error) => {
        console.error("Error getting your location:", error);
        alert("Error getting your location.");
      },
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formState.name.trim()) newErrors.name = "Name is required";
    if (
      (formState.coordinates.lat && !formState.coordinates.lng) ||
      (!formState.coordinates.lat && formState.coordinates.lng)
    ) {
      newErrors.coordinates =
        "Both latitude and longitude, or neither, must be provided";
    }
    if (formState.population && !/^\d*$/.test(formState.population))
      newErrors.population = "Population must be a number";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;
    const coordinates =
      formState.coordinates.lat && formState.coordinates.lng
        ? {
            lat: parseFloat(formState.coordinates.lat),
            lng: parseFloat(formState.coordinates.lng),
          }
        : null;
    const processedData = {
      ...formState,
      coordinates,
      population: formState.population
        ? parseInt(formState.population, 10)
        : null,
      importance: parseInt(String(formState.importance), 10),
      tags: formState.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      timelineIds: initialData?.timelineIds || [],
      parentLocationId: initialData?.parentLocationId,
      linkedEventIds: initialData?.linkedEventIds || [],
      properties: {
        ...initialData?.properties,
        iconId: formState.iconId,
        // --- MODIFICATION START ---
        customIcon: customIcon,
        // --- MODIFICATION END ---
      },
    };
    onSubmit(processedData);
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Basic Information */}
      <div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="md:col-span-2">
            <InputField
              label="Name"
              value={formState.name}
              onChange={(e) =>
                setFormState({ ...formState, name: e.target.value })
              }
              placeholder="Enter location name"
              required
              error={errors.name}
            />
          </div>
          <div className="md:col-span-2">
            <RichTextEditor
              label="Description"
              value={formState.description}
              onChange={(value) =>
                setFormState({ ...formState, description: value })
              }
              placeholder="Describe the location..."
              rows={4}
              helpText="Use the toolbar to format your text with bold, italic, lists, and more"
            />
          </div>
          <div>
            <label
              htmlFor="locationType"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Type
            </label>
            <select
              id="locationType"
              name="type"
              value={formState.type}
              onChange={(e) =>
                setFormState({ ...formState, type: e.target.value })
              }
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {LOCATION_TYPES.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption}
                </option>
              ))}
            </select>
          </div>
          {/* --- MODIFICATION START --- */}
          <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 border-t dark:border-gray-700 pt-6">
            <div>
              <IconSelector
                selectedIconId={formState.iconId}
                onIconSelect={(iconId) =>
                  setFormState({ ...formState, iconId })
                }
                disabled={!!customIcon}
              />
              {customIcon && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Disabled because a custom icon is active.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    id="custom-icon-upload"
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    onChange={handleCustomIconUpload}
                  />
                  <label
                    htmlFor="custom-icon-upload"
                    className="cursor-pointer w-full text-center px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400 hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                  >
                    Upload an Image
                  </label>
                </div>
              )}
            </div>
          </div>
          {/* --- MODIFICATION END --- */}
        </div>
      </div>

      {/* Section 2: Coordinates & Mapping */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Coordinates & Mapping
        </h3>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Search for Location
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && searchLocation()}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Search for a location..."
              />
              <Button
                variant="outline"
                onClick={searchLocation}
                disabled={isSearching}
              >
                {isSearching ? "Searching..." : "Search"}
              </Button>
              <Button
                variant="outline"
                onClick={getCurrentLocation}
                title="Use current location"
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
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-300 dark:border-gray-600 rounded-md max-h-48 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <button
                    key={index}
                    onClick={() => selectSearchResult(result)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                  >
                    {result.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Coordinates{" "}
              {errors.coordinates && (
                <span className="text-red-500 text-xs ml-1">
                  ({errors.coordinates})
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-4 mb-2">
              <InputField
                label="Latitude"
                value={formState.coordinates.lat}
                onChange={(e) => handleCoordinateChange("lat", e.target.value)}
                placeholder="e.g., 40.7128"
                helpText="Enter latitude (-90 to 90)"
              />
              <InputField
                label="Longitude"
                value={formState.coordinates.lng}
                onChange={(e) => handleCoordinateChange("lng", e.target.value)}
                placeholder="e.g., -74.0060"
                helpText="Enter longitude (-180 to 180)"
              />
            </div>
          </div>

          <div className="mt-4 border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden h-64">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <ChangeView center={mapCenter} zoom={mapZoom} />
              <MapClickHandler onClick={handleMapClickSetCoordinates} />
              {markerPosition && (
                <Marker position={markerPosition} icon={markerIcon} />
              )}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Section 3: Timeline & Dates */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Timeline & Dates
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
          <InputField
            label="Founded Date"
            value={formState.foundedDate}
            onChange={(e) =>
              setFormState({ ...formState, foundedDate: e.target.value })
            }
            type="date"
          />
          <InputField
            label="Destroyed/Abandoned Date"
            value={formState.destroyedDate}
            onChange={(e) =>
              setFormState({ ...formState, destroyedDate: e.target.value })
            }
            type="date"
            helpText="Leave empty if still exists"
          />
          <InputField
            label="Population"
            value={formState.population}
            onChange={(e) =>
              setFormState({ ...formState, population: e.target.value })
            }
            type="text"
            error={errors.population}
            helpText="Current or historical population"
          />
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Importance ({formState.importance}/10)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="1"
                max="10"
                value={formState.importance}
                onChange={(e) =>
                  setFormState({
                    ...formState,
                    importance: parseInt(e.target.value),
                  })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <span className="ml-3 w-8 text-center text-sm text-gray-700 dark:text-gray-300 tabular-nums">
                {formState.importance}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Additional Information */}
      <div className="pt-6 mt-6 border-t dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Additional Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <RichTextEditor
            label="Notes"
            value={formState.notes}
            onChange={(value) => setFormState({ ...formState, notes: value })}
            placeholder="Additional notes about this location..."
            rows={3}
            helpText="Any additional information or notes"
          />
          <InputField
            label="Tags"
            value={formState.tags}
            onChange={(e) =>
              setFormState({ ...formState, tags: e.target.value })
            }
            placeholder="tag1, tag2"
            helpText="Separate with commas"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-8 flex justify-end space-x-3 border-t dark:border-gray-700 mt-8">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit}>
          {initialData ? "Update" : "Create"} Location
        </Button>
      </div>
    </div>
  );
};

export default LocationForm;
