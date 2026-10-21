// src/hooks/useProjectData.ts - Fixed version with naming conflict resolved
import { useState, useCallback } from "react";
import { ProjectType } from "../types";
import { useAppState } from "../contexts/AppStateContext";
import { useNotification } from "../contexts/NotificationContext";
import { useProjectData as useProjectDataContext } from "../contexts/ProjectDataContext";
import {
  getRecentProjects,
  RecentProject,
} from "../services/recentProjectsService";
import {
  createProject,
  saveProject,
  loadProject,
  openProject,
  exportProjectAsAHP,
  importProjectFromFile,
} from "../services/projectService";

/**
 * Enhanced hook for managing project data and operations
 * with proper handling of file-based vs browser-based projects
 */
function useProjectManager() {
  const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(
    null,
  );
  const { showSuccess, showError } = useNotification();
  const { addLoadingState, removeLoadingState, setCurrentProjectId } =
    useAppState();
  const { setProject } = useProjectDataContext();

  /**
   * Create a new project
   */
  const createNewProject = useCallback(
    async (
      name: string,
      description: string = "",
    ): Promise<ProjectType | null> => {
      const operationId = "creating_project";
      addLoadingState(operationId);

      try {
        const result = await createProject({ name, description });

        if (result.success && result.data) {
          // Set the project in context with no file path (new project)
          setProject(result.data, null);
          setCurrentProjectPath(null);
          showSuccess(`Project "${name}" created successfully`);
          setCurrentProjectId(result.data.id);
          return result.data;
        } else {
          throw new Error(result.error || "Failed to create project");
        }
      } catch (error) {
        showError(
          `Error creating project: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      } finally {
        removeLoadingState(operationId);
      }
    },
    [
      addLoadingState,
      removeLoadingState,
      showSuccess,
      showError,
      setProject,
      setCurrentProjectId,
    ],
  );

  /**
   * Load a project from a file path
   */
  const loadProjectFromFile = useCallback(
    async (filePath: string): Promise<ProjectType | null> => {
      const operationId = "loading_project";
      addLoadingState(operationId);

      try {
        console.log(`Loading project from: ${filePath}`);
        const result = await loadProject(filePath);

        if (result.success && result.data) {
          // Set the project in context with proper file path and mode information
          setProject(result.data.project, result.data.filePath);
          setCurrentProjectPath(result.data.filePath);
          showSuccess(
            `Project "${result.data.project.name}" loaded successfully`,
          );
          setCurrentProjectId(result.data.project.id);
          return result.data.project;
        } else {
          throw new Error(result.error || "Failed to load project");
        }
      } catch (error) {
        showError(
          `Error loading project: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      } finally {
        removeLoadingState(operationId);
      }
    },
    [
      addLoadingState,
      removeLoadingState,
      showSuccess,
      showError,
      setProject,
      setCurrentProjectId,
    ],
  );

  /**
   * Open a project using the file dialog
   */
  const openProjectWithDialog =
    useCallback(async (): Promise<ProjectType | null> => {
      const operationId = "opening_project";
      addLoadingState(operationId);

      try {
        const result = await openProject();

        if (result.success && result.data) {
          // Set the project in context with proper file path and mode information
          setProject(result.data.project, result.data.filePath);
          setCurrentProjectPath(result.data.filePath);
          showSuccess(
            `Project "${result.data.project.name}" opened successfully`,
          );
          setCurrentProjectId(result.data.project.id);
          return result.data.project;
        } else if (result.error) {
          throw new Error(result.error);
        } else {
          // User cancelled - not an error
          console.log("Project open cancelled by user");
          return null;
        }
      } catch (error) {
        showError(
          `Error opening project: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      } finally {
        removeLoadingState(operationId);
      }
    }, [
      addLoadingState,
      removeLoadingState,
      showSuccess,
      showError,
      setProject,
      setCurrentProjectId,
    ]);

  /**
   * Open a recent project
   */
  const openRecentProject = useCallback(
    async (recentProject: RecentProject): Promise<ProjectType | null> => {
      return loadProjectFromFile(recentProject.path);
    },
    [loadProjectFromFile],
  );

  /**
   * Save a project to file
   * Uses the project context's save functionality which handles file-based vs localStorage automatically
   */
  const saveProjectToFile = useCallback(
    async (
      project: ProjectType,
      filePathParam?: string | null,
    ): Promise<boolean> => {
      const operationId = "saving_project";
      addLoadingState(operationId);

      try {
        // Determine if this should be file-based save
        const isFileBased =
          typeof window !== "undefined" &&
          (window as any).__TAURI__ &&
          filePathParam &&
          !filePathParam.startsWith("/mock/");

        const result = await saveProject(project, filePathParam, isFileBased);

        if (result.success && result.data) {
          setCurrentProjectPath(result.data.filePath);
          showSuccess(`Project "${project.name}" saved successfully`);
          return true;
        } else {
          throw new Error(result.error || "Failed to save project");
        }
      } catch (error) {
        showError(
          `Error saving project: ${error instanceof Error ? error.message : String(error)}`,
        );
        return false;
      } finally {
        removeLoadingState(operationId);
      }
    },
    [addLoadingState, removeLoadingState, showSuccess, showError],
  );

  /**
   * Export a project as ARK file
   */
  const exportProjectData = useCallback(
    async (project: ProjectType): Promise<boolean> => {
      const operationId = "exporting_project";
      addLoadingState(operationId);

      try {
        const filePath = await exportProjectAsAHP(project);

        if (filePath) {
          showSuccess(
            `Project "${project.name}" exported successfully to ${filePath}`,
          );
          return true;
        } else {
          // User cancelled the export
          console.log("Export cancelled by user");
          return false;
        }
      } catch (error) {
        showError(
          `Error exporting project: ${error instanceof Error ? error.message : String(error)}`,
        );
        return false;
      } finally {
        removeLoadingState(operationId);
      }
    },
    [addLoadingState, removeLoadingState, showSuccess, showError],
  );

  /**
   * Import a project from a file
   */
  const importProjectData =
    useCallback(async (): Promise<ProjectType | null> => {
      const operationId = "importing_project";
      addLoadingState(operationId);

      try {
        const result = await importProjectFromFile();

        if (result.success && result.data) {
          // Set the imported project in context
          setProject(result.data.project, result.data.filePath);
          setCurrentProjectPath(result.data.filePath);
          showSuccess(
            `Project "${result.data.project.name}" imported successfully`,
          );
          setCurrentProjectId(result.data.project.id);
          return result.data.project;
        } else {
          throw new Error(result.error || "Failed to import project");
        }
      } catch (error) {
        showError(
          `Error importing project: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      } finally {
        removeLoadingState(operationId);
      }
    }, [
      addLoadingState,
      removeLoadingState,
      showSuccess,
      showError,
      setProject,
      setCurrentProjectId,
    ]);

  /**
   * Get a validated list of recent projects
   * In file-based mode, this would check if files still exist
   * In browser mode, this just returns the list from localStorage
   */
  const getValidatedRecentProjects = useCallback(async (): Promise<
    RecentProject[]
  > => {
    try {
      const recentProjects = getRecentProjects();

      // In browser mode, we can't really validate file existence
      // so we just return all projects
      if (typeof window === "undefined" || !(window as any).__TAURI__) {
        return recentProjects;
      }

      // In Tauri mode, we could validate file existence
      // For now, we'll just return all projects
      // TODO: Add file existence validation for real file paths
      return recentProjects;
    } catch (err) {
      console.error("Error getting validated recent projects:", err);
      return [];
    }
  }, []);

  return {
    currentProjectPath,
    createProject: createNewProject,
    loadProject: openProjectWithDialog, // This function triggers the file dialog
    loadProjectFromPath: loadProjectFromFile, // This function loads from a specific path
    openRecentProject,
    saveProject: saveProjectToFile,
    exportProject: exportProjectData,
    importProject: importProjectData,
    getValidatedRecentProjects,
  };
}

export default useProjectManager;
