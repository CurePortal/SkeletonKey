import { useState, useCallback } from "react";
import { TimelineType } from "../types";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import { useAppState } from "../contexts/AppStateContext";

export const useTimelineImport = () => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const { project, addTimeline } = useProjectData();
  const { showSuccess, showError } = useNotification();
  const { setCurrentTimelineId } = useAppState();

  const openImportModal = useCallback(() => {
    setIsImportModalOpen(true);
  }, []);

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false);
  }, []);

  const handleImportTimelines = useCallback(
    async (timelines: TimelineType[]) => {
      setIsImporting(true);

      try {
        // Import timelines in the correct order: main timelines first, then branch timelines
        const mainTimelines = timelines.filter((t) => t.isMainTimeline);
        const branchTimelines = timelines.filter((t) => !t.isMainTimeline);

        // Import main timelines first
        for (const timeline of mainTimelines) {
          await addTimeline(timeline);
        }

        // Then import branch timelines (they may depend on main timelines)
        for (const timeline of branchTimelines) {
          await addTimeline(timeline);
        }

        showSuccess(
          `Successfully imported ${timelines.length} timeline${timelines.length > 1 ? "s" : ""}`,
          {
            title: "Import Successful",
            duration: 5000,
          },
        );

        // If there's exactly one main timeline imported, select it
        if (mainTimelines.length === 1) {
          setCurrentTimelineId(mainTimelines[0].id);
        }

        setIsImportModalOpen(false);
      } catch (error) {
        console.error("Error importing timelines:", error);
        showError(
          `Failed to import timelines: ${error instanceof Error ? error.message : "Unknown error"}`,
          {
            title: "Import Failed",
            duration: 8000,
          },
        );
      } finally {
        setIsImporting(false);
      }
    },
    [addTimeline, showSuccess, showError, setCurrentTimelineId],
  );

  return {
    isImportModalOpen,
    isImporting,
    openImportModal,
    closeImportModal,
    handleImportTimelines,
    currentProject: project,
  };
};
