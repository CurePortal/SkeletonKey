import React, {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { ID, TimelineType, EventType } from "../../types";
import { parseCalendarDate } from "../../utils/helpers";
import ConsistencyAnalysisPanel from "./ConsistencyAnalysisPanel";
import TimelineDetailsPanel from "./TimelineDetailsPanel";
import { useProjectData } from "../../contexts/ProjectDataContext";
import DayGroupCard, { DayGroup } from "./DayGroupCard";
import { useTimelineBranching } from "./TimelineBranchHandler";

interface InternalEventType extends EventType {
  verticalOffset?: number;
  branchFromEventId?: ID;
  linkedCharacters?: any[];
  linkedLocations?: any[];
  linkedTechnologies?: any[];
  linkedCultures?: any[];
}

interface TimelineFlowViewProps {
  timelines: TimelineType[];
  currentTimelineId: ID | null;
  onEventClick: (event: EventType) => void;
  onEventRightClick?: (event: InternalEventType, e: React.MouseEvent) => void;
  onAddEvent: (
    timelineId: ID,
    suggestedDate?: string | null | undefined,
  ) => void;
  onTimelineSelect: (timelineId: ID) => void;
  onAddTimelineClick: () => void;
  onDeleteEvent?: (eventId: ID, timelineId: ID) => void;
  onDeleteTimeline?: (timelineId: ID) => void;
  onEditTimeline?: (timelineId: ID) => void;
  onCreateBranch?: (sourceEventId: ID, sourceTimelineId: ID) => void;
  showConsistencyAnalysis?: boolean;
  onCloseConsistencyAnalysis?: () => void;
}

const CARD_WIDTH = 250;
const CARD_HEIGHT = 100;
const VERTICAL_SPACING = 160;
const HORIZONTAL_SPACING = 350;
const EVENT_CARD_WIDTH = 150;
const DAY_CARD_WIDTH = 260;
const DAY_CARD_HEIGHT = 92;
const EVENT_SPACING = 210;
const BRANCH_VERTICAL_OFFSET = 120;
const BRANCH_STAGGER_OFFSET = 120;

const localDateKey = (dateString?: string): string => {
  const parsed = dateString ? new Date(dateString) : new Date(NaN);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
};

const groupEventsByDay = (events: EventType[]): DayGroup[] => {
  const groups = new Map<string, EventType[]>();
  for (const event of events) {
    const key = localDateKey(event.date);
    const rows = groups.get(key) || [];
    rows.push(event);
    groups.set(key, rows);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, rows]) => ({ key, events: rows }));
};

const TimelineFlowView: React.FC<TimelineFlowViewProps> = ({
  timelines,
  currentTimelineId,
  onEventClick,
  onEventRightClick,
  onAddEvent,
  onTimelineSelect,
  onAddTimelineClick,
  onCreateBranch,
  onEditTimeline,
  showConsistencyAnalysis = false,
  onCloseConsistencyAnalysis,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { project } = useProjectData();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );

  const { openBranchModal, BranchingModal } = useTimelineBranching();
  const handleBranchFromCard = useCallback(
    (event: EventType) => {
      openBranchModal(event, (newTimelineId) => {
        // Navigate to the new timeline after creation
        if (newTimelineId) {
          onTimelineSelect(newTimelineId);
        }
      });
    },
    [openBranchModal, onTimelineSelect],
  );

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showDetailPanel, setShowDetailPanel] = useState(true);
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [hoveredTimeline, setHoveredTimeline] = useState<ID | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<InternalEventType | null>(
    null,
  );
  const [eventPositions, setEventPositions] = useState<
    Map<ID, { x: number; y: number }>
  >(new Map());
  const [timelineCardPositions, setTimelineCardPositions] = useState<
    Map<ID, { x: number; y: number }>
  >(new Map());
  const [renderedTimelineElements, setRenderedTimelineElements] = useState<
    JSX.Element[]
  >([]);

  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);

  const currentTimeline = useMemo(
    () => timelines.find((t) => t.id === currentTimelineId),
    [timelines, currentTimelineId],
  );

  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    updateWindowSize();
    window.addEventListener("resize", updateWindowSize);
    return () => window.removeEventListener("resize", updateWindowSize);
  }, []);

  // Replace the formatDate function in TimelineFlowView (around line 90-104) with this:

  const formatDate = useCallback((dateString?: string): string => {
    if (!dateString) return "";

    try {
      // Check for BC/BCE dates (stored as negative years)
      if (dateString.startsWith("-")) {
        // Remove the negative sign and parse the parts
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
      }

      // Try parsing as a regular date
      const date = parseCalendarDate(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }

      return "";
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return "";
    }
  }, []);

  const timelineTree = useMemo(() => {
    const mainTimelines = timelines.filter((t) => !t.parentTimelineId);
    const buildTimelineTree = (
      timeline: TimelineType,
      level = 0,
      branchIndex = 0,
    ): {
      timeline: TimelineType;
      level: number;
      children: any[];
      branchIndex: number;
    } => {
      const childrenRaw: TimelineType[] = timelines.filter(
        (t) => t.parentTimelineId === timeline.id,
      );
      return {
        timeline,
        level,
        branchIndex,
        children: childrenRaw.map((child, index) =>
          buildTimelineTree(child, level + 1, index),
        ),
      };
    };
    return mainTimelines.map((timeline, index) =>
      buildTimelineTree(timeline, 0, index),
    );
  }, [timelines]);

  const enrichEventWithKBData = useCallback(
    (event: EventType): InternalEventType => {
      if (!project) return event;

      const enrichedEvent: InternalEventType = { ...event };

      if (event.linkedCharacterIds && event.linkedCharacterIds.length > 0) {
        enrichedEvent.linkedCharacters = event.linkedCharacterIds
          .map((id) => project.characters?.find((c) => c.id === id))
          .filter(Boolean);
      }

      if (event.linkedLocationIds && event.linkedLocationIds.length > 0) {
        enrichedEvent.linkedLocations = event.linkedLocationIds
          .map((id) => project.locations?.find((l) => l.id === id))
          .filter(Boolean);
      }

      if (event.linkedTechnologyIds && event.linkedTechnologyIds.length > 0) {
        enrichedEvent.linkedTechnologies = event.linkedTechnologyIds
          .map((id) => project.technologies?.find((t) => t.id === id))
          .filter(Boolean);
      }

      if (event.linkedCultureIds && event.linkedCultureIds.length > 0) {
        enrichedEvent.linkedCultures = event.linkedCultureIds
          .map((id) => project.cultures?.find((c) => c.id === id))
          .filter(Boolean);
      }

      return enrichedEvent;
    },
    [project],
  );

  const handleEventClick = useCallback(
    (event: InternalEventType) => {
      const enrichedEvent = enrichEventWithKBData(event);
      setSelectedEvent(enrichedEvent);
      if (currentTimelineId !== event.timelineId) {
        const eventTimeline = timelines.find((t) =>
          t.events?.some((e) => e.id === event.id),
        );
        if (eventTimeline) {
          onTimelineSelect(eventTimeline.id);
        }
      }
    },
    [currentTimelineId, timelines, onTimelineSelect, enrichEventWithKBData],
  );

  const handleTimelineSelect = useCallback(
    (timelineId: ID) => {
      onTimelineSelect(timelineId);
      setSelectedEvent(null);
    },
    [onTimelineSelect],
  );

  const panToShowAllTimelines = useCallback(() => {
    if (
      !containerRef.current ||
      dimensions.width === 0 ||
      dimensions.height === 0
    )
      return;
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    const padding = 100;
    const contentWidth = dimensions.width;
    const contentHeight = dimensions.height;
    const scaleX = (containerWidth - padding * 2) / contentWidth;
    const scaleY = (containerHeight - padding * 2) / contentHeight;
    const newZoom = Math.min(Math.max(0.1, Math.min(scaleX, scaleY)), 2);
    const newPanX = (containerWidth - contentWidth * newZoom) / 2;
    const newPanY = (containerHeight - contentHeight * newZoom) / 2;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [dimensions]);

  useEffect(() => {
    if (isInitialLoad && timelines.length > 0) {
      const timeoutId = setTimeout(() => {
        panToShowAllTimelines();
        setIsInitialLoad(false);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [isInitialLoad, timelines.length, panToShowAllTimelines]);

  const renderTimelines = useCallback(
    (
      tree: any[],
      startX = 50,
      startY = 50,
      parentPosition: { x: number; y: number } | null = null,
      elementsAccumulator: JSX.Element[] = [],
      eventPositionsAccumulator: Map<ID, { x: number; y: number }> = new Map(),
      timelineCardPositionsAccumulator: Map<
        ID,
        { x: number; y: number }
      > = new Map(),
      branchTracker: Map<ID, number> = new Map(),
    ): {
      elements: JSX.Element[];
      newY: number;
      eventPositionsResult: Map<ID, { x: number; y: number }>;
      timelineCardPositionsResult: Map<ID, { x: number; y: number }>;
      maxX: number;
    } => {
      let currentY = startY;
      let maxUsedY = startY;
      let maxUsedX = startX + CARD_WIDTH;
      const newEventPositions = new Map(eventPositionsAccumulator);
      const newTimelineCardPositions = new Map(
        timelineCardPositionsAccumulator,
      );

      // Group elements by z-index layers
      const linesLayer: JSX.Element[] = [];
      const branchLinesLayer: JSX.Element[] = [];
      const timelineCardsLayer: JSX.Element[] = [];
      const plusButtonsLayer: JSX.Element[] = [];
      const eventCardsLayer: JSX.Element[] = [];

      for (let i = 0; i < tree.length; i++) {
        const node = tree[i];
        const { children, timeline, branchIndex } = node;

        // Handle branch positioning
        let currentStartX = startX;
        let branchY = currentY;

        if (timeline.parentTimelineId && timeline.branchFromEventId) {
          const branchEventPosition = newEventPositions.get(
            timeline.branchFromEventId,
          );
          if (branchEventPosition) {
            // Track how many branches come from this parent timeline
            const parentBranchCount =
              branchTracker.get(timeline.parentTimelineId) || 0;
            branchTracker.set(timeline.parentTimelineId, parentBranchCount + 1);

            // Position branch timeline with proper spacing
            currentStartX = branchEventPosition.x - EVENT_CARD_WIDTH / 2 - 50;
            branchY =
              branchEventPosition.y +
              BRANCH_VERTICAL_OFFSET +
              parentBranchCount * BRANCH_STAGGER_OFFSET;
            currentY = branchY;
          } else if (parentPosition) {
            branchY =
              parentPosition.y +
              BRANCH_VERTICAL_OFFSET +
              branchIndex * BRANCH_STAGGER_OFFSET;
            currentY = branchY;
          }
        } else if (timeline.parentTimelineId) {
          // Regular branch without specific event
          branchY =
            startY +
            BRANCH_VERTICAL_OFFSET +
            branchIndex * BRANCH_STAGGER_OFFSET;
          currentY = branchY;
        }

        newTimelineCardPositions.set(timeline.id, {
          x: currentStartX,
          y: currentY,
        });

        const isSelected = timeline.id === currentTimelineId;
        const bgColor = timeline.color || "#3B82F6";
        const lighterBgColor = `${bgColor}22`;
        const borderColor = isSelected ? bgColor : `${bgColor}66`;

        // Smart grouping: one card per active day, not one card per event.
        const sortedEvents = [...timeline.events].sort((a, b) => {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return dateA - dateB;
        });
        const dayGroups = groupEventsByDay(sortedEvents);

        // Calculate timeline line width based on number of active days
        const timelineLineWidth = Math.max(
          (dayGroups.length + 1) * EVENT_SPACING + 200,
          800,
        );
        maxUsedX = Math.max(
          maxUsedX,
          currentStartX + CARD_WIDTH + timelineLineWidth,
        );

        // Timeline colored line (add to lines layer)
        linesLayer.push(
          <svg
            key={`timeline-line-${timeline.id}`}
            className="absolute pointer-events-none"
            style={{
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
            }}
          >
            <line
              x1={currentStartX + CARD_WIDTH}
              y1={currentY + CARD_HEIGHT / 2}
              x2={currentStartX + CARD_WIDTH + timelineLineWidth}
              y2={currentY + CARD_HEIGHT / 2}
              stroke={bgColor}
              strokeWidth="3"
              opacity="0.3"
            />
          </svg>,
        );

        // Timeline card (add to cards layer)
        timelineCardsLayer.push(
          <div
            key={timeline.id}
            className={`absolute rounded-lg shadow-lg cursor-pointer transition-all duration-300 ${
              isSelected
                ? "ring-4 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-900 scale-105"
                : "hover:shadow-xl hover:scale-105"
            }`}
            style={{
              left: `${currentStartX}px`,
              top: `${currentY}px`,
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
              background: isSelected
                ? `linear-gradient(135deg, ${bgColor}33, ${bgColor}11)`
                : lighterBgColor,
              borderColor: borderColor,
              borderWidth: "2px",
              borderStyle: "solid",
              // Remove ringColor from here
            }}
            onClick={() => handleTimelineSelect(timeline.id)}
            onMouseEnter={() => setHoveredTimeline(timeline.id)}
            onMouseLeave={() => setHoveredTimeline(null)}
          >
            <div className="p-4 h-full flex flex-col justify-between">
              <div>
                <h3
                  className="font-bold text-sm mb-1 truncate"
                  style={{ color: bgColor }}
                >
                  {timeline.name}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                  {timeline.description || "No description"}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {timeline.events.length} events
                </span>
                {onEditTimeline && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditTimeline(timeline.id);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Edit
                  </button>
                )}
              </div>
              {timeline.parentTimelineId && (
                <div className="absolute -top-2 -left-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  ↱
                </div>
              )}
            </div>
          </div>,
        );

        // Add date range overlay when zoomed out
        if (zoom < 0.4 && dayGroups.length > 0) {
          const firstDate = dayGroups[0].key;
          const lastDate = dayGroups[dayGroups.length - 1].key;
          const dateRangeX = currentStartX + CARD_WIDTH + 40;
          const dateRangeWidth = Math.max(
            (dayGroups.length - 1) * EVENT_SPACING + DAY_CARD_WIDTH,
            200,
          );

          timelineCardsLayer.push(
            <div
              key={`date-range-${timeline.id}`}
              className="absolute pointer-events-none"
              style={{
                left: `${dateRangeX}px`,
                top: `${currentY + CARD_HEIGHT / 2 - 30}px`,
                width: `${dateRangeWidth}px`,
                height: "60px",
                opacity: Math.min(1, (0.4 - zoom) * 3),
              }}
            >
              <div className="relative h-full">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-transparent to-red-500/20 rounded-lg" />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
                  {formatDate(firstDate)}
                </div>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
                  {formatDate(lastDate)}
                </div>
                {zoom < 0.3 && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-gray-800 text-white px-3 py-1 rounded text-xs font-bold">
                    {sortedEvents.length} events
                  </div>
                )}
              </div>
            </div>,
          );
        }

        // Draw branch connection line if this is a branch timeline
        if (timeline.parentTimelineId && timeline.branchFromEventId) {
          const branchEventPosition = newEventPositions.get(
            timeline.branchFromEventId,
          );
          if (branchEventPosition) {
            branchLinesLayer.push(
              <svg
                key={`branch-line-${timeline.id}`}
                className="absolute pointer-events-none"
                style={{
                  left: 0,
                  top: 0,
                  width: "100%",
                  height: "100%",
                }}
              >
                <path
                  d={`M ${branchEventPosition.x} ${branchEventPosition.y}
                      Q ${branchEventPosition.x} ${branchEventPosition.y + 50}
                      ${currentStartX + CARD_WIDTH / 2} ${currentY}`}
                  stroke="#9333ea"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  fill="none"
                  opacity="0.5"
                />
              </svg>,
            );
          }
        }

        // Add first plus button before any events
        const firstPlusId = `${timeline.id}-addevent-0`;
        plusButtonsLayer.push(
          <div
            key={firstPlusId}
            className="absolute cursor-pointer"
            style={{
              left: `${currentStartX + CARD_WIDTH + 40}px`,
              top: `${currentY + CARD_HEIGHT / 2}px`,
              width: "24px",
              height: "24px",
              transform: "translate(-50%, -50%)",
            }}
            onMouseEnter={() => setHoveredSection(firstPlusId)}
            onMouseLeave={() => setHoveredSection(null)}
            onClick={() => {
              if (timeline.id !== currentTimelineId) {
                onTimelineSelect(timeline.id);
              }
              const suggestedDate = sortedEvents[0]?.date;
              onAddEvent(timeline.id, suggestedDate);
            }}
          >
            <div
              className={`flex items-center justify-center rounded-full ${
                hoveredSection === firstPlusId
                  ? "bg-blue-500 text-white shadow-lg"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900"
              } transition-all duration-200`}
              style={{
                width: "100%",
                height: "100%",
              }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
          </div>,
        );
        // Render one compact, expandable card per active day, plus a plus
        // button between days. Events inside the card stay individually
        // clickable, so nothing is lost by grouping.
        dayGroups.forEach((group, dayIndex) => {
          const dayX =
            currentStartX + CARD_WIDTH + 80 + dayIndex * EVENT_SPACING;
          const dayY = currentY + CARD_HEIGHT / 2 - DAY_CARD_HEIGHT / 2;
          const isDayExpanded = expandedDayKey === group.key;
          const isDaySelected = group.events.some(
            (event) => selectedEvent?.id === event.id,
          );

          for (const event of group.events) {
            newEventPositions.set(event.id, {
              x: dayX + DAY_CARD_WIDTH / 2,
              y: currentY + CARD_HEIGHT / 2,
            });
          }

          eventCardsLayer.push(
            <DayGroupCard
              key={`${timeline.id}-day-${group.key}`}
              group={group}
              x={dayX}
              y={dayY}
              width={DAY_CARD_WIDTH}
              height={DAY_CARD_HEIGHT}
              isExpanded={isDayExpanded}
              isSelected={isDaySelected}
              timelineColor={bgColor}
              onToggle={(key) =>
                setExpandedDayKey((current) =>
                  current === key ? null : key,
                )
              }
              onEventClick={handleEventClick}
              onEventRightClick={
                onEventRightClick
                  ? (event, e) => onEventRightClick(event, e)
                  : undefined
              }
              onBranchClick={handleBranchFromCard}
              formatDate={formatDate}
            />,
          );

          const plusButtonX =
            dayX + DAY_CARD_WIDTH + (EVENT_SPACING - DAY_CARD_WIDTH) / 2;
          const eventSectionId = `${timeline.id}-addevent-${dayIndex + 1}`;

          plusButtonsLayer.push(
            <div
              key={eventSectionId}
              className="absolute cursor-pointer"
              style={{
                left: `${plusButtonX}px`,
                top: `${currentY + CARD_HEIGHT / 2}px`,
                width: "24px",
                height: "24px",
                transform: "translate(-50%, -50%)",
              }}
              onMouseEnter={() => setHoveredSection(eventSectionId)}
              onMouseLeave={() => setHoveredSection(null)}
              onClick={() => {
                if (timeline.id !== currentTimelineId) {
                  onTimelineSelect(timeline.id);
                }
                onAddEvent(timeline.id, group.key);
              }}
            >
              <div
                className={`flex items-center justify-center rounded-full ${
                  hoveredSection === eventSectionId
                    ? "bg-blue-500 text-white shadow-lg"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-blue-100 dark:hover:bg-blue-900"
                } transition-all duration-200`}
                style={{
                  width: "100%",
                  height: "100%",
                }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
            </div>,
          );
        });

        maxUsedY = Math.max(maxUsedY, currentY + CARD_HEIGHT);

        if (children && children.length > 0) {
          const childResults = renderTimelines(
            children,
            currentStartX + HORIZONTAL_SPACING,
            currentY,
            { x: currentStartX + CARD_WIDTH / 2, y: currentY + CARD_HEIGHT },
            [],
            newEventPositions,
            newTimelineCardPositions,
            branchTracker,
          );

          // Add child elements to appropriate layers
          childResults.elements.forEach((el) => {
            const key = el.key as string;
            if (key?.includes("timeline-line")) {
              linesLayer.push(el);
            } else if (key?.includes("branch-line")) {
              branchLinesLayer.push(el);
            } else if (key?.includes("addevent")) {
              plusButtonsLayer.push(el);
            } else if (key?.includes("event-")) {
              eventCardsLayer.push(el);
            } else if (key?.includes("date-range")) {
              timelineCardsLayer.push(el);
            } else {
              timelineCardsLayer.push(el);
            }
          });

          maxUsedY = Math.max(maxUsedY, childResults.newY);
          maxUsedX = Math.max(maxUsedX, childResults.maxX);
        }

        if (i < tree.length - 1 && !timeline.parentTimelineId) {
          currentY = Math.max(
            currentY + VERTICAL_SPACING,
            maxUsedY + VERTICAL_SPACING * 0.3,
          );
        }
      }

      // Combine layers in proper z-order
      const combinedElements = [
        ...elementsAccumulator,
        ...branchLinesLayer, // z-index: 1
        ...linesLayer, // z-index: 2
        ...plusButtonsLayer, // z-index: 6
        ...timelineCardsLayer, // z-index: 10
        ...eventCardsLayer, // z-index: 15
      ];

      return {
        elements: combinedElements,
        newY: maxUsedY,
        eventPositionsResult: newEventPositions,
        timelineCardPositionsResult: newTimelineCardPositions,
        maxX: maxUsedX,
      };
    },
    [
      currentTimelineId,
      handleTimelineSelect,
      onAddEvent,
      handleEventClick,
      onEventRightClick,
      formatDate,
      hoveredSection,
      selectedEvent,
      onTimelineSelect,
      zoom,
      setHoveredTimeline,
      onEditTimeline,
      expandedDayKey,
    ],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    },
    [pan.x, pan.y],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragStart) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setDragStart(null);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = 0.05;
    setZoom((prevZoom) =>
      e.deltaY < 0
        ? Math.min(2, prevZoom + scaleFactor)
        : Math.max(0.1, prevZoom - scaleFactor),
    );
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(2, zoom + 0.1));
  }, [zoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(0.1, zoom - 0.1));
  }, [zoom]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const addTimelineButtonY = useMemo(() => {
    if (timelineTree.length === 0) return 100;

    // Find the maximum Y position used by any timeline or branch
    let maxY = 50; // Starting position

    // Get all timeline positions from the rendered state
    if (timelineCardPositions.size > 0) {
      const positions = Array.from(timelineCardPositions.values());
      const bottomMostY = Math.max(...positions.map((pos) => pos.y));
      maxY = bottomMostY + CARD_HEIGHT + VERTICAL_SPACING;
    } else {
      // Fallback calculation if positions aren't set yet
      const calculateMaxY = (
        tree: any[],
        startY = 50,
        parentBranchCount = 0,
      ): number => {
        let localMaxY = startY;

        tree.forEach((node, index) => {
          const { children, timeline } = node;
          let nodeY = startY;

          if (timeline.parentTimelineId) {
            nodeY = startY + index * BRANCH_STAGGER_OFFSET;
          } else if (index > 0) {
            nodeY = localMaxY + VERTICAL_SPACING;
          }

          localMaxY = Math.max(localMaxY, nodeY + CARD_HEIGHT);

          if (children && children.length > 0) {
            const childMaxY = calculateMaxY(
              children,
              nodeY + BRANCH_VERTICAL_OFFSET,
              children.length,
            );
            localMaxY = Math.max(localMaxY, childMaxY);
          }
        });

        return localMaxY;
      };

      maxY = calculateMaxY(timelineTree) + VERTICAL_SPACING;
    }

    return maxY;
  }, [timelineTree, timelineCardPositions]);

  useEffect(() => {
    const renderResults = renderTimelines(timelineTree);
    setRenderedTimelineElements(renderResults.elements);
    setEventPositions(renderResults.eventPositionsResult);
    setTimelineCardPositions(renderResults.timelineCardPositionsResult);

    const maxY = Math.max(
      ...Array.from(renderResults.timelineCardPositionsResult.values()).map(
        (pos) => pos.y,
      ),
      ...Array.from(renderResults.eventPositionsResult.values()).map(
        (pos) => pos.y,
      ),
      addTimelineButtonY,
      0,
    );

    setDimensions({
      width: renderResults.maxX + 200,
      height: maxY + 200,
    });
  }, [timelineTree, renderTimelines, addTimelineButtonY, expandedDayKey]);
  return (
    <div className="relative w-full h-full flex">
      <div
        ref={containerRef}
        className={`relative ${showDetailPanel ? "flex-1" : "w-full"} h-full overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="absolute"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
          }}
        >
          {renderedTimelineElements}
          <button
            className="absolute rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 bg-green-50 dark:bg-green-900/30 border-2 border-dashed border-green-400 dark:border-green-600 hover:bg-green-100 dark:hover:bg-green-900/50"
            style={{
              left: "50px",
              top: `${addTimelineButtonY}px`,
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
              zIndex: 10,
            }}
            onClick={onAddTimelineClick}
            title="Add New Timeline"
          >
            <div className="flex flex-col items-center justify-center gap-2">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Add Timeline
              </span>
            </div>
          </button>
        </div>
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
          <button
            onClick={() => setShowDetailPanel(!showDetailPanel)}
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            title={showDetailPanel ? "Hide Details" : "Show Details"}
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  showDetailPanel
                    ? "M13 5l7 7-7 7M5 5l7 7-7 7"
                    : "M11 19l-7-7 7-7m8 14l-7-7 7-7"
                }
              />
            </svg>
          </button>
          <button
            onClick={handleZoomIn}
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            title="Zoom In"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
              />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            title="Zoom Out"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
              />
            </svg>
          </button>
          <button
            onClick={handleResetView}
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            title="Reset View"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </button>
          <button
            onClick={panToShowAllTimelines}
            className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            title="Fit All"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
        </div>
      </div>
      {showDetailPanel && (
        <div className="w-80 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
          {showConsistencyAnalysis ? (
            <ConsistencyAnalysisPanel
              onClose={onCloseConsistencyAnalysis || (() => {})}
              onReviewEvent={(eventId: string, timelineId: string) => {
                // Find the event from the timelines
                const targetTimeline = timelines.find(
                  (t) => t.id === timelineId,
                );
                if (targetTimeline) {
                  const targetEvent = targetTimeline.events?.find(
                    (e) => e.id === eventId,
                  );
                  if (targetEvent) {
                    // Call the existing onEventClick handler which opens the event modal
                    onEventClick({
                      ...targetEvent,
                      timelineId: timelineId,
                    });
                    // Close the consistency panel
                    if (onCloseConsistencyAnalysis) {
                      onCloseConsistencyAnalysis();
                    }
                  }
                }
              }}
            />
          ) : (
            <TimelineDetailsPanel
              timeline={currentTimeline}
              selectedEvent={selectedEvent}
              allTimelines={timelines}
              onEventClick={handleEventClick}
              onEventEdit={onEventClick}
              onAddEvent={(timelineId) => onAddEvent(timelineId || currentTimelineId || "")}
              onEditTimeline={onEditTimeline}
              onSelectTimeline={handleTimelineSelect}
              onBackToTimeline={() => setSelectedEvent(null)}
              onViewKBItem={(type, id) =>
                console.log("View KB item:", type, id)
              }
            />
          )}
          <BranchingModal />
        </div>
      )}
    </div>
  );
};

export default TimelineFlowView;
