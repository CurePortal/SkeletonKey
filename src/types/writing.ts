// src/types/writing.ts

import { ID } from "./project";
import { Node, Edge } from "@xyflow/react";

// Document Types
export type DocumentType =
  | "narrative"
  | "scene"
  | "chapter"
  | "note"
  | "worldbuilding"
  | "character_sheet"
  | "research"
  | "outline"
  | "snippet";

// View Modes
export type ViewMode = "list" | "cards" | "flow" | "outline" | "timeline";
export type EditorMode = "edit" | "preview" | "split";
export type ContentFormat = "html" | "markdown" | "plain";

// Resource Link Interface
export interface ResourceLink {
  type: string; // 'character' | 'location' | 'technology' | 'culture' | 'event'
  id: ID;
  name: string;
  metadata?: Record<string, any>;
}

// Document Link Interface
export interface DocumentLink {
  targetId: ID;
  linkType: "reference" | "continuation" | "related" | "parent" | "child";
  annotation?: string;
}

// Flow Data for Visual Connections
export interface FlowData {
  nodes?: Node[];
  edges?: Edge[];
  position?: { x: number; y: number };
  connections?: ID[];
}

// Document Interface
export interface Document {
  id: ID;
  type: DocumentType;
  title: string;
  content: string; // HTML with embedded tags for resources/links
  format: ContentFormat;

  // Hierarchy
  parentId: ID | null;
  narrativeId: ID | null; // For scenes/chapters that belong to a narrative
  order: number;

  // Relationships
  linkedResources: ResourceLink[];
  linkedDocuments: DocumentLink[];
  tags: string[];

  // Metadata
  metadata: {
    wordCount?: number;
    characterCount?: number;
    lastEdited: Date;
    created: Date;
    author?: string;
    version?: number;
    viewMode?: EditorMode;
    isPublished?: boolean;
    isDraft?: boolean;
  };

  // Flow visualization data
  flowData?: FlowData;

  // Custom fields for specific document types
  customFields?: Record<string, any>;
}

// Narrative Container
export interface Narrative {
  id: ID;
  title: string;
  description: string;
  type: "linear" | "branching" | "collection" | "flow";

  // Document management
  documentIds: ID[];
  rootDocumentId?: ID; // For hierarchical structures

  // Display preferences
  viewPreference: ViewMode;
  defaultEditorMode: EditorMode;

  // Timeline integration
  timelineId?: ID;

  // Metadata
  metadata: {
    totalWords: number;
    totalScenes?: number;
    totalChapters?: number;
    lastModified: Date;
    created: Date;
    completionPercentage?: number;
    targetWordCount?: number;
  };

  // Visual flow data (for flow-type narratives)
  flowSettings?: {
    defaultNodeType?: string;
    defaultEdgeType?: string;
    layoutDirection?: "TB" | "LR" | "BT" | "RL";
    autoLayout?: boolean;
  };

  tags: string[];
}

// Folder/Collection for Organization
export interface DocumentFolder {
  id: ID;
  name: string;
  parentId: ID | null;
  documentIds: ID[];
  folderIds: ID[]; // Nested folders
  color?: string;
  icon?: string;
  sortOrder?: "manual" | "alphabetical" | "modified" | "created";
  isExpanded?: boolean;
  metadata: {
    documentCount: number;
    created: Date;
    modified: Date;
  };
}

// Template System
export interface DocumentTemplate {
  id: ID;
  name: string;
  type: DocumentType;
  description?: string;
  content: string; // Default content with placeholders
  fields?: TemplateField[];
  tags?: string[];
  category?: string;
  icon?: string;
}

export interface TemplateField {
  id: string;
  name: string;
  type: "text" | "textarea" | "select" | "date" | "number" | "boolean";
  placeholder?: string;
  defaultValue?: any;
  required?: boolean;
  options?: string[]; // For select type
}

// Search and Filter
export interface DocumentSearchQuery {
  query: string;
  documentTypes?: DocumentType[];
  narrativeIds?: ID[];
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  hasResources?: boolean;
  hasLinks?: boolean;
  parentId?: ID;
  sortBy?: "relevance" | "title" | "modified" | "created" | "wordCount";
  sortOrder?: "asc" | "desc";
}

export interface DocumentSearchResult {
  document: Document;
  relevanceScore: number;
  matchedFields: ("title" | "content" | "tags")[];
  excerpt?: string; // Snippet with highlighted matches
}

// Export/Import Formats
export interface DocumentExport {
  format: "json" | "markdown" | "html" | "docx" | "pdf" | "epub";
  includeMetadata: boolean;
  includeResources: boolean;
  includeLinks: boolean;
  preserveFormatting: boolean;
  customCSS?: string; // For HTML/PDF exports
}

// Writing Statistics
export interface WritingStats {
  documentId?: ID;
  narrativeId?: ID;
  totalWords: number;
  totalCharacters: number;
  totalParagraphs: number;
  totalSentences: number;
  averageWordLength: number;
  averageSentenceLength: number;
  readingTime: number; // In minutes
  uniqueWords: number;
  lexicalDiversity: number; // Unique words / total words
  mostCommonWords: Array<{ word: string; count: number }>;
  documentsByType: Record<DocumentType, number>;
  writingStreak?: {
    current: number;
    longest: number;
    lastWritingDate: Date;
  };
}

// Session Tracking
export interface WritingSession {
  id: ID;
  documentId: ID;
  startTime: Date;
  endTime?: Date;
  wordsWritten: number;
  wordsDeleted: number;
  netWords: number;
  edits: number;
  focusScore?: number; // Based on continuous writing time
}

// Revision History
export interface DocumentRevision {
  id: ID;
  documentId: ID;
  version: number;
  content: string;
  wordCount: number;
  changedBy?: string;
  changeDate: Date;
  changeDescription?: string;
  diff?: {
    added: number;
    removed: number;
    modified: number;
  };
}

// Collaboration Features
export interface DocumentComment {
  id: ID;
  documentId: ID;
  parentCommentId?: ID;
  content: string;
  author: string;
  createdAt: Date;
  resolvedAt?: Date;
  position?: {
    start: number;
    end: number;
  };
  replies?: DocumentComment[];
}

// Migration Types
export interface MigrationResult {
  success: boolean;
  documentsCreated: number;
  narrativesCreated: number;
  errors: string[];
  warnings: string[];
  mapping: Array<{
    oldId: ID;
    newId: ID;
    type: "scene" | "note" | "narrative";
  }>;
}

// Settings
export interface WritingModuleSettings {
  defaultDocumentType: DocumentType;
  defaultEditorMode: EditorMode;
  defaultViewMode: ViewMode;
  autoSave: boolean;
  autoSaveInterval: number; // In seconds
  spellCheck: boolean;
  wordCountGoal?: number;
  dailyWordGoal?: number;
  enableVersioning: boolean;
  maxVersions: number;
  enableComments: boolean;
  defaultFont?: string;
  defaultFontSize?: number;
  defaultLineHeight?: number;
  keyboardShortcuts: Record<string, string>;
  exportDefaults: DocumentExport;
}

// State Management
export interface WritingModuleState {
  documents: Document[];
  narratives: Narrative[];
  folders: DocumentFolder[];
  templates: DocumentTemplate[];

  activeDocumentId: ID | null;
  activeNarrativeId: ID | null;
  activeFolderId: ID | null;

  viewMode: ViewMode;
  editorMode: EditorMode;

  search: {
    query: string;
    results: DocumentSearchResult[];
    isSearching: boolean;
    filters: Partial<DocumentSearchQuery>;
  };

  selection: {
    documentIds: ID[];
    narrativeIds: ID[];
  };

  ui: {
    sidebarCollapsed: boolean;
    resourcePanelCollapsed: boolean;
    focusMode: boolean;
    darkMode: boolean;
    zoom: number;
  };

  session: WritingSession | null;
  stats: WritingStats | null;

  unsavedChanges: Record<ID, boolean>;
  loadingStates: Record<ID, boolean>;
  errors: Record<ID, string>;
}

// Action Types for State Management
export type WritingAction =
  | { type: "CREATE_DOCUMENT"; payload: Omit<Document, "id"> }
  | { type: "UPDATE_DOCUMENT"; payload: Document }
  | { type: "DELETE_DOCUMENT"; payload: ID }
  | { type: "CREATE_NARRATIVE"; payload: Omit<Narrative, "id"> }
  | { type: "UPDATE_NARRATIVE"; payload: Narrative }
  | { type: "DELETE_NARRATIVE"; payload: ID }
  | { type: "SET_ACTIVE_DOCUMENT"; payload: ID | null }
  | { type: "SET_ACTIVE_NARRATIVE"; payload: ID | null }
  | { type: "SET_VIEW_MODE"; payload: ViewMode }
  | { type: "SET_EDITOR_MODE"; payload: EditorMode }
  | { type: "SEARCH_DOCUMENTS"; payload: DocumentSearchQuery }
  | { type: "SET_SEARCH_RESULTS"; payload: DocumentSearchResult[] }
  | { type: "TOGGLE_FOCUS_MODE" }
  | { type: "START_WRITING_SESSION"; payload: ID }
  | { type: "END_WRITING_SESSION" }
  | { type: "UPDATE_STATS"; payload: WritingStats }
  | { type: "MIGRATE_DATA"; payload: MigrationResult }
  | { type: "BULK_UPDATE_DOCUMENTS"; payload: Document[] }
  | { type: "SET_UNSAVED_CHANGES"; payload: { id: ID; hasChanges: boolean } };
