import React from "react";
import { EventType } from "../../types";

interface ExpandableEventCardProps {
  event: EventType;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  isPod: boolean;
  isHighImportance: boolean;
  isExpanded: boolean;
  textColor: string;
  dateColor: string;
  cardBgColor: string;
  cardBorderColor: string;
  timelineColor?: string;
  eventIcon?: React.ReactNode;
  onEventClick: (event: EventType) => void;
  onEventRightClick?: (event: EventType, e: React.MouseEvent) => void;
  onExpandToggle: (eventId: string) => void;
  onBranchClick?: (event: EventType) => void;
  formatDate: (date: string) => string;
}

const ExpandableEventCard: React.FC<ExpandableEventCardProps> = ({
  event,
  x,
  y,
  width,
  height,
  isSelected,
  isPod,
  isHighImportance,
  isExpanded,
  textColor,
  dateColor,
  cardBgColor,
  cardBorderColor,
  timelineColor = "#3B82F6",
  eventIcon,
  onEventClick,
  onEventRightClick,
  onExpandToggle,
  onBranchClick,
  formatDate,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Always open details panel when clicking the card
    onEventClick(event);
    // Also toggle expansion for preview
    onExpandToggle(event.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (onEventRightClick) {
      e.preventDefault();
      e.stopPropagation();
      onEventRightClick(event, e);
    }
  };

  // Calculate expanded dimensions
  const expandedWidth = 320;
  const expandedHeight = "auto";
  const minExpandedHeight = 200;

  return (
    <div
      className={`absolute cursor-pointer transition-all duration-300 rounded-md ${cardBgColor} ${
        isSelected
          ? "ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg"
          : "hover:shadow-md"
      }`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: isExpanded ? `${expandedWidth}px` : `${width}px`,
        height: isExpanded ? expandedHeight : `${height}px`,
        minHeight: isExpanded ? `${minExpandedHeight}px` : undefined,
        zIndex: isExpanded ? 1000 : isSelected ? 20 : 15,
        transform: isExpanded ? "translate(-50%, -50%)" : undefined,
        transformOrigin: "center center",
        borderColor: isPod ? "#9333ea" : timelineColor,
        borderWidth: "2px",
        borderStyle: "solid",
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Collapsed View */}
      {!isExpanded ? (
        <div className="p-2 h-full flex flex-col justify-between">
          <div className="flex items-start gap-1">
            {eventIcon && (
              <div
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                style={{ color: timelineColor }}
              >
                {eventIcon}
              </div>
            )}
            <div className={`text-xs font-medium truncate ${textColor}`}>
              {event.title}
            </div>
          </div>
          <div className={`text-xs ${dateColor}`}>{formatDate(event.date)}</div>
        </div>
      ) : (
        /* Expanded View */
        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-start gap-2 mb-1">
                {eventIcon && (
                  <div
                    className="w-5 h-5 flex-shrink-0 mt-0.5"
                    style={{ color: timelineColor }}
                  >
                    {eventIcon}
                  </div>
                )}
                <h3 className={`text-sm font-bold ${textColor}`}>
                  {event.title}
                </h3>
              </div>
              <div className={`text-xs ${dateColor}`}>
                {formatDate(event.date)}
                {event.endDate && <> — {formatDate(event.endDate)}</>}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpandToggle(event.id);
              }}
              className="ml-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Importance and Status */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                event.importance >= 8
                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:bg-opacity-30 dark:text-red-200"
                  : event.importance >= 5
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:bg-opacity-30 dark:text-yellow-200"
                    : "bg-green-100 text-green-800 dark:bg-green-900 dark:bg-opacity-30 dark:text-green-200"
              }`}
            >
              Importance: {event.importance}/10
            </span>
            {isPod && (
              <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:bg-opacity-30 dark:text-purple-200">
                Point of Divergence
              </span>
            )}
          </div>

          {/* Description */}
          {event.description && (
            <div className="mb-3">
              <p className={`text-xs ${textColor} leading-relaxed`}>
                {event.description}
              </p>
            </div>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="mb-3">
              <div className="flex flex-wrap gap-1">
                {event.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Connected Entities Summary */}
          {(event.linkedCharacterIds?.length > 0 ||
            event.linkedLocationIds?.length > 0 ||
            event.linkedTechnologyIds?.length > 0 ||
            event.linkedCultureIds?.length > 0) && (
            <div className="mb-3 space-y-1">
              {event.linkedCharacterIds?.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {event.linkedCharacterIds.length} character
                    {event.linkedCharacterIds.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {event.linkedLocationIds?.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {event.linkedLocationIds.length} location
                    {event.linkedLocationIds.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {event.linkedTechnologyIds?.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {event.linkedTechnologyIds.length} technolog
                    {event.linkedTechnologyIds.length !== 1 ? "ies" : "y"}
                  </span>
                </div>
              )}
              {event.linkedCultureIds?.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {event.linkedCultureIds.length} culture
                    {event.linkedCultureIds.length !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons - Collapse and Branch */}
          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {onBranchClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onBranchClick(event);
                }}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Create Branch
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpandToggle(event.id);
              }}
              className={`${onBranchClick ? "flex-1" : "w-full"} px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors`}
            >
              Collapse
            </button>
          </div>
        </div>
      )}

      {/* POD Indicator Badge */}
      {isPod && !isExpanded && (
        <div className="absolute -top-2 -right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
          !
        </div>
      )}

      {/* Expand/Collapse Indicator */}
      {!isExpanded && (
        <div className="absolute bottom-1 right-1 opacity-50 hover:opacity-100">
          <svg
            className="w-3 h-3 text-gray-500"
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
        </div>
      )}
    </div>
  );
};

export default ExpandableEventCard;
