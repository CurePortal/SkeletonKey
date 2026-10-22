import { Node, Edge } from "@xyflow/react";
import {
  CustomEntityType as DynamicEntityType,
  GenericEntity,
} from "./dynamicEntity";

export type ID = string;

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface MapIcon {
  id: string;
  name: string;
  category: string;
  svg: string;
  color?: string;
  size?: [number, number];
  anchor?: [number, number];
}

export interface IconPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectIcon: (iconId: string) => void;
  selectedIconId?: string;
  title?: string;
}

export interface DataMapping {
  rootPath?: string;
  fieldMappings: FieldMapping[];
  extractionRules: ExtractionRule[];
}

export interface FieldMapping {
  id: string;
  sourcePath: string;
  sourceType: "string" | "number" | "boolean" | "object" | "array";
  targetCategory: KnowledgeBaseCategory;
  targetField: string;
  transform?:
    | "none"
    | "lowercase"
    | "uppercase"
    | "trim"
    | "split"
    | "join"
    | "date";
  enabled: boolean;
  preview?: string;
}

export interface ExtractionRule {
  id: string;
  name: string;
  condition: string;
  mappings: FieldMapping[];
}

export type KnowledgeBaseCategory =
  | "characters"
  | "locations"
  | "technologies"
  | "cultures"
  | "events"
  | "general";

export interface SceneType {
  id: ID;
  title: string;
  description: string;
  content: string;
  order: number;
  characters?: ID[];
  locations?: ID[];
  eventIds?: ID[];
  notes: string;
  technologies?: ID[];
  cultures?: ID[];
  sources?: ID[];
}

export interface LocationType {
  id: ID;
  name: string;
  description: string;
  coordinates: Coordinates | null;
  timelineIds: ID[];
  parentLocationId: ID | null;
  linkedEventIds: ID[];
  foundedDate: string | null;
  destroyedDate: string | null;
  population: number | null;
  importance: number;
  type: string;
  notes: string;
  mapUrl: string | null;
  tags: string[];
  mapData?: {
    importance: "low" | "medium" | "high";
    category:
      | "city"
      | "landmark"
      | "region"
      | "battle"
      | "port"
      | "fortress"
      | "other";
    customIcon?: string;
    color?: string;
    zoomThreshold?: number;
    alternativeNames?: string[];
  };
  properties?: {
    [key: string]: any;
    importedIconId?: string;
    originalIconUrl?: string;
    iconId?: string;
    customIcon?: {
      url: string;
      name: string;
    };
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AnchoredShape {
  id: string;
  type:
    | "polygon"
    | "polyline"
    | "circle"
    | "rectangle"
    | "marker"
    | "text"
    | "arrow";
  anchor: {
    locationId: string | "origin";
    offsetLat: number;
    offsetLng: number;
    anchorType: "center" | "corner" | "edge";
  };
  secondaryAnchors?: Array<{
    locationId: string;
    offsetLat: number;
    offsetLng: number;
    weight: number;
  }>;
  geometry: {
    points?: Array<{ lat: number; lng: number }>;
    radius?: number;
    width?: number;
    height?: number;
    text?: string;
    fontSize?: number;
    direction?: number;
    length?: number;
  };
  style: {
    color?: string;
    fillColor?: string;
    strokeWidth?: number;
    opacity?: number;
    fillOpacity?: number;
    dashArray?: string;
    zIndex?: number;
  };
  properties: {
    name?: string;
    description?: string;
    category?:
      | "political"
      | "military"
      | "trade"
      | "cultural"
      | "geographical"
      | "custom";
    timelineId?: string;
    dateCreated: string;
    dateModified?: string;
    tags?: string[];
    visibilityRules?: {
      minZoom?: number;
      maxZoom?: number;
      showOnTimelines?: string[];
      showAfterDate?: string;
      hideAfterDate?: string;
    };
    iconId?: string;
    [key: string]: any;
  };
}

export interface MapScenario {
  id: string;
  name: string;
  description?: string;
  timelineId: string;
  date: string;
  viewSettings: {
    center: Coordinates;
    zoom: number;
    baseMap: "standard" | "humanitarian" | "transport" | "satellite";
    showBorders: boolean;
    showLabels: boolean;
  };
  shapeIds: string[];
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export type EventIconId =
  | "default"
  | "star"
  | "crown"
  | "flag"
  | "bolt"
  | "globe"
  | "building"
  | "book"
  | "users"
  | "zap"
  | "award"
  | "anchor"
  | "crosshair"
  | "briefcase"
  | "map"
  | "warning"
  | "milestone";

export type TaskStatus = "todo" | "doing" | "blocked" | "done";

export interface TaskNote {
  ts: string;
  text: string;
}

export interface OperativeProfileType {
  name: string;
  callsign: string;
  pronouns: string;
  timezone: string;
  homeBase: string;
  languages: string;
  communicationStyle: string;
  accessibilityNeeds: string;
  healthNotes: string;
  constraints: string;
  skills: string;
  resources: string;
  routines: string;
  currentObjectives: string;
  importantPeople: string;
  dislikes: string;
  notes: string;
  tags: string[];
  updatedAt: string;
}

export type FinanceSourceKind =
  | "beancount"
  | "stripe"
  | "crypto"
  | "bank"
  | "manual"
  | "other";

export interface FinanceSourceType {
  id: ID;
  name: string;
  kind: FinanceSourceKind;
  status: "active" | "paused" | "error";
  ledgerAccount: string;
  envVar: string;
  reference: string;
  chain: string;
  notes: string;
  tags: string[];
  lastSync: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceSettingsType {
  ledgerFile: string;
  favaUrl: string;
}

export interface PersonalAssetType {
  id: ID;
  name: string;
  category: string;
  quantity: number;
  condition: string;
  status: "owned" | "loaned" | "stored" | "sold" | "lost";
  location: string;
  serialNumber: string;
  value: number | null;
  acquiredDate: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskType {
  id: ID;
  title: string;
  section: string;
  status: TaskStatus;
  due: string;
  dueEnd?: string;
  notes: TaskNote[];
  documentIds: ID[];
  linkedEntityIds?: ID[];
  createdAt: string;
  updatedAt: string;
}

export interface CaseDocumentType {
  id: ID;
  name: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploaded: string;
  status: "new" | "reviewed";
  analyzedAt: string;
  analysis: string;
  extractedText: string;
  note: string;
  sourceDocumentId?: ID;
  sourcePath?: string;
  tags?: string[];
}

export interface ProjectType {
  id: ID;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
  timelines: TimelineType[];
  characters: CharacterType[];
  locations: LocationType[];
  technologies: TechnologyType[];
  cultures: CultureType[];
  sources: SourceDocumentType[]; // Changed from sourceDocuments
  reports: ReportType[]; // Changed from narratives (NarrativeType to ReportType)
  deletedIds?: ID[];
  tasks?: TaskType[];
  caseDocuments?: CaseDocumentType[];
  assets?: PersonalAssetType[];
  financeSources?: FinanceSourceType[];
  financeSettings?: FinanceSettingsType;
  profile?: OperativeProfileType;
  entityTypes?: DynamicEntityType[];
  entities?: GenericEntity[];
  mapData?: {
    anchoredShapes: AnchoredShape[];
    scenarios: MapScenario[];
    defaultMapSettings: {
      baseMap: "standard" | "humanitarian" | "transport";
      showBorders: boolean;
      showLabels: boolean;
      defaultZoom: number;
      defaultCenter: Coordinates;
    };
  };
  version: string;
}

// Also rename NarrativeType to ReportType
export interface ReportType {
  id: ID;
  title: string;
  description: string;
  scenes: SceneType[];
  timelineId: ID | null;
  characterIds: ID[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  reportType: "linear" | "flow" | "note";
  content?: string;
  nodes: FlowNodeType[];
  edges: Edge[];
}

export interface TimelineType {
  id: ID;
  name: string;
  description: string;
  events: EventType[];
  pointsOfDivergence: PointOfDivergenceType[];
  startDate: string;
  endDate: string;
  isMainTimeline: boolean;
  parentTimelineId: ID | null;
  branchFromEventId?: ID | null;
  color: string;
  tags: string[];
}

export interface EventType {
  id: ID;
  title: string;
  description: string;
  date: string;
  endDate: string | null;
  timelineId: ID;
  importance: number;
  iconId: EventIconId;
  causes: ID[];
  effects: ID[];
  linkedCharacterIds: ID[];
  linkedLocationIds: ID[];
  linkedTechnologyIds: ID[];
  linkedCultureIds: ID[];
  linkedSourceDocumentIds: ID[];
  linkedNarrativeIds?: ID[];
  notes: string;
  tags: string[];
  isPointOfDivergence: boolean;
  position?: { x: number; y: number };
}

export interface PointOfDivergenceType {
  id: ID;
  name: string;
  description: string;
  date: string;
  timelineId: ID;
  parentTimelineId: ID | null;
  eventIds: ID[];
  resultingTimelineIds: ID[];
  plausibilityRating: number;
  notes: string;
  tags: string[];
}

export interface CharacterType {
  id: ID;
  name: string;
  description: string;
  birthDate: string | null;
  deathDate: string | null;
  timelineIds: ID[];
  relatedCharacterIds: Record<string, ID[]>;
  linkedEventIds: ID[];
  locations: ID[];
  traits: string[];
  motivation: string;
  background: string;
  notes: string;
  isHistorical: boolean;
  imageUrl: string | null;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TechnologyType {
  id: ID;
  name: string;
  description: string;
  discoveryDate: string | null;
  timelineIds: ID[];
  prerequisiteTechIds: ID[];
  derivedTechIds: ID[];
  inventors: ID[];
  linkedEventIds: ID[];
  developmentLevel: number;
  impact: number;
  fields: string[];
  notes: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CultureType {
  id: ID;
  name: string;
  description: string;
  foundedDate: string | null;
  endDate: string | null;
  timelineIds: ID[];
  linkedLocationIds: ID[];
  linkedCharacterIds: ID[];
  linkedEventIds: ID[];
  values: string[];
  practices: string[];
  languages: string[];
  beliefs: string[];
  notes: string;
  imageUrl?: string | null;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SourceDocumentType {
  id: string;
  title: string;
  description?: string;
  authors: string[];
  publicationDate: string | null;
  type: string;
  sourceType: "file" | "url" | "api" | "stream";
  url: string | null;
  filePath: string | null;
  fileName?: string | null;
  notes: string;
  tags: string[];
  citations: Record<string, string>;
  fileSize?: number;
  mimeType?: string;
  apiEndpoint?: string;
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  authType?: "none" | "basic" | "bearer" | "api_key" | "oauth";
  apiKey?: string;
  bearerToken?: string;
  basicAuthUsername?: string;
  basicAuthPassword?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseFormat?: "json" | "xml" | "text" | "csv";
  dataPath?: string;
  streamType?: "websocket" | "sse" | "polling" | "webhook";
  streamUrl?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pollingInterval?: number;
  lastPolled?: string;
  webhookSecret?: string;
  webhookPath?: string;
  connectionStatus?: "connected" | "disconnected" | "error" | "connecting";
  lastConnected?: string;
  connectionError?: string;
  lastDataUpdate?: string;
  cachedData?: any;
  dataCount?: number;
  dataMapping?: DataMapping;
  metadata?: {
    fileHash?: string;
    fileLastModified?: string;
    urlLastChecked?: string;
    urlStatus?: number;
    apiVersion?: string;
    rateLimit?: {
      limit: number;
      remaining: number;
      reset: string;
    };
    streamHealth?: {
      uptime: number;
      messagesReceived: number;
      lastMessage: string;
      averageLatency: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface FlowNodeData {
  label: string;
  resourceId: ID;
  resourceType: string;
  [key: string]: any;
}

export type FlowNodeType = Node<FlowNodeData>;

export interface NarrativeType {
  id: ID;
  title: string;
  description: string;
  scenes: SceneType[];
  timelineId: ID | null;
  characterIds: ID[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  narrativeType: "linear" | "flow";
  nodes: FlowNodeType[];
  edges: Edge[];
}

export interface FileDialogOptions {
  title?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  defaultPath?: string;
  directory?: boolean;
  multiple?: boolean;
}

export interface TimelineRelationship {
  parentId: ID | null;
  childrenIds: ID[];
  divergenceEventId: ID | null;
  parentTimeline?: TimelineType;
  childTimelines: TimelineType[];
  divergenceEvent?: EventType;
}
