import {
  TimelineType,
  EventType,
  PointOfDivergenceType,
  ID,
  AddTimelineRequest,
  UpdateTimelineRequest,
  DeleteTimelineRequest,
  AddEventRequest,
  UpdateEventRequest,
  DeleteEventRequest,
  AddPoDRequest,
  UpdatePoDRequest,
  DeletePoDRequest,
  ApiResponse,
} from "../types";
import { invokeCommand } from "./tauriUtils";
import { parseCalendarDate } from "../utils/helpers";

export async function addTimeline(
  projectId: ID,
  timeline: Omit<TimelineType, "id">,
): Promise<ApiResponse<TimelineType>> {
  const request: AddTimelineRequest = { projectId, timeline };
  return invokeCommand<TimelineType>("add_timeline_to_project", { ...request });
}

export async function updateTimeline(
  projectId: ID,
  timeline: TimelineType,
): Promise<ApiResponse<TimelineType>> {
  const request: UpdateTimelineRequest = { projectId, timeline };
  return invokeCommand<TimelineType>("update_timeline", { ...request });
}

export async function deleteTimeline(
  projectId: ID,
  timelineId: ID,
): Promise<ApiResponse<null>> {
  const request: DeleteTimelineRequest = { projectId, timelineId };
  return invokeCommand<null>("delete_timeline", { ...request });
}

export async function addEvent(
  projectId: ID,
  timelineId: ID,
  event: Omit<EventType, "id">,
): Promise<ApiResponse<EventType>> {
  const request: AddEventRequest = { projectId, timelineId, event };
  return invokeCommand<EventType>("add_event_to_timeline", { ...request });
}

export async function updateEvent(
  projectId: ID,
  timelineId: ID,
  event: EventType,
): Promise<ApiResponse<EventType>> {
  const request: UpdateEventRequest = { projectId, timelineId, event };
  return invokeCommand<EventType>("update_event", { ...request });
}

export async function deleteEvent(
  projectId: ID,
  timelineId: ID,
  eventId: ID,
): Promise<ApiResponse<null>> {
  const request: DeleteEventRequest = { projectId, timelineId, eventId };
  return invokeCommand<null>("delete_event", { ...request });
}

export async function addPointOfDivergence(
  projectId: ID,
  timelineId: ID,
  pointOfDivergence: Omit<PointOfDivergenceType, "id">,
): Promise<ApiResponse<PointOfDivergenceType>> {
  const request: AddPoDRequest = { projectId, timelineId, pointOfDivergence };
  return invokeCommand<PointOfDivergenceType>("add_pod_to_timeline", {
    ...request,
  });
}

export async function updatePointOfDivergence(
  projectId: ID,
  timelineId: ID,
  pointOfDivergence: PointOfDivergenceType,
): Promise<ApiResponse<PointOfDivergenceType>> {
  const request: UpdatePoDRequest = {
    projectId,
    timelineId,
    pointOfDivergence,
  };
  return invokeCommand<PointOfDivergenceType>("update_pod", { ...request });
}

export async function deletePointOfDivergence(
  projectId: ID,
  timelineId: ID,
  podId: ID,
): Promise<ApiResponse<null>> {
  const request: DeletePoDRequest = { projectId, timelineId, podId };
  return invokeCommand<null>("delete_pod", { ...request });
}

export async function createTimelineBranch(
  projectId: ID,
  parentTimelineId: ID,
  podId: ID,
  newTimelineName: string,
  newTimelineDescription: string,
): Promise<ApiResponse<TimelineType>> {
  return invokeCommand<TimelineType>("create_timeline_branch", {
    projectId,
    parentTimelineId,
    podId,
    newTimelineName,
    newTimelineDescription,
  });
}

export async function getTimelineEvents(
  projectId: ID,
  timelineId: ID,
): Promise<ApiResponse<EventType[]>> {
  return invokeCommand<EventType[]>("get_timeline_events", {
    projectId,
    timelineId,
  });
}

export function sortEventsByDate(events: EventType[]): EventType[] {
  return [...events].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA.getTime() - dateB.getTime();
  });
}

export function groupEvents(
  events: EventType[],
  groupBy: "year" | "month" | "location" | "character" | "importance",
): Record<string, EventType[]> {
  const grouped: Record<string, EventType[]> = {};
  events.forEach((event) => {
    let key: string;
    switch (groupBy) {
      case "year":
        key = parseCalendarDate(event.date).getFullYear().toString();
        break;
      case "month":
        const date = parseCalendarDate(event.date);
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        break;
      case "location":
        key = event.linkedLocationIds.join(",") || "Unknown";
        break;
      case "character":
        key = event.linkedCharacterIds.join(",") || "Unknown";
        break;
      case "importance":
        key = event.importance.toString();
        break;
      default:
        key = "Other";
    }
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(event);
  });
  return grouped;
}
