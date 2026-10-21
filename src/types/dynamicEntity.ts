export type ID = string;

export type FieldType =
  | "text"
  | "textarea"
  | "date"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "reference"
  | "tag_list"
  | "coordinates"
  | "url"
  | "email"
  | "rich_text";

export interface FieldConfig {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  description?: string;
  defaultValue?: any;

  options?: string[];

  referenceEntityType?: string;
  allowMultiple?: boolean;

  min?: number;
  max?: number;
  step?: number;

  maxLength?: number;
  pattern?: string;

  showInCard?: boolean;
  showInDetails?: boolean;
  searchable?: boolean;
  sortable?: boolean;
}

export interface CustomEntityType {
  id: string;
  name: string;
  namePlural: string;
  description: string;
  icon: string;
  color: string;

  fields: FieldConfig[];

  canHaveTimeline: boolean;
  canHaveLocation: boolean;
  canHaveNarratives: boolean;

  cardTemplate?: string;
  listTemplate?: string;

  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  id: string;
  name: string;
  type: "required" | "unique" | "format" | "dependency" | "custom";
  field: string;
  condition?: any;
  message: string;
  enabled: boolean;
}

export interface GenericEntity {
  id: ID;
  entityType: string;

  name: string;
  description: string;
  tags: string[];
  sourceDocumentIds: ID[];
  createdAt: string;
  updatedAt: string;

  fields: Record<string, any>;

  timelineIds?: ID[];
  coordinates?: { lat: number; lng: number };
  linkedEventIds?: ID[];
  linkedNarrativeIds?: ID[];

  sourceAPI?: {
    sourceId: ID;
    lastUpdated: string;
    originalData?: any;
  };
}

export interface DomainPreset {
  id: string;
  name: string;
  description: string;
  category:
    | "research"
    | "creative"
    | "business"
    | "technical"
    | "legal"
    | "custom";

  entityTypes: CustomEntityType[];

  defaultSettings?: {
    timelineRequired?: boolean;
    mapEnabled?: boolean;
    narrativeEnabled?: boolean;
    consistencyCheckEnabled?: boolean;
  };

  sampleData?: {
    entities?: Partial<GenericEntity>[];
    timelines?: any[];
  };
}

export interface EnhancedProjectType {
  id: ID;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  version: string;

  domainPreset?: string;

  entityTypes: CustomEntityType[];
  entities: GenericEntity[];

  characters?: any[];
  locations?: any[];
  technologies?: any[];
  cultures?: any[];
  sourceDocuments?: any[];

  timelines: any[];
  narratives: any[];
  mapData?: any;
  apiSettings?: any;
}

export interface MigrationResult {
  success: boolean;
  migratedEntities: number;
  errors: string[];
  warnings: string[];
}

export interface GenericSearchResult {
  id: string;
  entityType: string;
  entityTypeName: string;
  name: string;
  description: string | null;
  matchType: "name" | "description" | "fields" | "tags";
  matchText: string;
  entityId: ID;
  tags?: string[];
  icon?: string;
  color?: string;
}

export const DOMAIN_PRESETS: DomainPreset[] = [
  {
    id: "history_research",
    name: "History Research",
    description:
      "Perfect for personal records, research, and lived experience",
    category: "research",
    entityTypes: [
      {
        id: "character",
        name: "Character",
        namePlural: "Characters",
        description:
          "Historical figures, fictional characters, and people of interest",
        icon: "FaUser",
        color: "#10B981",
        canHaveTimeline: true,
        canHaveLocation: true,
        canHaveNarratives: true,
        fields: [
          {
            id: "birth_date",
            name: "Birth Date",
            type: "date",
            required: false,
            showInCard: true,
          },
          {
            id: "death_date",
            name: "Death Date",
            type: "date",
            required: false,
            showInCard: true,
          },
          {
            id: "background",
            name: "Background",
            type: "rich_text",
            required: false,
            showInDetails: true,
          },
          {
            id: "motivation",
            name: "Motivation",
            type: "textarea",
            required: false,
            showInDetails: true,
          },
          {
            id: "traits",
            name: "Traits",
            type: "tag_list",
            required: false,
            showInCard: true,
          },
          {
            id: "is_historical",
            name: "Historical Figure",
            type: "boolean",
            required: false,
            defaultValue: false,
          },
          { id: "image_url", name: "Image URL", type: "url", required: false },
          {
            id: "related_characters",
            name: "Related Characters",
            type: "reference",
            referenceEntityType: "character",
            allowMultiple: true,
            required: false,
          },
        ],
      },
      {
        id: "location",
        name: "Location",
        namePlural: "Locations",
        description: "Places, regions, cities, and geographical features",
        icon: "FaMapMarkerAlt",
        color: "#F59E0B",
        canHaveTimeline: true,
        canHaveLocation: true,
        canHaveNarratives: true,
        fields: [
          {
            id: "coordinates",
            name: "Coordinates",
            type: "coordinates",
            required: false,
            showInCard: true,
          },
          {
            id: "founded_date",
            name: "Founded Date",
            type: "date",
            required: false,
            showInCard: true,
          },
          {
            id: "destroyed_date",
            name: "Destroyed Date",
            type: "date",
            required: false,
          },
          {
            id: "population",
            name: "Population",
            type: "number",
            required: false,
            min: 0,
          },
          {
            id: "importance",
            name: "Importance",
            type: "select",
            options: ["Low", "Medium", "High", "Critical"],
            required: false,
            defaultValue: "Medium",
          },
          {
            id: "location_type",
            name: "Type",
            type: "select",
            options: [
              "City",
              "Region",
              "Landmark",
              "Battle Site",
              "Port",
              "Fortress",
              "Other",
            ],
            required: false,
          },
          {
            id: "parent_location",
            name: "Parent Location",
            type: "reference",
            referenceEntityType: "location",
            required: false,
          },
        ],
      },
      {
        id: "technology",
        name: "Technology",
        namePlural: "Technologies",
        description: "Inventions, discoveries, and technological developments",
        icon: "FaMicrochip",
        color: "#8B5CF6",
        canHaveTimeline: true,
        canHaveLocation: false,
        canHaveNarratives: true,
        fields: [
          {
            id: "discovery_date",
            name: "Discovery Date",
            type: "date",
            required: false,
            showInCard: true,
          },
          {
            id: "inventors",
            name: "Inventors",
            type: "reference",
            referenceEntityType: "character",
            allowMultiple: true,
            required: false,
          },
          {
            id: "prerequisites",
            name: "Prerequisites",
            type: "reference",
            referenceEntityType: "technology",
            allowMultiple: true,
            required: false,
          },
          {
            id: "derived_tech",
            name: "Derived Technologies",
            type: "reference",
            referenceEntityType: "technology",
            allowMultiple: true,
            required: false,
          },
          {
            id: "development_level",
            name: "Development Level",
            type: "number",
            min: 1,
            max: 10,
            required: false,
            defaultValue: 5,
          },
          {
            id: "impact",
            name: "Impact Level",
            type: "select",
            options: [
              "Minimal",
              "Local",
              "Regional",
              "Global",
              "Revolutionary",
            ],
            required: false,
          },
          {
            id: "fields",
            name: "Fields of Application",
            type: "tag_list",
            required: false,
          },
        ],
      },
      {
        id: "culture",
        name: "Culture",
        namePlural: "Cultures",
        description: "Civilizations, societies, and cultural groups",
        icon: "FaGlobe",
        color: "#EC4899",
        canHaveTimeline: true,
        canHaveLocation: true,
        canHaveNarratives: true,
        fields: [
          {
            id: "founded_date",
            name: "Founded Date",
            type: "date",
            required: false,
          },
          { id: "end_date", name: "End Date", type: "date", required: false },
          { id: "values", name: "Values", type: "tag_list", required: false },
          {
            id: "practices",
            name: "Practices",
            type: "tag_list",
            required: false,
          },
          {
            id: "languages",
            name: "Languages",
            type: "tag_list",
            required: false,
          },
          { id: "beliefs", name: "Beliefs", type: "tag_list", required: false },
          { id: "image_url", name: "Image URL", type: "url", required: false },
        ],
      },
    ],
  },
  {
    id: "creative_writing",
    name: "Creative Writing",
    description: "For authors, screenwriters, and creative storytellers",
    category: "creative",
    entityTypes: [
      {
        id: "character",
        name: "Character",
        namePlural: "Characters",
        description: "Protagonists, antagonists, and supporting characters",
        icon: "FaUser",
        color: "#10B981",
        canHaveTimeline: true,
        canHaveLocation: true,
        canHaveNarratives: true,
        fields: [
          {
            id: "age",
            name: "Age",
            type: "number",
            required: false,
            min: 0,
            max: 200,
          },
          {
            id: "role",
            name: "Role",
            type: "select",
            options: [
              "Protagonist",
              "Antagonist",
              "Supporting",
              "Minor",
              "Cameo",
            ],
            required: false,
          },
          {
            id: "personality",
            name: "Personality",
            type: "textarea",
            required: false,
          },
          {
            id: "backstory",
            name: "Backstory",
            type: "rich_text",
            required: false,
          },
          { id: "goals", name: "Goals", type: "textarea", required: false },
          {
            id: "conflicts",
            name: "Conflicts",
            type: "textarea",
            required: false,
          },
          {
            id: "relationships",
            name: "Relationships",
            type: "reference",
            referenceEntityType: "character",
            allowMultiple: true,
            required: false,
          },
          {
            id: "appearance",
            name: "Physical Appearance",
            type: "textarea",
            required: false,
          },
        ],
      },
      {
        id: "setting",
        name: "Setting",
        namePlural: "Settings",
        description: "Worlds, locations, and environments",
        icon: "FaMapMarkerAlt",
        color: "#F59E0B",
        canHaveTimeline: true,
        canHaveLocation: true,
        canHaveNarratives: true,
        fields: [
          {
            id: "setting_type",
            name: "Type",
            type: "select",
            options: [
              "World",
              "Country",
              "City",
              "Building",
              "Room",
              "Landscape",
              "Other",
            ],
            required: false,
          },
          {
            id: "time_period",
            name: "Time Period",
            type: "text",
            required: false,
          },
          {
            id: "atmosphere",
            name: "Atmosphere",
            type: "textarea",
            required: false,
          },
          {
            id: "significance",
            name: "Plot Significance",
            type: "textarea",
            required: false,
          },
          {
            id: "parent_setting",
            name: "Parent Setting",
            type: "reference",
            referenceEntityType: "setting",
            required: false,
          },
        ],
      },
      {
        id: "plot_device",
        name: "Plot Device",
        namePlural: "Plot Devices",
        description: "Plot elements, MacGuffins, and story mechanisms",
        icon: "FaCog",
        color: "#8B5CF6",
        canHaveTimeline: true,
        canHaveLocation: false,
        canHaveNarratives: true,
        fields: [
          {
            id: "device_type",
            name: "Type",
            type: "select",
            options: [
              "MacGuffin",
              "Red Herring",
              "Chekhov's Gun",
              "Deus Ex Machina",
              "Plot Twist",
              "Other",
            ],
            required: false,
          },
          { id: "purpose", name: "Purpose", type: "textarea", required: false },
          {
            id: "introduction",
            name: "How Introduced",
            type: "textarea",
            required: false,
          },
          {
            id: "resolution",
            name: "How Resolved",
            type: "textarea",
            required: false,
          },
        ],
      },
      {
        id: "theme",
        name: "Theme",
        namePlural: "Themes",
        description: "Central themes, motifs, and symbolic elements",
        icon: "FaLightbulb",
        color: "#EC4899",
        canHaveTimeline: false,
        canHaveLocation: false,
        canHaveNarratives: true,
        fields: [
          {
            id: "theme_type",
            name: "Type",
            type: "select",
            options: [
              "Central Theme",
              "Motif",
              "Symbol",
              "Archetype",
              "Moral",
              "Other",
            ],
            required: false,
          },
          {
            id: "manifestation",
            name: "How It Manifests",
            type: "rich_text",
            required: false,
          },
          {
            id: "related_characters",
            name: "Related Characters",
            type: "reference",
            referenceEntityType: "character",
            allowMultiple: true,
            required: false,
          },
          {
            id: "related_settings",
            name: "Related Settings",
            type: "reference",
            referenceEntityType: "setting",
            allowMultiple: true,
            required: false,
          },
        ],
      },
    ],
  },
];
