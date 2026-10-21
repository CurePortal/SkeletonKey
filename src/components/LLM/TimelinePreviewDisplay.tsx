// src/components/LLM/TimelinePreviewDisplay.tsx
import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { useProjectData } from "../../contexts/ProjectDataContext";
import { parseCalendarDate } from "../../utils/helpers";
import {
  normalizeTimeline,
  normalizeCharacter,
  normalizeLocation,
  normalizeTechnology,
  normalizeCulture,
  // --- FIX: Removed unused imports ---
  // normalizeNarrative,
  // normalizeEvent,
  // formatDateString,
  isTimelineObject,
  isEventObject,
  isCharacterObject,
  isLocationObject,
  isTechnologyObject,
  isCultureObject,
  // isNarrativeObject,
} from "../../utils/llmUtils";

interface TimelinePreviewDisplayProps {
  jsonData: any;
  onUseInProject: () => void;
  // --- FIX: Removed unused prop ---
  // onUpdateJsonData?: (updatedData: any) => void;
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "Unknown";
  try {
    if (dateString.startsWith("-")) {
      const bcYear = Math.abs(parseInt(dateString.split("-")[1]));
      return `${bcYear} BCE`;
    }
    const date = parseCalendarDate(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    return "Invalid Date";
  }
};

const TimelinePreviewDisplay: React.FC<TimelinePreviewDisplayProps> = ({
  jsonData,
  onUseInProject,
  // --- FIX: Removed unused prop ---
  // onUpdateJsonData,
}) => {
  const { project } = useProjectData();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedItemType, setSelectedItemType] = useState<string>("");
  // --- FIX: Removed unused state ---
  // const [previewMode, setPreviewMode] = useState<"new" | "existing">("new");
  const [normalizedData, setNormalizedData] = useState<any>(null);
  const [showAllItems, setShowAllItems] = useState<boolean>(true);

  const analyzeContentType = (data: any, type: string) => {
    if (!project || !data) return "new";
    const projectEntities = {
      character: project.characters || [],
      location: project.locations || [],
      technology: project.technologies || [],
      culture: project.cultures || [],
      narrative: project.reports || [],
    };
    const entities = Array.isArray(data) ? data : [data];
    const existingCount = entities.filter((entity: any) => {
      const entityName = entity.name || entity.title;
      if (!entityName) return false;
      const relevantEntities =
        projectEntities[type as keyof typeof projectEntities] || [];
      return relevantEntities.some(
        (existing: any) =>
          (existing.name || existing.title)?.toLowerCase() ===
          entityName.toLowerCase(),
      );
    }).length;
    return entities.length > 0 && existingCount / entities.length > 0.5
      ? "existing"
      : "new";
  };

  useEffect(() => {
    if (!jsonData) {
      setNormalizedData(null);
      return;
    }

    let tempNormalizedResult: any = null;
    // --- FIX: Removed unused variable ---
    // let detectedType = "unknown";
    let contentMode: "new" | "existing" = "new";

    if (Array.isArray(jsonData) && jsonData.length > 0) {
      if (jsonData.every(isCharacterObject)) {
        // detectedType = "character"; // No longer needed
        contentMode = analyzeContentType(jsonData, "character");
        tempNormalizedResult = {
          type: "character",
          mode: contentMode,
          characters: jsonData.map(normalizeCharacter),
        };
      } else if (jsonData.every(isLocationObject)) {
        // detectedType = "location"; // No longer needed
        contentMode = analyzeContentType(jsonData, "location");
        tempNormalizedResult = {
          type: "location",
          mode: contentMode,
          locations: jsonData.map(normalizeLocation),
        };
      } else if (jsonData.every(isTechnologyObject)) {
        // detectedType = "technology"; // No longer needed
        contentMode = analyzeContentType(jsonData, "technology");
        tempNormalizedResult = {
          type: "technology",
          mode: contentMode,
          technologies: jsonData.map(normalizeTechnology),
        };
      } else if (jsonData.every(isCultureObject)) {
        // detectedType = "culture"; // No longer needed
        contentMode = analyzeContentType(jsonData, "culture");
        tempNormalizedResult = {
          type: "culture",
          mode: contentMode,
          cultures: jsonData.map(normalizeCulture),
        };
      } else if (jsonData.every(isTimelineObject)) {
        // detectedType = "timeline"; // No longer needed
        tempNormalizedResult = {
          type: "timeline",
          mode: "new",
          timelines: jsonData.map(normalizeTimeline),
        };
      } else if (jsonData.every(isEventObject)) {
        // detectedType = "event"; // No longer needed
        tempNormalizedResult = {
          type: "timeline",
          mode: "new",
          timelines: [
            normalizeTimeline({
              id: uuidv4(),
              name: "Generated Event List",
              description: `Preview of ${jsonData.length} generated events.`,
              color: "#4287f5",
              events: jsonData,
              pointsOfDivergence: [],
              isMainTimeline: false,
            }),
          ],
        };
      }
    } else if (
      jsonData &&
      typeof jsonData === "object" &&
      !Array.isArray(jsonData)
    ) {
      if (isCharacterObject(jsonData)) {
        // detectedType = "character"; // No longer needed
        contentMode = analyzeContentType(jsonData, "character");
        tempNormalizedResult = {
          type: "character",
          mode: contentMode,
          characters: [normalizeCharacter(jsonData)],
        };
      } else if (isLocationObject(jsonData)) {
        // detectedType = "location"; // No longer needed
        contentMode = analyzeContentType(jsonData, "location");
        tempNormalizedResult = {
          type: "location",
          mode: contentMode,
          locations: [normalizeLocation(jsonData)],
        };
      }
      // ... handle other single object types
    }

    setNormalizedData(tempNormalizedResult);
    // --- FIX: Removed setPreviewMode ---
    // setPreviewMode(contentMode);
  }, [jsonData, project]);

  const handleItemClick = (item: any, type: string) => {
    setSelectedItem(item);
    setSelectedItemType(type);
  };

  const closeDetails = () => {
    setSelectedItem(null);
    setSelectedItemType("");
  };

  if (!normalizedData) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="font-medium text-gray-800 dark:text-white">
            Preview Generated Content
          </h3>
        </div>
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <p>No preview available for this content.</p>
        </div>
      </div>
    );
  }

  const characters = normalizedData?.characters || [];
  const locations = normalizedData?.locations || [];
  const technologies = normalizedData?.technologies || [];
  const cultures = normalizedData?.cultures || [];
  const narratives = normalizedData?.narratives || [];
  const timelines = normalizedData?.timelines || [];

  const isExistingContent = normalizedData.mode === "existing";

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="font-medium text-gray-800 dark:text-white">
          {isExistingContent
            ? "Project Content Analysis"
            : "Preview Generated Content"}
        </h3>
        <div className="flex space-x-2 items-center">
          {!isExistingContent && (
            <button
              onClick={onUseInProject}
              className="px-3 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
            >
              Add to Project
            </button>
          )}
          {characters.length +
            locations.length +
            technologies.length +
            cultures.length +
            narratives.length +
            timelines.length >
            6 && (
            <button
              onClick={() => setShowAllItems(!showAllItems)}
              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              {showAllItems ? "Collapse" : "Expand All"}
            </button>
          )}
        </div>
      </div>

      {characters.length > 0 && (
        <div className="p-4">
          <h3 className="text-base font-medium mb-3 text-gray-800 dark:text-white">
            {characters.length} Character{characters.length === 1 ? "" : "s"}
            {isExistingContent ? " in Project" : " to be Added"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {characters
              .slice(0, showAllItems ? characters.length : 6)
              .map((character: any, index: number) => (
                <div
                  key={character.id || `char-preview-${index}`}
                  className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleItemClick(character, "character")}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm text-gray-800 dark:text-white truncate">
                      {character.name || "Unnamed Character"}
                    </h4>
                    <div className="flex gap-1">
                      {character.isHistorical && (
                        <span className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-100 px-1 py-0.5 rounded">
                          Historical
                        </span>
                      )}
                      {isExistingContent && (
                        <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 px-1 py-0.5 rounded">
                          In Project
                        </span>
                      )}
                    </div>
                  </div>
                  {character.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 mb-2 line-clamp-3">
                      {character.description}
                    </p>
                  )}
                  {character.traits && character.traits.length > 0 && (
                    <div className="mb-2">
                      <div className="flex flex-wrap gap-1">
                        {character.traits
                          .slice(0, 3)
                          .map((trait: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-xs bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 px-1 py-0.5 rounded"
                            >
                              {trait}
                            </span>
                          ))}
                        {character.traits.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            +{character.traits.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {(character.birthDate || character.deathDate) && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {character.birthDate && (
                        <span>Born: {formatDate(character.birthDate)}</span>
                      )}
                      {character.birthDate && character.deathDate && (
                        <span> • </span>
                      )}
                      {character.deathDate && (
                        <span>Died: {formatDate(character.deathDate)}</span>
                      )}
                    </div>
                  )}
                  {isExistingContent && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Click to view full details
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
          {!showAllItems && characters.length > 6 && (
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              + {characters.length - 6} more characters
            </div>
          )}
        </div>
      )}

      {locations.length > 0 && (
        <div className="p-4">
          <h3 className="text-base font-medium mb-3 text-gray-800 dark:text-white">
            {locations.length} Location{locations.length === 1 ? "" : "s"}
            {isExistingContent ? " in Project" : " to be Added"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {locations
              .slice(0, showAllItems ? locations.length : 6)
              .map((location: any, index: number) => (
                <div
                  key={location.id || `loc-preview-${index}`}
                  className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleItemClick(location, "location")}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm text-gray-800 dark:text-white">
                      {location.name}
                    </h4>
                    {isExistingContent && (
                      <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100 px-1 py-0.5 rounded">
                        In Project
                      </span>
                    )}
                  </div>
                  {location.type && (
                    <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-1">
                      {location.type}
                    </p>
                  )}
                  {location.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">
                      {location.description}
                    </p>
                  )}
                  {location.importance && (
                    <div className="mt-2 flex items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Importance: {location.importance}/10
                      </span>
                      <div className="ml-2 flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1 max-w-16">
                        <div
                          className="bg-amber-500 h-1 rounded-full"
                          style={{
                            width: `${(location.importance / 10) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {selectedItem && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-gray-800 dark:text-white">
                {selectedItemType === "character"
                  ? "Character Details"
                  : selectedItemType === "location"
                    ? "Location Details"
                    : "Item Details"}
                : {selectedItem.name || selectedItem.title}
              </h4>
              <button
                onClick={closeDetails}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm max-h-96 overflow-y-auto">
              {selectedItem.description && (
                <div>
                  <strong className="text-gray-700 dark:text-gray-300">
                    Description:
                  </strong>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {selectedItem.description}
                  </p>
                </div>
              )}
              {selectedItemType === "character" && (
                <>
                  {selectedItem.background && (
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">
                        Background:
                      </strong>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {selectedItem.background}
                      </p>
                    </div>
                  )}
                  {selectedItem.motivation && (
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">
                        Motivation:
                      </strong>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {selectedItem.motivation}
                      </p>
                    </div>
                  )}
                  {selectedItem.traits && selectedItem.traits.length > 0 && (
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">
                        Traits:
                      </strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedItem.traits.map(
                          (trait: string, idx: number) => (
                            <span
                              key={idx}
                              className="text-xs bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 px-2 py-1 rounded"
                            >
                              {trait}
                            </span>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                  {(selectedItem.birthDate || selectedItem.deathDate) && (
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">
                        Lifespan:
                      </strong>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {selectedItem.birthDate &&
                          `Born: ${formatDate(selectedItem.birthDate)}`}
                        {selectedItem.birthDate &&
                          selectedItem.deathDate &&
                          " • "}
                        {selectedItem.deathDate &&
                          `Died: ${formatDate(selectedItem.deathDate)}`}
                      </p>
                    </div>
                  )}
                  <div>
                    <strong className="text-gray-700 dark:text-gray-300">
                      Historical:
                    </strong>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">
                      {selectedItem.isHistorical ? "Yes" : "No"}
                    </span>
                  </div>
                </>
              )}
              {selectedItemType === "location" && (
                <>
                  {selectedItem.type && (
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">
                        Type:
                      </strong>
                      <span className="text-gray-600 dark:text-gray-400 ml-2">
                        {selectedItem.type}
                      </span>
                    </div>
                  )}
                  {selectedItem.coordinates && (
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">
                        Coordinates:
                      </strong>
                      <span className="text-gray-600 dark:text-gray-400 ml-2">
                        {selectedItem.coordinates.lat.toFixed(4)},{" "}
                        {selectedItem.coordinates.lng.toFixed(4)}
                      </span>
                    </div>
                  )}
                  {(selectedItem.foundedDate || selectedItem.destroyedDate) && (
                    <div>
                      <strong className="text-gray-700 dark:text-gray-300">
                        Timeline:
                      </strong>
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        {selectedItem.foundedDate &&
                          `Founded: ${formatDate(selectedItem.foundedDate)}`}
                        {selectedItem.foundedDate &&
                          selectedItem.destroyedDate &&
                          " • "}
                        {selectedItem.destroyedDate &&
                          `Destroyed: ${formatDate(selectedItem.destroyedDate)}`}
                      </p>
                    </div>
                  )}
                </>
              )}
              {selectedItem.notes && (
                <div>
                  <strong className="text-gray-700 dark:text-gray-300">
                    Notes:
                  </strong>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {selectedItem.notes}
                  </p>
                </div>
              )}
              {isExistingContent && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    💡 This {selectedItemType} is already in your project. You
                    can view its full details and connections in the main
                    interface.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelinePreviewDisplay;
