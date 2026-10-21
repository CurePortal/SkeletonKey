/**
 * Utility functions for managing timeline branch relationships and validation
 */

import { TimelineType, EventType, ID } from "../types";

export interface TimelineBranchInfo {
  timeline: TimelineType;
  level: number;
  branchIndex: number;
  parentEvent?: EventType;
  childTimelines: TimelineType[];
  isOrphan: boolean;
}

export interface BranchValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Calculate the hierarchical structure of timelines with branch information
 */
export function calculateTimelineHierarchy(
  timelines: TimelineType[],
): Map<ID, TimelineBranchInfo> {
  const hierarchy = new Map<ID, TimelineBranchInfo>();
  const processedTimelines = new Set<ID>();

  // First pass: Create basic entries for all timelines
  timelines.forEach((timeline) => {
    hierarchy.set(timeline.id, {
      timeline,
      level: 0,
      branchIndex: 0,
      childTimelines: [],
      isOrphan: false,
    });
  });

  // Second pass: Build parent-child relationships
  timelines.forEach((timeline) => {
    const info = hierarchy.get(timeline.id)!;

    // Find children
    const children = timelines.filter(
      (t) => t.parentTimelineId === timeline.id,
    );
    info.childTimelines = children;

    // Find parent event if this is a branch timeline
    if (timeline.parentTimelineId && timeline.branchFromEventId) {
      const parentTimeline = timelines.find(
        (t) => t.id === timeline.parentTimelineId,
      );
      if (parentTimeline) {
        const parentEvent = parentTimeline.events?.find(
          (e) => e.id === timeline.branchFromEventId,
        );
        info.parentEvent = parentEvent;
      }
    }
  });

  // Third pass: Calculate levels and branch indices
  const calculateLevel = (timelineId: ID, currentLevel: number = 0): void => {
    if (processedTimelines.has(timelineId)) return;

    processedTimelines.add(timelineId);
    const info = hierarchy.get(timelineId)!;
    info.level = currentLevel;

    // Calculate branch index among siblings
    if (info.timeline.parentTimelineId) {
      const siblings = timelines.filter(
        (t) => t.parentTimelineId === info.timeline.parentTimelineId,
      );
      // Sort siblings by their branch creation order or date
      siblings.sort((a, b) => {
        if (a.startDate && b.startDate) {
          return (
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );
        }
        return a.name.localeCompare(b.name);
      });
      info.branchIndex = siblings.findIndex((t) => t.id === timelineId);
    }

    // Process children
    info.childTimelines.forEach((child) => {
      calculateLevel(child.id, currentLevel + 1);
    });
  };

  // Start with main timelines (no parent)
  const mainTimelines = timelines.filter((t) => !t.parentTimelineId);
  mainTimelines.forEach((timeline) => {
    calculateLevel(timeline.id, 0);
  });

  // Mark orphaned timelines
  timelines.forEach((timeline) => {
    if (timeline.parentTimelineId && !processedTimelines.has(timeline.id)) {
      const info = hierarchy.get(timeline.id)!;
      info.isOrphan = true;
      info.level = -1; // Mark as orphaned
    }
  });

  return hierarchy;
}

/**
 * Validate timeline branch relationships
 */
export function validateTimelineRelationships(
  timelines: TimelineType[],
): BranchValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Check for circular references
  const checkCircularReference = (
    timelineId: ID,
    visited: Set<ID> = new Set(),
  ): boolean => {
    if (visited.has(timelineId)) return true;

    visited.add(timelineId);
    const timeline = timelines.find((t) => t.id === timelineId);

    if (timeline?.parentTimelineId) {
      return checkCircularReference(timeline.parentTimelineId, visited);
    }

    return false;
  };

  timelines.forEach((timeline) => {
    // Check for circular references
    if (checkCircularReference(timeline.id)) {
      errors.push(
        `Circular reference detected in timeline "${timeline.name}" (${timeline.id})`,
      );
    }

    // Check branch timeline validity
    if (timeline.parentTimelineId) {
      const parentTimeline = timelines.find(
        (t) => t.id === timeline.parentTimelineId,
      );

      if (!parentTimeline) {
        errors.push(
          `Branch timeline "${timeline.name}" references non-existent parent timeline ${timeline.parentTimelineId}`,
        );
      } else {
        // Check if branch event exists
        if (timeline.branchFromEventId) {
          const branchEvent = parentTimeline.events?.find(
            (e) => e.id === timeline.branchFromEventId,
          );

          if (!branchEvent) {
            errors.push(
              `Branch timeline "${timeline.name}" references non-existent event ${timeline.branchFromEventId} in parent timeline "${parentTimeline.name}"`,
            );
          } else if (!branchEvent.isPointOfDivergence) {
            warnings.push(
              `Event "${branchEvent.title}" in timeline "${parentTimeline.name}" should be marked as a point of divergence for branch "${timeline.name}"`,
            );
          }
        } else {
          warnings.push(
            `Branch timeline "${timeline.name}" is missing branchFromEventId reference`,
          );
        }
      }
    }

    // Check for duplicate names at the same level
    const siblings = timelines.filter(
      (t) =>
        t.parentTimelineId === timeline.parentTimelineId &&
        t.id !== timeline.id,
    );
    const duplicateName = siblings.find((t) => t.name === timeline.name);
    if (duplicateName) {
      warnings.push(
        `Timeline "${timeline.name}" has a duplicate name with sibling timeline ${duplicateName.id}`,
      );
    }

    // Check for missing events in branch timelines
    if (
      timeline.parentTimelineId &&
      (!timeline.events || timeline.events.length === 0)
    ) {
      suggestions.push(
        `Branch timeline "${timeline.name}" has no events. Consider adding events to develop this branch.`,
      );
    }
  });

  // Check for orphaned point of divergence events
  timelines.forEach((timeline) => {
    timeline.events?.forEach((event) => {
      if (event.isPointOfDivergence) {
        const branchesFromThisEvent = timelines.filter(
          (t) => t.branchFromEventId === event.id,
        );
        if (branchesFromThisEvent.length === 0) {
          suggestions.push(
            `Event "${event.title}" in timeline "${timeline.name}" is marked as a point of divergence but has no branch timelines. Consider creating a branch or removing the divergence flag.`,
          );
        }
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

/**
 * Repair timeline relationships by fixing common issues
 */
export function repairTimelineRelationships(
  timelines: TimelineType[],
): TimelineType[] {
  const repairedTimelines = [...timelines];

  repairedTimelines.forEach((timeline, index) => {
    // Fix branch timelines missing branchFromEventId
    if (timeline.parentTimelineId && !timeline.branchFromEventId) {
      const parentTimeline = repairedTimelines.find(
        (t) => t.id === timeline.parentTimelineId,
      );

      if (parentTimeline) {
        // Find the first point of divergence event in the parent
        const divergenceEvent = parentTimeline.events?.find(
          (e) => e.isPointOfDivergence,
        );

        if (divergenceEvent) {
          repairedTimelines[index] = {
            ...timeline,
            branchFromEventId: divergenceEvent.id,
          };
        }
      }
    }

    // Mark events as points of divergence if they have branches
    timeline.events?.forEach((event, eventIndex) => {
      const branchesFromThisEvent = repairedTimelines.filter(
        (t) => t.branchFromEventId === event.id,
      );

      if (branchesFromThisEvent.length > 0 && !event.isPointOfDivergence) {
        const timelineToUpdate = repairedTimelines.find(
          (t) => t.id === timeline.id,
        );
        if (timelineToUpdate && timelineToUpdate.events) {
          timelineToUpdate.events[eventIndex] = {
            ...event,
            isPointOfDivergence: true,
          };
        }
      }
    });
  });

  return repairedTimelines;
}

/**
 * Calculate optimal positioning for timeline branches to avoid overlaps
 */
export function calculateBranchPositions(
  timelines: TimelineType[],
  baseVerticalSpacing: number = 140,
  branchStaggerOffset: number = 40,
): Map<ID, { x: number; y: number; level: number; branchIndex: number }> {
  const positions = new Map<
    ID,
    { x: number; y: number; level: number; branchIndex: number }
  >();
  const hierarchy = calculateTimelineHierarchy(timelines);

  let currentY = 50; // Starting Y position
  const baseX = 50; // Starting X position
  const horizontalSpacing = 280; // Space between levels

  // Process main timelines first
  const mainTimelines = timelines.filter((t) => !t.parentTimelineId);

  const processTimeline = (
    timeline: TimelineType,
    x: number,
    y: number,
    level: number,
  ): number => {
    const info = hierarchy.get(timeline.id);
    if (!info) return y;

    // Set position for current timeline
    positions.set(timeline.id, {
      x,
      y,
      level,
      branchIndex: info.branchIndex,
    });

    let maxY = y;

    // Process child timelines
    if (info.childTimelines.length > 0) {
      let childY = y + baseVerticalSpacing;

      info.childTimelines.forEach((child, index) => {
        const childInfo = hierarchy.get(child.id);
        if (childInfo) {
          // Apply staggered positioning for multiple branches
          const staggeredY = childY + index * branchStaggerOffset;
          const usedY = processTimeline(
            child,
            x + horizontalSpacing,
            staggeredY,
            level + 1,
          );
          maxY = Math.max(maxY, usedY);
          childY = Math.max(childY, usedY + baseVerticalSpacing);
        }
      });
    }

    return Math.max(maxY, y);
  };

  // Process each main timeline
  mainTimelines.forEach((timeline) => {
    const usedY = processTimeline(timeline, baseX, currentY, 0);
    currentY = usedY + baseVerticalSpacing;
  });

  return positions;
}

/**
 * Find all timelines that branch from a specific event
 */
export function findBranchesFromEvent(
  timelines: TimelineType[],
  eventId: ID,
): TimelineType[] {
  return timelines.filter((timeline) => timeline.branchFromEventId === eventId);
}

/**
 * Get the full ancestry path of a timeline
 */
export function getTimelineAncestry(
  timelines: TimelineType[],
  timelineId: ID,
): TimelineType[] {
  const ancestry: TimelineType[] = [];
  let currentTimeline = timelines.find((t) => t.id === timelineId);

  while (currentTimeline) {
    ancestry.unshift(currentTimeline);

    if (currentTimeline.parentTimelineId) {
      currentTimeline = timelines.find(
        (t) => t.id === currentTimeline!.parentTimelineId,
      );
    } else {
      break;
    }
  }

  return ancestry;
}

/**
 * Get all descendants of a timeline
 */
export function getTimelineDescendants(
  timelines: TimelineType[],
  timelineId: ID,
): TimelineType[] {
  const descendants: TimelineType[] = [];
  const directChildren = timelines.filter(
    (t) => t.parentTimelineId === timelineId,
  );

  directChildren.forEach((child) => {
    descendants.push(child);
    descendants.push(...getTimelineDescendants(timelines, child.id));
  });

  return descendants;
}

/**
 * Export utility object with all functions
 */
const timelineBranchUtils = {
  calculateTimelineHierarchy,
  validateTimelineRelationships,
  repairTimelineRelationships,
  calculateBranchPositions,
  findBranchesFromEvent,
  getTimelineAncestry,
  getTimelineDescendants,
};

export default timelineBranchUtils;
