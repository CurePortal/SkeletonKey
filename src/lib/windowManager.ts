// src/services/windowManager.ts
import { invoke } from "@tauri-apps/api/tauri";
const getCurrentWindow = () => (window as any).__TAURI__.window.getCurrentWindow();
import { listen, emit } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export interface OpenProject {
  [windowLabel: string]: string; // windowLabel -> projectPath
}

export class ProjectWindowManager {
  /**
   * Opens a project in a new window or focuses existing window with that project
   */
  static async openProject(projectPath: string): Promise<string> {
    try {
      const windowLabel = await invoke<string>("open_project_window", {
        projectPath,
      });
      console.log(`Opened project in window: ${windowLabel}`);
      return windowLabel;
    } catch (error) {
      console.error("Failed to open project window:", error);
      throw error;
    }
  }

  /**
   * Gets the project path for the current window
   */
  static async getCurrentProjectPath(): Promise<string | null> {
    try {
      const currentWindow = getCurrentWindow();
      const projectPath = await invoke<string>("get_window_project", {
        windowLabel: currentWindow.label,
      });
      return projectPath;
    } catch (error) {
      console.error("Failed to get current project:", error);
      return null;
    }
  }

  /**
   * Gets all currently open projects
   */
  static async getOpenProjects(): Promise<OpenProject> {
    try {
      const projects = await invoke<OpenProject>("get_open_projects");
      return projects;
    } catch (error) {
      console.error("Failed to get open projects:", error);
      return {};
    }
  }

  /**
   * Closes a project window
   */
  static async closeProjectWindow(windowLabel: string): Promise<void> {
    try {
      await invoke("close_project_window", { windowLabel });
    } catch (error) {
      console.error("Failed to close project window:", error);
      throw error;
    }
  }

  /**
   * Opens a file dialog to select an .ark project file
   */
  static async selectProjectFile(): Promise<string | null> {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "ARK Project",
            extensions: ["ark"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        return selected;
      }

      return null;
    } catch (error) {
      console.error("Failed to select project file:", error);
      return null;
    }
  }

  /**
   * Opens an existing project in a new window from file selection
   */
  static async openProjectFromDialog(): Promise<string | null> {
    try {
      const projectPath = await this.selectProjectFile();
      if (projectPath) {
        const windowLabel = await this.openProject(projectPath);
        return windowLabel;
      }
      return null;
    } catch (error) {
      console.error("Failed to open project from dialog:", error);
      return null;
    }
  }

  /**
   * Checks if a project is already open in any window
   */
  static async isProjectOpen(projectPath: string): Promise<boolean> {
    try {
      const openProjects = await this.getOpenProjects();
      return Object.values(openProjects).includes(projectPath);
    } catch (error) {
      console.error("Failed to check if project is open:", error);
      return false;
    }
  }

  /**
   * Gets the window label for a given project path
   */
  static async getWindowForProject(
    projectPath: string,
  ): Promise<string | null> {
    try {
      const openProjects = await this.getOpenProjects();
      for (const [label, path] of Object.entries(openProjects)) {
        if (path === projectPath) {
          return label;
        }
      }
      return null;
    } catch (error) {
      console.error("Failed to get window for project:", error);
      return null;
    }
  }

  /**
   * Sets up event listeners for window management
   */
  static async setupWindowEventListeners(
    onProjectLoad?: (projectPath: string) => void,
    onWindowFocus?: () => void,
  ): Promise<() => void> {
    const unlisteners: Array<() => void> = [];

    try {
      // Listen for project load events
      if (onProjectLoad) {
        const unlistenLoad = await listen<string>("load-project", (event) => {
          console.log("Received load-project event:", event.payload);
          onProjectLoad(event.payload);
        });
        unlisteners.push(unlistenLoad);
      }

      // Listen for window focus events
      if (onWindowFocus) {
        const currentWindow = getCurrentWindow();
        const unlistenFocus = await currentWindow.onFocusChanged((focused: any) => {
          if (focused.payload && onWindowFocus) {
            onWindowFocus();
          }
        });
        unlisteners.push(unlistenFocus);
      }

      // Return cleanup function
      return () => {
        unlisteners.forEach((unlisten) => unlisten());
      };
    } catch (error) {
      console.error("Failed to setup window event listeners:", error);
      return () => {};
    }
  }

  /**
   * Emits an event to reload the project in all windows
   */
  static async reloadAllProjects(): Promise<void> {
    try {
      await emit("reload-projects", {});
    } catch (error) {
      console.error("Failed to emit reload event:", error);
    }
  }

  /**
   * Focus a specific window by label
   */
  static async focusWindow(windowLabel: string): Promise<void> {
    try {
      await invoke("focus_window", { windowLabel });
    } catch (error) {
      console.error("Failed to focus window:", error);
    }
  }
}

// Export as default for backward compatibility
export default ProjectWindowManager;
