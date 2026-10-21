import { useMemo, useCallback } from "react";
import { useProjectData } from "../contexts/ProjectDataContext";
import { TimelineType, EventType, ID } from "../types";
import useTimelineRelationships from "./useTimelineRelationships";
import { v4 as uuidv4 } from "uuid";

// Utility function to generate unique colors for timelines
export const generateTimelineColor = (index: number = 0): string => {
  const colors = [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#14b8a6", // teal
    "#f97316", // orange
    "#84cc16", // lime
  ];

  return colors[index % colors.length];
};

// Interface for timeline import data
interface ImportedKnowledgeBase {
  characters: any[];
  locations: any[];
  technologies: any[];
  cultures: any[];
  sourceDocuments: any[];
}

const useTimelineManager = () => {
  const {
    project,
    addTimeline,
    updateTimeline,
    deleteTimeline,
    addEvent,
    updateEvent,
    deleteEvent,
    batchImportTimelines,
  } = useProjectData();

  const {
    getBranchesFromEvent,
  } = useTimelineRelationships();

  // Main (root) timelines are ones without a parent
  const mainTimelines = useMemo(() => {
    if (!project) return [];
    return project.timelines.filter((timeline) => !timeline.parentTimelineId);
  }, [project]);

  // Get all branch timelines
  const branchTimelines = useMemo(() => {
    if (!project) return [];
    return project.timelines.filter((timeline) => timeline.parentTimelineId);
  }, [project]);

  // Get timeline hierarchy (main timelines with their branches)
  const timelineHierarchy = useMemo(() => {
    if (!project) return [];

    return mainTimelines.map(mainTimeline => ({
      ...mainTimeline,
      branches: branchTimelines.filter(branch => branch.parentTimelineId === mainTimeline.id)
    }));
  }, [project, mainTimelines, branchTimelines]);

  // Create a new timeline
  const createTimeline = useCallback(
    (name: string, description: string = "", isMain: boolean = true) => {
      if (!project) return null;

      const colorIndex = project.timelines.length % 10;

      const newTimeline: Omit<TimelineType, "id"> = {
        name,
        description,
        isMainTimeline: isMain,
        color: generateTimelineColor(colorIndex),
        events: [],
        pointsOfDivergence: [],
        tags: [],
        startDate: "",
        endDate: "",
        parentTimelineId: null,
      };

      addTimeline(newTimeline);
      return true;
    },
    [project, addTimeline],
  );

  // Create a branch timeline from a specific event
  const createBranchTimeline = useCallback(
    (
      name: string,
      parentTimelineId: ID,
      branchFromEventId: ID,
      description: string = "",
      color?: string,
    ) => {
      if (!project) return null;

      // Get the parent timeline to verify the event belongs to it
      const parentTimeline = project.timelines.find(
        (t) => t.id === parentTimelineId,
      );
      if (!parentTimeline) return null;

      // Verify the event exists in the parent timeline
      const sourceEvent = parentTimeline.events.find(
        (e) => e.id === branchFromEventId,
      );
      if (!sourceEvent) return null;

      // Update the source event to mark it as a point of divergence if it's not already
      if (!sourceEvent.isPointOfDivergence) {
        const updatedEvent: EventType = {
          ...sourceEvent,
          isPointOfDivergence: true,
        };
        updateEvent(parentTimelineId, updatedEvent);
      }

      // Create the branch timeline
      const colorIndex = project.timelines.length % 10;

      const newTimeline: Omit<TimelineType, "id"> = {
        name,
        description,
        isMainTimeline: false,
        color: color || generateTimelineColor(colorIndex),
        parentTimelineId,
        branchFromEventId,
        events: [],
        pointsOfDivergence: [],
        tags: [],
        startDate: "",
        endDate: "",
      };

      addTimeline(newTimeline);
      return true;
    },
    [project, addTimeline, updateEvent],
  );

  // Get all branches from a specific event
  const getEventBranches = useCallback(
    (eventId: ID): TimelineType[] => {
      return getBranchesFromEvent(eventId);
    },
    [getBranchesFromEvent],
  );

  // Get the divergence point for a branch timeline
  const getTimelineDivergenceEvent = useCallback(
    (timelineId: ID): EventType | null => {
      if (!project) return null;

      const timeline = project.timelines.find((t) => t.id === timelineId);
      if (
        !timeline ||
        !timeline.parentTimelineId ||
        !timeline.branchFromEventId
      )
        return null;

      const parentTimeline = project.timelines.find(
        (t) => t.id === timeline.parentTimelineId,
      );
      if (!parentTimeline) return null;

      const divergenceEvent = parentTimeline.events.find(
        (e) => e.id === timeline.branchFromEventId,
      );
      return divergenceEvent || null;
    },
    [project],
  );

  // NEW: Import timelines with knowledge base items
  const importTimelines = useCallback(
    async (timelines: TimelineType[], knowledgeBase?: ImportedKnowledgeBase): Promise<boolean> => {
      if (!project) return false;

      try {
        // Process timelines to ensure proper relationships
        const processedTimelines = processImportedTimelines(timelines, knowledgeBase);

        // Use the batch import function
        await batchImportTimelines(processedTimelines, knowledgeBase as any);

        return true;
      } catch (error) {
        console.error("Failed to import timelines:", error);
        return false;
      }
    },
    [project, batchImportTimelines]
  );

  // NEW: Process imported timelines to maintain relationships
  const processImportedTimelines = useCallback(
    (timelines: TimelineType[], knowledgeBase?: ImportedKnowledgeBase): TimelineType[] => {
      // Create ID mappings
      const timelineIdMap = new Map<string, string>();
      const kbIdMap = new Map<string, string>();

      // Map timeline IDs
      timelines.forEach(timeline => {
        timelineIdMap.set(timeline.id, uuidv4());
      });

      // Map knowledge base IDs
      if (knowledgeBase) {
        [
          ...knowledgeBase.characters,
          ...knowledgeBase.locations,
          ...knowledgeBase.technologies,
          ...knowledgeBase.cultures,
          ...knowledgeBase.sourceDocuments
        ].forEach(item => {
          if (item.id) {
            kbIdMap.set(item.id, item.id); // Assume IDs are already processed
          }
        });
      }

      // Process each timeline
      return timelines.map(timeline => {
        const newId = timelineIdMap.get(timeline.id)!;

        // Update events with new IDs and KB references
        const updatedEvents = timeline.events.map(event => ({
          ...event,
          id: uuidv4(),
          timelineId: newId,
          // Update KB references
          linkedCharacterIds: event.linkedCharacterIds?.map(id => kbIdMap.get(id) || id) || [],
          linkedLocationIds: event.linkedLocationIds?.map(id => kbIdMap.get(id) || id) || [],
          linkedTechnologyIds: event.linkedTechnologyIds?.map(id => kbIdMap.get(id) || id) || [],
          linkedCultureIds: event.linkedCultureIds?.map(id => kbIdMap.get(id) || id) || [],
          linkedSourceDocumentIds: event.linkedSourceDocumentIds?.map(id => kbIdMap.get(id) || id) || [],
          // Clear relationships for import
          causes: [],
          effects: []
        }));

        // Update points of divergence
        const updatedPoDs = timeline.pointsOfDivergence?.map(pod => ({
          ...pod,
          id: uuidv4(),
          timelineId: newId,
          eventIds: pod.eventIds?.map(eventId => {
            const originalEvent = timeline.events.find(e => e.id === eventId);
            if (originalEvent) {
              const newEvent = updatedEvents.find(e =>
                e.title === originalEvent.title && e.date === originalEvent.date
              );
              return newEvent ? newEvent.id : eventId;
            }
            return eventId;
          }) || [],
          resultingTimelineIds: []
        })) || [];

        // Handle parent relationships
        let parentTimelineId = null;
        if (timeline.parentTimelineId) {
          // Check if parent is also being imported
          if (timelineIdMap.has(timeline.parentTimelineId)) {
            parentTimelineId = timelineIdMap.get(timeline.parentTimelineId)!;
          } else if (project?.timelines.some(t => t.id === timeline.parentTimelineId)) {
            // Parent exists in current project
            parentTimelineId = timeline.parentTimelineId;
          }
        }

        return {
          ...timeline,
          id: newId,
          events: updatedEvents,
          pointsOfDivergence: updatedPoDs,
          parentTimelineId,
          branchFromEventId: parentTimelineId ? timeline.branchFromEventId : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });
    },
    [project]
  );

  // NEW: Get timeline statistics
  const getTimelineStats = useCallback(() => {
    if (!project) return null;

    const totalEvents = project.timelines.reduce((sum, timeline) => sum + timeline.events.length, 0);
    const totalPoDs = project.timelines.reduce((sum, timeline) => sum + (timeline.pointsOfDivergence?.length || 0), 0);
    const branchCount = branchTimelines.length;
    const mainCount = mainTimelines.length;

    return {
      totalTimelines: project.timelines.length,
      mainTimelines: mainCount,
      branchTimelines: branchCount,
      totalEvents,
      totalPointsOfDivergence: totalPoDs,
      averageEventsPerTimeline: project.timelines.length > 0 ? totalEvents / project.timelines.length : 0
    };
  }, [project, mainTimelines, branchTimelines]);

  // NEW: Validate timeline relationships
  const validateTimelineRelationships = useCallback(() => {
    if (!project) return { isValid: true, issues: [] };

    const issues: string[] = [];

    project.timelines.forEach(timeline => {
      // Check parent relationships
      if (timeline.parentTimelineId) {
        const parent = project.timelines.find(t => t.id === timeline.parentTimelineId);
        if (!parent) {
          issues.push(`Timeline "${timeline.name}" references non-existent parent timeline`);
        }
      }

      // Check branch event relationships
      if (timeline.branchFromEventId && timeline.parentTimelineId) {
        const parent = project.timelines.find(t => t.id === timeline.parentTimelineId);
        if (parent) {
          const branchEvent = parent.events.find(e => e.id === timeline.branchFromEventId);
          if (!branchEvent) {
            issues.push(`Timeline "${timeline.name}" branches from non-existent event`);
          }
        }
      }

      // Check knowledge base references in events
      timeline.events.forEach(event => {
        // Check character references
        event.linkedCharacterIds?.forEach(charId => {
          if (!project.characters.some(c => c.id === charId)) {
            issues.push(`Event "${event.title}" references non-existent character`);
          }
        });

        // Check location references
        event.linkedLocationIds?.forEach(locId => {
          if (!project.locations.some(l => l.id === locId)) {
            issues.push(`Event "${event.title}" references non-existent location`);
          }
        });

        // Similar checks for other KB items...
      });
    });

    return {
      isValid: issues.length === 0,
      issues
    };
  }, [project]);

  return {
    // Existing functions
    mainTimelines,
    branchTimelines,
    timelineHierarchy,
    createTimeline,
    createBranchTimeline,
    getEventBranches,
    getTimelineDivergenceEvent,

    // New import-related functions
    importTimelines,
    processImportedTimelines,
    getTimelineStats,
    validateTimelineRelationships,

    // Expose CRUD operations
    updateTimeline,
    deleteTimeline,
    addEvent,
    updateEvent,
    deleteEvent,
  };
};

export default useTimelineManager;
