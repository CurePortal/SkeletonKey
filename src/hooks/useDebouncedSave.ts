// src/hooks/useDebouncedSave.ts
import { useEffect, useRef, useState } from "react";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useAppState } from "../contexts/AppStateContext";
import { compressedStorage } from "../services/compressedStorageService"; // Import compressed storage

/**
 * Custom hook for auto-saving a project after changes.
 * Automatically detects whether to save to file (desktop) or localStorage (browser).
 * Uses the autoSaveDelay setting from AppStateContext.
 * Now includes compression for large projects.
 *
 * @param enabled Whether auto-save is enabled (defaults to true).
 */
function useDebouncedSave(enabled: boolean = true) {
  const {
    project,
    hasUnsavedChanges,
    isFileBasedProject,
    currentFilePath,
    isAutoSaveEnabled,
    markSaved,
  } = useProjectData();
  const { appState } = useAppState();
  const delay = appState.autoSaveDelay;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSaving = useRef<boolean>(false);
  const [isPendingSave, setIsPendingSave] = useState(false);

  useEffect(() => {
    // Clear existing timer if conditions are not met
    if (!enabled || !hasUnsavedChanges || !project || !isAutoSaveEnabled) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setIsPendingSave(false);
      return;
    }

    // Don't start new timer if already auto-saving
    if (isAutoSaving.current) {
      return;
    }

    // Clear existing timer before setting new one
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    setIsPendingSave(true);
    timerRef.current = setTimeout(async () => {
      if (project && !isAutoSaving.current) {
        isAutoSaving.current = true;

        try {
          if (isFileBasedProject && currentFilePath) {
            // Desktop mode - save directly to file
            console.log(`Auto-saving to file: ${currentFilePath}`);

            const { saveProjectToFileSystem } = await import(
              "../services/projectFileSystem"
            );
            await saveProjectToFileSystem(project, currentFilePath);

            console.log("Auto-save to file completed successfully");
          } else {
            // Browser mode - save to localStorage with compression
            console.log(
              `Auto-saving to localStorage with compression: skeletonkey_project_${project.id}`,
            );

            // Use compressed storage instead of direct localStorage
            compressedStorage.setItem(
              `skeletonkey_project_${project.id}`,
              project,
            );

            // Update recent projects (can still use regular localStorage for small metadata)
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
              path: currentFilePath || `/${project.name}.ark`,
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

            console.log(
              "Auto-save to localStorage with compression completed successfully",
            );

            // Log storage statistics after save
            const stats = compressedStorage.getStorageStats();
            console.log(
              `Storage stats - Used: ${stats.used}, Available: ${stats.available}`,
            );
          }
          markSaved();
        } catch (error) {
          console.error("Auto-save failed:", error);

          // If it's a quota error, the compressed storage service will handle cleanup
          if (
            error instanceof DOMException &&
            error.name === "QuotaExceededError"
          ) {
            console.error(
              "Storage quota exceeded even after compression. Old projects may have been removed.",
            );
          }
        } finally {
          isAutoSaving.current = false;
          setIsPendingSave(false);
        }
      }
    }, delay);

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    enabled,
    hasUnsavedChanges,
    project,
    isAutoSaveEnabled,
    isFileBasedProject,
    currentFilePath,
    delay,
    markSaved,
  ]);

  /**
   * Cancel any pending auto-save operation
   */
  const cancelPendingSave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  /**
   * Immediately save the project, respecting the current save mode
   */
  const saveImmediately = async (): Promise<boolean> => {
    // Cancel any pending auto-save
    cancelPendingSave();

    if (!project) {
      return false;
    }

    // Prevent concurrent saves
    if (isAutoSaving.current) {
      console.log("Save already in progress, skipping immediate save");
      return false;
    }

    isAutoSaving.current = true;

    try {
      if (isFileBasedProject && currentFilePath) {
        // Desktop mode - save directly to file
        console.log(`Immediately saving to file: ${currentFilePath}`);

        const { saveProjectToFileSystem } = await import(
          "../services/projectFileSystem"
        );
        await saveProjectToFileSystem(project, currentFilePath);

        console.log("Immediate save to file completed successfully");
        markSaved();
        return true;
      } else {
        // Browser mode or new project - use compressed storage
        console.log(
          `Immediately saving to localStorage with compression: skeletonkey_project_${project.id}`,
        );

        // Use compressed storage
        compressedStorage.setItem(`skeletonkey_project_${project.id}`, project);

        // Update recent projects
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
          path: currentFilePath || `/${project.name}.ark`,
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

        console.log(
          "Immediate save to localStorage with compression completed successfully",
        );
        markSaved();
        return true;
      }
    } catch (error) {
      console.error("Immediate save failed:", error);

      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        console.error("Storage quota exceeded even after compression.");
        // The compressed storage service will have already tried to clean up
      }

      return false;
    } finally {
      isAutoSaving.current = false;
    }
  };

  return {
    isPendingSave,
    isAutoSaving: isAutoSaving.current,
    cancelPendingSave,
    saveImmediately,
  };
}

export default useDebouncedSave;
