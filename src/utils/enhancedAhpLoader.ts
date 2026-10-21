import { readTextFile, readFile, exists } from "@tauri-apps/plugin-fs";
import { join, dirname, basename, extname } from "@tauri-apps/api/path";
import JSZip from "jszip";
import { ProjectType } from "../types";
import { ensureProjectHasNarratives } from "../services/projectMigration";
import { EnhancedProjectType } from "../types/dynamicEntity";

interface LegacyAhpStructure {
  project: {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    version: string;
    timelineIds: string[];
    characterIds: string[];
    locationIds: string[];
    technologyIds: string[];
    cultureIds: string[];
    sourceDocumentIds: string[];
    narrativeIds: string[];
  };
  timelines: Record<string, any>;
  characters: Record<string, any>;
  locations: Record<string, any>;
  technologies: Record<string, any>;
  cultures: Record<string, any>;
  sourceDocuments: Record<string, any>;
  narratives: Record<string, any>;
  manifest: {
    version: string;
    created: string;
    appVersion: string;
    format: string;
  };
}

/**
 * Load project from any supported format
 */
export async function loadProjectFromAhp(
  filePath: string,
): Promise<ProjectType | EnhancedProjectType> {
  console.log(`Loading project from: ${filePath}`);

  try {
    const extension = await extname(filePath);
    const isArkFile = extension.toLowerCase() === ".ark";

    if (isArkFile) {
      // Try ZIP format first (new format)
      try {
        console.log("Attempting to load as ZIP-based .ark file");
        const projectData = await loadFromZipFile(filePath);
        if (projectData) {
          console.log("Successfully loaded project from ZIP-based .ark file");
          return projectData;
        }
      } catch (zipError) {
        console.warn("Not a ZIP format, trying legacy format:", zipError);

        // Fall back to legacy single-file JSON format
        try {
          const projectData = await loadFromLegacySingleFile(filePath);
          if (projectData) {
            console.log("Successfully loaded project from legacy JSON format");
            return projectData;
          }
        } catch (legacyError) {
          console.warn("Error loading as legacy format:", legacyError);
        }
      }
    }

    // Try directory structure (legacy)
    console.log("Attempting to load as directory structure");
    const projectData = await loadFromDirectory(filePath);
    console.log("Successfully loaded project from directory structure");
    return projectData;
  } catch (error) {
    console.error("Error loading project file:", error);
    throw new Error(
      `Failed to load project: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Load from new ZIP-based format
 */
async function loadFromZipFile(
  filePath: string,
): Promise<ProjectType | EnhancedProjectType> {
  // Read the file as binary
  const fileContent = await readFile(filePath);

  // Load as ZIP
  const zip = new JSZip();
  await zip.loadAsync(fileContent);

  // Check for required files
  const projectFile = zip.file("project.json");
  const manifestFile = zip.file("ark-manifest.json");

  if (!projectFile || !manifestFile) {
    throw new Error("Invalid ZIP-based ARK: missing required files");
  }

  // Load project metadata
  const projectContent = await projectFile.async("string");
  const projectMetadata = JSON.parse(projectContent);

  // Load entity type definitions
  let entityTypes: any[] = [];
  const typesManifestFile = zip.file("types/manifest.json");
  if (typesManifestFile) {
    const typesContent = await typesManifestFile.async("string");
    entityTypes = JSON.parse(typesContent);
  }

  // Initialize project
  const project: any = {
    id: projectMetadata.id,
    name: projectMetadata.name,
    description: projectMetadata.description,
    createdAt: projectMetadata.createdAt,
    updatedAt: projectMetadata.updatedAt,
    version: projectMetadata.version,
    thumbnailUrl: projectMetadata.thumbnailUrl,
    mapData: projectMetadata.mapData,
    timelines: [],
    characters: [],
    locations: [],
    technologies: [],
    cultures: [],
    sources: [],
    reports: [],
  };

  // Load entities based on index
  const entityIndex = projectMetadata.entityIndex || {};

  // Load built-in entity types
  const builtInTypes = [
    { field: "timelines", type: "timeline" },
    { field: "characters", type: "character" },
    { field: "locations", type: "location" },
    { field: "technologies", type: "technology" },
    { field: "cultures", type: "culture" },
    { field: "sources", type: "source" },
    { field: "reports", type: "report" },
  ];

  for (const { field, type } of builtInTypes) {
    const typeIds = entityIndex[type] || [];
    for (const id of typeIds) {
      const entityFile = zip.file(`entities/${type}/${id}.json`);
      if (entityFile) {
        const content = await entityFile.async("string");
        project[field].push(JSON.parse(content));
      }
    }
  }

  // Handle enhanced project with custom entities
  if (projectMetadata.hasCustomTypes) {
    const customTypes = entityTypes.filter((t) => !t.isBuiltIn);
    project.entityTypes = customTypes.map((t) => ({
      id: t.id,
      name: t.name,
      schema: t.schema,
    }));

    project.entities = [];
    for (const customType of customTypes) {
      const typeIds = entityIndex[customType.id] || [];
      for (const id of typeIds) {
        const entityFile = zip.file(`entities/${customType.id}/${id}.json`);
        if (entityFile) {
          const content = await entityFile.async("string");
          project.entities.push(JSON.parse(content));
        }
      }
    }

    return project as EnhancedProjectType;
  }

  return ensureProjectHasNarratives(project as ProjectType);
}

/**
 * Load from legacy single-file JSON format
 */
async function loadFromLegacySingleFile(
  filePath: string,
): Promise<ProjectType> {
  let fileContent: string;
  try {
    fileContent = await readTextFile(filePath);
  } catch (textError) {
    const binaryData = await readFile(filePath);
    const decoder = new TextDecoder("utf-8");
    fileContent = decoder.decode(binaryData);
  }

  const fileData: LegacyAhpStructure = JSON.parse(fileContent);

  if (!fileData.project || !fileData.manifest) {
    throw new Error("Invalid legacy ARK: missing required data");
  }

  const projectData: ProjectType = {
    id: fileData.project.id,
    name: fileData.project.name,
    description: fileData.project.description,
    createdAt: fileData.project.createdAt,
    updatedAt: new Date().toISOString(),
    version: fileData.project.version,
    timelines: Object.values(fileData.timelines || {}),
    characters: Object.values(fileData.characters || {}),
    locations: Object.values(fileData.locations || {}),
    technologies: Object.values(fileData.technologies || {}),
    cultures: Object.values(fileData.cultures || {}),
    sources: Object.values(fileData.sourceDocuments || {}),
    reports: Object.values(fileData.narratives || []),
  };

  return ensureProjectHasNarratives(projectData);
}

/**
 * Load from legacy directory structure
 */
async function loadFromDirectory(filePath: string): Promise<ProjectType> {
  let dirPath = filePath;
  const extension = await extname(filePath);

  if (extension.toLowerCase() === ".ark") {
    dirPath = await join(
      await dirname(filePath),
      await basename(filePath, ".ark"),
    );
  }

  const manifestPath = await join(dirPath, ".ark-manifest");
  const manifestExists = await exists(manifestPath);

  if (!manifestExists) {
    throw new Error("Invalid directory project: Missing manifest");
  }

  const projectIndexPath = await join(dirPath, "project.json");
  const projectIndexText = await readTextFile(projectIndexPath);
  const projectIndex = JSON.parse(projectIndexText);

  // Load entities from directories
  const timelines = await loadEntitiesFromDir(
    dirPath,
    "timelines",
    projectIndex.timelineIds,
  );
  const characters = await loadEntitiesFromDir(
    dirPath,
    "characters",
    projectIndex.characterIds,
  );
  const locations = await loadEntitiesFromDir(
    dirPath,
    "locations",
    projectIndex.locationIds,
  );
  const reports = await loadEntitiesFromDir(
    dirPath,
    "narratives",
    projectIndex.narrativeIds,
  );

  // Load resources
  const resourcesPath = await join(dirPath, "resources");
  const technologies = await loadResourceEntities(
    resourcesPath,
    "technology",
    projectIndex.technologyIds,
  );
  const cultures = await loadResourceEntities(
    resourcesPath,
    "culture",
    projectIndex.cultureIds,
  );
  const sources = await loadResourceEntities(
    resourcesPath,
    "document",
    projectIndex.sourceDocumentIds,
  );

  const project: ProjectType = {
    id: projectIndex.id,
    name: projectIndex.name,
    description: projectIndex.description,
    createdAt: projectIndex.createdAt,
    updatedAt: projectIndex.updatedAt || new Date().toISOString(),
    version: projectIndex.version || "1.0",
    timelines,
    characters,
    locations,
    technologies,
    cultures,
    sources,
    reports,
  };

  return ensureProjectHasNarratives(project);
}

async function loadEntitiesFromDir(
  dirPath: string,
  entityType: string,
  ids: string[] = [],
): Promise<any[]> {
  const entities: any[] = [];
  const entityDirPath = await join(dirPath, entityType);

  for (const id of ids) {
    const entityPath = await join(entityDirPath, `${id}.json`);
    if (await exists(entityPath)) {
      const entityText = await readTextFile(entityPath);
      entities.push(JSON.parse(entityText));
    }
  }

  return entities;
}

async function loadResourceEntities(
  resourcesPath: string,
  prefix: string,
  ids: string[] = [],
): Promise<any[]> {
  const entities: any[] = [];

  for (const id of ids) {
    const entityPath = await join(resourcesPath, `${prefix}-${id}.json`);
    if (await exists(entityPath)) {
      const entityText = await readTextFile(entityPath);
      entities.push(JSON.parse(entityText));
    }
  }

  return entities;
}

/**
 * Check if file is a valid ARK project
 */
export async function isValidAhpProject(filePath: string): Promise<boolean> {
  try {
    console.log(`Validating ARK project: ${filePath}`);

    if (!filePath.toLowerCase().endsWith(".ark")) {
      return false;
    }

    // Try to validate as ZIP first
    try {
      const fileContent = await readFile(filePath);
      const zip = new JSZip();
      await zip.loadAsync(fileContent);

      const hasManifest = zip.file("ark-manifest.json") !== null;
      const hasProject = zip.file("project.json") !== null;

      if (hasManifest && hasProject) {
        console.log("Valid ZIP-based ARK detected");
        return true;
      }
    } catch (zipError) {
      // Not a ZIP, try other formats
    }

    // Try legacy JSON format
    try {
      const fileContent = await readTextFile(filePath);
      const data = JSON.parse(fileContent);

      if (data.project && data.manifest) {
        console.log("Valid legacy JSON ARK detected");
        return true;
      }
    } catch (jsonError) {
      // Not legacy JSON
    }

    // Try directory format
    try {
      const dirPath = await join(
        await dirname(filePath),
        await basename(filePath, ".ark"),
      );

      const manifestPath = await join(dirPath, ".ark-manifest");
      const projectPath = await join(dirPath, "project.json");

      if ((await exists(manifestPath)) && (await exists(projectPath))) {
        console.log("Valid directory ARK detected");
        return true;
      }
    } catch (dirError) {
      // Not directory format
    }

    return false;
  } catch (error) {
    console.error("Error validating ARK project:", error);
    return false;
  }
}
