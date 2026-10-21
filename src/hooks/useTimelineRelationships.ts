import { useMemo, useCallback } from "react";
import { useProjectData } from "../contexts/ProjectDataContext";
import {
  ID,
  TimelineType,
  TimelineRelationship, // The type that needs to be resolved
} from "../types"; // Ensure this path is correct

// Enhanced version of useTimelineRelationships hook to properly handle branch relationships

const useTimelineRelationships = () => {
  const { project } = useProjectData();

  const timelineRelationships = useMemo(() => {
    if (!project) return new Map<ID, TimelineRelationship>();

    const relationships = new Map<ID, TimelineRelationship>();

    // Initialize relationships for all timelines
    project.timelines.forEach((timeline) => {
      relationships.set(timeline.id, {
        // Add the missing required properties:
        parentId: null, // Or timeline.parentTimelineId if you want to set it here initially
        childrenIds: [],
        divergenceEventId: null, // Or timeline.branchFromEventId if appropriate here

        // Your existing properties:
        parentTimeline: undefined,
        childTimelines: [], // This is good, ensures it's an array
        divergenceEvent: undefined,
      });
    });

    // Set parent-child relationships and find divergence events
    project.timelines.forEach((timeline) => {
      if (timeline.parentTimelineId) {
        const parentRelationship = relationships.get(timeline.parentTimelineId);
        const parentTimeline = project.timelines.find(
          (t) => t.id === timeline.parentTimelineId,
        );

        if (parentRelationship && parentTimeline) {
          // Add this timeline to parent's children
          parentRelationship.childTimelines.push(timeline);

          // Set parent reference in this timeline's relationship
          const timelineRelationship = relationships.get(timeline.id);
          if (timelineRelationship) {
            timelineRelationship.parentTimeline = parentTimeline;

            // Find divergence event if branchFromEventId exists
            if (timeline.branchFromEventId) {
              const divergenceEvent = parentTimeline.events.find(
                (e) => e.id === timeline.branchFromEventId,
              );

              if (divergenceEvent) {
                timelineRelationship.divergenceEvent = divergenceEvent;

                // Also update the isPointOfDivergence flag for this event if not set
                // This ensures all branch source events are properly marked
                if (!divergenceEvent.isPointOfDivergence) {
                  console.log(
                    `Fixing missing isPointOfDivergence flag for event ${divergenceEvent.id}`,
                  );
                  divergenceEvent.isPointOfDivergence = true;
                }
              } else {
                console.warn(
                  `Branch timeline ${timeline.id} references event ${timeline.branchFromEventId} ` +
                    `but event was not found in parent timeline ${parentTimeline.id}`,
                );
              }
            }
          }
        }
      }
    });

    return relationships;
  }, [project]);

  // Find all timelines that branch from a specific event
  const getBranchesFromEvent = useCallback(
    (eventId: ID): TimelineType[] => {
      const branches: TimelineType[] = [];

      if (!project) return branches;

      project.timelines.forEach((timeline) => {
        if (timeline.branchFromEventId === eventId) {
          branches.push(timeline);
        }
      });

      return branches;
    },
    [project],
  );

  // Get all timelines directly connected to this timeline (parent and children)
  const getConnectedTimelines = useCallback(
    (timelineId: ID): TimelineType[] => {
      const connected: TimelineType[] = [];

      if (!project) return connected;

      const relationship = timelineRelationships.get(timelineId);
      if (!relationship) return connected;

      if (relationship.parentTimeline) {
        connected.push(relationship.parentTimeline);
      }

      connected.push(...relationship.childTimelines);

      return connected;
    },
    [project, timelineRelationships],
  );

  return {
    timelineRelationships,
    getTimelineRelationship: (timelineId: ID) =>
      timelineRelationships.get(timelineId),
    getChildTimelines: (timelineId: ID) => {
      const relationship = timelineRelationships.get(timelineId);
      return relationship ? relationship.childTimelines : [];
    },
    getParentTimeline: (timelineId: ID) => {
      const relationship = timelineRelationships.get(timelineId);
      return relationship ? relationship.parentTimeline : undefined;
    },
    getDivergenceEvent: (timelineId: ID) => {
      const relationship = timelineRelationships.get(timelineId);
      return relationship ? relationship.divergenceEvent : undefined;
    },
    getBranchesFromEvent,
    getConnectedTimelines,
  };
};

export default useTimelineRelationships;
