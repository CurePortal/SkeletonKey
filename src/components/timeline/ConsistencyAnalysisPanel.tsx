import React, { useState, useCallback, useEffect } from "react";
import { useProjectData } from "../../contexts/ProjectDataContext";
import { useNotification } from "../../contexts/NotificationContext";
import Button from "../common/Button";
import { EventType } from "../../types/project";

// Define the structure for a consistency issue
interface ConsistencyIssue {
  id: string;
  type:
    | "character_conflict"
    | "location_anachronism"
    | "technology_anachronism"
    | "logical_contradiction"
    | "temporal_paradox"
    | "missing_prerequisite";
  severity: "critical" | "warning" | "suggestion";
  category: "research" | "logic" | "continuity";
  title: string;
  description: string;
  context: string;
  affectedEvents: Array<{
    eventId: string;
    timelineId: string;
    timelineName: string;
    eventTitle: string;
    conflictingValue: string;
    date?: string;
  }>;
  suggestions?: string[];
  researchNotes?: string;
  confidence: number;
}

// Define the props for the panel component, including callbacks
interface ConsistencyAnalysisPanelProps {
  onClose: () => void;
  onReviewEvent?: (eventId: string, timelineId: string) => void; // Prop to handle opening an event
}

// Define an enriched event type for internal use
type EnrichedEvent = EventType & {
  timelineId: string;
  timelineName: string;
  timeline: any; // Consider defining a proper TimelineType if available
};

// The main component
const ConsistencyAnalysisPanel: React.FC<ConsistencyAnalysisPanelProps> = ({
  onClose,
  onReviewEvent, // Accept the new prop
}) => {
  const { project } = useProjectData();
  const { showInfo } = useNotification();

  // State hooks
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issues, setIssues] = useState<ConsistencyIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<ConsistencyIssue | null>(
    null,
  );
  const [analysisMode, setAnalysisMode] = useState<"research" | "creative">(
    "research",
  );

  // The core analysis logic
  const runConsistencyAnalysis = useCallback(() => {
    if (!project?.timelines || project.timelines.length === 0) return;

    setIsAnalyzing(true);

    setTimeout(() => {
      try {
        const foundIssues: ConsistencyIssue[] = [];
        const allEvents: EnrichedEvent[] = project.timelines.flatMap(
          (timeline) =>
            (timeline.events || []).map((event) => ({
              ...event,
              timelineId: timeline.id,
              timelineName: timeline.name || `Timeline ${timeline.id}`,
              timeline: timeline,
            })),
        );

        const characterEventsMap = new Map<string, EnrichedEvent[]>();
        allEvents.forEach((event) => {
          if (
            event.linkedCharacterIds &&
            Array.isArray(event.linkedCharacterIds)
          ) {
            event.linkedCharacterIds.forEach((charId: string) => {
              if (!characterEventsMap.has(charId)) {
                characterEventsMap.set(charId, []);
              }
              characterEventsMap.get(charId)!.push(event);
            });
          }
        });

        characterEventsMap.forEach((events, charId) => {
          const eventsByTimeline = new Map<string, EnrichedEvent[]>();
          events.forEach((event) => {
            if (!eventsByTimeline.has(event.timelineId)) {
              eventsByTimeline.set(event.timelineId, []);
            }
            eventsByTimeline.get(event.timelineId)!.push(event);
          });

          eventsByTimeline.forEach((timelineEvents, timelineId) => {
            if (timelineEvents.length < 2) return;
            const directLocations = new Set(
              timelineEvents
                .map((e) => (e as any).location)
                .filter(
                  (loc) => loc && typeof loc === "string" && loc.trim() !== "",
                ),
            );
            const linkedLocations = new Set(
              timelineEvents
                .flatMap((e) => e.linkedLocationIds || [])
                .filter((locId) => locId && locId.trim() !== ""),
            );
            const allLocations = new Set([
              ...directLocations,
              ...linkedLocations,
            ]);

            if (allLocations.size > 1) {
              const timelineInfo = project.timelines.find(
                (t) => t.id === timelineId,
              );
              const locationDisplayNames = Array.from(allLocations).map(
                (locIdOrName) => {
                  if (directLocations.has(locIdOrName!)) return locIdOrName;
                  const locationObj = project.locations?.find(
                    (loc) => loc.id === locIdOrName,
                  );
                  return locationObj ? locationObj.name : locIdOrName;
                },
              );

              foundIssues.push({
                id: `char_location_conflict_${charId}_${timelineId}`,
                type: "character_conflict",
                severity: "critical",
                category: "research",
                title: `Character Location Conflict: ${charId}`,
                description:
                  "Character appears in multiple locations within the same timeline without sufficient time for travel.",
                context: `Timeline: ${timelineInfo?.name || "Unknown Timeline"}`,
                affectedEvents: timelineEvents.map((e) => {
                  let eventLocation =
                    (e as any).location || "No direct location";
                  if (
                    !(e as any).location &&
                    e.linkedLocationIds &&
                    e.linkedLocationIds.length > 0
                  ) {
                    const linkedLocNames = e.linkedLocationIds.map(
                      (locId: string) => {
                        const locationObj = project.locations?.find(
                          (loc) => loc.id === locId,
                        );
                        return locationObj ? locationObj.name : locId;
                      },
                    );
                    eventLocation = linkedLocNames.join(", ");
                  }
                  return {
                    eventId: e.id,
                    timelineId: e.timelineId,
                    timelineName: e.timelineName,
                    eventTitle: e.title,
                    conflictingValue: eventLocation,
                    date: e.date,
                  };
                }),
                suggestions: [
                  "Verify the records behind these locations",
                  "Check if the dates allow for realistic travel time",
                  "Consider if these events should be in separate timeline branches",
                  "Check the real places associated with this person",
                ],
                researchNotes: `This conflict suggests either: (1) incorrect location data, (2) events that should be on different timelines, or (3) missing travel time between events. Conflicting locations: ${locationDisplayNames.join(", ")}`,
                confidence: 90,
              });
            }
          });
        });

        allEvents.forEach((event) => {
          if (!event.date && event.importance && event.importance >= 8) {
            foundIssues.push({
              id: `missing_date_${event.id}`,
              type: "missing_prerequisite",
              severity: "warning",
              category: "research",
              title: "High-Importance Event Missing Date",
              description: `Important event "${event.title}" lacks a specific date, making timeline placement uncertain.`,
              context: `Timeline: ${event.timelineName}`,
              affectedEvents: [
                {
                  eventId: event.id,
                  timelineId: event.timelineId,
                  timelineName: event.timelineName,
                  eventTitle: event.title,
                  conflictingValue: "No date specified",
                  date: event.date,
                },
              ],
              suggestions: [
                "Check the source records to establish a more precise date",
                "Consider using approximate dates (e.g., 'c. 1500 BCE')",
                "Document the uncertainty in the event notes",
              ],
              researchNotes:
                "Precise dating helps maintain timeline integrity and allows for better analysis of cause-and-effect relationships.",
              confidence: 75,
            });
          }
        });

        const filteredIssues = foundIssues.filter(
          (issue) => issue.confidence >= 60,
        );
        setIssues(filteredIssues);

        if (filteredIssues.length === 0) {
          showInfo(
            `Analysis complete. No ${analysisMode === "research" ? "research" : "creative"} inconsistencies detected.`,
          );
        } else {
          showInfo(
            `Found ${filteredIssues.length} potential research issue${filteredIssues.length !== 1 ? "s" : ""} to investigate.`,
          );
        }
      } catch (error) {
        console.error("Error analyzing timeline consistency:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }, 500);
  }, [project, analysisMode, showInfo]);

  // Effect to run analysis when project or mode changes (Fixed dependency array)
  useEffect(() => {
    runConsistencyAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, analysisMode]);

  // Handlers wrapped in useCallback
  const handleViewIssue = useCallback((issue: ConsistencyIssue) => {
    setSelectedIssue(issue);
  }, []);

  const handleReviewEvent = useCallback(
    (eventId: string, timelineId: string) => {
      console.log(
        `Request to review event: ${eventId} on timeline ${timelineId}`,
      );
      if (onReviewEvent) {
        onReviewEvent(eventId, timelineId); // Call parent's function
        onClose(); // Close panel
      } else {
        showInfo(
          `Navigation to event ${eventId} is not configured (placeholder)...`,
        );
      }
    },
    [onReviewEvent, onClose, showInfo],
  );

  const handleResolveIssue = useCallback(
    (issueId: string) => {
      setIssues((prevIssues) =>
        prevIssues.filter((issue) => issue.id !== issueId),
      );
      setSelectedIssue(null);
      showInfo("Issue marked as resolved.");
    },
    [showInfo],
  );

  // Helper functions for styling
  const getSeverityColor = (severity: ConsistencyIssue["severity"]) => {
    switch (severity) {
      case "critical":
        return "text-red-600 dark:text-red-400";
      case "warning":
        return "text-yellow-600 dark:text-yellow-400";
      case "suggestion":
        return "text-blue-600 dark:text-blue-400";
    }
  };

  const getSeverityBg = (severity: ConsistencyIssue["severity"]) => {
    switch (severity) {
      case "critical":
        return "bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border-red-200 dark:border-red-800";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 border-yellow-200 dark:border-yellow-800";
      case "suggestion":
        return "bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border-blue-200 dark:border-blue-800";
    }
  };

  // Filtered issue lists
  const criticalIssues = issues.filter((i) => i.severity === "critical");
  const warningIssues = issues.filter((i) => i.severity === "warning");
  const suggestionIssues = issues.filter((i) => i.severity === "suggestion");

  // Render the selected issue details view
  if (selectedIssue) {
    return (
      <div className="w-full h-full overflow-auto bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-3">
            <button
              onClick={() => setSelectedIssue(null)}
              className="mr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Back to analysis results"
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
              Research Issue Details
            </h3>
            <button
              onClick={onClose}
              className="ml-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Close analysis"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <div className="flex items-center mb-2">
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${getSeverityColor(selectedIssue.severity)}`}
            >
              {selectedIssue.severity.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded mr-2">
              {selectedIssue.category}
            </span>
            <span className="text-xs text-gray-400">
              {selectedIssue.confidence}% confidence
            </span>
          </div>
          <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {selectedIssue.title}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {selectedIssue.description}
          </p>
        </div>
        <div className="p-5">
          <div className="mb-6">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Context
            </h5>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {selectedIssue.context}
            </p>
          </div>
          <div className="mb-6">
            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Affected Events ({selectedIssue.affectedEvents.length})
            </h5>
            <div className="space-y-3">
              {selectedIssue.affectedEvents.map((event, index) => (
                <div
                  key={`${event.eventId}-${index}`}
                  className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {event.timelineName}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                      {event.date || "No date"}
                    </span>
                  </div>
                  <h6 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {event.eventTitle}
                  </h6>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <strong>Location:</strong> {event.conflictingValue}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      handleReviewEvent(event.eventId, event.timelineId)
                    }
                  >
                    Review Event
                  </Button>
                </div>
              ))}
            </div>
          </div>
          {selectedIssue.suggestions && (
            <div className="mb-6">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Research Suggestions
              </h5>
              <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {selectedIssue.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          {selectedIssue.researchNotes && (
            <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Research Notes
              </h5>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {selectedIssue.researchNotes}
              </p>
            </div>
          )}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <Button
              variant="primary"
              onClick={() => handleResolveIssue(selectedIssue.id)}
            >
              Mark as Resolved
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Render the main list view
  return (
    <div className="w-full h-full overflow-auto bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <svg
              className="h-5 w-5 mr-2 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Consistency Analysis
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            title="Close analysis"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <select
              value={analysisMode}
              onChange={(e) =>
                setAnalysisMode(e.target.value as "research" | "creative")
              }
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1 pr-8 bg-white dark:bg-gray-800"
            >
              <option value="research">Research Mode</option>
              <option value="creative">Creative Mode</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={runConsistencyAnalysis}
              disabled={isAnalyzing}
              isLoading={isAnalyzing}
            >
              Re-analyze
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {criticalIssues.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Critical
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {warningIssues.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Warnings
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {suggestionIssues.length}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Suggestions
            </div>
          </div>
        </div>
      </div>
      <div className="p-5">
        {isAnalyzing ? (
          <div className="text-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Analyzing timeline consistency...
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Checking for character conflicts, temporal issues, and data
              inconsistencies
            </p>
          </div>
        ) : issues.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 dark:bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="h-8 w-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Issues Found
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your timeline data appears consistent. No research attention
              points detected.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Research Attention Points ({issues.length})
            </h4>
            {criticalIssues.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-red-700 dark:text-red-300">
                  Critical Issues
                </h5>
                {criticalIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${getSeverityBg(issue.severity)}`}
                    onClick={() => handleViewIssue(issue)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h6 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">
                          {issue.title}
                        </h6>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {issue.description}
                        </p>
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <span>
                            {issue.affectedEvents.length} events affected
                          </span>
                          <span className="mx-2">•</span>
                          <span>{issue.confidence}% confidence</span>
                        </div>
                      </div>
                      <svg
                        className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {warningIssues.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                  Warnings
                </h5>
                {warningIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${getSeverityBg(issue.severity)}`}
                    onClick={() => handleViewIssue(issue)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h6 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">
                          {issue.title}
                        </h6>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {issue.description}
                        </p>
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <span>
                            {issue.affectedEvents.length} events affected
                          </span>
                          <span className="mx-2">•</span>
                          <span>{issue.confidence}% confidence</span>
                        </div>
                      </div>
                      <svg
                        className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsistencyAnalysisPanel;
