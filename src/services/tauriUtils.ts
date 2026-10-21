// @ts-nocheck
import {
  ApiResponse,
  FileDialogOptions,
  ProjectType,
  ID,
  EventType,
} from "../types";
import { ensureProjectHasNarratives } from "./projectMigration";

export function isTauriEnvironment(): boolean {
  try {
    if (typeof window === "undefined") {
      console.log("🔍 Tauri Detection: No window object (SSR environment)");
      return false;
    }

    const checks = {
      __TAURI__: !!window.__TAURI__,
      __TAURI_IPC__: typeof (window as any).__TAURI_IPC__ === "function",
      __TAURI_METADATA__: !!(window as any).__TAURI_METADATA__,
      userAgent: navigator.userAgent.includes("Tauri"),
      protocol: window.location.protocol === "tauri:",
      tauriProcess: typeof (window as any).__TAURI_PROCESS__ !== "undefined",
    };

    const isTauri = Object.values(checks).some(Boolean);

    console.log("🔍 Tauri Environment Detection:", {
      ...checks,
      result: isTauri ? "✅ TAURI" : "❌ WEB",
    });

    return isTauri;
  } catch (error) {
    console.warn("⚠️ Error detecting Tauri environment:", error);
    return false;
  }
}

export async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  try {
    const tauriAvailable = isTauriEnvironment();
    console.log(
      `🚀 Invoking command '${command}' - Tauri available: ${tauriAvailable}`,
    );

    if (!tauriAvailable) {
      if (command === "save_project_cmd" && args?.project) {
        const project = args.project as ProjectType;
        localStorage.setItem(`project_${project.id}`, JSON.stringify(project));
        console.log("💾 Browser mock: Saved project to localStorage");
        return {
          success: true,
          data: null as unknown as T,
        };
      }

      if (
        command === "update_event" &&
        args?.projectId &&
        args?.timelineId &&
        args?.event
      ) {
        const {
          projectId,
          timelineId,
          event: updatedEventData,
        } = args as { projectId: ID; timelineId: ID; event: EventType };

        try {
          const projectKey = `project_${projectId}`;
          const storedProjectJSON = localStorage.getItem(projectKey);
          if (!storedProjectJSON) {
            return {
              success: false,
              error: `Project with ID "${projectId}" not found in localStorage for browser mock.`,
            };
          }

          const project = JSON.parse(storedProjectJSON) as ProjectType;
          const timelineIndex = project.timelines.findIndex(
            (tl) => tl.id === timelineId,
          );
          if (timelineIndex === -1) {
            return {
              success: false,
              error: `Timeline with ID "${timelineId}" not found in project "${projectId}".`,
            };
          }

          const eventIndex = project.timelines[timelineIndex].events.findIndex(
            (ev) => ev.id === updatedEventData.id,
          );
          if (eventIndex === -1) {
            return {
              success: false,
              error: `Event with ID "${updatedEventData.id}" not found in timeline "${timelineId}".`,
            };
          }

          project.timelines[timelineIndex].events[eventIndex] = {
            ...project.timelines[timelineIndex].events[eventIndex],
            ...updatedEventData,
          };
          project.updatedAt = new Date().toISOString();

          localStorage.setItem(projectKey, JSON.stringify(project));
          console.log("💾 Browser mock: Updated event in localStorage");

          return {
            success: true,
            data: updatedEventData as T,
          };
        } catch (e) {
          console.error("❌ Error in browser mock for 'update_event':", e);
          return {
            success: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }

      return {
        success: false,
        error: `Tauri environment not available. Command '${command}' requires desktop functionality or is not mocked for browser.`,
      };
    }

    if (!window.__TAURI__) {
      console.log("⏳ Waiting for Tauri APIs to load...");
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!window.__TAURI__) {
        throw new Error("Tauri APIs not available after waiting");
      }
    }

    const { invoke } = await import("@tauri-apps/api/tauri");

    console.log(`📡 Calling Tauri command: ${command}`, args);

    const result = await invoke<T>(command, args);

    console.log(`✅ Tauri command '${command}' completed successfully`);
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error(`❌ Error invoking Tauri command '${command}':`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function openFileDialog(
  options?: FileDialogOptions,
): Promise<string | string[] | null> {
  try {
    const tauriAvailable = isTauriEnvironment();
    console.log(`📂 Opening file dialog - Tauri available: ${tauriAvailable}`);

    if (!tauriAvailable) {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";

        if (options?.filters) {
          const acceptTypes = options.filters
            .flatMap((filter) => filter.extensions.map((ext) => `.${ext}`))
            .join(",");
          if (acceptTypes) {
            input.accept = acceptTypes;
          }
        }

        if (options?.multiple) {
          input.multiple = true;
        }

        input.onchange = (e) => {
          const files = (e.target as HTMLInputElement).files;
          if (!files || files.length === 0) {
            resolve(null);
            return;
          }

          if (options?.multiple) {
            const fileNames = Array.from(files).map(
              (file) => `/mock/${file.name}`,
            );
            resolve(fileNames);
          } else {
            resolve(`/mock/${files[0].name}`);
          }

          if (document.body.contains(input)) {
            document.body.removeChild(input);
          }
        };

        const handleCancel = () => {
          document.removeEventListener("focus", handleCancel);
          setTimeout(() => {
            if (!input.files || input.files.length === 0) {
              resolve(null);
            }
            if (document.body.contains(input)) {
              document.body.removeChild(input);
            }
          }, 300);
        };

        document.addEventListener("focus", handleCancel);

        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
      });
    }

    const { open } = await import("@tauri-apps/plugin-dialog");

    console.log("📂 Opening native file dialog with options:", options);
    const selected = await open({
      title: options?.title || "Open File",
      filters: options?.filters || undefined,
      directory: options?.directory || false,
      multiple: options?.multiple || false,
    });

    console.log("📂 File dialog result:", selected);

    if (selected === null) {
      console.log("❌ User cancelled file dialog");
      return null;
    }

    return selected;
  } catch (error) {
    console.error("❌ Error opening file dialog:", error);
    return null;
  }
}

export async function openAhpProject(
  options?: FileDialogOptions,
): Promise<ApiResponse<{ project: ProjectType; filePath: string }>> {
  try {
    const tauriAvailable = isTauriEnvironment();
    console.log(`📁 Opening ARK project - Tauri available: ${tauriAvailable}`);

    const dialogOptions: FileDialogOptions = {
      title: options?.title || "Open ARK Project",
      filters: options?.filters || [
        { name: "ARK Project Files", extensions: ["ark"] },
      ],
      multiple: false,
      ...options,
    };

    const selectedPath = await openFileDialog(dialogOptions);

    if (!selectedPath) {
      console.log("❌ ARK file selection canceled");
      return {
        success: false,
        error: "File selection canceled",
      };
    }

    const filePath = Array.isArray(selectedPath)
      ? selectedPath[0]
      : selectedPath;

    if (tauriAvailable) {
      const { loadProjectFromAhp, isValidAhpProject } = await import(
        "../utils/enhancedAhpLoader"
      );

      const isValid = await isValidAhpProject(filePath);
      if (!isValid) {
        return {
          success: false,
          error: "Selected file is not a valid ARK project",
        };
      }

      const projectData = await loadProjectFromAhp(filePath);

      return {
        success: true,
        data: {
          project: projectData,
          filePath: filePath,
        },
      };
    } else {
      const fileName = filePath.split("/").pop() || "unnamed.ark";
      const projectName = fileName.replace(/\.ark$/i, "");

      const storedProject = localStorage.getItem(`project_${projectName}`);

      if (storedProject) {
        try {
          const project = JSON.parse(storedProject) as ProjectType;
          const migratedProject = ensureProjectHasNarratives(project);

          return {
            success: true,
            data: {
              project: migratedProject,
              filePath: filePath,
            },
          };
        } catch (error) {
          console.warn("⚠️ Error parsing stored project:", error);
        }
      }

      const now = new Date().toISOString();
      const mockProject: ProjectType = {
        id: `mock-${projectName}`,
        name: projectName,
        description: `Project created from ${fileName}`,
        createdAt: now,
        updatedAt: now,
        timelines: [],
        characters: [],
        locations: [],
        technologies: [],
        cultures: [],
        sourceDocuments: [],
        narratives: [],
        version: "1.0",
      };

      const migratedProject = ensureProjectHasNarratives(mockProject);

      localStorage.setItem(
        `project_${migratedProject.id}`,
        JSON.stringify(migratedProject),
      );

      console.log(
        "💾 Created mock ARK project for browser:",
        migratedProject.name,
      );

      return {
        success: true,
        data: {
          project: migratedProject,
          filePath: filePath,
        },
      };
    }
  } catch (error) {
    console.error("❌ Error opening ARK project:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function saveFileDialog(
  options?: FileDialogOptions,
): Promise<string | null> {
  try {
    const tauriAvailable = isTauriEnvironment();
    console.log(`💾 Opening save dialog - Tauri available: ${tauriAvailable}`);

    if (!tauriAvailable) {
      const fileName = prompt(
        options?.title || "Enter a filename to save:",
        options?.defaultPath || "untitled.ark",
      );

      if (!fileName) {
        return null;
      }

      return `/mock/${fileName}`;
    }

    const { save } = await import("@tauri-apps/plugin-dialog");

    console.log("💾 Opening native save dialog with options:", options);
    const selected = await save({
      title: options?.title || "Save File",
      filters: options?.filters || undefined,
      defaultPath: options?.defaultPath || undefined,
    });

    console.log("💾 Save dialog result:", selected);

    if (selected === null) {
      console.log("❌ User cancelled save dialog");
      return null;
    }

    return selected;
  } catch (error) {
    console.error("❌ Error opening save dialog:", error);
    return null;
  }
}

export function generateErrorId(): string {
  return `error-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
