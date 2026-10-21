// src/components/common/TimelineSelector.tsx
import React, { useRef, useEffect } from "react";
import Button from "../common/Button";
import { TimelineType, ID } from "../../types";

interface TimelineSelectorProps {
  timelines: TimelineType[];
  currentTimelineId: ID | null;
  onTimelineSelect: (timelineId: ID | null) => void;
  onAddTimelineClick: () => void;
  isOpen: boolean;
  onToggle: () => void;
  allowAll?: boolean;
}

const TimelineSelector: React.FC<TimelineSelectorProps> = ({
  timelines,
  currentTimelineId,
  onTimelineSelect,
  onAddTimelineClick,
  isOpen,
  onToggle,
  allowAll = true, // Default to true to allow "All Timelines"
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        if (isOpen) {
          onToggle();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onToggle]);

  // Handle timeline selection and close dropdown
  const handleTimelineSelect = (timelineId: ID | null) => {
    onTimelineSelect(timelineId);
    onToggle(); // Close the dropdown
  };

  // Handle add timeline click and close dropdown
  const handleAddTimelineClick = () => {
    onAddTimelineClick();
    onToggle(); // Close the dropdown
  };

  const currentTimelineName =
    currentTimelineId === null
      ? "All Timelines"
      : timelines.find((t) => t.id === currentTimelineId)?.name ||
        "Select Timeline";

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        rightIcon={
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${
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
        }
        className="min-w-[150px] justify-between"
      >
        <span className="truncate">{currentTimelineName}</span>
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50 py-1">
          {allowAll && (
            <button
              key="all-timelines"
              className={`w-full text-left block px-4 py-2.5 text-sm ${
                currentTimelineId === null
                  ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/80"
              }`}
              onClick={() => handleTimelineSelect(null)}
            >
              All Timelines
            </button>
          )}
          {timelines.map((timeline) => (
            <button
              key={timeline.id}
              className={`w-full text-left block px-4 py-2.5 text-sm ${
                timeline.id === currentTimelineId
                  ? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-200 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/80"
              }`}
              onClick={() => handleTimelineSelect(timeline.id)}
            >
              <div className="flex items-center">
                <span
                  className="w-3 h-3 rounded-full mr-3 shrink-0"
                  style={{ backgroundColor: timeline.color }}
                />
                <span className="truncate">{timeline.name}</span>
              </div>
            </button>
          ))}
          <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
            <button
              className="w-full text-left block px-4 py-2.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700/80"
              onClick={handleAddTimelineClick}
            >
              <div className="flex items-center">
                <svg
                  className="h-4 w-4 mr-2.5"
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
                Create New Timeline
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimelineSelector;
