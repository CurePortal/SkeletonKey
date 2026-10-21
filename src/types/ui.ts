// types/ui.ts
import { ID } from "./project";

export type NotificationType = "success" | "error" | "info" | "warning";

export interface NotificationMessage {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  duration?: number;
  dismissible?: boolean;
}

export interface LoadingState {
  isLoading: boolean;
  operation: string;
  progress?: number;
}

export interface Option {
  value: string;
  label: string;
  disabled?: boolean;
  [key: string]: any;
}

// Updated to support dynamic entity types
export type KnowledgeBaseSectionType = string;

// Keep the legacy type for reference if needed
export type LegacyKnowledgeBaseSectionType =
  | "characters"
  | "locations"
  | "technologies"
  | "cultures"
  | "sources"
  | "tags";

// Updated to support dynamic entity types
export type SingularEntityType = string;

// Keep the legacy type for reference if needed
export type LegacySingularEntityType =
  | "character"
  | "location"
  | "technology"
  | "culture"
  | "source";

export type ViewMode =
  | "dashboard"
  | "timeline"
  | "map"
  | "knowledge-base"
  | "narrative"
  | "documents"
  | "tasks"
  | "notes"
  | "whiteboard"
  | "ai-analysis"
  | "settings"
  | "search-results"
  | "timeline-editor"
  | "kb-character-new"
  | "kb-character-edit"
  | "kb-location-new"
  | "kb-location-edit"
  | "kb-technology-new"
  | "kb-technology-edit"
  | "kb-culture-new"
  | "kb-culture-edit"
  | "kb-source-new"
  | "kb-source-edit"
  | "kb-timeline-new"
  | "kb-timeline-edit";

export interface AppState {
  currentProjectId: ID | null;
  currentProjectPath: string | null;
  currentTimelineId: ID | null;
  selectedEntityId: ID | null;
  selectedEntityType: string | null;
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  loadingStates: LoadingState[];
  isEditMode: boolean;
  viewMode: ViewMode;
  searchQuery: string;
  filters: Record<string, any>;
  appVersion: string;
  timelinesPinned: boolean;
  knowledgeBasePinned: boolean;
  currentKnowledgeBaseCategory: KnowledgeBaseSectionType | null;
  selectedKnowledgeBaseEntityId: ID | null;
  llmProvider: "ollama" | "openai";
  ollamaModel: string | null;
  openAIAPIKey: string | null;
  openAIModel: string | null;
  isLLMPanelOpen: boolean;
  autoSaveDelay: number;
  showConsistencyAnalysis: boolean;
}

export type ModalType =
  | "new-project"
  | "create_project"
  | "create_timeline"
  | "edit_project"
  | "edit_character"
  | "edit_culture"
  | "edit_location"
  | "edit_technology"
  | "edit_source"
  | "edit_event"
  | "confirm_delete"
  | "settings"
  | "export_project"
  | "user_projects"
  | "import_data"
  | "error_display"
  | "llm_config"
  | "consistency_results";

export interface ModalState {
  isOpen: boolean;
  type: ModalType | null;
  data?: any;
}
