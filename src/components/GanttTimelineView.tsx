import React, { useState, useEffect, useRef } from "react";
import { TimelineType, EventType, ID } from "../types";
import Button from "../components/common/Button";
import { eventIcons } from "./IconSelector";
import { parseCalendarDate } from "../utils/helpers";

// Utility function to get date range of all events across timelines
const getDateRange = (timelines: TimelineType[]) => {
  let minDate = new Date();
  let maxDate = new Date();

  if (timelines.length === 0) return { minDate, maxDate };

  // Initialize with first event
  const allEvents = timelines.flatMap((timeline) => timeline.events);

  if (allEvents.length === 0) return { minDate, maxDate };

  minDate = parseCalendarDate(allEvents[0].date);
  maxDate = parseCalendarDate(allEvents[0].date);

  // Find min and max dates across all events
  allEvents.forEach((event) => {
    const eventDate = parseCalendarDate(event.date);
    if (eventDate < minDate) minDate = eventDate;
    if (eventDate > maxDate) maxDate = eventDate;

    // Consider end date if it exists
    if (event.endDate) {
      const endDate = parseCalendarDate(event.endDate);
      if (endDate > maxDate) maxDate = endDate;
    }
  });

  // Add padding (10% on each side)
  const dateRange = maxDate.getTime() - minDate.getTime();
  minDate = new Date(minDate.getTime() - dateRange * 0.1);
  maxDate = new Date(maxDate.getTime() + dateRange * 0.1);

  return { minDate, maxDate };
};

// Helper to calculate position on timeline
const calculatePositionX = (
  date: Date,
  minDate: Date,
  maxDate: Date,
  width: number,
) => {
  const totalTimeRange = maxDate.getTime() - minDate.getTime();
  const timeFromStart = date.getTime() - minDate.getTime();
  return (timeFromStart / totalTimeRange) * width;
};

// Helper to get the SVG icon for an event
const getEventIcon = (event: EventType) => {
  // Find the icon by ID, or use default if not found
  const iconId = event.iconId || "default";
  const icon = eventIcons.find((i) => i.id === iconId) || eventIcons[0];
  return icon.svg;
};

// Helper to group events by exact date - Fixed to handle invalid dates
const groupEventsByDate = (events: EventType[]) => {
  const groupedEvents: Record<string, EventType[]> = {};

  events.forEach((event) => {
    // Skip events with missing date values
    if (!event.date) {
      console.warn(
        `Event with missing date skipped: ${event.title || "Untitled event"}`,
      );
      return;
    }

    try {
      // Create a date object and validate it
      const eventDate = parseCalendarDate(event.date);

      // Check if the date is valid before trying to use it
      if (isNaN(eventDate.getTime())) {
        console.warn(
          `Event with invalid date skipped: ${event.title || "Untitled event"}`,
        );
        return;
      }

      // Local calendar day, so the group key matches what is rendered.
      const dateKey = `${eventDate.getFullYear()}-${String(
        eventDate.getMonth() + 1,
      ).padStart(2, "0")}-${String(eventDate.getDate()).padStart(2, "0")}`;

      if (!groupedEvents[dateKey]) {
        groupedEvents[dateKey] = [];
      }

      groupedEvents[dateKey].push(event);
    } catch (error) {
      console.error(
        `Error processing event date for: ${event.title || "Untitled event"}`,
        error,
      );
    }
  });

  return groupedEvents;
};

interface GanttTimelineViewProps {
  timelines: TimelineType[];
  currentTimelineId: ID | null;
  onEventClick: (event: EventType) => void;
  onAddEvent: () => void;
  onTimelineSelect: (timelineId: ID) => void;
  onAddTimelineClick: () => void;
}

const GanttTimelineView: React.FC<GanttTimelineViewProps> = ({
  timelines,
  currentTimelineId,
  onEventClick,
  onAddEvent,
  onTimelineSelect,
  onAddTimelineClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [activeEventGroup, setActiveEventGroup] = useState<{
    timelineId: ID;
    dateKey: string;
  } | null>(null);

  // Timeline configuration
  const rowHeight = 120;
  const eventHeight = 48;
  const eventRadius = 16; // Increased radius to better accommodate icons
  const timelineLabelWidth = 180; // Increased width for timeline labels

  // Zoom configuration
  const MIN_ZOOM_LEVEL = 0.45; // Allow zooming out to 5% of original size
  const MAX_ZOOM_LEVEL = 1000; // Or whatever value you want as the new maximum

  // Calculate date range across all timelines
  const { minDate, maxDate } = getDateRange(timelines);

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Close the active event group when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeEventGroup && !event.defaultPrevented) {
        // Add a small delay to allow click events on items to process first
        setTimeout(() => {
          setActiveEventGroup(null);
        }, 100);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [activeEventGroup]);

  // Current timeline
  const currentTimeline =
    timelines.find((t) => t.id === currentTimelineId) || timelines[0];

  // Handle zoom change
  const handleZoomIn = () =>
    setZoom((prev) => Math.min(prev + 0.25, MAX_ZOOM_LEVEL));
  const handleZoomOut = () =>
    setZoom((prev) => Math.max(prev - 0.25, MIN_ZOOM_LEVEL));
  const handleZoomReset = () => setZoom(1);

  // Calculate timeline width based on zoom - ensures full width at minimum zoom
  const timelineWidth = containerWidth * (zoom / MIN_ZOOM_LEVEL);

  // Calculate connections between timelines
  const timelineConnections = React.useMemo(() => {
    const connections = [];

    for (const timeline of timelines) {
      if (timeline.parentTimelineId && timeline.pointsOfDivergence.length > 0) {
        const parentTimeline = timelines.find(
          (t) => t.id === timeline.parentTimelineId,
        );
        if (parentTimeline) {
          // Find the point of divergence connecting these timelines
          const pod = timeline.pointsOfDivergence[0]; // We'll use the first PoD for simplicity

          // Find the events in each timeline related to this PoD
          const sourceEvent = parentTimeline.events.find((e) =>
            pod.eventIds.includes(e.id),
          );
          const targetEvent = timeline.events.find((e) =>
            pod.eventIds.includes(e.id),
          );

          if (sourceEvent && targetEvent) {
            connections.push({
              sourceTimelineId: parentTimeline.id,
              targetTimelineId: timeline.id,
              sourceEvent,
              targetEvent,
              pointOfDivergence: pod,
            });
          }
        }
      }
    }

    return connections;
  }, [timelines]);

  // Get the index of each timeline for vertical positioning
  const timelineIndices = timelines.reduce(
    (acc, timeline, index) => {
      acc[timeline.id] = index;
      return acc;
    },
    {} as Record<string, number>,
  );

  // If no timelines are available
  if (timelines.length === 0) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 min-h-[400px] flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">
          No timelines available. Create a timeline to get started.
        </p>
      </div>
    );
  }

  // // Handle event click with proper event handling and mouse event capture
  // const handleEventClick = (event: EventType, e: React.MouseEvent) => {
  //   if (e) {
  //     e.stopPropagation();
  //     e.preventDefault();
  //     e.nativeEvent.stopImmediatePropagation(); // Stop all other listeners
  //   }
  //   console.log("Event clicked:", event.title, event.id); // Debug log
  //   onEventClick(event);
  //   setActiveEventGroup(null);
  // };

  return (
    <div
      className="relative border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 overflow-hidden flex flex-col"
      style={{
        height: `${Math.max(rowHeight * timelines.length + 140, 550)}px`,
      }}
      ref={containerRef}
    >
      {/* Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onAddEvent}
            leftIcon={
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            }
          >
            Add Event
          </Button>

          <span className="text-sm text-gray-600 dark:text-gray-400">
            Current: {currentTimeline?.name || "None"}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            title="Zoom Out"
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
                d="M20 12H4"
              />
            </svg>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomReset}
            title="Reset Zoom"
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
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            title="Zoom In"
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
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </Button>
        </div>
      </div>

      {/* Timeline header - time scale */}
      <div className="border-b border-gray-200 dark:border-gray-700 pl-[180px] pr-4 py-2 flex items-center">
        {Array.from({ length: 10 }).map((_, i) => {
          const date = new Date(
            minDate.getTime() +
              ((maxDate.getTime() - minDate.getTime()) * i) / 9,
          );
          return (
            <div
              key={i}
              className="absolute text-xs text-gray-500 dark:text-gray-400"
              style={{
                left: `${calculatePositionX(date, minDate, maxDate, timelineWidth) + timelineLabelWidth}px`,
                transform: "translateX(-50%)",
              }}
            >
              {date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          );
        })}
      </div>

      {/* Main timeline container - scrollable */}
      <div className="flex-1 overflow-auto relative">
        {/* SVG for connections between timelines */}
        <svg
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{
            width: `${timelineWidth + 80}px`,
            height: `${rowHeight * timelines.length + 40}px`,
          }}
        >
          {/* Time axis vertical lines */}
          {Array.from({ length: 10 }).map((_, i) => {
            const x = (timelineWidth * i) / 9 + timelineLabelWidth;
            return (
              <line
                key={`gridline-${i}`}
                x1={x}
                y1={0}
                x2={x}
                y2={rowHeight * timelines.length + 40}
                stroke="currentColor"
                strokeWidth="1"
                className="text-gray-200 dark:text-gray-700"
                strokeDasharray={i % 5 === 0 ? "none" : "4,4"}
              />
            );
          })}

          {/* Horizontal separators between timelines */}
          {timelines.map((timeline, index) => (
            <line
              key={`timeline-separator-${timeline.id}`}
              x1={0}
              y1={(index + 1) * rowHeight}
              x2={timelineWidth + 80}
              y2={(index + 1) * rowHeight}
              stroke="currentColor"
              strokeWidth="1"
              className="text-gray-200 dark:text-gray-700"
            />
          ))}

          {/* Curved connections between timelines */}
          {timelineConnections.map((connection, index) => {
            const sourceTimelineIndex =
              timelineIndices[connection.sourceTimelineId];
            const targetTimelineIndex =
              timelineIndices[connection.targetTimelineId];

            const sourceDate = new Date(connection.sourceEvent.date);
            const targetDate = new Date(connection.targetEvent.date);

            const sourceX =
              calculatePositionX(sourceDate, minDate, maxDate, timelineWidth) +
              timelineLabelWidth;
            const targetX =
              calculatePositionX(targetDate, minDate, maxDate, timelineWidth) +
              timelineLabelWidth;

            const sourceY = sourceTimelineIndex * rowHeight + rowHeight / 2;
            const targetY = targetTimelineIndex * rowHeight + rowHeight / 2;

            // Control points for the curve
            const controlPointX1 =
              sourceX + Math.min(100, Math.abs(targetX - sourceX) / 2);
            const controlPointX2 =
              targetX - Math.min(100, Math.abs(targetX - sourceX) / 2);

            return (
              <path
                key={`connection-${index}`}
                d={`M ${sourceX} ${sourceY} C ${controlPointX1} ${sourceY}, ${controlPointX2} ${targetY}, ${targetX} ${targetY}`}
                fill="none"
                stroke={
                  connection.targetTimelineId === currentTimelineId
                    ? connection.sourceEvent.isPointOfDivergence
                      ? "#9333ea"
                      : "#3b82f6"
                    : "#9ca3af"
                }
                strokeWidth="2"
                strokeDasharray={
                  connection.sourceEvent.isPointOfDivergence ? "none" : "4,4"
                }
                className="opacity-60 hover:opacity-100 transition-opacity"
              />
            );
          })}
        </svg>

        {/* Timeline rows */}
        <div
          className="relative"
          style={{
            width: `${timelineWidth + 80}px`,
            minHeight: `${rowHeight * timelines.length}px`,
          }}
        >
          {timelines.map((timeline, timelineIndex) => {
            // Group timeline events by date
            const eventsByDate = groupEventsByDate(timeline.events);

            return (
              <div
                key={timeline.id}
                className={`absolute w-full pl-[180px] ${
                  timeline.id === currentTimelineId
                    ? "bg-blue-50 dark:bg-blue-900 dark:bg-opacity-10"
                    : ""
                }`}
                style={{
                  top: `${timelineIndex * rowHeight}px`,
                  height: `${rowHeight}px`,
                }}
                onClick={() => onTimelineSelect(timeline.id)}
              >
                {/* Timeline label - Left-justified with text truncation */}
                <div className="absolute left-0 top-0 bottom-0 w-[180px] px-4 flex items-center border-r border-gray-200 dark:border-gray-700">
                  <div className="flex items-center w-full overflow-hidden">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mr-2"
                      style={{ backgroundColor: timeline.color }}
                    />
                    <span
                      className={`font-medium truncate ${
                        timeline.id === currentTimelineId
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                      title={timeline.name}
                    >
                      {timeline.name}
                    </span>
                  </div>
                </div>

                {/* Timeline events - now grouped by date */}
                {Object.entries(eventsByDate).map(([dateKey, eventsOnDate]) => {
                  const firstEventDate = parseCalendarDate(eventsOnDate[0].date);
                  const x = calculatePositionX(
                    firstEventDate,
                    minDate,
                    maxDate,
                    timelineWidth,
                  );

                  const hasMultipleEvents = eventsOnDate.length > 1;
                  const isActiveGroup =
                    activeEventGroup?.timelineId === timeline.id &&
                    activeEventGroup?.dateKey === dateKey;

                  // Use first event for display if not active, or the most important one
                  const displayEvent = hasMultipleEvents
                    ? eventsOnDate.reduce(
                        (prev, current) =>
                          current.importance > prev.importance ? current : prev,
                        eventsOnDate[0],
                      )
                    : eventsOnDate[0];

                  return (
                    <div
                      key={dateKey}
                      className={`absolute group ${
                        displayEvent.isPointOfDivergence ? "z-10" : "z-5"
                      }`}
                      style={{
                        left: `${x}px`,
                        top: `${rowHeight / 2 - eventHeight / 2}px`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      {/* Event node with icon and counter badge if multiple events */}
                      <div
                        className={`rounded-full flex items-center justify-center cursor-pointer transform transition-transform group-hover:scale-110 border-2 ${
                          displayEvent.isPointOfDivergence
                            ? "bg-purple-100 border-purple-600 text-purple-800 dark:bg-purple-900 dark:bg-opacity-30 dark:border-purple-500 dark:text-purple-300"
                            : timeline.id === currentTimelineId
                              ? "bg-blue-100 border-blue-600 text-blue-800 dark:bg-blue-900 dark:bg-opacity-30 dark:border-blue-500 dark:text-blue-300"
                              : "bg-gray-100 border-gray-400 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
                        }`}
                        style={{
                          width: `${eventRadius * 2}px`,
                          height: `${eventRadius * 2}px`,
                          marginLeft: `-${eventRadius}px`,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (hasMultipleEvents) {
                            // Toggle the active event group
                            setActiveEventGroup(
                              isActiveGroup
                                ? null
                                : { timelineId: timeline.id, dateKey },
                            );
                          } else {
                            // Single event - direct click
                            onEventClick(displayEvent);
                          }
                        }}
                      >
                        {/* Display the icon for the event */}
                        <div className="w-5 h-5">
                          {React.cloneElement(getEventIcon(displayEvent), {
                            className: `${
                              displayEvent.isPointOfDivergence
                                ? "text-purple-700 dark:text-purple-300"
                                : timeline.id === currentTimelineId
                                  ? "text-blue-700 dark:text-blue-300"
                                  : "text-gray-700 dark:text-gray-300"
                            }`,
                          })}
                        </div>

                        {/* Counter badge for multiple events */}
                        {hasMultipleEvents && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 dark:bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-medium">
                              {eventsOnDate.length}
                            </span>
                          </div>
                        )}

                        {/* Add a star indicator for high importance events */}
                        {!hasMultipleEvents && displayEvent.importance >= 8 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 dark:bg-red-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">★</span>
                          </div>
                        )}
                      </div>

                      {/* Multi-event popup menu - FIXED EVENT CLICKING */}
                      {hasMultipleEvents && isActiveGroup && (
                        <div
                          className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50 w-72 pointer-events-auto event-popup-menu"
                          style={{
                            left: `${eventRadius}px`,
                            top:
                              timelineIndex < timelines.length / 2
                                ? "100%"
                                : "auto",
                            bottom:
                              timelineIndex >= timelines.length / 2
                                ? "100%"
                                : "auto",
                            marginTop:
                              timelineIndex < timelines.length / 2
                                ? "8px"
                                : "0",
                            marginBottom:
                              timelineIndex >= timelines.length / 2
                                ? "8px"
                                : "0",
                            pointerEvents: "all", // Ensure clicks register
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                          }}
                        >
                          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                              {firstEventDate.toLocaleDateString(
                                undefined,
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}{" "}
                              Events
                            </h4>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {eventsOnDate.map((event) => (
                              <button
                                key={event.id}
                                className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-start border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                onClick={(e) => {
                                  // Aggressively capture the click event
                                  e.stopPropagation();
                                  e.preventDefault();
                                  e.nativeEvent.stopImmediatePropagation();

                                  // Call the handler directly with a delay to ensure click capture
                                  console.log(
                                    "Event button clicked:",
                                    event.title,
                                  );
                                  onEventClick(event);
                                  setTimeout(
                                    () => setActiveEventGroup(null),
                                    10,
                                  );
                                }}
                                style={{
                                  position: "relative",
                                  zIndex: 10,
                                  pointerEvents: "all",
                                }}
                              >
                                <div className="flex-shrink-0 mt-1 mr-2">
                                  <div className="w-4 h-4">
                                    {React.cloneElement(getEventIcon(event), {
                                      className:
                                        "text-gray-600 dark:text-gray-300",
                                    })}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {event.title}
                                    </p>
                                    {event.importance >= 8 && (
                                      <span className="ml-1 text-red-500 dark:text-red-400 text-xs">
                                        ★
                                      </span>
                                    )}
                                    {event.isPointOfDivergence && (
                                      <span className="ml-1 px-1 py-0.5 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:bg-opacity-50 dark:text-purple-200 rounded">
                                        PoD
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                                    {event.description}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Event tooltip on hover - only show for single events or when not in active multi-mode */}
                      {(!hasMultipleEvents || !isActiveGroup) && (
                        <div
                          className={`absolute opacity-0 group-hover:opacity-100 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 rounded-md shadow-md transition-opacity w-64 z-20 ${
                            timelineIndex < timelines.length / 2
                              ? "top-full mt-2"
                              : "bottom-full mb-2"
                          }`}
                          style={{
                            left: `${eventRadius}px`,
                          }}
                        >
                          <div className="flex items-center mb-1">
                            <div className="w-4 h-4 mr-2">
                              {React.cloneElement(getEventIcon(displayEvent), {
                                className: "text-gray-700 dark:text-gray-300",
                              })}
                            </div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {displayEvent.title}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {parseCalendarDate(displayEvent.date).toLocaleDateString()}
                            {hasMultipleEvents && (
                              <span className="ml-2 text-blue-500 dark:text-blue-400">
                                +{eventsOnDate.length - 1} more events
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                            {displayEvent.description}
                          </div>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {displayEvent.isPointOfDivergence && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:bg-opacity-50 dark:text-purple-200">
                                PoD
                              </span>
                            )}

                            {displayEvent.tags.slice(0, 2).map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                              >
                                {tag}
                              </span>
                            ))}

                            {displayEvent.tags.length > 2 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                +{displayEvent.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div className="pt-2">
        <Button
          variant="success"
          size="sm"
          onClick={onAddTimelineClick}
          leftIcon={
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          }
        >
          Add Timeline
        </Button>
      </div>
    </div>
  );
};

export default GanttTimelineView;
