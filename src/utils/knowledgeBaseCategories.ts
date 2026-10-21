import { ProjectType } from "../types/project";
import { CustomEntityType } from "../types/dynamicEntity";

export const BUILT_IN_KB_TYPES: CustomEntityType[] = [
  {
    id: "character",
    name: "Character",
    namePlural: "Characters",
    icon: "FaUser",
    description: "",
    color: "#10B981",
    fields: [],
    canHaveTimeline: true,
    canHaveLocation: true,
    canHaveNarratives: true,
  },
  {
    id: "location",
    name: "Location",
    namePlural: "Locations",
    icon: "FaMapMarkerAlt",
    description: "",
    color: "#F59E0B",
    fields: [],
    canHaveTimeline: true,
    canHaveLocation: true,
    canHaveNarratives: true,
  },
  {
    id: "technology",
    name: "Technology",
    namePlural: "Technologies",
    icon: "FaMicrochip",
    description: "",
    color: "#8B5CF6",
    fields: [],
    canHaveTimeline: true,
    canHaveLocation: false,
    canHaveNarratives: true,
  },
  {
    id: "culture",
    name: "Culture",
    namePlural: "Cultures",
    icon: "FaGlobe",
    description: "",
    color: "#0EA5E9",
    fields: [],
    canHaveTimeline: true,
    canHaveLocation: false,
    canHaveNarratives: true,
  },
  {
    id: "source",
    name: "Source",
    namePlural: "Sources",
    icon: "FaFileAlt",
    description: "",
    color: "#64748B",
    fields: [],
    canHaveTimeline: false,
    canHaveLocation: false,
    canHaveNarratives: true,
  },
];

export const TAGS_SECTION: CustomEntityType = {
  id: "tags",
  name: "Tag",
  namePlural: "Tags",
  icon: "FaTags",
  description: "",
  color: "#6B7280",
  fields: [],
  canHaveTimeline: false,
  canHaveLocation: false,
  canHaveNarratives: false,
};

export const BUILT_IN_KB_IDS = new Set([
  ...BUILT_IN_KB_TYPES.map((type) => type.id),
  "tags",
]);

export const LEGACY_ID_ALIAS: Record<string, string> = {
  characters: "character",
  locations: "location",
  technologies: "technology",
  cultures: "culture",
  sources: "source",
};

export const LEGACY_FIELD_BY_SINGULAR: Record<string, keyof ProjectType> = {
  character: "characters",
  location: "locations",
  technology: "technologies",
  culture: "cultures",
  source: "sources",
};

export function resolveKnowledgeBaseSections(
  project: ProjectType | null | undefined,
): CustomEntityType[] {
  const byId = new Map<string, CustomEntityType>();
  for (const type of BUILT_IN_KB_TYPES) byId.set(type.id, type);

  for (const configured of project?.entityTypes || []) {
    const id = LEGACY_ID_ALIAS[configured.id] || configured.id;
    const base = byId.get(id);
    byId.set(id, {
      ...(base || {}),
      ...configured,
      id,
      fields: configured.fields || base?.fields || [],
      namePlural:
        configured.namePlural || base?.namePlural || configured.name,
    } as CustomEntityType);
  }

  const sections = Array.from(byId.values()).filter(
    (section) => section.id !== "tags",
  );
  sections.push(TAGS_SECTION);
  return sections;
}

export function sectionAliases(sectionId: string): string[] {
  const singular = LEGACY_ID_ALIAS[sectionId] || sectionId;
  if (LEGACY_FIELD_BY_SINGULAR[singular]) {
    return [singular, `${singular}s`];
  }
  return [sectionId];
}

export function knowledgeBaseEntitiesForSection(
  project: ProjectType | null | undefined,
  sectionId: string,
): any[] {
  if (!project || sectionId === "tags") return [];
  const aliases = sectionAliases(sectionId);
  const generic = (project.entities || []).filter((entity) =>
    aliases.includes(entity.entityType),
  );
  if (generic.length > 0) return generic;

  const singular = LEGACY_ID_ALIAS[sectionId] || sectionId;
  const legacyField = LEGACY_FIELD_BY_SINGULAR[singular];
  return legacyField && Array.isArray(project[legacyField])
    ? (project[legacyField] as any[])
    : [];
}
