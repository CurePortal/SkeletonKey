import React from "react";
import { EventType } from "../../types";
import { DayGroup } from "./DayGroupCard";

export interface MonthGroup {
  key: string;
  days: DayGroup[];
  events: EventType[];
}

interface MonthGroupCardProps {
  month: MonthGroup;
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

const monthLabel = (key: string): string => {
  const [year, month] = key.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || year <= 0) {
    return key;
  }
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
};

const MonthGroupCard: React.FC<MonthGroupCardProps> = ({
  month,
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
  const count = month.events.length;
  const dayCount = month.days.length;
  const topTitles = [...new Set(month.events.map((event) => event.title))].slice(
    0,
    3,
  );

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
        width: `${width}px`,
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
              {monthLabel(month.key)}
            </div>
            <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
              {count} event{count === 1 ? "" : "s"} · {dayCount} day
              {dayCount === 1 ? "" : "s"}
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
            {topTitles.slice(0, 2).map((title) => (
              <div
                key={title}
                className="text-[11px] text-gray-600 dark:text-gray-300 truncate"
              >
                {title}
              </div>
            ))}
            <div className="mt-1 text-[9px] text-gray-400 dark:text-gray-500">
              click to expand
            </div>
          </div>
        )}

        {isExpanded && (
          <div className="mt-2 space-y-2 border-t border-gray-200 pt-2 dark:border-gray-700">
            {month.days.map((day) => (
              <div key={day.key}>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {formatDate(day.key)}
                </div>
                <div className="space-y-1">
                  {day.events.map((event) => (
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthGroupCard;
