import {
  ID,
  CharacterType,
  LocationType,
  TechnologyType,
  CultureType,
  SourceDocumentType,
  AddCharacterRequest,
  UpdateCharacterRequest,
  DeleteCharacterRequest,
  AddLocationRequest,
  UpdateLocationRequest,
  DeleteLocationRequest,
  AddTechnologyRequest,
  UpdateTechnologyRequest,
  DeleteTechnologyRequest,
  AddCultureRequest,
  UpdateCultureRequest,
  DeleteCultureRequest,
  AddSourceDocumentRequest,
  UpdateSourceDocumentRequest,
  DeleteSourceDocumentRequest,
  ApiResponse,
} from "../types";
import { invokeCommand } from "./tauriUtils";

export async function addCharacter(
  projectId: ID,
  character: Omit<CharacterType, "id">,
): Promise<ApiResponse<CharacterType>> {
  const request: AddCharacterRequest = { projectId, character };
  return invokeCommand<CharacterType>("add_character_to_project", {
    ...request,
  });
}

export async function updateCharacter(
  projectId: ID,
  character: CharacterType,
): Promise<ApiResponse<CharacterType>> {
  const request: UpdateCharacterRequest = { projectId, character };
  return invokeCommand<CharacterType>("update_character", { ...request });
}

export async function deleteCharacter(
  projectId: ID,
  characterId: ID,
): Promise<ApiResponse<null>> {
  const request: DeleteCharacterRequest = { projectId, characterId };
  return invokeCommand<null>("delete_character", { ...request });
}

export async function getProjectCharacters(
  projectId: ID,
): Promise<ApiResponse<CharacterType[]>> {
  return invokeCommand<CharacterType[]>("get_project_characters", {
    projectId,
  });
}

export async function addLocation(
  projectId: ID,
  location: Omit<LocationType, "id">,
): Promise<ApiResponse<LocationType>> {
  const request: AddLocationRequest = { projectId, location };
  return invokeCommand<LocationType>("add_location_to_project", { ...request });
}

export async function updateLocation(
  projectId: ID,
  location: LocationType,
): Promise<ApiResponse<LocationType>> {
  const request: UpdateLocationRequest = { projectId, location };
  return invokeCommand<LocationType>("update_location", { ...request });
}

export async function deleteLocation(
  projectId: ID,
  locationId: ID,
): Promise<ApiResponse<null>> {
  const request: DeleteLocationRequest = { projectId, locationId };
  return invokeCommand<null>("delete_location", { ...request });
}

export async function getProjectLocations(
  projectId: ID,
): Promise<ApiResponse<LocationType[]>> {
  return invokeCommand<LocationType[]>("get_project_locations", { projectId });
}

export async function addTechnology(
  projectId: ID,
  technology: Omit<TechnologyType, "id">,
): Promise<ApiResponse<TechnologyType>> {
  const request: AddTechnologyRequest = { projectId, technology };
  return invokeCommand<TechnologyType>("add_technology_to_project", {
    ...request,
  });
}

export async function updateTechnology(
  projectId: ID,
  technology: TechnologyType,
): Promise<ApiResponse<TechnologyType>> {
  const request: UpdateTechnologyRequest = { projectId, technology };
  return invokeCommand<TechnologyType>("update_technology", { ...request });
}

export async function deleteTechnology(
  projectId: ID,
  technologyId: ID,
): Promise<ApiResponse<null>> {
  const request: DeleteTechnologyRequest = { projectId, technologyId };
  return invokeCommand<null>("delete_technology", { ...request });
}

export async function getProjectTechnologies(
  projectId: ID,
): Promise<ApiResponse<TechnologyType[]>> {
  return invokeCommand<TechnologyType[]>("get_project_technologies", {
    projectId,
  });
}

export async function addCulture(
  projectId: ID,
  culture: Omit<CultureType, "id">,
): Promise<ApiResponse<CultureType>> {
  const request: AddCultureRequest = { projectId, culture };
  return invokeCommand<CultureType>("add_culture_to_project", { ...request });
}

export async function updateCulture(
  projectId: ID,
  culture: CultureType,
): Promise<ApiResponse<CultureType>> {
  const request: UpdateCultureRequest = { projectId, culture };
  return invokeCommand<CultureType>("update_culture", { ...request });
}

export async function deleteCulture(
  projectId: ID,
  cultureId: ID,
): Promise<ApiResponse<null>> {
  const request: DeleteCultureRequest = { projectId, cultureId };
  return invokeCommand<null>("delete_culture", { ...request });
}

export async function getProjectCultures(
  projectId: ID,
): Promise<ApiResponse<CultureType[]>> {
  return invokeCommand<CultureType[]>("get_project_cultures", { projectId });
}

export async function addSourceDocument(
  projectId: ID,
  sourceDocument: Omit<SourceDocumentType, "id">,
): Promise<ApiResponse<SourceDocumentType>> {
  const request: AddSourceDocumentRequest = { projectId, sourceDocument };
  return invokeCommand<SourceDocumentType>("add_source_document_to_project", {
    ...request,
  });
}

export async function updateSourceDocument(
  projectId: ID,
  sourceDocument: SourceDocumentType,
): Promise<ApiResponse<SourceDocumentType>> {
  const request: UpdateSourceDocumentRequest = { projectId, sourceDocument };
  return invokeCommand<SourceDocumentType>("update_source_document", {
    ...request,
  });
}

export async function deleteSourceDocument(
  projectId: ID,
  sourceDocumentId: ID,
): Promise<ApiResponse<null>> {
  const request: DeleteSourceDocumentRequest = { projectId, sourceDocumentId };
  return invokeCommand<null>("delete_source_document", { ...request });
}

export async function getProjectSourceDocuments(
  projectId: ID,
): Promise<ApiResponse<SourceDocumentType[]>> {
  return invokeCommand<SourceDocumentType[]>("get_project_source_documents", {
    projectId,
  });
}

export async function searchKnowledgeBase(
  projectId: ID,
  query: string,
  entityTypes: string[] = [
    "character",
    "location",
    "technology",
    "culture",
    "source",
  ],
): Promise<ApiResponse<Record<string, any[]>>> {
  return invokeCommand<Record<string, any[]>>("search_knowledge_base", {
    projectId,
    query,
    entityTypes,
  });
}

export async function filterEntitiesByTags(
  projectId: ID,
  entityType: string,
  tags: string[],
): Promise<ApiResponse<any[]>> {
  return invokeCommand<any[]>("filter_entities_by_tags", {
    projectId,
    entityType,
    tags,
  });
}

export async function getProjectTags(
  projectId: ID,
): Promise<ApiResponse<Record<string, string[]>>> {
  return invokeCommand<Record<string, string[]>>("get_project_tags", {
    projectId,
  });
}

export async function batchImportCharacters(
  projectId: ID,
  characters: Omit<CharacterType, "id">[],
): Promise<ApiResponse<CharacterType[]>> {
  return invokeCommand<CharacterType[]>("batch_import_characters", {
    projectId,
    characters,
  });
}

export async function batchImportLocations(
  projectId: ID,
  locations: Omit<LocationType, "id">[],
): Promise<ApiResponse<LocationType[]>> {
  return invokeCommand<LocationType[]>("batch_import_locations", {
    projectId,
    locations,
  });
}

export async function batchImportTechnologies(
  projectId: ID,
  technologies: Omit<TechnologyType, "id">[],
): Promise<ApiResponse<TechnologyType[]>> {
  return invokeCommand<TechnologyType[]>("batch_import_technologies", {
    projectId,
    technologies,
  });
}

export async function batchImportCultures(
  projectId: ID,
  cultures: Omit<CultureType, "id">[],
): Promise<ApiResponse<CultureType[]>> {
  return invokeCommand<CultureType[]>("batch_import_cultures", {
    projectId,
    cultures,
  });
}

export async function batchImportSourceDocuments(
  projectId: ID,
  sourceDocuments: Omit<SourceDocumentType, "id">[],
): Promise<ApiResponse<SourceDocumentType[]>> {
  return invokeCommand<SourceDocumentType[]>("batch_import_source_documents", {
    projectId,
    sourceDocuments,
  });
}

export async function importKnowledgeBase(
  projectId: ID,
  knowledgeBase: {
    characters: Omit<CharacterType, "id">[];
    locations: Omit<LocationType, "id">[];
    technologies: Omit<TechnologyType, "id">[];
    cultures: Omit<CultureType, "id">[];
    sourceDocuments: Omit<SourceDocumentType, "id">[];
  },
): Promise<
  ApiResponse<{
    characters: CharacterType[];
    locations: LocationType[];
    technologies: TechnologyType[];
    cultures: CultureType[];
    sourceDocuments: SourceDocumentType[];
    idMappings: Record<string, string>;
  }>
> {
  return invokeCommand("import_knowledge_base", {
    projectId,
    knowledgeBase,
  });
}

export async function checkKnowledgeBaseConflicts(
  projectId: ID,
  itemsToImport: {
    characters: Array<{ name: string; id: string }>;
    locations: Array<{ name: string; id: string }>;
    technologies: Array<{ name: string; id: string }>;
    cultures: Array<{ name: string; id: string }>;
    sourceDocuments: Array<{ title: string; id: string }>;
  },
): Promise<
  ApiResponse<{
    conflicts: Array<{
      type:
        | "character"
        | "location"
        | "technology"
        | "culture"
        | "sourceDocument";
      importingItem: { id: string; name: string };
      existingItem: { id: string; name: string };
    }>;
  }>
> {
  return invokeCommand("check_knowledge_base_conflicts", {
    projectId,
    itemsToImport,
  });
}

export async function batchImportKnowledgeBaseWithConflictResolution(
  projectId: ID,
  knowledgeBase: {
    characters: CharacterType[];
    locations: LocationType[];
    technologies: TechnologyType[];
    cultures: CultureType[];
    sourceDocuments: SourceDocumentType[];
  },
  conflictResolutions: Array<{
    originalId: string;
    type:
      | "character"
      | "location"
      | "technology"
      | "culture"
      | "sourceDocument";
    resolution: "merge" | "rename" | "skip";
    newName?: string;
    existingId?: string;
  }>,
): Promise<
  ApiResponse<{
    imported: {
      characters: CharacterType[];
      locations: LocationType[];
      technologies: TechnologyType[];
      cultures: CultureType[];
      sourceDocuments: SourceDocumentType[];
    };
    skipped: Array<{
      type: string;
      originalId: string;
      reason: string;
    }>;
    idMappings: Record<string, string>;
  }>
> {
  return invokeCommand("batch_import_knowledge_base_with_conflict_resolution", {
    projectId,
    knowledgeBase,
    conflictResolutions,
  });
}

export async function importTimelineWithKnowledgeBase(
  projectId: ID,
  timeline: Omit<import("../types").TimelineType, "id">,
  knowledgeBase: {
    characters: CharacterType[];
    locations: LocationType[];
    technologies: TechnologyType[];
    cultures: CultureType[];
    sourceDocuments: SourceDocumentType[];
  },
  options: {
    preserveKnowledgeBaseIds?: boolean;
    conflictResolution?: "merge" | "rename" | "skip";
  } = {},
): Promise<
  ApiResponse<{
    timeline: import("../types").TimelineType;
    knowledgeBase: {
      characters: CharacterType[];
      locations: LocationType[];
      technologies: TechnologyType[];
      cultures: CultureType[];
      sourceDocuments: SourceDocumentType[];
    };
    idMappings: Record<string, string>;
  }>
> {
  return invokeCommand("import_timeline_with_knowledge_base", {
    projectId,
    timeline,
    knowledgeBase,
    options,
  });
}

export async function validateKnowledgeBaseReferences(
  projectId: ID,
  events: Array<{
    id: string;
    characterIds?: string[];
    locationIds?: string[];
    technologyIds?: string[];
    cultureIds?: string[];
    sourceDocumentIds?: string[];
  }>,
): Promise<
  ApiResponse<{
    valid: boolean;
    missingReferences: Array<{
      eventId: string;
      type:
        | "character"
        | "location"
        | "technology"
        | "culture"
        | "sourceDocument";
      missingIds: string[];
    }>;
    suggestions: Array<{
      eventId: string;
      type:
        | "character"
        | "location"
        | "technology"
        | "culture"
        | "sourceDocument";
      missingId: string;
      suggestedMatches: Array<{
        id: string;
        name: string;
        similarity: number;
      }>;
    }>;
  }>
> {
  return invokeCommand("validate_knowledge_base_references", {
    projectId,
    events,
  });
}

export async function getKnowledgeBaseStats(projectId: ID): Promise<
  ApiResponse<{
    characters: {
      total: number;
      withTags: number;
      mostUsedTags: Array<{ tag: string; count: number }>;
    };
    locations: {
      total: number;
      withTags: number;
      mostUsedTags: Array<{ tag: string; count: number }>;
    };
    technologies: {
      total: number;
      withTags: number;
      mostUsedTags: Array<{ tag: string; count: number }>;
    };
    cultures: {
      total: number;
      withTags: number;
      mostUsedTags: Array<{ tag: string; count: number }>;
    };
    sourceDocuments: {
      total: number;
      withTags: number;
      mostUsedTags: Array<{ tag: string; count: number }>;
    };
    overallStats: {
      totalEntities: number;
      totalTags: number;
      mostConnectedEntities: Array<{
        type: string;
        id: string;
        name: string;
        connectionCount: number;
      }>;
    };
  }>
> {
  return invokeCommand("get_knowledge_base_stats", {
    projectId,
  });
}
