// src/contexts/AppStateContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { ID } from "../types/project"; // Adjust path if necessary
import {
  AppState, // Ensure AppState is imported
  ModalState,
  ModalType,
  KnowledgeBaseSectionType,
  LoadingState,
} from "../types/ui"; // Adjust path if necessary

interface AppStateContextType {
  appState: AppState;
  setCurrentProjectId: (id: ID | null) => void;
  setCurrentProjectPath: (path: string | null) => void;
  setCurrentTimelineId: (id: ID | null) => void;
  setSelectedEntityId: (id: ID | null) => void;
  setSelectedEntityType: (type: string | null) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setViewMode: (mode: AppState["viewMode"]) => void; // <--- Use AppState['viewMode']
  setIsEditMode: (isEdit: boolean) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Record<string, any>) => void;
  addLoadingState: (operation: string) => void;
  removeLoadingState: (operation: string) => void;
  updateLoadingProgress: (operation: string, progress: number) => void;
  isLoading: (operation?: string) => boolean;
  modalState: ModalState;
  openModal: (type: ModalType, data?: any) => void;
  closeModal: () => void;
  timelinesPinned: boolean;
  knowledgeBasePinned: boolean;
  setTimelinesPinned: (isPinned: boolean) => void;
  setKnowledgeBasePinned: (isPinned: boolean) => void;
  setCurrentKnowledgeBaseCategory: (
    category: KnowledgeBaseSectionType | null,
  ) => void;
  setSelectedKnowledgeBaseEntityId: (id: ID | null) => void;
  toggleLLMPanel: () => void;
  setLLMPanelOpen: (isOpen: boolean) => void;
  setAutoSaveDelay: (delay: number) => void;
  setShowConsistencyAnalysis: (show: boolean) => void;
  // Add these new properties for event opening
  pendingEventToOpen: any | null;
  setPendingEventToOpen: (event: any | null) => void;
  clearPendingEventToOpen: () => void;
}

const defaultAppState: AppState = {
  currentProjectId: null,
  currentProjectPath: null,
  currentTimelineId: null,
  selectedEntityId: null,
  selectedEntityType: null,
  sidebarOpen: true,
  theme: "system",
  loadingStates: [] as LoadingState[],
  isEditMode: false,
  viewMode: "dashboard",
  searchQuery: "",
  filters: {},
  appVersion: "0.9.8",
  timelinesPinned: false,
  knowledgeBasePinned: false,
  currentKnowledgeBaseCategory: null,
  selectedKnowledgeBaseEntityId: null,
  isLLMPanelOpen: false,
  showConsistencyAnalysis: false,
  llmProvider: "ollama",
  ollamaModel: "llama3.2:3b",
  openAIAPIKey: null,
  openAIModel: "gpt-3.5-turbo",
  autoSaveDelay: 10000,
};

// --- THIS IS THE MISSING PIECE ---
const defaultModalState: ModalState = {
  isOpen: false,
  type: null,
  data: undefined,
};
// ------------------------------------

const AppStateContext = createContext<AppStateContextType | undefined>(
  undefined,
);

interface AppStateProviderProps {
  children: ReactNode;
}

export const AppStateProvider: React.FC<AppStateProviderProps> = ({
  children,
}) => {
  const [appState, setAppState] = useState<AppState>(() => {
    const savedSettings = localStorage.getItem("appSettings");
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        return { ...defaultAppState, ...parsedSettings };
      } catch (e) {
        console.error("Failed to parse app settings from localStorage", e);
        return defaultAppState;
      }
    }
    return defaultAppState;
  });

  // Now this line will work
  const [modalState, setModalState] = useState<ModalState>(defaultModalState);

  // Add new state for pending event to open
  const [pendingEventToOpen, setPendingEventToOpen] = useState<any | null>(
    null,
  );

  useEffect(() => {
    const settingsToSave = {
      theme: appState.theme,
      autoSaveDelay: appState.autoSaveDelay,
      llmProvider: appState.llmProvider,
      ollamaModel: appState.ollamaModel,
      openAIModel: appState.openAIModel,
    };
    localStorage.setItem("appSettings", JSON.stringify(settingsToSave));
    if (appState.theme === "system") {
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      document.documentElement.classList.toggle("dark", systemPrefersDark);
    } else {
      document.documentElement.classList.toggle(
        "dark",
        appState.theme === "dark",
      );
    }
  }, [
    appState.theme,
    appState.autoSaveDelay,
    appState.llmProvider,
    appState.ollamaModel,
    appState.openAIModel,
  ]);

  const setCurrentProjectId = (id: ID | null) => {
    setAppState((prev) => ({ ...prev, currentProjectId: id }));
  };

  const setCurrentProjectPath = (path: string | null) => {
    setAppState((prev) => ({ ...prev, currentProjectPath: path }));
  };

  const setCurrentTimelineId = (id: ID | null) => {
    setAppState((prev) => ({ ...prev, currentTimelineId: id }));
  };

  const setSelectedEntityId = (id: ID | null) => {
    setAppState((prev) => ({ ...prev, selectedEntityId: id }));
  };

  const setSelectedEntityType = (type: string | null) => {
    setAppState((prev) => ({ ...prev, selectedEntityType: type }));
  };

  const toggleSidebar = () => {
    setAppState((prev) => ({ ...prev, sidebarOpen: !prev.sidebarOpen }));
  };

  const setSidebarOpen = (isOpen: boolean) => {
    setAppState((prev) => ({ ...prev, sidebarOpen: isOpen }));
  };

  const setTheme = (theme: "light" | "dark" | "system") => {
    setAppState((prev) => ({ ...prev, theme }));
  };

  // Use AppState['viewMode'] here as well
  const setViewMode = (mode: AppState["viewMode"]) => {
    setAppState((prev) => ({ ...prev, viewMode: mode }));
  };

  const setIsEditMode = (isEdit: boolean) => {
    setAppState((prev) => ({ ...prev, isEditMode: isEdit }));
  };

  const setSearchQuery = (query: string) => {
    setAppState((prev) => ({ ...prev, searchQuery: query }));
  };

  const setFilters = (filters: Record<string, any>) => {
    setAppState((prev) => ({ ...prev, filters }));
  };

  const addLoadingState = (operation: string) => {
    setAppState((prev) => ({
      ...prev,
      loadingStates: [
        ...prev.loadingStates,
        { isLoading: true, operation, progress: 0 },
      ],
    }));
  };

  const removeLoadingState = (operation: string) => {
    setAppState((prev) => ({
      ...prev,
      loadingStates: prev.loadingStates.filter(
        (state) => state.operation !== operation,
      ),
    }));
  };

  const updateLoadingProgress = (operation: string, progress: number) => {
    setAppState((prev) => ({
      ...prev,
      loadingStates: prev.loadingStates.map((state) =>
        state.operation === operation ? { ...state, progress } : state,
      ),
    }));
  };

  const isLoading = (operation?: string) => {
    if (operation) {
      return appState.loadingStates.some(
        (state) => state.operation === operation && state.isLoading,
      );
    }
    return appState.loadingStates.some((state) => state.isLoading);
  };

  const setTimelinesPinned = (isPinned: boolean) => {
    setAppState((prev) => ({ ...prev, timelinesPinned: isPinned }));
  };

  const setKnowledgeBasePinned = (isPinned: boolean) => {
    setAppState((prev) => ({ ...prev, knowledgeBasePinned: isPinned }));
  };

  const openModal = (type: ModalType, data?: any) => {
    setModalState({ isOpen: true, type, data });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, type: null, data: undefined });
  };

  const setCurrentKnowledgeBaseCategory = (
    category: KnowledgeBaseSectionType | null,
  ) => {
    setAppState((prev) => ({
      ...prev,
      currentKnowledgeBaseCategory: category,
    }));
  };

  const setSelectedKnowledgeBaseEntityId = (id: ID | null) => {
    setAppState((prev) => ({ ...prev, selectedKnowledgeBaseEntityId: id }));
  };

  const toggleLLMPanel = () => {
    setAppState((prev) => ({ ...prev, isLLMPanelOpen: !prev.isLLMPanelOpen }));
  };

  const setLLMPanelOpen = (isOpen: boolean) => {
    setAppState((prev) => ({ ...prev, isLLMPanelOpen: isOpen }));
  };

  const setAutoSaveDelay = (delay: number) => {
    setAppState((prev) => ({ ...prev, autoSaveDelay: delay }));
  };

  const setShowConsistencyAnalysis = (show: boolean) => {
    setAppState((prev) => ({ ...prev, showConsistencyAnalysis: show }));
  };

  // Add helper function for clearing pending event
  const clearPendingEventToOpen = () => setPendingEventToOpen(null);

  return (
    <AppStateContext.Provider
      value={{
        appState,
        setCurrentProjectId,
        setCurrentProjectPath,
        setCurrentTimelineId,
        setSelectedEntityId,
        setSelectedEntityType,
        toggleSidebar,
        setSidebarOpen,
        setTheme,
        setViewMode,
        setIsEditMode,
        setSearchQuery,
        setFilters,
        addLoadingState,
        removeLoadingState,
        updateLoadingProgress,
        isLoading,
        timelinesPinned: appState.timelinesPinned,
        knowledgeBasePinned: appState.knowledgeBasePinned,
        setTimelinesPinned,
        setKnowledgeBasePinned,
        modalState,
        openModal,
        closeModal,
        setCurrentKnowledgeBaseCategory,
        setSelectedKnowledgeBaseEntityId,
        toggleLLMPanel,
        setLLMPanelOpen,
        setAutoSaveDelay,
        setShowConsistencyAnalysis,
        // Add the new pending event properties
        pendingEventToOpen,
        setPendingEventToOpen,
        clearPendingEventToOpen,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
};

export default AppStateContext;
