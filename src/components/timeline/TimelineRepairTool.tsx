import React, { useState, useCallback, useEffect, useRef } from "react";
import { useProjectData } from "../../contexts/ProjectDataContext";
import Button from "../common/Button";
import Modal from "../common/Modal";
import { useNotification } from "../../contexts/NotificationContext";

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

// **ADDED**: Props interface to receive the event handler from the parent.
interface TimelineConsistencyCheckerProps {
  onReviewEvent: (eventInfo: { eventId: string; timelineId: string }) => void;
}

const TimelineConsistencyChecker: React.FC<TimelineConsistencyCheckerProps> = ({
  onReviewEvent,
}) => {
  // --- FIX: Removed unused 'updateEvent' (TS6133) ---
  const { project } = useProjectData(); // --- FIX: Removed unused 'showSuccess' (TS6133) ---
  const { showError, showInfo } = useNotification();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issues, setIssues] = useState<ConsistencyIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<ConsistencyIssue | null>(
    null,
  );
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [ignoredIssues, setIgnoredIssues] = useState<Set<string>>(new Set());
  const [analysisMode, setAnalysisMode] = useState<"research" | "creative">(
    "research",
  ); // --- FIX: Removed unused 'setShowMinorIssues' (TS6133) ---
  const [showMinorIssues] = useState(false);

  const isAnalyzingRef = useRef(false);
  const lastProjectVersionRef = useRef<string>(""); // Simple and direct analysis that WILL find conflicts

  const analyzeConsistency = useCallback(() => {
    if (
      isAnalyzingRef.current ||
      !project?.timelines ||
      project.timelines.length === 0
    ) {
      return;
    }

    const projectVersion = JSON.stringify({
      timelinesCount: project.timelines.length,
      eventsCount: project.timelines.reduce(
        (sum, t) => sum + (t.events?.length || 0),
        0,
      ),
      ignoredCount: ignoredIssues.size,
      mode: analysisMode,
    });

    if (lastProjectVersionRef.current === projectVersion) {
      return;
    }

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);

    setTimeout(() => {
      try {
        console.log("=== CONSISTENCY ANALYSIS START ===");
        const foundIssues: ConsistencyIssue[] = []; // Get all events with their timeline context

        const allEvents = project.timelines.flatMap((timeline) =>
          (timeline.events || []).map((event) => ({
            ...event,
            timelineId: timeline.id,
            timelineName: timeline.name || `Timeline ${timeline.id}`,
            timeline: timeline,
          })),
        );

        console.log(`Total events to analyze: ${allEvents.length}`); // Build character to events mapping

        const characterEventsMap = new Map<string, any[]>();

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

        console.log(`Characters found: ${characterEventsMap.size}`); // Check each character for location conflicts within same timeline

        characterEventsMap.forEach((events, charId) => {
          console.log(
            `\nAnalyzing character ${charId} with ${events.length} events`,
          ); // Group events by timeline

          const eventsByTimeline = new Map<string, any[]>();
          events.forEach((event) => {
            if (!eventsByTimeline.has(event.timelineId)) {
              eventsByTimeline.set(event.timelineId, []);
            }
            eventsByTimeline.get(event.timelineId)!.push(event);
          }); // Check for location conflicts within each timeline

          eventsByTimeline.forEach((timelineEvents, timelineId) => {
            if (timelineEvents.length < 2) return;

            console.log(
              `  Timeline ${timelineId}: ${timelineEvents.length} events`,
            ); // Get all unique locations for this character in this timeline

            const directLocations = new Set(
              timelineEvents
                .map((e) => e.location)
                .filter((loc) => loc && loc.trim() !== ""),
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

            console.log(
              `    Direct locations: ${Array.from(directLocations).join(", ")}`,
            );
            console.log(
              `    Linked location IDs: ${Array.from(linkedLocations).join(", ")}`,
            );
            console.log(
              `    All locations: ${Array.from(allLocations).join(", ")}`,
            );

            if (allLocations.size > 1) {
              console.log(
                `    🚨 CONFLICT DETECTED! Character in ${allLocations.size} locations`,
              );

              const timelineInfo = project.timelines.find(
                (t) => t.id === timelineId,
              );

              const locationDisplayNames = Array.from(allLocations).map(
                (locId) => {
                  if (directLocations.has(locId)) return locId;

                  const locationObj = project.locations?.find(
                    (loc) => loc.id === locId,
                  );
                  return locationObj ? locationObj.name : locId;
                },
              );

              const issue: ConsistencyIssue = {
                id: `char_location_conflict_${charId}_${timelineId}`,
                type: "character_conflict",
                severity: "critical",
                category: "research",
                title: `Character Location Conflict: ${charId}`,
                description: `Character appears in multiple locations within the same timeline without sufficient time for travel.`,
                context: `Timeline: ${timelineInfo?.name || "Unknown Timeline"}`,
                affectedEvents: timelineEvents.map((e) => {
                  let eventLocation = e.location || "No direct location";
                  if (
                    !e.location &&
                    e.linkedLocationIds &&
                    e.linkedLocationIds.length > 0
                  ) {
                    // --- FIX: Added explicit type 'string' for 'locId' (TS7006) ---
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
                  "Verify the historical accuracy of these locations",
                  "Check if the dates allow for realistic travel time",
                  "Consider if these events should be in separate timeline branches",
                  "Research the actual historical locations for this character",
                ],
                researchNotes: `This conflict suggests either: (1) incorrect location data, (2) events that should be on different timelines, or (3) missing travel time between events. Conflicting locations: ${locationDisplayNames.join(", ")}`,
                confidence: 90,
              };

              foundIssues.push(issue);
            }
          });
        });

        allEvents.forEach((event) => {
          if (!event.date && event.importance >= 8) {
            foundIssues.push({
              id: `missing_date_${event.id}`,
              type: "missing_prerequisite",
              severity: "warning",
              category: "research",
              title: `High-Importance Event Missing Date`,
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
                "Research historical sources to establish a more precise date",
                "Consider using approximate dates (e.g., 'c. 1500 BCE')",
                "Document the uncertainty in the event notes",
              ],
              researchNotes:
                "Precise dating helps maintain timeline integrity and allows for better analysis of cause-and-effect relationships.",
              confidence: 75,
            });
          }
        });

        console.log(`\n=== ANALYSIS COMPLETE ===`);
        console.log(`Raw issues found: ${foundIssues.length}`);

        const filteredIssues = foundIssues.filter((issue) => {
          if (!showMinorIssues && issue.severity === "suggestion") return false;
          if (issue.confidence < 60) return false;
          return !ignoredIssues.has(issue.id);
        });

        console.log(`Filtered issues: ${filteredIssues.length}`);
        console.log("Issues:", filteredIssues);

        setIssues(filteredIssues);
        lastProjectVersionRef.current = projectVersion;

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
        showError(
          "Failed to analyze timeline consistency. Please check the console for details.",
        );
      } finally {
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;
      }
    }, 50);
  }, [
    project,
    ignoredIssues,
    analysisMode,
    showMinorIssues,
    showError,
    showInfo,
  ]); // Added 'project' to dependencies

  useEffect(() => {
    // --- FIX: Added checks for 'project' and 'project.timelines' before accessing 'length' (TS18048) ---
    if (
      project &&
      project.timelines &&
      project.timelines.length >= 1 &&
      !isAnalyzingRef.current
    ) {
      analyzeConsistency();
    } else if (!project?.timelines || project.timelines.length === 0) {
      setIssues([]);
    } // --- FIX: Updated dependency array for clarity ---
  }, [project, analysisMode, showMinorIssues, analyzeConsistency]);

  const handleReAnalyze = useCallback(() => {
    lastProjectVersionRef.current = "";
    analyzeConsistency();
  }, [analyzeConsistency]);

  const handleIgnoreIssue = useCallback(
    (issueId: string) => {
      setIgnoredIssues((prev) => new Set([...prev, issueId]));
      setIssues((prev) => prev.filter((issue) => issue.id !== issueId));
      setShowIssueModal(false);
      setSelectedIssue(null);
      showInfo(
        "Issue marked as resolved and will be hidden from future checks.",
      );
    },
    [showInfo],
  );

  const handleViewIssue = useCallback((issue: ConsistencyIssue) => {
    setSelectedIssue(issue);
    setShowIssueModal(true);
  }, []);

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

  const getCategoryIcon = (category: ConsistencyIssue["category"]) => {
    switch (category) {
      case "research":
        return (
          <svg
            className="h-5 w-5 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
                       {" "}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
            />
                     {" "}
          </svg>
        );
      case "logic":
        return (
          <svg
            className="h-5 w-5 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
                       {" "}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
                     {" "}
          </svg>
        );
      case "continuity":
        return (
          <svg
            className="h-5 w-5 text-purple-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
                       {" "}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
                     {" "}
          </svg>
        );
    }
  };

  if (!project || !project.timelines || project.timelines.length === 0) {
    return null;
  }

  const criticalIssues = issues.filter((i) => i.severity === "critical");
  const warningIssues = issues.filter((i) => i.severity === "warning");
  const suggestionIssues = issues.filter((i) => i.severity === "suggestion");

  return (
    <>
           {" "}
      <div
        className={`border rounded-lg p-4 mb-6 ${issues.length > 0 ? getSeverityBg(criticalIssues.length > 0 ? "critical" : warningIssues.length > 0 ? "warning" : "suggestion") : "bg-green-50 dark:bg-green-900 dark:bg-opacity-20 border-green-200 dark:border-green-800"}`}
      >
               {" "}
        <div className="flex items-start">
                   {" "}
          <div className="flex-shrink-0">{getCategoryIcon("research")}</div>   
               {" "}
          <div className="ml-3 flex-1">
                       {" "}
            <div className="flex items-center justify-between mb-2">
                           {" "}
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                Research Analysis{" "}
                {isAnalyzing ? "(Analyzing...)" : "Complete"}             {" "}
              </h3>
                           {" "}
              <div className="flex items-center space-x-2">
                               {" "}
                <select
                  value={analysisMode}
                  onChange={(e) =>
                    setAnalysisMode(e.target.value as "research" | "creative")
                  }
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                >
                                   {" "}
                  <option value="research">Research Mode</option>               
                    <option value="creative">Creative Mode</option>             
                   {" "}
                </select>
                             {" "}
              </div>
                         {" "}
            </div>
                       {" "}
            <div className="mb-3 text-sm text-gray-700 dark:text-gray-300">
                           {" "}
              <p>
                               {" "}
                {issues.length === 0 ? (
                  "✅ Analysis complete - no research inconsistencies detected"
                ) : (
                  <>
                                        🔍 Found {issues.length} potential
                    research attention point                    {" "}
                    {issues.length !== 1 ? "s" : ""}                   {" "}
                    {criticalIssues.length > 0 &&
                      ` (${criticalIssues.length} critical)`}
                                       {" "}
                    {warningIssues.length > 0 &&
                      ` (${warningIssues.length} warnings)`}
                                       {" "}
                    {suggestionIssues.length > 0 &&
                      showMinorIssues &&
                      ` (${suggestionIssues.length} suggestions)`}
                                     {" "}
                  </>
                )}
                             {" "}
              </p>
                         {" "}
            </div>
                       {" "}
            {issues.length > 0 && (
              <>
                               {" "}
                <div className="space-y-2">
                                   {" "}
                  {issues.slice(0, 3).map((issue) => (
                    <div
                      key={issue.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border"
                    >
                                           {" "}
                      <div className="flex-1">
                                               {" "}
                        <div className="flex items-center mb-1">
                                                   {" "}
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${getSeverityColor(issue.severity)}`}
                          >
                                                       {" "}
                            {issue.severity.toUpperCase()}                     
                               {" "}
                          </span>
                                                   {" "}
                          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                                        {issue.category}       
                                             {" "}
                          </span>
                                                   {" "}
                          <span className="text-xs text-gray-400 ml-2">
                                                        {issue.confidence}%
                            confidence                          {" "}
                          </span>
                                                 {" "}
                        </div>
                                               {" "}
                        <span className="font-medium text-sm">
                                                    {issue.title}               
                                 {" "}
                        </span>
                                               {" "}
                        <p className="text-xs text-gray-500 mt-1">
                                                   {" "}
                          {issue.affectedEvents.length} events • {issue.context}
                                                 {" "}
                        </p>
                                             {" "}
                      </div>
                                           {" "}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewIssue(issue)}
                      >
                                                Investigate                    
                         {" "}
                      </Button>
                                         {" "}
                    </div>
                  ))}
                                   {" "}
                  {issues.length > 3 && (
                    <p className="text-xs text-gray-500 mt-2">
                                            ...and {issues.length - 3} more
                      research points                    {" "}
                    </p>
                  )}
                                 {" "}
                </div>
                             {" "}
              </>
            )}
                       {" "}
            <div className="mt-4 flex space-x-2">
                           {" "}
              {issues.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleViewIssue(issues[0])}
                  disabled={isAnalyzing}
                >
                                    Review Research Points                {" "}
                </Button>
              )}
                           {" "}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReAnalyze}
                disabled={isAnalyzing}
                isLoading={isAnalyzing}
              >
                                Re-analyze              {" "}
              </Button>
                         {" "}
            </div>
                     {" "}
          </div>
                 {" "}
        </div>
             {" "}
      </div>
           {" "}
      <Modal
        isOpen={showIssueModal}
        onClose={() => {
          setShowIssueModal(false);
          setSelectedIssue(null);
        }}
        title="Research Analysis Point"
        size="lg"
      >
               {" "}
        {selectedIssue && (
          <div className="space-y-6">
                       {" "}
            <div>
                           {" "}
              <div className="flex items-center mb-2">
                               {" "}
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 ${getSeverityColor(selectedIssue.severity)}`}
                >
                                    {selectedIssue.severity.toUpperCase()}     
                           {" "}
                </span>
                               {" "}
                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded mr-2">
                                    {selectedIssue.category}               {" "}
                </span>
                               {" "}
                <span className="text-xs text-gray-400">
                                    {selectedIssue.confidence}% confidence      
                           {" "}
                </span>
                             {" "}
              </div>
                           {" "}
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                {selectedIssue.title}             {" "}
              </h4>
                           {" "}
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                                {selectedIssue.description}             {" "}
              </p>
                           {" "}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                                <strong>Context:</strong>{" "}
                {selectedIssue.context}             {" "}
              </p>
                         {" "}
            </div>
                       {" "}
            <div>
                           {" "}
              <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                                Affected Events:              {" "}
              </h5>
                           {" "}
              <div className="space-y-3">
                               {" "}
                {selectedIssue.affectedEvents.map((event, index) => (
                  <div
                    key={`${event.eventId}-${index}`}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded border"
                  >
                                       {" "}
                    <div className="flex justify-between items-start mb-2">
                                           {" "}
                      <span className="font-medium text-sm">
                                                {event.timelineName}           
                                 {" "}
                      </span>
                                           {" "}
                      <span className="text-xs text-gray-500">
                                                {event.date}                   
                         {" "}
                      </span>
                                         {" "}
                    </div>
                                       {" "}
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                            {event.eventTitle}                 
                       {" "}
                    </p>
                                       {" "}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            <strong>Location:</strong>{" "}
                      {event.conflictingValue}                   {" "}
                    </p>
                                       {" "}
                    {/* **FIXED**: Button to review a specific event */}       
                               {" "}
                    <div className="mt-3 text-right">
                                           {" "}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onReviewEvent({
                            eventId: event.eventId,
                            timelineId: event.timelineId,
                          });
                          setShowIssueModal(false);
                        }}
                      >
                                                Review Event                    
                         {" "}
                      </Button>
                                         {" "}
                    </div>
                                     {" "}
                  </div>
                ))}
                             {" "}
              </div>
                         {" "}
            </div>
                       {" "}
            {selectedIssue.suggestions && (
              <div>
                               {" "}
                <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                    Research Suggestions:                {" "}
                </h5>
                               {" "}
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                   {" "}
                  {selectedIssue.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                                 {" "}
                </ul>
                             {" "}
              </div>
            )}
                       {" "}
            {selectedIssue.researchNotes && (
              <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border border-blue-200 dark:border-blue-800 rounded p-3">
                               {" "}
                <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                                    Research Notes:                {" "}
                </h5>
                               {" "}
                <p className="text-sm text-blue-800 dark:text-blue-200">
                                    {selectedIssue.researchNotes}             
                   {" "}
                </p>
                             {" "}
              </div>
            )}
                       {" "}
            {/* **FIXED**: Updated modal footer with functional buttons */}     
                 {" "}
            <div className="flex justify-between items-center pt-5 border-t dark:border-gray-600">
                           {" "}
              <Button
                variant="outline"
                onClick={() => handleIgnoreIssue(selectedIssue.id)}
              >
                                Mark as Resolved              {" "}
              </Button>
                           {" "}
              <div className="space-x-3">
                               {" "}
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowIssueModal(false);
                    setSelectedIssue(null);
                  }}
                >
                                    Close                {" "}
                </Button>
                               {" "}
                {selectedIssue.affectedEvents.length > 0 && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      const firstEvent = selectedIssue.affectedEvents[0];
                      if (firstEvent) {
                        onReviewEvent({
                          eventId: firstEvent.eventId,
                          timelineId: firstEvent.timelineId,
                        });
                        setShowIssueModal(false);
                      }
                    }}
                  >
                                        Review First Event                
                     {" "}
                  </Button>
                )}
                             {" "}
              </div>
                         {" "}
            </div>
                     {" "}
          </div>
        )}
             {" "}
      </Modal>
         {" "}
    </>
  );
};

export default TimelineConsistencyChecker;
