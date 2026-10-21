// src/hooks/useTimelineEditor.ts
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  NodeChange,
} from "reactflow";
import { v4 as uuidv4 } from "uuid";
import { compressedStorage } from "../services/compressedStorageService";

import { useProjectData } from "../contexts/ProjectDataContext";
import { useAppState } from "../contexts/AppStateContext";
import { useNotification } from "../contexts/NotificationContext";

import { TimelineType, EventType, ID } from "../types";
import {
  EVENT_NODE_WIDTH,
  HORIZONTAL_SPACING_EVENT,
  TIMELINE_VERTICAL_SPACING,
  TIMELINE_INITIAL_Y,
  TIMELINE_INITIAL_X,
  eventIcons,
} from "../utils/timelineConstants";
import {
  getRandomColor,
  parseCalendarDate,
  toCalendarDateString,
} from "../utils/helpers";

// Tauri specific imports
let tauriDialog: any = null;
let tauriFsPath: any = null;
let tauriInvoke: any = null;

if (typeof window !== "undefined" && (window as any).__TAURI__) {
  import("@tauri-apps/plugin-dialog").then((mod) => (tauriDialog = mod));
  import("@tauri-apps/api/path").then((mod) => (tauriFsPath = mod));
  import("@tauri-apps/api/tauri").then((mod) => (tauriInvoke = mod.invoke));
}

interface AppStateHookValue {
  appState: {
    currentTimelineId: ID | null;
    sidebarOpen: boolean;
    viewMode: string;
    modalToOpen?: string | null;
  };
  setCurrentTimelineId: (id: ID | null) => void;
  openModal: (modalName: string) => void;
  clearModalRequest?: () => void;
  pendingEventToOpen: any | null;
  setPendingEventToOpen: (event: any | null) => void;
  clearPendingEventToOpen: () => void;
}

export const useTimelineEditor = () => {
  const {
    project,
    setProject,
    addTimeline: contextAddTimeline,
    updateTimeline: contextUpdateTimeline,
    addEvent: contextAddEvent,
    updateEvent: contextUpdateEvent,
    deleteEvent: contextDeleteEvent,
  } = useProjectData();

  const {
    appState: rawAppState,
    setCurrentTimelineId: setGlobalCurrentTimelineId,
    clearModalRequest,
    pendingEventToOpen,
    clearPendingEventToOpen,
  } = useAppState() as AppStateHookValue;

  const { showSuccess, showError } = useNotification();

  const [currentTimelineId, setCurrentTimelineIdLocal] = useState<ID | null>(
    rawAppState.currentTimelineId,
  );

  const [newEventTemplate, setNewEventTemplate] = useState<Omit<
    EventType,
    "id"
  > | null>(null);

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [selectedTimelineForEditing, setSelectedTimelineForEditing] =
    useState<TimelineType | null>(null);
  const [isPoDModalOpen, setIsPoDModalOpen] = useState(false);

  const [nodes, setNodesReactFlow, onNodesChangeReactFlow] = useNodesState([]);
  const [edges, setEdgesReactFlow, onEdgesChangeReactFlow] = useEdgesState([]);

  const currentTimeline = useMemo(() => {
    return currentTimelineId && project?.timelines
      ? project.timelines.find((tl) => tl.id === currentTimelineId)
      : undefined;
  }, [currentTimelineId, project?.timelines]);

  // --- Action Handlers ---

  const handleTimelineSelect = useCallback(
    (timelineId: ID) => {
      setGlobalCurrentTimelineId(timelineId);
    },
    [setGlobalCurrentTimelineId],
  );

  const handleAddTimelineClick = useCallback(() => {
    setSelectedTimelineForEditing(null);
    setIsTimelineModalOpen(true);
  }, []);

  const handleEditTimelineClick = useCallback(() => {
    if (currentTimeline) {
      setSelectedTimelineForEditing(currentTimeline);
      setIsTimelineModalOpen(true);
    } else {
      showError("No timeline selected to edit.");
    }
  }, [currentTimeline, showError]);

  const handleSaveTimeline = useCallback(
    (timelineData: TimelineType | Omit<TimelineType, "id">) => {
      if (!project) {
        showError("Project data is not available.");
        return;
      }
      setIsLoading(true);
      try {
        if (!("id" in timelineData)) {
          const newTimelineData = {
            ...timelineData,
            startDate: timelineData.startDate || new Date().toISOString(),
            endDate: timelineData.endDate || new Date().toISOString(),
            events: [],
            pointsOfDivergence: [],
            isMainTimeline: project.timelines.length === 0,
            parentTimelineId: null,
            color: timelineData.color || getRandomColor(),
            tags: timelineData.tags || [],
          };
          contextAddTimeline(newTimelineData as Omit<TimelineType, "id">);
          showSuccess(`Timeline "${timelineData.name}" created.`);
        } else {
          contextUpdateTimeline(timelineData as TimelineType);
          showSuccess(`Timeline "${timelineData.name}" updated.`);
        }
        setIsTimelineModalOpen(false);
        setSelectedTimelineForEditing(null);
      } catch (e) {
        showError(
          `Error saving timeline: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      project,
      contextAddTimeline,
      contextUpdateTimeline,
      showError,
      showSuccess,
    ],
  );

  const handleAddEventClick = useCallback(
    (specificTimelineId?: ID) => {
      const timelineIdToUse = specificTimelineId || currentTimelineId;

      if (!timelineIdToUse) {
        showError(
          "Please select a timeline first or provide a target timeline.",
        );
        return;
      }

      setSelectedEvent(null);
      setNewEventTemplate({
        timelineId: timelineIdToUse,
        title: "New Event",
        description: "",
        date: new Date().toISOString(),
        endDate: null,
        importance: 5,
        iconId: "default",
        isPointOfDivergence: false,
        causes: [],
        effects: [],
        linkedCharacterIds: [],
        linkedLocationIds: [],
        linkedTechnologyIds: [],
        linkedCultureIds: [],
        linkedSourceDocumentIds: [],
        linkedNarrativeIds: [],
        notes: "",
        tags: [],
      });
      setIsEventModalOpen(true);
    },
    [currentTimelineId, showError],
  );

  const handleAddPreviousEvent = useCallback(
    (sourceEvent: EventType) => {
      if (!currentTimelineId) {
        showError("No timeline selected.");
        return;
      }
      const previousDate = parseCalendarDate(sourceEvent.date);
      previousDate.setDate(previousDate.getDate() - 1);
      setNewEventTemplate({
        timelineId: currentTimelineId,
        title: `Before: ${sourceEvent.title}`,
        description: "",
        date: toCalendarDateString(previousDate),
        endDate: null,
        importance: sourceEvent.importance,
        iconId: sourceEvent.iconId,
        isPointOfDivergence: false,
        causes: [],
        effects: [sourceEvent.id],
        linkedCharacterIds: [],
        linkedLocationIds: [],
        linkedTechnologyIds: [],
        linkedCultureIds: [],
        linkedSourceDocumentIds: [],
        linkedNarrativeIds: [],
        notes: "",
        tags: [],
      });
      setSelectedEvent(null);
      setIsEventModalOpen(true);
    },
    [currentTimelineId, showError],
  );

  const handleAddNextEvent = useCallback(
    (sourceEvent: EventType) => {
      if (!currentTimelineId) {
        showError("No timeline selected.");
        return;
      }
      const nextDate = parseCalendarDate(sourceEvent.date);
      nextDate.setDate(nextDate.getDate() + 1);
      setNewEventTemplate({
        timelineId: currentTimelineId,
        title: `After: ${sourceEvent.title}`,
        description: "",
        date: toCalendarDateString(nextDate),
        endDate: null,
        importance: sourceEvent.importance,
        iconId: sourceEvent.iconId,
        isPointOfDivergence: false,
        causes: [sourceEvent.id],
        effects: [],
        linkedCharacterIds: [],
        linkedLocationIds: [],
        linkedTechnologyIds: [],
        linkedCultureIds: [],
        linkedSourceDocumentIds: [],
        linkedNarrativeIds: [],
        notes: "",
        tags: [],
      });
      setSelectedEvent(null);
      setIsEventModalOpen(true);
    },
    [currentTimelineId, showError],
  );

  const handleSaveEvent = useCallback(
    (eventDataPayload: Omit<EventType, "id"> | EventType) => {
      const targetTimelineId =
        "timelineId" in eventDataPayload && eventDataPayload.timelineId
          ? eventDataPayload.timelineId
          : newEventTemplate?.timelineId || currentTimelineId;

      if (!targetTimelineId) {
        showError("Target timeline ID is missing for the event.");
        return;
      }
      setIsLoading(true);
      try {
        if ("id" in eventDataPayload && eventDataPayload.id) {
          contextUpdateEvent(targetTimelineId, eventDataPayload as EventType);
          showSuccess(`Event "${eventDataPayload.title}" updated.`);
        } else {
          contextAddEvent(
            targetTimelineId,
            eventDataPayload as Omit<EventType, "id">,
          );
          showSuccess(`Event "${eventDataPayload.title}" added.`);
        }
        setIsEventModalOpen(false);
        setSelectedEvent(null);
        setNewEventTemplate(null);
      } catch (e) {
        showError(
          `Error saving event: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      newEventTemplate,
      currentTimelineId,
      contextUpdateEvent,
      contextAddEvent,
      showError,
      showSuccess,
    ],
  );

  const handleDeleteEventClick = useCallback((event: EventType) => {
    setSelectedEvent(event);
    setIsDeleteModalOpen(true);
  }, []);

  const handleConfirmDeleteEvent = useCallback(() => {
    if (!selectedEvent || !selectedEvent.timelineId) {
      showError("No event selected or event is missing timeline ID.");
      setIsDeleteModalOpen(false);
      return;
    }
    const {
      id: eventIdToDelete,
      timelineId: targetTimelineId,
      title: eventTitle,
    } = selectedEvent;
    setIsLoading(true);
    try {
      contextDeleteEvent(targetTimelineId, eventIdToDelete);
      showSuccess(`Event "${eventTitle}" deleted.`);
      setIsDeleteModalOpen(false);
      setIsEventModalOpen(false);
      setSelectedEvent(null);
    } catch (e) {
      showError(
        `Error deleting event: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedEvent, contextDeleteEvent, showError, showSuccess]);

  const handleBranchFromEventClick = useCallback((event: EventType) => {
    setSelectedEvent(event);
    setIsPoDModalOpen(true);
    setIsEventModalOpen(false);
  }, []);

  const handleCreateBranchFromEvent = useCallback(
    (newTimelineName: string, newTimelineDescription: string) => {
      if (!selectedEvent || !selectedEvent.timelineId || !project) {
        showError("Source event or timeline is missing for branching.");
        return;
      }
      const parentTimeline = project.timelines.find(
        (tl) => tl.id === selectedEvent.timelineId,
      );
      if (!parentTimeline) {
        showError("Parent timeline not found.");
        return;
      }

      setIsLoading(true);
      try {
        const updatedSourceEvent = {
          ...selectedEvent,
          isPointOfDivergence: true,
        };
        contextUpdateEvent(parentTimeline.id, updatedSourceEvent);

        const newTimelineId = uuidv4();

        const newBranchTimeline: Omit<TimelineType, "id"> = {
          name: newTimelineName,
          description: newTimelineDescription,
          startDate: updatedSourceEvent.date,
          endDate: parentTimeline.endDate,
          events: [],
          pointsOfDivergence: [],
          isMainTimeline: false,
          parentTimelineId: parentTimeline.id,
          branchFromEventId: selectedEvent.id,
          color: getRandomColor(parentTimeline.color),
          tags: ["branch", ...(parentTimeline.tags || [])],
        };

        contextAddTimeline(newBranchTimeline);
        setGlobalCurrentTimelineId(newTimelineId);
        showSuccess(
          `Empty branch timeline "${newTimelineName}" created. This timeline starts from the divergence point and is ready for you to add new events that explore this alternate path.`,
        );

        setIsPoDModalOpen(false);
        setIsEventModalOpen(false);
        setSelectedEvent(null);
      } catch (e) {
        showError(
          `Error creating branch: ${e instanceof Error ? e.message : String(e)}`,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      selectedEvent,
      project,
      showError,
      contextUpdateEvent,
      contextAddTimeline,
      setGlobalCurrentTimelineId,
      showSuccess,
    ],
  );

  const handleNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChangeReactFlow(changes);
      changes.forEach((change) => {
        if (
          change.type === "position" &&
          change.dragging === false &&
          change.position &&
          project &&
          change.id
        ) {
          const nodeId = change.id;
          const newPosition = change.position;
          let projectDataWasModified = false;
          const newTimelines = project.timelines.map((timeline) => {
            const eventIndex = timeline.events.findIndex(
              (e) => e.id.toString() === nodeId,
            );
            if (eventIndex !== -1) {
              const eventToUpdate = timeline.events[eventIndex];
              if (
                eventToUpdate.position?.x !== newPosition.x ||
                eventToUpdate.position?.y !== newPosition.y
              ) {
                const updatedEvents = [...timeline.events];
                updatedEvents[eventIndex] = {
                  ...eventToUpdate,
                  position: { x: newPosition.x, y: newPosition.y },
                };
                projectDataWasModified = true;
                return { ...timeline, events: updatedEvents };
              }
            }
            return timeline;
          });
          if (projectDataWasModified) {
            setProject({
              ...project,
              timelines: newTimelines,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      });
    },
    [project, setProject, onNodesChangeReactFlow],
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChangeReactFlow(changes);
    },
    [onEdgesChangeReactFlow],
  );

  // FIX: Memoize the node click handler to prevent re-renders
  const handleNodeClick = useCallback((event: EventType) => {
    setSelectedEvent(event);
    setNewEventTemplate(null);
    setIsEventModalOpen(true);
  }, []);

  // --- useEffect Hooks ---

  useEffect(() => {
    setCurrentTimelineIdLocal(rawAppState.currentTimelineId);
  }, [rawAppState.currentTimelineId]);

  useEffect(() => {
    if (
      rawAppState &&
      rawAppState.modalToOpen === "create_timeline" &&
      typeof clearModalRequest === "function"
    ) {
      handleAddTimelineClick();
      clearModalRequest();
    }
  }, [rawAppState, handleAddTimelineClick, clearModalRequest]);

  useEffect(() => {
    if (pendingEventToOpen && clearPendingEventToOpen) {
      const timeoutId = setTimeout(() => {
        setSelectedEvent(pendingEventToOpen);
        setNewEventTemplate(null);
        setIsEventModalOpen(true);
        clearPendingEventToOpen();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [pendingEventToOpen, clearPendingEventToOpen]);

  useEffect(() => {
    if (
      !currentTimelineId &&
      project?.timelines &&
      project.timelines.length > 0 &&
      project.timelines[0]?.id
    ) {
      setGlobalCurrentTimelineId(project.timelines[0].id);
    }
  }, [currentTimelineId, project?.timelines, setGlobalCurrentTimelineId]);

  useEffect(() => {
    if (!project || !project.timelines || project.timelines.length === 0) {
      setNodesReactFlow([]);
      setEdgesReactFlow([]);
      return;
    }
    const newFlowNodes: Node[] = [];
    const newFlowEdges: Edge[] = [];
    const timelineYLayout = new Map<ID, number>();
    let currentGlobalY = TIMELINE_INITIAL_Y;
    const processedTimelines = new Set<ID>();

    function assignTimelineYRecursive(
      timelineId: ID,
      yPos: number,
      level: number = 0,
    ): number {
      if (processedTimelines.has(timelineId)) return yPos;
      processedTimelines.add(timelineId);
      timelineYLayout.set(timelineId, yPos);
      let maxY = yPos;
      const children = project!.timelines
        .filter((tl) => tl.parentTimelineId === timelineId)
        .sort(
          (a, b) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
        );
      let childY = yPos + TIMELINE_VERTICAL_SPACING + level * 20;
      for (const child of children) {
        maxY = Math.max(
          maxY,
          assignTimelineYRecursive(child.id, childY, level + 1),
        );
        childY = maxY + TIMELINE_VERTICAL_SPACING + (level + 1) * 20;
      }
      return maxY;
    }

    const rootTimelines = project.timelines
      .filter((tl) => !tl.parentTimelineId)
      .sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      );
    for (const rootTl of rootTimelines) {
      currentGlobalY =
        assignTimelineYRecursive(rootTl.id, currentGlobalY) +
        TIMELINE_VERTICAL_SPACING;
    }
    project.timelines.forEach((tl) => {
      if (!timelineYLayout.has(tl.id)) {
        currentGlobalY =
          assignTimelineYRecursive(tl.id, currentGlobalY, 1) +
          TIMELINE_VERTICAL_SPACING;
      }
    });

    let minDateEpoch = Infinity;
    let maxDateEpoch = -Infinity;
    project.timelines.forEach((tl) => {
      tl.events.forEach((ev) => {
        const eventEpoch = parseCalendarDate(ev.date).getTime();
        minDateEpoch = Math.min(minDateEpoch, eventEpoch);
        maxDateEpoch = Math.max(maxDateEpoch, eventEpoch);
      });
    });
    if (minDateEpoch === Infinity) {
      minDateEpoch = new Date().getTime();
      maxDateEpoch = new Date().getTime() + 1;
    }
    const totalDuration = Math.max(1, maxDateEpoch - minDateEpoch);
    const baseViewWidth = 1200;
    const viewWidth = Math.max(
      baseViewWidth,
      project.timelines.length * 600 +
        project.timelines.reduce(
          (sum, tl) =>
            sum +
            (tl.events.length * (EVENT_NODE_WIDTH + HORIZONTAL_SPACING_EVENT)) /
              4,
          0,
        ),
    );
    const dateToX = (dateStr: string): number => {
      if (totalDuration <= 1 && minDateEpoch === maxDateEpoch)
        return TIMELINE_INITIAL_X + EVENT_NODE_WIDTH / 2;
      const eventEpoch = parseCalendarDate(dateStr).getTime();
      const relativePos = (eventEpoch - minDateEpoch) / totalDuration;
      return (
        TIMELINE_INITIAL_X +
        relativePos *
          (viewWidth -
            EVENT_NODE_WIDTH -
            TIMELINE_INITIAL_X -
            HORIZONTAL_SPACING_EVENT)
      );
    };

    project.timelines.forEach((timeline) => {
      const timelineY = timelineYLayout.get(timeline.id) || TIMELINE_INITIAL_Y;
      const sortedEvents = [...timeline.events].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
      sortedEvents.forEach((event, index) => {
        const xPosFromDate = dateToX(event.date);
        const nodePosition = event.position
          ? { x: event.position.x, y: event.position.y }
          : { x: xPosFromDate, y: timelineY };
        newFlowNodes.push({
          id: event.id.toString(),
          type: "eventNode",
          position: nodePosition,
          data: {
            event,
            timelineColor: timeline.color,
            iconData: eventIcons[event.iconId] || eventIcons["default"],
            onClick: handleNodeClick, // FIX: Use the memoized handler
            onAddPrevious: handleAddPreviousEvent,
            onAddNext: handleAddNextEvent,
          },
          draggable: true,
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          style: { zIndex: event.id === selectedEvent?.id ? 10 : 1 },
        });
        if (index > 0) {
          const prevEvent = sortedEvents[index - 1];
          newFlowEdges.push({
            id: `e-${prevEvent.id}-to-${event.id}`,
            source: prevEvent.id.toString(),
            target: event.id.toString(),
            type: "smoothstep",
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: timeline.color,
              width: 18,
              height: 18,
            },
            style: { stroke: timeline.color, strokeWidth: 2 },
            animated: timeline.id === currentTimelineId,
            zIndex: 0,
          });
        }
      });
      if (timeline.parentTimelineId && timeline.branchFromEventId) {
        const parentSourceEventId = timeline.branchFromEventId;
        const firstEventInThisBranch = sortedEvents[0];
        if (firstEventInThisBranch) {
          const parentNodeExists = project.timelines.some(
            (ptl) =>
              ptl.id === timeline.parentTimelineId &&
              ptl.events.some((e) => e.id === parentSourceEventId),
          );
          if (parentNodeExists) {
            newFlowEdges.push({
              id: `branch-${parentSourceEventId}-to-${firstEventInThisBranch.id}`,
              source: parentSourceEventId.toString(),
              target: firstEventInThisBranch.id.toString(),
              type: "smoothstep",
              label: `Branches to: ${timeline.name}`,
              labelStyle: {
                fill: timeline.color,
                fontWeight: "600",
                fontSize: "10px",
              },
              labelBgPadding: [6, 3],
              labelBgBorderRadius: 3,
              labelBgStyle: {
                fill: "var(--edge-label-bg, #ffffffcc)",
                fillOpacity: 0.8,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: timeline.color,
                width: 18,
                height: 18,
              },
              style: {
                stroke: timeline.color,
                strokeDasharray: "5 5",
                strokeWidth: 2.5,
              },
              animated: true,
              zIndex: 0,
            });
          }
        }
      }
    });
    setNodesReactFlow(newFlowNodes);
    setEdgesReactFlow(newFlowEdges);
  }, [
    project,
    currentTimelineId,
    selectedEvent,
    handleAddPreviousEvent,
    handleAddNextEvent,
    handleNodeClick, // FIX: Add dependency
    setNodesReactFlow,
    setEdgesReactFlow,
  ]);

  const lastSavedProjectJson = useRef<string | null>(null);

  // FIX: Guarded auto-save useEffect
  useEffect(() => {
    if (!project || !project.id) return;

    const currentProjectJson = JSON.stringify(project);

    if (lastSavedProjectJson.current === currentProjectJson) {
      return;
    }

    const saveTimeout = setTimeout(async () => {
      if (!project) return;

      lastSavedProjectJson.current = currentProjectJson;

      console.log("Auto-saving project on change...", project.id, project.name);
      try {
        if (
          typeof window !== "undefined" &&
          (window as any).__TAURI__ &&
          tauriInvoke &&
          tauriDialog &&
          tauriFsPath
        ) {
          const docDir = await tauriFsPath.documentDir();
          const sanitizedProjectName = project.name.replace(
            /[^a-zA-Z0-9_.-]/g,
            "_",
          );
          const filePath = await tauriFsPath.join(
            docDir,
            `${sanitizedProjectName}.ark`,
          );
          await tauriInvoke("save_project_cmd", {
            project: project,
            filePath: filePath,
          });
          showSuccess("Project auto-saved (Tauri).");
        } else {
          compressedStorage.setItem(
            `skeletonkey_project_${project.id}`,
            project,
          );
          const recentProjectsStr =
            localStorage.getItem("recentProjects") || "[]";
          let recentProjects: any[] = [];
          try {
            recentProjects = JSON.parse(recentProjectsStr);
            if (!Array.isArray(recentProjects)) recentProjects = [];
          } catch {
            recentProjects = [];
          }
          const recentProject = {
            id: project.id,
            name: project.name,
            path: `/${project.name}.ark`,
            lastAccessed: new Date().toISOString(),
          };
          const existingIndex = recentProjects.findIndex(
            (p: any) => p.id === project.id,
          );
          if (existingIndex >= 0) {
            recentProjects[existingIndex] = recentProject;
          } else {
            recentProjects.push(recentProject);
          }
          localStorage.setItem(
            "recentProjects",
            JSON.stringify(recentProjects.slice(-5)),
          );
          showSuccess("Project auto-saved (LocalStorage).");
        }
      } catch (error) {
        console.error("Error auto-saving project:", error);
        lastSavedProjectJson.current = null;
        showError(
          `Auto-save failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }, 2000);

    return () => clearTimeout(saveTimeout);
  }, [project, showSuccess, showError]);

  return {
    project,
    currentTimeline,
    currentTimelineId,
    nodes,
    edges,
    isLoading,
    isEventModalOpen,
    setIsEventModalOpen,
    selectedEvent,
    setSelectedEvent,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    isTimelineModalOpen,
    setIsTimelineModalOpen,
    selectedTimelineForEditing,
    setSelectedTimelineForEditing,
    isPoDModalOpen,
    setIsPoDModalOpen,
    newEventTemplate,
    setNewEventTemplate,
    handleTimelineSelect,
    handleAddTimelineClick,
    handleEditTimelineClick,
    handleSaveTimeline,
    handleAddEventClick,
    handleAddPreviousEvent,
    handleAddNextEvent,
    handleSaveEvent,
    handleDeleteEventClick,
    handleConfirmDeleteEvent,
    handleBranchFromEventClick,
    handleCreateBranchFromEvent,
    handleNodesChange,
    handleEdgesChange,
  };
};
