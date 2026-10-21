// @ts-nocheck
/**
 * Project File System Service v2
 * Single-file ZIP-based ARK format
 *
 * First install: pnpm add jszip @types/jszip
 */

import JSZip from "jszip";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import { BaseDirectory } from "@tauri-apps/api/path";
import {
  ProjectType,
  TimelineType,
  CharacterType,
  LocationType,
  TechnologyType,
  CultureType,
  SourceDocumentType,
  ReportType,
} from "../types";
import {
  EnhancedProjectType,
  CustomEntityType,
  GenericEntity,
} from "../types/dynamicEntity";

/**
 * Entity type definitions for the unified structure
 */
interface EntityTypeDefinition {
  id: string;
  name: string;
  isBuiltIn: boolean;
  version: string;
  schema?: any;
}

/**
 * Save project to a single ZIP-based .ark file
 */
export async function saveProjectToFileSystem(
  project: ProjectType | EnhancedProjectType,
  filePath: string,
): Promise<boolean> {
  try {
    // Ensure .ark extension
    let projectPath = filePath;
    if (!projectPath.toLowerCase().endsWith(".ark")) {
      projectPath += ".ark";
    }

    // Create a new ZIP file
    const zip = new JSZip();

    // Build entity type definitions
    const entityTypes: EntityTypeDefinition[] = [
      { id: "timeline", name: "Timeline", isBuiltIn: true, version: "1.0.0" },
      { id: "character", name: "Character", isBuiltIn: true, version: "1.0.0" },
      { id: "location", name: "Location", isBuiltIn: true, version: "1.0.0" },
      {
        id: "technology",
        name: "Technology",
        isBuiltIn: true,
        version: "1.0.0",
      },
      { id: "culture", name: "Culture", isBuiltIn: true, version: "1.0.0" },
      { id: "source", name: "Source", isBuiltIn: true, version: "1.0.0" },
      { id: "report", name: "Report", isBuiltIn: true, version: "1.0.0" },
      { id: "task", name: "Task", isBuiltIn: true, version: "1.0.0" },
      { id: "caseDocument", name: "Case Document", isBuiltIn: true, version: "1.0.0" },
    ];

    // Add custom/configured entity types if this project has them.
    const isEnhanced =
      Array.isArray((project as any).entityTypes) ||
      Array.isArray((project as any).entities);
    const configuredTypes = Array.isArray((project as any).entityTypes)
      ? ((project as any).entityTypes as any[])
      : [];
    if (configuredTypes.length > 0) {
      const byId = new Map(entityTypes.map((row) => [row.id, row]));
      for (const customType of configuredTypes) {
        const existing = byId.get(customType.id);
        byId.set(customType.id, {
          ...(existing || {}),
          ...customType,
          isBuiltIn: Boolean(existing?.isBuiltIn),
          version: "1.0.0",
        });
      }
      entityTypes = Array.from(byId.values());
    }

    // Save entity type definitions
    const typesFolder = zip.folder("types");
    typesFolder!.file("manifest.json", JSON.stringify(entityTypes, null, 2));

    // Create entity index for metadata
    const entityIndex: Record<string, string[]> = {};

    // Create entities folder
    const entitiesFolder = zip.folder("entities");

    // Save built-in entities
    const entityGroups = [
      { type: "timeline", entities: project.timelines || [] },
      { type: "character", entities: project.characters || [] },
      { type: "location", entities: project.locations || [] },
      { type: "technology", entities: project.technologies || [] },
      { type: "culture", entities: project.cultures || [] },
      { type: "source", entities: project.sources || [] },
      { type: "report", entities: project.reports || [] },
      { type: "task", entities: project.tasks || [] },
      { type: "caseDocument", entities: project.caseDocuments || [] },
    ];

    for (const group of entityGroups) {
      if (group.entities.length > 0) {
        const typeFolder = entitiesFolder!.folder(group.type);
        entityIndex[group.type] = [];

        for (const entity of group.entities) {
          let entityData = entity;

          // Special handling for reports
          if (group.type === "report" && entity.documents) {
            entityData = {
              ...entity,
              documents: entity.documents || [],
              categories: entity.categories || [
                { id: "narratives", name: "Narratives", color: "blue" },
                { id: "worldbuilding", name: "World Building", color: "green" },
                { id: "research", name: "Research", color: "purple" },
                { id: "sources", name: "Sources", color: "gray" },
              ],
            };
          }

          typeFolder!.file(
            `${entity.id}.json`,
            JSON.stringify(entityData, null, 2),
          );
          entityIndex[group.type].push(entity.id);
        }
      }
    }

    // Save custom entities if enhanced
    if (isEnhanced) {
      const enhancedProject = project as EnhancedProjectType;
      if (enhancedProject.entities) {
        // Group custom entities by type
        const customGroups = new Map<string, GenericEntity[]>();
        for (const entity of enhancedProject.entities) {
          if (!customGroups.has(entity.entityType)) {
            customGroups.set(entity.entityType, []);
          }
          customGroups.get(entity.entityType)!.push(entity);
        }

        // Save each custom entity group
        for (const [entityType, entities] of customGroups) {
          const typeFolder = entitiesFolder!.folder(entityType);
          const indexKey = `custom:${entityType}`;
          entityIndex[indexKey] = [];
          for (const entity of entities) {
            typeFolder!.file(
              `${entity.id}.json`,
              JSON.stringify(entity, null, 2),
            );
            entityIndex[indexKey]!.push(entity.id);
          }
        }
      }
    }

    // Save project metadata
    const projectMetadata = {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: new Date().toISOString(),
      version: project.version || "2.0.0",
      thumbnailUrl: project.thumbnailUrl,
      mapData: project.mapData,
      deletedIds: (project as any).deletedIds || [],
      entityIndex: entityIndex,
      entityTypes: configuredTypes,
      format: "unified-zip",
      hasCustomTypes: isEnhanced,
    };

    zip.file("project.json", JSON.stringify(projectMetadata, null, 2));

    // Save manifest
    zip.file(
      "ark-manifest.json",
      JSON.stringify(
        {
          version: "2.0.0",
          format: "unified-zip",
          created: project.createdAt || new Date().toISOString(),
          modified: new Date().toISOString(),
          entityTypeCount: entityTypes.length,
          totalEntities: Object.values(entityIndex).reduce(
            (sum, ids) => sum + ids.length,
            0,
          ),
        },
        null,
        2,
      ),
    );

    // Create assets folder (empty for now)
    zip.folder("assets");

    // Generate the ZIP file as a Uint8Array
    const zipContent = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: {
        level: 6, // Medium compression (1-9, where 9 is best compression)
      },
    });

    // Write the ZIP file to disk
    await writeFile(projectPath, zipContent);

    // Set custom icon on macOS (restore what was working)
    try {
      const currentPlatform = await platform();
      if (currentPlatform === "darwin") {
        await Command.create("setfile", [
          "SetFile",
          "-a",
          "C",
          projectPath,
        ]).execute();
      }
    } catch (iconError) {
      console.warn("Could not set custom icon:", iconError);
    }

    console.log(`Project saved as single-file ARK: ${projectPath}`);
    return true;
  } catch (error) {
    console.error("Error saving project to file system:", error);
    throw new Error(
      `Failed to save project: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
/**
 * Load project from single-file ZIP-based ARK format
 */
export async function loadProjectFromFileSystem(
  filePath: string,
): Promise<ProjectType | EnhancedProjectType> {
  try {
    // Ensure we're pointing to a .ark file
    let arkPath = filePath;
    if (!filePath.toLowerCase().endsWith(".ark")) {
      arkPath = filePath + ".ark";
    }

    // Read the ZIP file
    const fileContent = await readFile(arkPath);

    // Load the ZIP
    const zip = new JSZip();
    await zip.loadAsync(fileContent);

    // Load project metadata
    const projectMetadataFile = zip.file("project.json");
    if (!projectMetadataFile) {
      throw new Error("Invalid project: missing project.json");
    }
    const projectMetadataContent = await projectMetadataFile.async("string");
    const projectMetadata = JSON.parse(projectMetadataContent);

    // Load entity type definitions
    let entityTypes: EntityTypeDefinition[] = [];
    const typesManifestFile = zip.file("types/manifest.json");
    if (typesManifestFile) {
      const typesContent = await typesManifestFile.async("string");
      entityTypes = JSON.parse(typesContent);
    }

    // Initialize project object
    const project: any = {
      id: projectMetadata.id,
      name: projectMetadata.name,
      description: projectMetadata.description,
      createdAt: projectMetadata.createdAt,
      updatedAt: projectMetadata.updatedAt,
      version: projectMetadata.version,
      thumbnailUrl: projectMetadata.thumbnailUrl,
      mapData: projectMetadata.mapData,
      deletedIds: Array.isArray(projectMetadata.deletedIds)
        ? projectMetadata.deletedIds
        : [],
      timelines: [],
      characters: [],
      locations: [],
      technologies: [],
      cultures: [],
      sources: [],
      reports: [],
      tasks: [],
      caseDocuments: [],
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
      { field: "tasks", type: "task" },
      { field: "caseDocuments", type: "caseDocument" },
    ];

    for (const { field, type } of builtInTypes) {
      const typeIds = entityIndex[type] || [];
      if (typeIds.length > 0) {
        for (const id of typeIds) {
          const entityFile = zip.file(`entities/${type}/${id}.json`);
          if (entityFile) {
            const content = await entityFile.async("string");
            project[field].push(JSON.parse(content));
          }
        }
      }
    }

    // Load configured/custom entity types and their generic entities.
    if (projectMetadata.hasCustomTypes || projectMetadata.entityTypes) {
      const manifestTypes = entityTypes.filter((t) => !t.isBuiltIn);
      const savedTypes = Array.isArray(projectMetadata.entityTypes)
        ? projectMetadata.entityTypes
        : [];
      const configuredTypes = savedTypes.length > 0 ? savedTypes : manifestTypes;
      project.entityTypes = configuredTypes;
      project.entities = [];

      const builtInIds = new Set([
        "character",
        "characters",
        "location",
        "locations",
        "technology",
        "technologies",
        "culture",
        "cultures",
        "source",
        "sources",
        "tags",
      ]);
      for (const type of configuredTypes) {
        if (type.id === "tags") continue;
        const typeIds = builtInIds.has(type.id)
          ? entityIndex[`custom:${type.id}`] || []
          : entityIndex[`custom:${type.id}`] || entityIndex[type.id] || [];
        for (const id of typeIds) {
          const entityFile = zip.file(`entities/${type.id}/${id}.json`);
          if (entityFile) {
            const content = await entityFile.async("string");
            project.entities.push(JSON.parse(content));
          }
        }
      }

      return project as EnhancedProjectType;
    }

    return project as ProjectType;
  } catch (error) {
    console.error("Error loading project from file system:", error);
    throw new Error(
      `Failed to load project: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Check if a file path is a valid ARK project
 */
export async function isValidAhpProject(filePath: string): Promise<boolean> {
  try {
    // Ensure we're checking a .ark file
    let arkPath = filePath;
    if (!filePath.toLowerCase().endsWith(".ark")) {
      arkPath = filePath + ".ark";
    }

    // Try to read the file
    const fileContent = await readFile(arkPath);

    // Try to load as ZIP and check for required files
    const zip = new JSZip();
    await zip.loadAsync(fileContent);

    // Check for required files
    const hasManifest = zip.file("ark-manifest.json") !== null;
    const hasProject = zip.file("project.json") !== null;

    return hasManifest && hasProject;
  } catch (error) {
    // If it's not a valid ZIP or doesn't exist, return false
    return false;
  }
}
