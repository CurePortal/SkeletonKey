import React from "react";
import { EventType } from "../../types";

export interface DayGroup {
  key: string;
  events: EventType[];
}

interface DayGroupCardProps {
  group: DayGroup;
  x: number;
  y: number;
  width: number;
  height: number;
  isExpanded: boolean;
  isSelected: boolean;
  timelineColor: string;
  onToggle: () => void;
  onEventClick: (event: EventType) => void;
  onEventRightClick?: (event: EventType, e: React.MouseEvent) => void;
  onBranchClick?: (event: EventType) => void;
  formatDate: (date: string) => string;
}

const NOISE_TAGS = new Set([
  "case-worker",
  "import",
  "document",
  "plan",
  "stream",
  "fieldlog",
  "hq",
  "beacon",
  "telemetry",
  "auto",
]);

const activityFor = (events: EventType[]): string => {
  const tags = new Set<string>();
  for (const event of events) {
    for (const tag of event.tags || []) {
      if (!NOISE_TAGS.has(tag)) tags.add(tag);
    }
  }
  return [...tags].slice(0, 4).join(" · ");
};

const DayGroupCard: React.FC<DayGroupCardProps> = ({
  group,
  x,
  y,
  width,
  height,
  isExpanded,
  isSelected,
  timelineColor,
  onToggle,
  onEventClick,
  onEventRightClick,
  onBranchClick,
  formatDate,
}) => {
  const { events } = group;
  const count = events.length;
  const activity = activityFor(events);
  const topTitles = [...new Set(events.map((event) => event.title))].slice(0, 3);
  const expandedWidth = width;

  return (
    <div
      className={`absolute rounded-md bg-white dark:bg-gray-800 transition-all duration-300 ${
        isSelected
          ? "ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg"
          : "hover:shadow-md"
      }`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: "translateY(-50%)",
        width: isExpanded ? `${expandedWidth}px` : `${width}px`,
        minHeight: `${height}px`,
        maxHeight: isExpanded ? "360px" : undefined,
        overflowY: isExpanded ? "auto" : "visible",
        zIndex: isExpanded ? 1000 : isSelected ? 20 : 15,
        borderColor: timelineColor,
        borderWidth: "2px",
        borderStyle: "solid",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onWheel={(e) => {
        if (isExpanded) e.stopPropagation();
      }}
      onMouseDown={(e) => {
        if (isExpanded) e.stopPropagation();
      }}
    >
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {formatDate(group.key)}
            </div>
            <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
              {count === 1 ? events[0].title : `${count} events`}
            </div>
          </div>
          <div
            className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
            style={{ backgroundColor: timelineColor }}
          >
            {count}
          </div>
        </div>

        {!isExpanded && (
          <div className="mt-1.5 space-y-0.5">
            {topTitles.slice(0, count === 1 ? 0 : 2).map((title) => (
              <div
                key={title}
                className="text-[11px] text-gray-600 dark:text-gray-300 truncate"
              >
                {title}
              </div>
            ))}
            {activity && (
              <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                {activity}
              </div>
            )}
          </div>
        )}

        {isExpanded && (
          <div className="mt-2 space-y-1 border-t border-gray-200 pt-2 dark:border-gray-700">
            {events.map((event) => (
              <div
                key={event.id}
                role="button"
                tabIndex={0}
                className="group flex w-full items-start gap-1.5 rounded px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  e.stopPropagation();
                  onEventClick(event);
                }}
                onContextMenu={(e) => {
                  if (!onEventRightClick) return;
                  e.preventDefault();
                  e.stopPropagation();
                  onEventRightClick(event, e);
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: timelineColor }}
                    />
                    <span className="truncate text-[11px] font-medium text-gray-800 dark:text-gray-100">
                      {event.title}
                    </span>
                    {event.isPointOfDivergence && (
                      <span className="text-[9px] font-semibold text-purple-600 dark:text-purple-400">
                        POD
                      </span>
                    )}
                  </div>
                  {event.description && (
                    <div className="ml-3 line-clamp-1 text-[10px] text-gray-500 dark:text-gray-400">
                      {event.description.replace(/<[^>]*>/g, "")}
                    </div>
                  )}
                </div>
                {onBranchClick && (
                  <button
                    type="button"
                    title="Branch from this event"
                    className="invisible rounded px-1 text-[11px] text-purple-700 hover:bg-purple-100 group-hover:visible dark:text-purple-300 dark:hover:bg-purple-900/40"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBranchClick(event);
                    }}
                  >
                    ↱
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!isExpanded && count > 1 && (
          <div className="mt-1 text-[9px] text-gray-400 dark:text-gray-500">
            click to expand
          </div>
        )}
      </div>
    </div>
  );
};

export default DayGroupCard;
