import {
  ProjectType,
  CreateProjectRequest,
  ApiResponse,
  FileDialogOptions,
} from "../types";
import {
  saveProjectToFileSystem,
  loadProjectFromFileSystem,
  isValidAhpProject,
} from "./projectFileSystem";
import { v4 as uuidv4 } from "uuid";
import { ensureProjectHasNarratives } from "./projectMigration";
import { addRecentProject } from "./recentProjectsService";
import { isValidAhpProject as enhancedIsValidAhpProject } from "../utils/enhancedAhpLoader";
import { openAhpProject } from "./tauriUtils";
import { isTauriEnvironmentAsync } from "../utils/tauriDetection";

/**
 * Export project for web browser download
 * Uses single-file format with manifest for compatibility
 */
async function exportProjectAsWebDownload(
  project: ProjectType,
): Promise<string | null> {
  try {
    const projectToExport: ProjectType = {
      ...project,
      updatedAt: new Date().toISOString(),
      version: project.version || "2.0.0",
    };

    // Create hybrid format with manifest for compatibility
    const arkFile = {
      // Manifest for format detection
      manifest: {
        version: "2.0.0",
        format: "single-file",
        created: project.createdAt,
        modified: new Date().toISOString(),
        appVersion: "2.0.0",
      },
      // Project metadata
      project: {
        id: projectToExport.id,
        name: projectToExport.name,
        description: projectToExport.description,
        createdAt: projectToExport.createdAt,
        updatedAt: projectToExport.updatedAt,
        version: projectToExport.version,
        timelineIds: projectToExport.timelines.map((t) => t.id),
        characterIds: projectToExport.characters.map((c) => c.id),
        locationIds: projectToExport.locations.map((l) => l.id),
        technologyIds: projectToExport.technologies?.map((t) => t.id) || [],
        cultureIds: projectToExport.cultures?.map((c) => c.id) || [],
        sourceDocumentIds: projectToExport.sources?.map((s) => s.id) || [],
        narrativeIds: projectToExport.reports?.map((n) => n.id) || [],
      },
      // Collections as records for v1.0 compatibility
      timelines: Object.fromEntries(
        projectToExport.timelines.map((t) => [t.id, t]),
      ),
      characters: Object.fromEntries(
        projectToExport.characters.map((c) => [c.id, c]),
      ),
      locations: Object.fromEntries(
        projectToExport.locations.map((l) => [l.id, l]),
      ),
      technologies: Object.fromEntries(
        (projectToExport.technologies || []).map((t) => [t.id, t]),
      ),
      cultures: Object.fromEntries(
        (projectToExport.cultures || []).map((c) => [c.id, c]),
      ),
      sourceDocuments: Object.fromEntries(
        (projectToExport.sources || []).map((s) => [s.id, s]),
      ),
      narratives: Object.fromEntries(
        (projectToExport.reports || []).map((n) => [n.id, n]),
      ),
      // Include additional data
      mapData: projectToExport.mapData,
      entityTypes: projectToExport.entityTypes,
      entities: projectToExport.entities,
    };

    const jsonString = JSON.stringify(arkFile, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name}.ark`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    return `${project.name}.ark`;
  } catch (error) {
    console.error("Web export failed:", error);
    throw new Error(
      `Web export failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Export project as desktop file using directory-based structure
 */
async function exportProjectAsDesktopFile(
  project: ProjectType,
): Promise<string | null> {
  console.log("🚀 Starting desktop export process...");

  const projectToExport: ProjectType = {
    ...project,
    updatedAt: new Date().toISOString(),
    version: project.version || "2.0.0",
  };

  try {
    console.log("📦 Attempting to use directory-based export...");
    const { save } = await import("@tauri-apps/plugin-dialog");
    console.log("✅ Tauri dialog imported successfully.");

    let preferredDir: string | null = null;
    try {
      preferredDir = await getProjectSaveDirectory();
    } catch (pathError) {
      console.warn("Could not get preferred save directory:", pathError);
    }

    const filePath = await save({
      title: "Export Project as ARK File",
      defaultPath: preferredDir
        ? `${preferredDir}/${project.name}.ark`
        : `${project.name}.ark`,
      filters: [{ name: "ARK Project", extensions: ["ark"] }],
    });

    if (!filePath) {
      console.log("❌ User cancelled file selection");
      return null;
    }

    console.log("📍 Selected path:", filePath);

    // Use the directory-based save system
    const success = await saveProjectToFileSystem(projectToExport, filePath);

    if (success) {
      console.log("🎉 Project exported successfully with directory structure!");
      addRecentProject(projectToExport, filePath);
      return filePath;
    } else {
      throw new Error("Failed to save project to file system");
    }
  } catch (error) {
    console.error("💥 Desktop export failed:", error);
    throw new Error(
      `Desktop export failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getProjectSaveDirectory(): Promise<string | null> {
  try {
    const userPreferredDirectory = localStorage.getItem(
      "project-save-directory",
    );

    if (userPreferredDirectory && userPreferredDirectory.trim() !== "") {
      try {
        const { exists } = await import("@tauri-apps/plugin-fs");
        const dirExists = await exists(userPreferredDirectory);
        if (dirExists) {
          return userPreferredDirectory;
        } else {
          console.warn(
            `User-preferred directory ${userPreferredDirectory} doesn't exist or is inaccessible`,
          );
        }
      } catch (error) {
        console.error("Error checking directory existence:", error);
      }
    }

    const isTauri = await isTauriEnvironmentAsync();
    if (isTauri) {
      try {
        const { documentDir } = await import("@tauri-apps/api/path");
        const docDir = await documentDir();
        return docDir;
      } catch (error) {
        console.error("Error getting document directory:", error);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error("Error resolving project save directory:", error);
    return null;
  }
}

export async function createProject(
  data: CreateProjectRequest,
): Promise<ApiResponse<ProjectType>> {
  try {
    const now = new Date().toISOString();
    const newProject: ProjectType = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      createdAt: now,
      updatedAt: now,
      timelines: [],
      characters: [],
      locations: [],
      technologies: [],
      cultures: [],
      sources: [],
      reports: [],
      deletedIds: [],
      version: "2.0.0", // Updated version
    };
    const migratedProject = ensureProjectHasNarratives(newProject);
    return { success: true, data: migratedProject };
  } catch (error) {
    console.error("Error creating project:", error);
    return {
      success: false,
      error: `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function loadProject(
  filePath: string,
): Promise<
  ApiResponse<{ project: ProjectType; filePath: string; isFileBased: boolean }>
> {
  try {
    console.log(`[Service] Loading project from: ${filePath}`);

    const isTauri = await isTauriEnvironmentAsync();
    if (!isTauri) {
      return {
        success: false,
        error: "Cannot load files: Not in Tauri environment.",
      };
    }

    const { exists } = await import("@tauri-apps/plugin-fs");
    const fileExistsResult = await exists(filePath);
    if (!fileExistsResult) {
      return { success: false, error: "The specified file does not exist" };
    }

    const isValid = await enhancedIsValidAhpProject(filePath);
    if (!isValid) {
      return {
        success: false,
        error: "The selected file is not a valid ARK project",
      };
    }

    const project = await loadProjectFromFileSystem(filePath);
    addRecentProject(project as ProjectType, filePath);
    return { success: true, data: { project: project as ProjectType, filePath, isFileBased: true } };
  } catch (error) {
    console.error("[Service] Error loading project:", error);
    return {
      success: false,
      error: `Failed to load project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function openProject(
  options?: FileDialogOptions,
): Promise<
  ApiResponse<{ project: ProjectType; filePath: string; isFileBased: boolean }>
> {
  try {
    const isTauri = await isTauriEnvironmentAsync();
    if (!isTauri) {
      return {
        success: false,
        error: "Cannot open files: Not in Tauri environment.",
      };
    }

    const result = await openAhpProject(options);
    if (result.success && result.data) {
      addRecentProject(result.data.project, result.data.filePath);
      return { success: true, data: { ...result.data, isFileBased: true } };
    } else {
      return {
        success: false,
        error: result.error || "Failed to open project",
      };
    }
  } catch (error) {
    console.error("[Service] Error opening project:", error);
    return {
      success: false,
      error: `Failed to open project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function saveProject(
  project: ProjectType,
  filePath?: string | null,
  isFileBased?: boolean,
): Promise<ApiResponse<{ filePath: string | null; isFileBased: boolean }>> {
  try {
    const inTauriEnv = await isTauriEnvironmentAsync();
    if (!inTauriEnv) {
      return {
        success: false,
        error: "Cannot save files: Not in Tauri environment.",
        data: { filePath: null, isFileBased: false },
      };
    }

    console.log(
      `[Service] saveProject: isFileBased=${isFileBased}, filePath=${filePath}, inTauriEnv=${inTauriEnv}`,
    );

    let effectiveFilePath = filePath;
    if (!effectiveFilePath) {
      effectiveFilePath = await selectProjectSavePath(project.name);
      if (!effectiveFilePath) {
        return {
          success: false,
          error: "Save operation cancelled by user.",
          data: { filePath: null, isFileBased: false },
        };
      }
    }

    await saveProjectToFileSystem(project, effectiveFilePath as string);
    addRecentProject(project, effectiveFilePath as string);
    return {
      success: true,
      data: { filePath: effectiveFilePath, isFileBased: true },
    };
  } catch (error) {
    console.error("[Service] Error saving project:", error);
    return {
      success: false,
      error: `Failed to save project: ${error instanceof Error ? error.message : String(error)}`,
      data: { filePath: null, isFileBased: false },
    };
  }
}

export async function selectProjectFile(): Promise<string | null> {
  try {
    const isTauri = await isTauriEnvironmentAsync();
    if (!isTauri) {
      console.error("Cannot select file: Not in Tauri environment");
      return null;
    }

    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      title: "Open Advanced Research Knowledgebase File",
      filters: [{ name: "ARK Project", extensions: ["ark", "ahp", "json"] }],
      multiple: false,
    });
    return typeof selected === "string" ? selected : null;
  } catch (error) {
    console.error("[Service] Error selecting project file:", error);
    return null;
  }
}

export async function selectProjectSavePath(
  defaultName: string = "new-project",
): Promise<string | null> {
  try {
    const isTauri = await isTauriEnvironmentAsync();
    if (!isTauri) {
      console.error("Cannot select save path: Not in Tauri environment");
      return null;
    }

    const preferredDir = await getProjectSaveDirectory();
    const { save } = await import("@tauri-apps/plugin-dialog");

    return await save({
      title: "Save SkeletonKey Project",
      defaultPath: preferredDir
        ? `${preferredDir}/${defaultName}.ark`
        : `${defaultName}.ark`,
      filters: [{ name: "ARK Project", extensions: ["ark"] }],
    });
  } catch (error) {
    console.error("[Service] Error selecting project save path:", error);
    return null;
  }
}

export function hasUnsavedChanges(
  project: ProjectType | null,
  originalProject: ProjectType | null,
): boolean {
  if (!project || !originalProject) return false;
  return JSON.stringify(project) !== JSON.stringify(originalProject);
}

export async function isAhpProject(filePath: string): Promise<boolean> {
  const isTauri = await isTauriEnvironmentAsync();
  if (!isTauri) return false;

  try {
    if (await enhancedIsValidAhpProject(filePath)) return true;
  } catch (enhancedError) {
    console.warn("[Service] Enhanced ARK validation failed:", enhancedError);
  }
  return isValidAhpProject(filePath);
}

/**
 * Export project as ARK file
 * Desktop: Uses directory-based structure
 * Web: Uses single-file with manifest
 */
export async function exportProjectAsAHP(
  project: ProjectType,
): Promise<string | null> {
  try {
    const isTauri = await isTauriEnvironmentAsync();

    if (isTauri) {
      console.log(
        "🖥️ Detected desktop environment, using directory-based export...",
      );
      return await exportProjectAsDesktopFile(project);
    } else {
      console.log("🌐 Detected web environment, using single-file export...");
      return await exportProjectAsWebDownload(project);
    }
  } catch (error) {
    console.error("Export failed:", error);
    throw error;
  }
}

export async function importProjectFromFile(): Promise<
  ApiResponse<{ project: ProjectType; filePath: string; isFileBased: boolean }>
> {
  try {
    const isTauri = await isTauriEnvironmentAsync();
    if (!isTauri) {
      return {
        success: false,
        error: "Cannot import files: Not in Tauri environment.",
      };
    }

    return await openProject();
  } catch (error) {
    console.error("[Service] Error importing project:", error);
    return {
      success: false,
      error: `Failed to import project: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
