// @ts-nocheck
// src/utils/llmUtils.ts
import { v4 as uuidv4 } from "uuid";

/**
 * Extracts JSON blocks from LLM output text
 */
export const extractJsonFromLLMOutput = (output: string): any[] => {
  const jsonBlocks: any[] = [];
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/g;

  let match;
  while ((match = jsonRegex.exec(output)) !== null) {
    try {
      const jsonContent = match[1].trim();
      const parsedJson = JSON.parse(jsonContent);
      jsonBlocks.push(parsedJson);
    } catch (e) {
      console.error(
        "Failed to parse JSON block:",
        e,
        "\nContent:",
        match[1].trim(),
      );
    }
  }
  return jsonBlocks;
};

export type SingleProjectElementType =
  | "timeline"
  | "event"
  | "character"
  | "location"
  | "technology"
  | "culture"
  | "narrative"
  | "project"
  | "unknown";

export type ArrayProjectElementType =
  | "timeline_array"
  | "event_array"
  | "character_array"
  | "location_array"
  | "technology_array"
  | "culture_array"
  | "narrative_array"
  | "project_array"
  | "unknown_array_empty"
  | "unknown_array_mixed_or_invalid";

export type ProjectElementOrArrayType =
  | SingleProjectElementType
  | ArrayProjectElementType;

export interface ValidationResult {
  valid: boolean;
  type: ProjectElementOrArrayType;
  errors: string[];
}

// --- Helper functions to check basic structure of individual objects ---
export const isTimelineObject = (obj: any): boolean => {
  return !!(
    obj &&
    typeof obj.name === "string" &&
    Array.isArray(obj.events) && // Key differentiator
    (typeof obj.color === "string" || obj.color === undefined)
  );
};

export const isEventObject = (obj: any): boolean => {
  return !!(
    obj &&
    typeof obj.title === "string" &&
    typeof obj.date === "string"
  );
};

export const isLocationObject = (obj: any): boolean => {
  return !!(
    obj &&
    typeof obj.name === "string" &&
    (typeof obj.type === "string" || obj.coordinates !== undefined) && // Location specific
    obj.events === undefined && // Not a timeline
    obj.birthDate === undefined &&
    obj.traits === undefined // Not character-like
  );
};

export const isTechnologyObject = (obj: any): boolean => {
  return !!(
    obj &&
    typeof obj.name === "string" &&
    (obj.discoveryDate !== undefined ||
      obj.developmentLevel !== undefined ||
      obj.era !== undefined ||
      obj.fields !== undefined) && // Tech specific
    obj.events === undefined &&
    obj.type === undefined &&
    obj.coordinates === undefined
  );
};

export const isCultureObject = (obj: any): boolean => {
  return !!(
    obj &&
    typeof obj.name === "string" &&
    (obj.values !== undefined ||
      obj.practices !== undefined ||
      obj.symbols !== undefined ||
      obj.languages !== undefined) && // Culture specific
    obj.events === undefined &&
    obj.type === undefined &&
    obj.coordinates === undefined
  );
};

export const isNarrativeObject = (obj: any): boolean => {
  return !!(
    obj &&
    typeof obj.title === "string" && // Narratives use 'title'
    typeof obj.description === "string" &&
    (obj.narrativeType !== undefined || Array.isArray(obj.scenes)) &&
    obj.name === undefined // Usually don't have 'name' like other entities
  );
};

// Fixed character check - more accurate detection
export const isCharacterObject = (obj: any): boolean => {
  if (!obj || typeof obj.name !== "string") return false;

  // Negative checks - ensure it's not another type
  if (obj.events !== undefined) return false; // Not a timeline
  if (obj.type !== undefined && obj.coordinates === undefined) return false; // Might be location
  if (
    obj.discoveryDate !== undefined ||
    obj.era !== undefined ||
    obj.fields !== undefined
  )
    return false; // Not tech
  if (
    obj.values !== undefined ||
    obj.practices !== undefined ||
    obj.symbols !== undefined
  )
    return false; // Not culture
  if (obj.title !== undefined) return false; // Not narrative

  // Positive indicators - at least one character-specific field
  const hasCharacterField =
    obj.description !== undefined ||
    obj.birthDate !== undefined ||
    obj.deathDate !== undefined ||
    obj.traits !== undefined ||
    obj.motivation !== undefined ||
    obj.background !== undefined ||
    obj.isHistorical !== undefined ||
    obj.locations !== undefined; // locations is a character field (array of strings)

  return hasCharacterField;
};

export const isProjectObject = (obj: any): boolean => {
  return !!(
    obj &&
    !Array.isArray(obj) &&
    ((obj.timelines && Array.isArray(obj.timelines)) ||
      (obj.characters && Array.isArray(obj.characters)) ||
      (obj.locations && Array.isArray(obj.locations)) ||
      (obj.technologies && Array.isArray(obj.technologies)) ||
      (obj.cultures && Array.isArray(obj.cultures)) ||
      (obj.narratives && Array.isArray(obj.narratives)))
  );
};

// --- Helper to get the type of a single, non-array JSON object ---
export const getSingleObjectType = (obj: any): SingleProjectElementType => {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return "unknown";
  }

  // Order matters: check most specific types first
  if (isProjectObject(obj)) return "project";
  if (isTimelineObject(obj)) return "timeline";
  if (isEventObject(obj)) return "event";
  if (isNarrativeObject(obj)) return "narrative";

  // For entities with 'name' field, check more specific types first
  if (isLocationObject(obj)) return "location";
  if (isTechnologyObject(obj)) return "technology";
  if (isCultureObject(obj)) return "culture";

  // Character is checked last among 'name' entities
  if (isCharacterObject(obj)) return "character";

  return "unknown";
};

// --- Detailed validation functions for SINGLE objects ---
const validateSingleTimeline = (
  timeline: any,
  itemLabel: string = "Timeline",
): string[] => {
  const errors: string[] = [];
  if (!isTimelineObject(timeline)) {
    errors.push(
      `${itemLabel} structure is invalid. Required: name (string), events (array). Optional: color (string).`,
    );
    return errors;
  }
  if (typeof timeline.name !== "string" || !timeline.name.trim())
    errors.push(`  ${itemLabel} 'name' is missing or empty.`);
  if (timeline.color && typeof timeline.color !== "string")
    errors.push(`  ${itemLabel} 'color' must be a string (hex code).`);
  if (!Array.isArray(timeline.events))
    errors.push(`  ${itemLabel} 'events' must be an array.`);
  else {
    timeline.events.forEach((event: any, index: number) => {
      errors.push(
        ...validateSingleEvent(event, `Event ${index + 1} in ${itemLabel}`),
      );
    });
  }
  if (
    timeline.hasOwnProperty("description") &&
    typeof timeline.description !== "string"
  )
    errors.push(`  ${itemLabel} 'description' must be a string if present.`);
  return errors;
};

// Fixed character validation
const validateSingleCharacter = (
  character: any,
  itemLabel: string = "Character",
): string[] => {
  const errors: string[] = [];

  // Basic structure check
  if (!isCharacterObject(character)) {
    errors.push(
      `${itemLabel} structure is invalid. Ensure it has character-specific fields.`,
    );
    return errors;
  }

  // Required fields
  if (typeof character.name !== "string" || !character.name.trim())
    errors.push(`  ${itemLabel} 'name' is missing or empty.`);

  // Optional but typed fields
  if (
    character.description !== undefined &&
    typeof character.description !== "string"
  )
    errors.push(`  ${itemLabel} 'description' must be a string.`);

  if (character.traits && !Array.isArray(character.traits))
    errors.push(`  ${itemLabel} 'traits' must be an array.`);

  // Validate locations - should be strings, not objects
  if (character.locations) {
    if (!Array.isArray(character.locations)) {
      errors.push(`  ${itemLabel} 'locations' must be an array.`);
    } else {
      character.locations.forEach((loc: any, idx: number) => {
        if (typeof loc !== "string") {
          errors.push(
            `  ${itemLabel} location ${idx + 1} must be a string (location name).`,
          );
        }
      });
    }
  }

  if (character.tags && !Array.isArray(character.tags))
    errors.push(`  ${itemLabel} 'tags' must be an array.`);

  if (
    character.isHistorical !== undefined &&
    typeof character.isHistorical !== "boolean"
  )
    errors.push(`  ${itemLabel} 'isHistorical' must be a boolean.`);

  if (character.timelineIds && !Array.isArray(character.timelineIds))
    errors.push(`  ${itemLabel} 'timelineIds' must be an array.`);

  if (character.linkedEventIds && !Array.isArray(character.linkedEventIds))
    errors.push(`  ${itemLabel} 'linkedEventIds' must be an array.`);

  return errors;
};

const validateSingleEvent = (
  event: any,
  itemLabel: string = "Event",
): string[] => {
  const errors: string[] = [];
  if (!isEventObject(event)) {
    errors.push(
      `${itemLabel} structure is invalid. Required: title (string), date (string).`,
    );
    return errors;
  }
  if (typeof event.title !== "string" || !event.title.trim())
    errors.push(`  ${itemLabel} 'title' is missing or empty.`);
  if (typeof event.date !== "string" || !event.date.trim())
    errors.push(`  ${itemLabel} 'date' is missing or empty.`);
  return errors;
};

const validateSingleLocation = (
  location: any,
  itemLabel: string = "Location",
): string[] => {
  const errors: string[] = [];
  if (!isLocationObject(location)) {
    errors.push(
      `${itemLabel} structure is invalid. Expected name and location-specific fields like 'type' or 'coordinates'.`,
    );
    return errors;
  }
  if (typeof location.name !== "string" || !location.name.trim())
    errors.push(`  ${itemLabel} 'name' is missing or empty.`);
  if (location.hasOwnProperty("type") && typeof location.type !== "string")
    errors.push(`  ${itemLabel} 'type' must be a string if present.`);
  return errors;
};

const validateSingleTechnology = (
  tech: any,
  itemLabel: string = "Technology",
): string[] => {
  const errors: string[] = [];
  if (!isTechnologyObject(tech)) {
    errors.push(
      `${itemLabel} structure is invalid. Expected name and tech-specific fields like 'era' or 'discoveryDate'.`,
    );
    return errors;
  }
  if (typeof tech.name !== "string" || !tech.name.trim())
    errors.push(`  ${itemLabel} 'name' is missing or empty.`);
  return errors;
};

const validateSingleCulture = (
  culture: any,
  itemLabel: string = "Culture",
): string[] => {
  const errors: string[] = [];
  if (!isCultureObject(culture)) {
    errors.push(
      `${itemLabel} structure is invalid. Expected name and culture-specific fields like 'values' or 'symbols'.`,
    );
    return errors;
  }
  if (typeof culture.name !== "string" || !culture.name.trim())
    errors.push(`  ${itemLabel} 'name' is missing or empty.`);
  return errors;
};

const validateSingleNarrative = (
  narrative: any,
  itemLabel: string = "Narrative",
): string[] => {
  const errors: string[] = [];
  if (!isNarrativeObject(narrative)) {
    errors.push(
      `${itemLabel} structure is invalid. Required: title (string), description (string), and narrativeType or scenes.`,
    );
    return errors;
  }
  if (typeof narrative.title !== "string" || !narrative.title.trim())
    errors.push(`  ${itemLabel} 'title' is missing or empty.`);
  if (typeof narrative.description !== "string")
    errors.push(`  ${itemLabel} 'description' (string) is required.`);
  return errors;
};

const validateSingleProject = (
  projectData: any,
  itemLabel: string = "Project",
): string[] => {
  const errors: string[] = [];
  if (!isProjectObject(projectData)) {
    errors.push(`${itemLabel} is not a valid project object.`);
    return errors;
  }

  const validateArrayIfPresent = (
    validator: (item: any, label: string) => string[],
    arrName: string,
    itemName: string,
  ) => {
    if (projectData[arrName] !== undefined) {
      if (Array.isArray(projectData[arrName])) {
        projectData[arrName].forEach((item: any, index: number) => {
          // Skip validation if this is the locations field and items are strings
          if (arrName === "locations" && typeof item === "string") {
            return; // This is valid - locations in characters are strings
          }
          errors.push(
            ...validator(item, `${itemName} ${index + 1} in Project`),
          );
        });
      } else {
        errors.push(
          `${itemLabel} '${arrName}' property must be an array if present.`,
        );
      }
    }
  };

  validateArrayIfPresent(validateSingleTimeline, "timelines", "Timeline");
  validateArrayIfPresent(validateSingleCharacter, "characters", "Character");
  validateArrayIfPresent(validateSingleLocation, "locations", "Location");
  validateArrayIfPresent(
    validateSingleTechnology,
    "technologies",
    "Technology",
  );
  validateArrayIfPresent(validateSingleCulture, "cultures", "Culture");
  validateArrayIfPresent(validateSingleNarrative, "narratives", "Narrative");

  return errors;
};

// --- Main validation function ---
export const validateProjectElement = (json: any): ValidationResult => {
  if (json === null || typeof json !== "object") {
    return {
      valid: false,
      type: "unknown",
      errors: ["Input must be a JSON object or array."],
    };
  }

  if (Array.isArray(json)) {
    if (json.length === 0) {
      return { valid: true, type: "unknown_array_empty", errors: [] };
    }

    const firstElementRawType = getSingleObjectType(json[0]);

    if (firstElementRawType === "unknown") {
      // Special case: might be an event array
      if (json.every(isEventObject)) {
        let allErrors: string[] = [];
        json.forEach((item, i) =>
          allErrors.push(...validateSingleEvent(item, `Event item ${i + 1}`)),
        );
        return {
          valid: allErrors.length === 0,
          type: "event_array",
          errors: allErrors,
        };
      }
      return {
        valid: false,
        type: "unknown_array_mixed_or_invalid",
        errors: [
          "Array elements are not a recognized uniform entity type or are mixed.",
        ],
      };
    }

    const arrayElementType = firstElementRawType;
    let allErrors: string[] = [];
    let allSameType = true;

    // Fixed: Proper TypeScript generic syntax on one line
    const singleValidatorMap: Record<
      string,
      (obj: any, label?: string) => string[]
    > = {
      timeline: validateSingleTimeline,
      character: validateSingleCharacter,
      event: validateSingleEvent,
      location: validateSingleLocation,
      technology: validateSingleTechnology,
      culture: validateSingleCulture,
      narrative: validateSingleNarrative,
      project: validateSingleProject,
    };

    const validator = singleValidatorMap[arrayElementType];

    if (!validator) {
      return {
        valid: false,
        type: "unknown_array_mixed_or_invalid",
        errors: [
          `No validator for detected array element type: ${arrayElementType}`,
        ],
      };
    }

    for (let i = 0; i < json.length; i++) {
      const element = json[i];
      if (getSingleObjectType(element) !== arrayElementType) {
        allSameType = false;
        allErrors.push(
          `Array contains mixed element types. Expected ${arrayElementType} but found ${getSingleObjectType(element)} at index ${i}.`,
        );
        break;
      }
      allErrors.push(
        ...validator(element, `${arrayElementType} item ${i + 1}`),
      );
    }

    if (!allSameType) {
      return {
        valid: false,
        type: "unknown_array_mixed_or_invalid",
        errors: allErrors,
      };
    }

    const arrayType = `${arrayElementType}_array` as ArrayProjectElementType;
    return {
      valid: allErrors.length === 0,
      type: arrayType,
      errors: allErrors,
    };
  }

  // Handle single object
  const objectType = getSingleObjectType(json);
  let errors: string[] = [];

  switch (objectType) {
    case "timeline":
      errors = validateSingleTimeline(json);
      break;
    case "character":
      errors = validateSingleCharacter(json);
      break;
    case "event":
      errors = validateSingleEvent(json);
      break;
    case "location":
      errors = validateSingleLocation(json);
      break;
    case "technology":
      errors = validateSingleTechnology(json);
      break;
    case "culture":
      errors = validateSingleCulture(json);
      break;
    case "narrative":
      errors = validateSingleNarrative(json);
      break;
    case "project":
      errors = validateSingleProject(json);
      break;
    default:
      errors.push(
        "Object does not match any known single entity type: " +
          JSON.stringify(json, null, 2).substring(0, 100) +
          "...",
      );
      return { valid: false, type: "unknown", errors };
  }
  return { valid: errors.length === 0, type: objectType, errors };
};

// --- Normalization Functions ---
export const formatDateString = (
  dateStr: string | null | undefined,
): string => {
  if (!dateStr) return "";
  try {
    const bceMatch = dateStr.match(/(\d+)\s*(BCE|BC)/i);
    if (bceMatch) {
      const year = parseInt(bceMatch[1]);
      if (!isNaN(year)) return `-${String(year).padStart(4, "0")}`;
    }
    const ceMatch = dateStr.match(/(\d+)\s*(CE|AD)/i);
    if (ceMatch) {
      const year = parseInt(ceMatch[1]);
      if (!isNaN(year)) return String(year).padStart(4, "0");
    }
    if (/^\-?\d{1,4}$/.test(dateStr.trim())) {
      const num = parseInt(dateStr.trim());
      if (num < 0) return `-${String(Math.abs(num)).padStart(4, "0")}`;
      return String(num).padStart(4, "0");
    }
    const isoLikeMatch = dateStr.match(
      /^(\-?\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:T.*)?$/,
    );
    if (isoLikeMatch) {
      const year = isoLikeMatch[1];
      const month = isoLikeMatch[2];
      const day = isoLikeMatch[3];
      if (month && day) return `${year}-${month}-${day}`;
      if (month) return `${year}-${month}`;
      return year;
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      if (
        /^\d{1,4}$/.test(dateStr.trim()) &&
        date.getFullYear().toString() === dateStr.trim()
      ) {
        return dateStr.trim().padStart(4, "0");
      }
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      if (year < 0)
        return `-${String(Math.abs(year)).padStart(4, "0")}-${month}-${day}`;
      return `${String(year).padStart(4, "0")}-${month}-${day}`;
    }
    return dateStr;
  } catch (e) {
    console.warn("Error formatting date string:", dateStr, e);
    return dateStr;
  }
};

export const ensureObjectDefaults = <T extends object>(
  obj: any,
  defaults: T,
): T => {
  const result: any = { ...defaults };
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    for (const key in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, key)) {
        result[key] =
          obj[key] !== undefined ? obj[key] : defaults[key as keyof T];
      }
    }
    for (const key in obj) {
      if (
        Object.prototype.hasOwnProperty.call(obj, key) &&
        !Object.prototype.hasOwnProperty.call(defaults, key)
      ) {
        result[key] = obj[key];
      }
    }
  } else if (obj && typeof obj === "object" && Array.isArray(obj)) {
    console.warn(
      "ensureObjectDefaults received an array, returning defaults.",
      obj,
    );
  }
  return result as T;
};

export const normalizeTimeline = (timelineData: any): any => {
  const defaults = {
    name: "Untitled Timeline",
    description: "",
    color: "#E74C3C",
    events: [],
    pointsOfDivergence: [],
    startDate: "",
    endDate: "",
    isMainTimeline: false,
    parentTimelineId: null,
    branchFromEventId: null,
    tags: [],
  };
  const ensuredTimeline = ensureObjectDefaults(timelineData, defaults);
  const newId = timelineData.id || uuidv4();
  return {
    ...ensuredTimeline,
    id: newId,
    events: Array.isArray(ensuredTimeline.events)
      ? ensuredTimeline.events.map((event: any) =>
          normalizeEvent(event, newId, ensuredTimeline.color),
        )
      : [],
    pointsOfDivergence: Array.isArray(ensuredTimeline.pointsOfDivergence)
      ? ensuredTimeline.pointsOfDivergence.map((pod: any) => ({
          ...pod,
          id: pod.id || uuidv4(),
        }))
      : [],
    startDate: formatDateString(ensuredTimeline.startDate),
    endDate: formatDateString(ensuredTimeline.endDate),
  };
};

// Helper function for normalizing related character IDs
function normalizeRelatedCharacterIds(
  relatedIds: any,
): Record<string, string[]> {
  if (!relatedIds || typeof relatedIds !== "object") {
    return {};
  }

  const normalized: Record<string, string[]> = {};

  for (const [key, value] of Object.entries(relatedIds)) {
    if (Array.isArray(value)) {
      normalized[key] = value.filter((id) => typeof id === "string");
    } else if (typeof value === "string") {
      normalized[key] = [value];
    } else {
      normalized[key] = [];
    }
  }

  return normalized;
}

// Fixed CharacterType interface
export interface CharacterType {
  name: string;
  description: string;
  birthDate: string | null;
  deathDate: string | null;
  traits: string[];
  motivation: string;
  background: string;
  isHistorical: boolean;
  imageUrl: string | null;
  linkedTimelineIds: string[]; // or timelineIds depending on your actual type
  linkedEventIds: string[];
  relatedCharacterIds: Record<string, string[]>;
  locations: string[]; // Changed to string array
  tags: string[];
  notes: string;
}

// Fixed normalizeCharacter
export const normalizeCharacter = (character: any): Partial<CharacterType> => {
  return {
    name: character.name || "Unnamed Character",
    description: character.description || "",
    birthDate: character.birthDate || null,
    deathDate: character.deathDate || null,
    traits: Array.isArray(character.traits) ? character.traits : [],
    motivation: character.motivation || "",
    background: character.background || "",
    isHistorical:
      character.isHistorical !== undefined ? character.isHistorical : true,
    imageUrl: character.imageUrl || null,
    // Handle both field names for compatibility
    linkedTimelineIds: Array.isArray(character.timelineIds)
      ? character.timelineIds
      : Array.isArray(character.linkedTimelineIds)
        ? character.linkedTimelineIds
        : [],
    linkedEventIds: Array.isArray(character.linkedEventIds)
      ? character.linkedEventIds
      : [],
    relatedCharacterIds: normalizeRelatedCharacterIds(
      character.relatedCharacterIds,
    ),
    // Keep locations as strings
    locations: Array.isArray(character.locations)
      ? character.locations.filter((loc: any) => typeof loc === "string")
      : [],
    tags: Array.isArray(character.tags) ? character.tags : [],
    notes: character.notes || "",
  };
};

export const normalizeEvent = (
  eventData: any,
  timelineIdProp?: string,
  defaultTimelineColor?: string,
): any => {
  const defaults = {
    title: "Untitled Event",
    description: "",
    date: new Date().toISOString().split("T")[0],
    endDate: null,
    timelineId: timelineIdProp || "",
    importance: 5,
    iconId: "default",
    causes: [],
    effects: [],
    linkedCharacterIds: [],
    linkedLocationIds: [],
    linkedTechnologyIds: [],
    linkedCultureIds: [],
    linkedSourceDocumentIds: [],
    linkedNarrativeIds: [],
    notes: "",
    tags: [],
    isPointOfDivergence: false,
    color: defaultTimelineColor || "#3498DB",
    position: undefined,
  };
  const ensuredEvent = ensureObjectDefaults(eventData, defaults);
  return {
    ...ensuredEvent,
    id: eventData.id || uuidv4(),
    date: formatDateString(ensuredEvent.date),
    endDate: formatDateString(ensuredEvent.endDate),
    timelineId: ensuredEvent.timelineId || timelineIdProp || "",
    color: ensuredEvent.color || defaultTimelineColor || "#3498DB",
  };
};

export const normalizeLocation = (locationData: any): any => {
  const defaults = {
    name: "Unnamed Location",
    description: "",
    coordinates: null,
    timelineIds: [],
    parentLocationId: null,
    linkedEventIds: [],
    foundedDate: null,
    destroyedDate: null,
    population: null,
    importance: 5,
    type: "Unknown",
    notes: "",
    mapUrl: null,
    tags: [],
    color: "#9B59B6",
  };
  const ensuredLocation = ensureObjectDefaults(locationData, defaults);
  return {
    ...ensuredLocation,
    id: locationData.id || uuidv4(),
    foundedDate: formatDateString(ensuredLocation.foundedDate),
    destroyedDate: formatDateString(ensuredLocation.destroyedDate),
  };
};

export const normalizeTechnology = (technologyData: any): any => {
  const defaults = {
    name: "Unnamed Technology",
    description: "",
    discoveryDate: null,
    timelineIds: [],
    prerequisiteTechIds: [],
    derivedTechIds: [],
    inventors: [],
    linkedEventIds: [],
    developmentLevel: 5,
    impact: 5,
    fields: [],
    notes: "",
    tags: [],
    era: "Future",
    color: "#E67E22",
  };
  const ensuredTechnology = ensureObjectDefaults(technologyData, defaults);
  return {
    ...ensuredTechnology,
    id: technologyData.id || uuidv4(),
    discoveryDate: formatDateString(ensuredTechnology.discoveryDate),
  };
};

export const normalizeCulture = (cultureData: any): any => {
  const defaults = {
    name: "Unnamed Culture",
    description: "",
    foundedDate: null,
    endDate: null,
    timelineIds: [],
    linkedLocationIds: [],
    linkedCharacterIds: [],
    linkedEventIds: [],
    values: [],
    practices: [],
    languages: [],
    beliefs: [],
    notes: "",
    imageUrl: null,
    tags: [],
    symbols: [],
    color: "#F1C40F",
  };
  const ensuredCulture = ensureObjectDefaults(cultureData, defaults);
  return {
    ...ensuredCulture,
    id: cultureData.id || uuidv4(),
    foundedDate: formatDateString(ensuredCulture.foundedDate),
    endDate: formatDateString(ensuredCulture.endDate),
  };
};

export const normalizeNarrative = (narrativeData: any): any => {
  const defaults = {
    title: "Untitled Narrative",
    description: "",
    scenes: [],
    relatedEventIds: [],
    relatedCharacterIds: [],
    relatedLocationIds: [],
    relatedTimelineIds: [],
    narrativeType: "general",
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    color: "#C0392B",
  };

  const ensuredNarrative = ensureObjectDefaults(narrativeData, defaults);

  // Process scenes - handle both strings and objects
  let normalizedScenes = [];
  if (Array.isArray(ensuredNarrative.scenes)) {
    normalizedScenes = ensuredNarrative.scenes.map(
      (scene: any, index: number) => {
        // If scene is just a string, convert to proper scene object
        if (typeof scene === "string") {
          return {
            id: uuidv4(),
            title: `Scene ${index + 1}`,
            content: scene,
            order: index,
            characterIds: [],
            locationIds: [],
            eventIds: [],
          };
        }

        // If it's an object but might be corrupted (has numeric keys)
        if (typeof scene === "object" && !Array.isArray(scene)) {
          // Check if it's a corrupted string-as-object (has keys 0, 1, 2, etc.)
          if ("0" in scene && "1" in scene) {
            // Reconstruct the string from the numeric keys
            const reconstructed = Object.keys(scene)
              .filter((key) => !isNaN(Number(key)))
              .sort((a, b) => Number(a) - Number(b))
              .map((key) => scene[key])
              .join("");

            return {
              id: scene.id || uuidv4(),
              title: `Scene ${index + 1}`,
              content: reconstructed,
              order: index,
              characterIds: [],
              locationIds: [],
              eventIds: [],
            };
          }

          // Normal scene object - ensure it has all required fields
          return {
            id: scene.id || uuidv4(),
            title: scene.title || `Scene ${index + 1}`,
            content: scene.content || "",
            order: scene.order !== undefined ? scene.order : index,
            characterIds: scene.characterIds || [],
            locationIds: scene.locationIds || [],
            eventIds: scene.eventIds || [],
          };
        }

        // Fallback for any other type
        return {
          id: uuidv4(),
          title: `Scene ${index + 1}`,
          content: String(scene),
          order: index,
          characterIds: [],
          locationIds: [],
          eventIds: [],
        };
      },
    );
  }

  return {
    ...ensuredNarrative,
    id: narrativeData.id || uuidv4(),
    scenes: normalizedScenes,
    createdAt: ensuredNarrative.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};
