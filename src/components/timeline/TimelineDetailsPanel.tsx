import React, { useMemo } from "react";
import { TimelineType, EventType, ID } from "../../types"; // Assuming ID is defined here
import { parseCalendarDate } from "../../utils/helpers";

// Define basic types for KB items - these should match your actual data structure
// These are placeholders; replace with your actual imported types if available
interface CharacterType {
  id: ID;
  name: string;
  // add other relevant character properties
}

interface LocationType {
  id: ID;
  name: string;
  // add other relevant location properties
}

interface TechnologyType {
  id: ID;
  name: string;
  // add other relevant technology properties
}

interface CultureType {
  id: ID;
  name: string;
  // add other relevant culture properties
}

// Extend EventType for internal use to match the flow view
// Assume the event now includes arrays of the full linked objects
interface InternalEventType extends EventType {
  verticalOffset?: number;
  branchFromEventId?: ID;
  linkedCharacters?: CharacterType[]; // Added linked objects
  linkedLocations?: LocationType[]; // Added linked objects
  linkedTechnologies?: TechnologyType[]; // Added linked objects
  linkedCultures?: CultureType[]; // Added linked objects
}

interface TimelineDetailsPanelProps {
  timeline: TimelineType | undefined;
  selectedEvent: InternalEventType | null; // Use the extended type
  allTimelines: TimelineType[];
  onEventClick: (event: InternalEventType) => void; // Updated to use extended type
  onEventEdit: (event: InternalEventType) => void; // Updated to use extended type
  onAddEvent: (timelineId?: ID) => void; // This seems to trigger adding a timeline when timeline is null, maybe rename or clarify?
  onEditTimeline?: (timelineId: ID) => void;
  onSelectTimeline: (timelineId: ID) => void;
  onBackToTimeline: () => void;
  onViewKBItem: (
    type:
      | "character"
      | "location"
      | "technology"
      | "culture"
      | "source"
      | "tag",
    id: ID,
  ) => void; // New prop for viewing KB items (kept as it's part of the interface, but not used for the linked entities display now)
}

// Replace the formatDate function in TimelineDetailsPanel (around line 69-85) with this:

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "Unknown";

  try {
    // Check for BC/BCE dates (stored as negative years)
    if (dateString.startsWith("-")) {
      // Remove the negative sign and split to get year, month, day
      const cleanedDate = dateString.substring(1);
      const parts = cleanedDate.split("-");

      if (parts.length > 0) {
        let year = parseInt(parts[0], 10);

        // Handle year 0 or invalid parsing
        if (isNaN(year) || year === 0) {
          // If we can't parse properly, try to extract just the year
          const yearMatch = dateString.match(/-(\d+)/);
          if (yearMatch) {
            year = parseInt(yearMatch[1], 10);
          }
        }

        if (!isNaN(year) && year > 0) {
          // Check if we have month and day
          if (parts.length >= 3) {
            const month = parseInt(parts[1], 10);
            const day = parseInt(parts[2], 10);

            if (!isNaN(month) && !isNaN(day) && month >= 1 && month <= 12) {
              const monthNames = [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ];
              return `${monthNames[month - 1]} ${day}, ${year} BCE`;
            }
          }
          return `${year} BCE`;
        }
      }
      return "Invalid Date";
    }

    // Regular date formatting
    const date = parseCalendarDate(dateString);
    if (isNaN(date.getTime())) return "Invalid Date";

    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    console.error("Error formatting date:", dateString, error);
    return "Invalid Date";
  }
};

const TimelineDetailsPanel: React.FC<TimelineDetailsPanelProps> = ({
  timeline,
  selectedEvent, // selectedEvent now potentially contains linked KB objects
  allTimelines,
  onEventClick,
  onEventEdit,
  onAddEvent, // This seems to trigger adding a timeline when timeline is null, maybe rename or clarify?
  onEditTimeline,
  onSelectTimeline,
  onBackToTimeline,
}) => {
  // If we have a selected event, show event details instead of timeline details
  if (selectedEvent) {
    // Check if there are any linked entities (either full objects or just IDs)
    const hasLinkedEntities =
      (selectedEvent.linkedCharacters?.length ?? 0) > 0 ||
      (selectedEvent.linkedLocations?.length ?? 0) > 0 ||
      (selectedEvent.linkedTechnologies?.length ?? 0) > 0 ||
      (selectedEvent.linkedCultures?.length ?? 0) > 0 ||
      (selectedEvent.linkedCharacterIds?.length ?? 0) > 0 ||
      (selectedEvent.linkedLocationIds?.length ?? 0) > 0 ||
      (selectedEvent.linkedTechnologyIds?.length ?? 0) > 0 ||
      (selectedEvent.linkedCultureIds?.length ?? 0) > 0;

    return (
      <div className="w-full h-full overflow-auto bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
        {/* Event Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-3">
            <button
              onClick={onBackToTimeline}
              className="mr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Back to timeline"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex-1">
              Event Details
            </h3>
            <button
              onClick={() => onEventEdit(selectedEvent)}
              className="ml-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Edit event"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          </div>

          {/* Event Title and primary tags */}
          <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {selectedEvent.title}
          </h4>
          <div className="flex flex-wrap gap-2">
            <span className="text-sm px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:bg-opacity-30 dark:text-blue-200">
              {formatDate(selectedEvent.date)}
            </span>
            <span
              className={`text-sm px-2 py-1 rounded-full ${
                selectedEvent.importance >= 8
                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:bg-opacity-30 dark:text-red-200"
                  : selectedEvent.importance >= 5
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:bg-opacity-30 dark:text-yellow-200"
                    : "bg-green-100 text-green-800 dark:bg-green-900 dark:bg-opacity-30 dark:text-green-200"
              }`}
            >
              Importance: {selectedEvent.importance}/10
            </span>
            {selectedEvent.isPointOfDivergence && (
              <span className="text-sm px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:bg-opacity-30 dark:text-purple-200">
                Point of Divergence
              </span>
            )}
          </div>
        </div>

        {/* Event Content - Structured Sections */}
        <div className="p-5">
          {/* Event Description Section */}
          {selectedEvent.description && (
            <div className="mb-6">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </h5>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {selectedEvent.description}
              </p>
            </div>
          )}

          {/* Event Tags Section */}
          {selectedEvent.tags && selectedEvent.tags.length > 0 && (
            <div className="mb-6">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {selectedEvent.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Connected Entities Section */}
          {hasLinkedEntities && ( // Only render this section if there are any linked entities
            <div className="mb-6">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Connected Entities
              </h5>

              <div className="space-y-4">
                {" "}
                {/* Increased space between entity type groups */}
                {/* Characters Group */}
                {((selectedEvent.linkedCharacters?.length ?? 0) > 0 ||
                  (selectedEvent.linkedCharacterIds?.length ?? 0) > 0) && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Characters
                    </p>{" "}
                    {/* Sub-heading */}
                    <div className="space-y-2">
                      {" "}
                      {/* Space between individual items */}
                      {selectedEvent.linkedCharacters &&
                      selectedEvent.linkedCharacters.length > 0
                        ? selectedEvent.linkedCharacters.map((character) => (
                            <div
                              key={character.id}
                              className="p-3 rounded-md bg-green-50 dark:bg-green-900 dark:bg-opacity-20 border border-green-200 dark:border-green-800 flex items-center"
                            >
                              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                                {/* Display name if available, otherwise fallback to ID with label */}
                                {character.name ||
                                  `Character ID: ${character.id}`}
                              </span>
                            </div>
                          ))
                        : // Fallback to IDs if full objects aren't available
                          selectedEvent.linkedCharacterIds?.map(
                            (characterId) => (
                              <div
                                key={`id-char-${characterId}`}
                                className="p-3 rounded-md bg-green-50 dark:bg-green-900 dark:bg-opacity-20 border border-green-200 dark:border-green-800 flex items-center"
                              >
                                <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                                  {/* Explicitly show it's just the ID in this fallback */}
                                  Character ID: {characterId}
                                </span>
                              </div>
                            ),
                          )}
                    </div>
                  </div>
                )}
                {/* Locations Group */}
                {((selectedEvent.linkedLocations?.length ?? 0) > 0 ||
                  (selectedEvent.linkedLocationIds?.length ?? 0) > 0) && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Locations
                    </p>{" "}
                    {/* Sub-heading */}
                    <div className="space-y-2">
                      {" "}
                      {/* Space between individual items */}
                      {selectedEvent.linkedLocations &&
                      selectedEvent.linkedLocations.length > 0
                        ? selectedEvent.linkedLocations.map((location) => (
                            <div
                              key={location.id}
                              className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-200 dark:border-yellow-800 flex items-center"
                            >
                              <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                {location.name || `Location ID: ${location.id}`}
                              </span>
                            </div>
                          ))
                        : // Fallback to IDs
                          selectedEvent.linkedLocationIds?.map((locationId) => (
                            <div
                              key={`id-loc-${locationId}`}
                              className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-200 dark:border-yellow-800 flex items-center"
                            >
                              <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                Location ID: {locationId}
                              </span>
                            </div>
                          ))}
                    </div>
                  </div>
                )}
                {/* Technologies Group */}
                {((selectedEvent.linkedTechnologies?.length ?? 0) > 0 ||
                  (selectedEvent.linkedTechnologyIds?.length ?? 0) > 0) && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Technologies
                    </p>{" "}
                    {/* Sub-heading */}
                    <div className="space-y-2">
                      {" "}
                      {/* Space between individual items */}
                      {selectedEvent.linkedTechnologies &&
                      selectedEvent.linkedTechnologies.length > 0
                        ? selectedEvent.linkedTechnologies.map((technology) => (
                            <div
                              key={technology.id}
                              className="p-3 rounded-md bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 border border-purple-200 dark:border-purple-800 flex items-center"
                            >
                              <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                              <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                                Technology:{" "}
                                {technology.name || `ID: ${technology.id}`}
                              </span>
                            </div>
                          ))
                        : // Fallback to IDs
                          selectedEvent.linkedTechnologyIds?.map(
                            (technologyId) => (
                              <div
                                key={`id-tech-${technologyId}`}
                                className="p-3 rounded-md bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 border border-purple-200 dark:border-purple-800 flex items-center"
                              >
                                <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                                <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                                  Technology ID: {technologyId}
                                </span>
                              </div>
                            ),
                          )}
                    </div>
                  </div>
                )}
                {/* Cultures Group */}
                {((selectedEvent.linkedCultures?.length ?? 0) > 0 ||
                  (selectedEvent.linkedCultureIds?.length ?? 0) > 0) && (
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Cultures
                    </p>{" "}
                    {/* Sub-heading */}
                    <div className="space-y-2">
                      {" "}
                      {/* Space between individual items */}
                      {selectedEvent.linkedCultures &&
                      selectedEvent.linkedCultures.length > 0
                        ? selectedEvent.linkedCultures.map((culture) => (
                            <div
                              key={culture.id}
                              className="p-3 rounded-md bg-pink-50 dark:bg-pink-900 dark:bg-opacity-20 border border-pink-200 dark:border-pink-800 flex items-center"
                            >
                              <div className="w-3 h-3 rounded-full bg-pink-500 mr-2"></div>
                              <span className="text-sm font-medium text-pink-800 dark:text-pink-200">
                                Culture: {culture.name || `ID: ${culture.id}`}
                              </span>
                            </div>
                          ))
                        : // Fallback to IDs
                          selectedEvent.linkedCultureIds?.map((cultureId) => (
                            <div
                              key={`id-cult-${cultureId}`}
                              className="p-3 rounded-md bg-pink-50 dark:bg-pink-900 dark:bg-opacity-20 border border-pink-200 dark:border-pink-800 flex items-center"
                            >
                              <div className="w-3 h-3 rounded-full bg-pink-500 mr-2"></div>
                              <span className="text-sm font-medium text-pink-800 dark:text-pink-200">
                                Culture ID: {cultureId}
                              </span>
                            </div>
                          ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Notes Section */}
          {selectedEvent.notes && (
            <div
              className={`${
                hasLinkedEntities ? "mt-6 pt-6 border-t" : ""
              } border-gray-200 dark:border-gray-700`}
            >
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional Notes
              </h5>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {selectedEvent.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Calculate various timeline statistics and relationships
  const stats = useMemo(() => {
    if (!timeline) return null;

    // Find parent timeline
    const parentTimeline = timeline.parentTimelineId
      ? allTimelines.find((t) => t.id === timeline.parentTimelineId)
      : null;

    // Find child timelines
    const childTimelines = allTimelines.filter(
      (t) => t.parentTimelineId === timeline.id,
    );

    // Count events by importance
    const eventsByImportance = {
      high: timeline.events.filter((e) => e.importance >= 8).length,
      medium: timeline.events.filter(
        (e) => e.importance >= 5 && e.importance < 8,
      ).length,
      low: timeline.events.filter((e) => e.importance < 5).length,
    };

    // Sort events chronologically
    const sortedEvents = [...timeline.events].sort((a, b) => {
      // Handle potential null/undefined dates gracefully during sort
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      if (isNaN(dateA) || isNaN(dateB)) {
        // If dates are invalid, sort them consistently (e.g., put invalid dates at the end)
        if (isNaN(dateA) && isNaN(dateB)) return 0;
        if (isNaN(dateA)) return 1; // Invalid date A comes after valid date B
        if (isNaN(dateB)) return -1; // Valid date A comes before invalid date B
      }
      return dateA - dateB;
    });

    // Find earliest and latest events
    const earliestEvent = sortedEvents.length > 0 ? sortedEvents[0] : null;
    const latestEvent =
      sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1] : null;

    // Find points of divergence
    const pointsOfDivergence = timeline.events.filter(
      (e) => e.isPointOfDivergence,
    );

    // Collect unique entities connected to this timeline's events
    // This section sums up the counts based on IDs
    const uniqueEntities = {
      characters: new Set<ID>(),
      locations: new Set<ID>(),
      technologies: new Set<ID>(),
      cultures: new Set<ID>(),
    };

    timeline.events.forEach((event) => {
      // Use linkedCharacterIds etc for counting unique entities in the timeline summary
      (event.linkedCharacterIds || []).forEach((id) =>
        uniqueEntities.characters.add(id),
      );
      (event.linkedLocationIds || []).forEach((id) =>
        uniqueEntities.locations.add(id),
      );
      (event.linkedTechnologyIds || []).forEach((id) =>
        uniqueEntities.technologies.add(id),
      );
      (event.linkedCultureIds || []).forEach((id) =>
        uniqueEntities.cultures.add(id),
      );
    });

    return {
      parentTimeline,
      childTimelines,
      eventsByImportance,
      earliestEvent,
      latestEvent,
      pointsOfDivergence,
      uniqueEntities: {
        characters: uniqueEntities.characters.size,
        locations: uniqueEntities.locations.size,
        technologies: uniqueEntities.technologies.size,
        cultures: uniqueEntities.cultures.size,
      },
      totalEvents: timeline.events.length,
    };
  }, [timeline, allTimelines]);

  if (!timeline) {
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center h-full">
        <div className="text-center max-w-xs">
          <svg
            className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p>Select a timeline to view details</p>
          <button
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            // Assuming this button should add a new timeline, not an event - adjusted text
            onClick={() => onAddEvent()} // Consider if a separate onAddTimeline prop is better
          >
            Create New Timeline
          </button>
        </div>
      </div>
    );
  }

  // Timeline details view (existing code, potentially updated based on stats)
  return (
    <div className="w-full h-full overflow-auto bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Timeline Header */}
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <div
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: timeline.color }}
            />
            {timeline.name}
          </h3>
          {onEditTimeline && (
            <button
              onClick={() => onEditTimeline(timeline.id)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Edit timeline"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              timeline.isMainTimeline
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:bg-opacity-30 dark:text-green-200"
                : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:bg-opacity-30 dark:text-purple-200"
            }`}
          >
            {timeline.isMainTimeline ? "Main Timeline" : "Branch Timeline"}
          </span>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            {stats?.totalEvents || 0} events
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {timeline.description || "No description provided."}
        </p>
      </div>

      {/* Timeline Stats */}
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Timeline Details
        </h4>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-sm">
            <p className="text-gray-500 dark:text-gray-400">Start Date</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">
              {formatDate(timeline.startDate)}
            </p>
          </div>
          <div className="text-sm">
            <p className="text-gray-500 dark:text-gray-400">End Date</p>
            <p className="font-medium text-gray-800 dark:text-gray-200">
              {formatDate(timeline.endDate)}
            </p>
          </div>
        </div>

        {/* Timeline Tags */}
        {timeline.tags && timeline.tags.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {timeline.tags.map((tag, index) => (
                <span
                  key={index}
                  className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Parent/Child Relationships */}
        {stats?.parentTimeline && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Parent Timeline
            </p>
            <button
              onClick={() => onSelectTimeline(stats.parentTimeline!.id)}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
            >
              <div
                className="w-2 h-2 rounded-full mr-1"
                style={{ backgroundColor: stats.parentTimeline!.color }}
              />
              {stats.parentTimeline!.name}
            </button>
          </div>
        )}

        {stats?.childTimelines && stats.childTimelines.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Branch Timelines ({stats.childTimelines.length})
            </p>
            <div className="flex flex-col gap-1">
              {stats.childTimelines.map((childTimeline) => (
                <button
                  key={childTimeline.id}
                  onClick={() => onSelectTimeline(childTimeline.id)}
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                >
                  <div
                    className="w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: childTimeline.color }}
                  />
                  {childTimeline.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Event Distribution */}
        {stats && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Event Impact Distribution
            </p>
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full"
                  style={{
                    width: `${stats.totalEvents > 0 ? (stats.eventsByImportance.high / stats.totalEvents) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {stats.eventsByImportance.high} high
              </span>
            </div>
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full"
                  style={{
                    width: `${stats.totalEvents > 0 ? (stats.eventsByImportance.medium / stats.totalEvents) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {stats.eventsByImportance.medium} med
              </span>
            </div>
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{
                    width: `${stats.totalEvents > 0 ? (stats.eventsByImportance.low / stats.totalEvents) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {stats.eventsByImportance.low} low
              </span>
            </div>
          </div>
        )}

        {/* Connected Entities (displaying counts based on IDs as before) */}
        {stats && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Connected Entities Summary
            </p>{" "}
            {/* Updated label */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {stats.uniqueEntities.characters} characters
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {stats.uniqueEntities.locations} locations
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {stats.uniqueEntities.technologies} technologies
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-pink-500"></div>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {stats.uniqueEntities.cultures} cultures
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Date Range */}
        {stats?.earliestEvent && stats?.latestEvent && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Timeline Span
            </p>
            <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center mb-1">
              <span className="mr-1">From:</span>
              <span className="font-medium">
                {formatDate(stats.earliestEvent.date)} (
                {stats.earliestEvent.title})
              </span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300 flex items-center">
              <span className="mr-1">To:</span>
              <span className="font-medium">
                {formatDate(stats.latestEvent.date)} ({stats.latestEvent.title})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Key Events */}
      <div className="p-5">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Key Events
        </h4>

        {/* Points of Divergence */}
        {stats?.pointsOfDivergence.length ? (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Points of Divergence
            </p>
            {stats.pointsOfDivergence.map((event) => (
              <div
                key={event.id}
                className="mb-2 p-3 rounded-md bg-purple-50 dark:bg-purple-900 dark:bg-opacity-20 border border-purple-200 dark:border-purple-800 cursor-pointer hover:bg-purple-100 dark:hover:bg-opacity-30 transition-colors"
                onClick={() => onEventClick(event as InternalEventType)} // Pass event to handler
              >
                <p className="font-medium text-purple-800 dark:text-purple-300 text-sm">
                  {event.title}
                </p>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                  {formatDate(event.date)}
                </p>
                {event.description && (
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-1 line-clamp-2">
                    {event.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Major Events (importance >= 8) */}
        {timeline.events.filter((e) => e.importance >= 8).length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Major Events
            </p>
            {timeline.events
              .filter((e) => e.importance >= 8)
              .sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                if (isNaN(dateA) || isNaN(dateB)) {
                  if (isNaN(dateA) && isNaN(dateB)) return 0;
                  if (isNaN(dateA)) return 1;
                  if (isNaN(dateB)) return -1;
                }
                return dateA - dateB;
              })
              .map((event) => (
                <div
                  key={event.id} // Added key
                  className="mb-2 p-3 rounded-md bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border border-red-200 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-opacity-30 transition-colors" // Added styling for Major Events
                  onClick={() => onEventClick(event as InternalEventType)} // Pass event to handler
                >
                  <p className="font-medium text-red-800 dark:text-red-300 text-sm">
                    {event.title}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {formatDate(event.date)}
                  </p>
                  {event.description && (
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Medium Events (5 <= importance < 8) */}
        {timeline.events.filter((e) => e.importance >= 5 && e.importance < 8)
          .length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Medium Events
            </p>
            {timeline.events
              .filter((e) => e.importance >= 5 && e.importance < 8)
              .sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                if (isNaN(dateA) || isNaN(dateB)) {
                  if (isNaN(dateA) && isNaN(dateB)) return 0;
                  if (isNaN(dateA)) return 1;
                  if (isNaN(dateB)) return -1;
                }
                return dateA - dateB;
              })
              .map((event) => (
                <div
                  key={event.id} // Added key
                  className="mb-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border border-yellow-200 dark:border-yellow-800 cursor-pointer hover:bg-yellow-100 dark:hover:bg-opacity-30 transition-colors" // Added styling for Medium Events
                  onClick={() => onEventClick(event as InternalEventType)} // Pass event to handler
                >
                  <p className="font-medium text-yellow-800 dark:text-yellow-300 text-sm">
                    {event.title}
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    {formatDate(event.date)}
                  </p>
                  {event.description && (
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Low Events (importance < 5) */}
        {timeline.events.filter((e) => e.importance < 5).length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Minor Events
            </p>
            {timeline.events
              .filter((e) => e.importance < 5)
              .sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0;
                const dateB = b.date ? new Date(b.date).getTime() : 0;
                if (isNaN(dateA) || isNaN(dateB)) {
                  if (isNaN(dateA) && isNaN(dateB)) return 0;
                  if (isNaN(dateA)) return 1;
                  if (isNaN(dateB)) return -1;
                }
                return dateA - dateB;
              })
              .map((event) => (
                <div
                  key={event.id} // Added key
                  className="mb-2 p-3 rounded-md bg-green-50 dark:bg-green-900 dark:bg-opacity-20 border border-green-200 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-opacity-30 transition-colors" // Added styling for Minor Events
                  onClick={() => onEventClick(event as InternalEventType)} // Pass event to handler
                >
                  <p className="font-medium text-green-800 dark:text-green-300 text-sm">
                    {event.title}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {formatDate(event.date)}
                  </p>
                  {event.description && (
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1 line-clamp-2">
                      {event.description}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineDetailsPanel;
