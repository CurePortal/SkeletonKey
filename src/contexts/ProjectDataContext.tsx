// Enhanced ProjectDataContext with map data AND UNDO support (Full Version)
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { flushSync } from "react-dom";
import {
  ProjectType,
  TimelineType,
  EventType,
  PointOfDivergenceType,
  CharacterType,
  LocationType,
  TechnologyType,
  CultureType,
  SourceDocumentType,
  ReportType,
  SceneType,
  TaskType,
  PersonalAssetType,
  FinanceSourceType,
  FinanceSettingsType,
  OperativeProfileType,
  CaseDocumentType,
  AnchoredShape,
  MapScenario,
  ID,
  Coordinates,
} from "../types";
import { useAppState } from "./AppStateContext";
import { ensureProjectHasNarratives } from "../services/projectMigration";
import { withDeletionTombstones } from "../services/mainProjectService";
import { v4 as uuidv4 } from "uuid";
import { saveProjectToFileSystem } from "../services/projectFileSystem";
import { compressedStorage } from "../services/compressedStorageService";
import type {
  CustomEntityType as DynamicEntityType,
  GenericEntity,
} from "../types/dynamicEntity";

// --- UNDO/REDO: History State Interface ---
interface HistoryState<T> {
  past: T[];
  present: T | null;
  future: T[];
}
// --- END UNDO/REDO ---

interface ImportedKnowledgeBase {
  characters: CharacterType[];
  locations: LocationType[];
  technologies: TechnologyType[];
  cultures: CultureType[];
  sources: SourceDocumentType[];
}

interface ProjectDataProviderProps {
  children: ReactNode;
}

interface MapSettingsType {
  baseMap: "standard" | "humanitarian" | "transport";
  showBorders: boolean;
  showLabels: boolean;
  defaultZoom: number;
  defaultCenter: Coordinates;
}

// --- UNDO/REDO: Add to Context Type ---
interface ProjectDataContextType {
  project: ProjectType | null; // This will now come from history.present
  originalProject: ProjectType | null;
  hasUnsavedChanges: boolean;
  currentFilePath: string | null;
  isFileBasedProject: boolean;
  setProject: (
    project: ProjectType | null,
    filePath?: string | null,
    isCloud?: boolean,
  ) => void;
  setCurrentFilePath: (path: string | null) => void;
  setFilePath: (path: string | null) => void;
  setIsFileBased: (isFile: boolean) => void;
  updateProjectDetails: (details: {
    name?: string;
    description?: string;
    thumbnailUrl?: string;
  }) => void;

  // --- UNDO/REDO: Add Functions to Type ---
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // --- END UNDO/REDO ---

  // Timeline operations
  addTimeline: (
    timelineData: Omit<TimelineType, "id" | "events" | "pointsOfDivergence"> & {
      events?: Array<Omit<EventType, "id">>;
      pointsOfDivergence?: Array<Omit<PointOfDivergenceType, "id">>;
    },
  ) => void;
  updateTimeline: (timeline: TimelineType) => void;
  deleteTimeline: (timelineId: ID) => void;

  // Event operations
  addEvent: (timelineId: ID, eventData: Omit<EventType, "id">) => void;
  updateEvent: (timelineId: ID, event: EventType) => void;
  deleteEvent: (timelineId: ID, eventId: ID) => void;

  // Point of Divergence operations
  addPointOfDivergence: (
    timelineId: ID,
    podData: Omit<PointOfDivergenceType, "id">,
  ) => void;
  updatePointOfDivergence: (timelineId: ID, pod: PointOfDivergenceType) => void;
  deletePointOfDivergence: (timelineId: ID, podId: ID) => void;

  // Character operations
  addCharacter: (characterData: Omit<CharacterType, "id">) => ID; // MODIFIED
  updateCharacter: (character: CharacterType) => void;
  deleteCharacter: (characterId: ID) => void;

  // Location operations
  addLocation: (locationData: Omit<LocationType, "id">) => ID; // MODIFIED
  updateLocation: (location: LocationType) => void;
  deleteLocation: (locationId: ID) => void;

  // Technology operations
  addTechnology: (technologyData: Omit<TechnologyType, "id">) => ID; // MODIFIED
  updateTechnology: (technology: TechnologyType) => void;
  deleteTechnology: (technologyId: ID) => void;

  // Culture operations
  addCulture: (cultureData: Omit<CultureType, "id">) => ID; // MODIFIED
  updateCulture: (culture: CultureType) => void;
  deleteCulture: (cultureId: ID) => void;

  // Source document operations
  addSourceDocument: (docData: Omit<SourceDocumentType, "id">) => ID; // MODIFIED
  updateSourceDocument: (doc: SourceDocumentType) => void;
  deleteSourceDocument: (docId: ID) => void;

  // Report operations (renamed from Narrative)
  addNarrative?: (narrativeData: any) => void;
  updateNarrative?: (narrative: any) => void;
  deleteNarrative?: (narrativeId: ID) => void;
  addReport: (
    reportData: Omit<ReportType, "id" | "scenes"> & {
      scenes?: Array<Omit<SceneType, "id">>;
    },
  ) => void;
  updateReport: (report: ReportType) => void;
  deleteReport: (reportId: ID) => void;

  // Task operations
  addTask: (
    taskData: Omit<TaskType, "id" | "createdAt" | "updatedAt">,
  ) => ID;
  updateTask: (task: TaskType) => void;
  deleteTask: (taskId: ID) => void;

  // Personal asset inventory
  addFinanceSource: (
    sourceData: Omit<FinanceSourceType, "id" | "createdAt" | "updatedAt"> & {
      id?: ID;
    },
  ) => ID;
  updateFinanceSource: (source: FinanceSourceType) => void;
  deleteFinanceSource: (sourceId: ID) => void;
  updateFinanceSettings: (settings: FinanceSettingsType) => void;
  updateProfile: (profile: OperativeProfileType) => void;

  addAsset: (
    assetData: Omit<PersonalAssetType, "id" | "createdAt" | "updatedAt"> & {
      id?: ID;
    },
  ) => ID;
  updateAsset: (asset: PersonalAssetType) => void;
  deleteAsset: (assetId: ID) => void;

  // Knowledge base category + generic entity operations
  upsertEntityType: (entityType: DynamicEntityType) => void;
  deleteEntityType: (entityTypeId: ID) => void;
  addGenericEntity: (
    entity: Omit<GenericEntity, "id" | "createdAt" | "updatedAt"> & {
      id?: ID;
    },
  ) => ID;
  updateGenericEntity: (entity: GenericEntity) => void;
  deleteGenericEntity: (entityId: ID) => void;

  // Case document operations (local uploads + analysis)
  addCaseDocument: (
    docData: Omit<CaseDocumentType, "id"> & { id?: ID },
  ) => ID;
  updateCaseDocument: (doc: CaseDocumentType) => void;
  deleteCaseDocument: (docId: ID) => void;

  // Scene operations
  addScene: (reportId: ID, sceneData: Omit<SceneType, "id">) => void;
  updateScene: (reportId: ID, scene: SceneType) => void;
  deleteScene: (reportId: ID, sceneId: ID) => void;

  // NEW: Map-specific operations
  addAnchoredShape: (shapeData: Omit<AnchoredShape, "id">) => void;
  updateAnchoredShape: (shape: AnchoredShape) => void;
  setAnchoredShapes: (shapes: AnchoredShape[]) => void;
  deleteAnchoredShape: (shapeId: ID) => void;
  getAnchoredShapesByTimeline: (timelineId: ID) => AnchoredShape[];

  // Map scenario operations
  addMapScenario: (scenarioData: Omit<MapScenario, "id">) => void;
  updateMapScenario: (scenario: MapScenario) => void;
  deleteMapScenario: (scenarioId: ID) => void;
  getMapScenariosByTimeline: (timelineId: ID) => MapScenario[];

  // Update map settings
  updateMapSettings: (settings: Partial<MapSettingsType>) => void;

  // Batch import functions
  batchImportKnowledgeBase: (
    knowledgeBase: ImportedKnowledgeBase,
  ) => Promise<void>;
  batchImportTimelines: (
    timelines: TimelineType[],
    knowledgeBase?: ImportedKnowledgeBase,
  ) => Promise<void>;

  // Getter functions
  getTimelineById: (timelineId: ID) => TimelineType | undefined;
  getEventById: (eventId: ID, timelineId?: ID) => EventType | undefined;
  getCharacterById: (characterId: ID) => CharacterType | undefined;
  getLocationById: (locationId: ID) => LocationType | undefined;
  getTechnologyById: (technologyId: ID) => TechnologyType | undefined;
  getCultureById: (cultureId: ID) => CultureType | undefined;
  getSourceDocumentById: (docId: ID) => SourceDocumentType | undefined;
  getReportById: (reportId: ID) => ReportType | undefined;
  getSceneById: (reportId: ID, sceneId: ID) => SceneType | undefined;
  getAnchoredShapeById: (shapeId: ID) => AnchoredShape | undefined;
  getMapScenarioById: (scenarioId: ID) => MapScenario | undefined;

  // Save operations
  saveChanges: () => Promise<boolean>;
  saveChangesAs: () => Promise<boolean>;
  discardChanges: () => void;
  markSaved: () => void;
  enableAutoSave: () => void;
  disableAutoSave: () => void;
  isAutoSaveEnabled: boolean;
  isAutoSavePending: boolean;
  isSaving: boolean;
  lastSavedAt: string | null;
  autoSaveError: string | null;
}
// --- END UNDO/REDO ---

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(
  undefined,
);

export const ProjectDataProvider: React.FC<ProjectDataProviderProps> = ({
  children,
}) => {
  // --- UNDO/REDO: Replace project state with history state ---
  const [history, setHistory] = useState<HistoryState<ProjectType>>({
    past: [],
    present: null,
    future: [],
  });
  const { present: project } = history; // This is now your source of 'project'
  // --- END UNDO/REDO ---

  const [originalProject, setOriginalProject] = useState<ProjectType | null>(
    null,
  );
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [isFileBasedProject, setIsFileBasedProject] = useState<boolean>(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState<boolean>(true);
  const [isAutoSavePending, setIsAutoSavePending] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { appState } = useAppState();
  const autoSaveDelay = appState.autoSaveDelay;

  const isTauriEnvironment =
    typeof window !== "undefined" &&
    Boolean((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__);

  // Use 'project' (history.present) for this calculation
  const hasUnsavedChanges = useMemo(() => {
    if (!project || !originalProject) return false;
    return JSON.stringify(project) !== JSON.stringify(originalProject);
  }, [project, originalProject]);

  // Add normalization function for backward compatibility
  const normalizeProjectStructure = useCallback(
    (projectData: any): ProjectType => {
      if (!projectData) return projectData;

      const normalized = { ...projectData };

      // Handle sourceDocuments -> sources migration
      if ("sourceDocuments" in projectData && !("sources" in projectData)) {
        normalized.sources = projectData.sourceDocuments;
      } else if (!("sources" in projectData)) {
        normalized.sources = [];
      }

      // Handle narratives -> reports migration
      if ("narratives" in projectData && !("reports" in projectData)) {
        normalized.reports = projectData.narratives;
      } else if (!("reports" in projectData)) {
        normalized.reports = [];
      }

      // Ensure all required arrays exist
      normalized.characters = normalized.characters || [];
      normalized.locations = normalized.locations || [];
      normalized.technologies = normalized.technologies || [];
      normalized.cultures = normalized.cultures || [];
      normalized.timelines = normalized.timelines || [];
      normalized.tasks = normalized.tasks || [];
      normalized.caseDocuments = normalized.caseDocuments || [];

      return normalized as ProjectType;
    },
    [],
  );

  const ensureProjectHasMapData = useCallback(
    (projectData: ProjectType): ProjectType => {
      let updatedProject = { ...projectData };
      if (!updatedProject.mapData) {
        updatedProject.mapData = {
          anchoredShapes: [],
          scenarios: [],
          defaultMapSettings: {
            baseMap: "standard",
            showBorders: true,
            showLabels: true,
            defaultZoom: 2,
            defaultCenter: { lat: 30, lng: 0 },
          },
        };
      } else {
        if (!updatedProject.mapData.defaultMapSettings) {
          updatedProject.mapData.defaultMapSettings = {
            baseMap: "standard",
            showBorders: true,
            showLabels: true,
            defaultZoom: 2,
            defaultCenter: { lat: 30, lng: 0 },
          };
        }
        if (!updatedProject.mapData.anchoredShapes) {
          updatedProject.mapData.anchoredShapes = [];
        }
        if (!updatedProject.mapData.scenarios) {
          updatedProject.mapData.scenarios = [];
        }
      }
      return updatedProject;
    },
    [],
  );

  // --- UNDO/REDO: Modify setProject to use setHistory ---
  const setProject = useCallback(
    (
      newProjectData: ProjectType | null,
      filePath?: string | null,
      isCloud?: boolean,
    ) => {
      // Normalize the project structure first
      let processedProject = newProjectData
        ? normalizeProjectStructure(newProjectData)
        : null;

      if (processedProject) {
        processedProject = ensureProjectHasNarratives(processedProject);
        processedProject = ensureProjectHasMapData(processedProject);
      }

      // SET HISTORY INSTEAD OF setProjectState
      setHistory({
        past: [],
        present: processedProject,
        future: [],
      });
      // END SET HISTORY

      setOriginalProject(
        processedProject ? JSON.parse(JSON.stringify(processedProject)) : null,
      );
      setIsAutoSavePending(false);
      setIsSaving(false);
      setAutoSaveError(null);
      setLastSavedAt(
        processedProject ? new Date().toISOString() : null,
      );

      if (filePath) {
        setCurrentFilePath(filePath);
        setIsFileBasedProject(
          isTauriEnvironment && !filePath.startsWith("/mock/"),
        );
      } else {
        setCurrentFilePath(null);
        setIsFileBasedProject(false);
      }
    },
    [isTauriEnvironment, ensureProjectHasMapData, normalizeProjectStructure],
  );
  // --- END UNDO/REDO ---


  const autoSaveProject = useCallback(
    async (projectToSave: ProjectType | null): Promise<void> => {
      if (!isAutoSaveEnabled || !projectToSave) {
        setIsAutoSavePending(false);
        return;
      }
      console.log(`Attempting auto-save for: ${projectToSave.name}`);
      setIsSaving(true);
      setAutoSaveError(null);
      try {
        let savedViaFileSystem = false;

        // Save with backward compatibility
        const projectToSaveCompat = {
          ...projectToSave,
          sourceDocuments: projectToSave.sources, // Keep both for compatibility
          narratives: projectToSave.reports,
        };

        if (
          isFileBasedProject &&
          currentFilePath &&
          isTauriEnvironment
        ) {
          console.log("Auto-saving to file system...");
          await saveProjectToFileSystem(projectToSaveCompat, currentFilePath);
          console.log("File system save successful.");
          savedViaFileSystem = true;
        } else {
          console.log("Auto-saving to local storage with compression...");

          // Use compressed storage instead of direct localStorage
          compressedStorage.setItem(
            `skeletonkey_project_${projectToSave.id}`,
            projectToSaveCompat,
          );

          console.log("Local storage save with compression successful.");

          // Log storage statistics
          const stats = compressedStorage.getStorageStats();
          console.log(`Storage statistics:`, {
            used: `${(stats.used / 1024 / 1024).toFixed(2)} MB`,
            available: `${(stats.available / 1024 / 1024).toFixed(2)} MB`,
            largestItems: stats.items.slice(0, 3).map((item) => ({
              key: item.key,
              size: `${(item.size / 1024).toFixed(2)} KB`,
              compressed: item.compressed,
              compressionRatio: item.compressionRatio
                ? `${item.compressionRatio}%`
                : "N/A",
            })),
          });
        }

        // --- UNDO/REDO: Update originalProject on successful save ---
        setOriginalProject(JSON.parse(JSON.stringify(projectToSave)));
        setLastSavedAt(new Date().toISOString());
        // --- END UNDO/REDO ---

        const recentProjectsStr =
          localStorage.getItem("recentProjects") || "[]";
        let recentProjects: any[] = [];
        try {
          recentProjects = JSON.parse(recentProjectsStr);
          if (!Array.isArray(recentProjects)) recentProjects = [];
        } catch {
          recentProjects = [];
        }

        let projectPath: string;
        let projectType: string;

        if (savedViaFileSystem && currentFilePath) {
          projectPath = currentFilePath;
          projectType = "local_file";
        } else {
          projectPath = `local_storage://${projectToSave.id}`;
          projectType = "local_storage";
        }

        const recentProjectEntry = {
          id: projectToSave.id,
          name: projectToSave.name,
          path: projectPath,
          type: projectType,
          lastAccessed: new Date().toISOString(),
        };

        const existingIndex = recentProjects.findIndex(
          (p: any) => p.id === projectToSave.id,
        );
        if (existingIndex >= 0) {
          recentProjects[existingIndex] = recentProjectEntry;
        } else {
          recentProjects.push(recentProjectEntry);
        }
        localStorage.setItem(
          "recentProjects",
          JSON.stringify(recentProjects.slice(-5)),
        );
        console.log("Project auto-saved and recent list updated.");
      } catch (error) {
        console.error("Auto-save failed:", error);
        setAutoSaveError(
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setIsSaving(false);
        setIsAutoSavePending(false);
      }
    },
    [
      isAutoSaveEnabled,
      isFileBasedProject,
      currentFilePath,
      isTauriEnvironment,
    ],
  );

  // Helper function to schedule autosave
  const scheduleAutoSave = useCallback(
    (projectToSave: ProjectType) => {
      if (!isAutoSaveEnabled) {
        setIsAutoSavePending(false);
        return;
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      setIsAutoSavePending(true);
      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSaveTimeoutRef.current = null;
        void autoSaveProject(projectToSave);
      }, autoSaveDelay);
    },
    [isAutoSaveEnabled, autoSaveProject, autoSaveDelay],
  );

  // IMPROVED updateProjectDataAndAutoSave with deep cloning
  const updateProjectDataAndAutoSave = useCallback(
    (updateFn: (currentProject: ProjectType) => ProjectType | null) => {
      setHistory((currentHistory) => {
        if (!currentHistory.present) return currentHistory;

        const projectWithMapData = ensureProjectHasMapData(
          currentHistory.present,
        );
        const updatedProject = updateFn(projectWithMapData);

        if (!updatedProject) {
          return currentHistory;
        }

        // Record deletions so the 15-second HQ merge cannot resurrect a
        // character or item the person just removed.
        const tombstoned = withDeletionTombstones(
          currentHistory.present,
          updatedProject,
        );

        // CRITICAL: Deep clone to ensure completely new references
        const clonedProject = JSON.parse(JSON.stringify(tombstoned));

        // Check if actually changed
        if (
          JSON.stringify(clonedProject) ===
          JSON.stringify(currentHistory.present)
        ) {
          return currentHistory;
        }

        // Create new history state with deep cloned project
        const newHistoryState = {
          past: [...currentHistory.past, currentHistory.present],
          present: clonedProject,
          future: [] as ProjectType[],
        };

        // Schedule auto-save
        scheduleAutoSave(clonedProject);

        return newHistoryState;
      });
    },
    [ensureProjectHasMapData, scheduleAutoSave],
  );

  // --- UNDO/REDO: Add Undo/Redo functions ---
  const undo = useCallback(() => {
    setHistory((currentHistory) => {
      const { past, present, future } = currentHistory;
      if (past.length === 0 || !present) {
        return currentHistory; // Can't undo
      }
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      return {
        past: newPast,
        present: previous,
        future: [present, ...future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((currentHistory) => {
      const { past, present, future } = currentHistory;
      if (future.length === 0 || !present) {
        return currentHistory; // Can't redo
      }
      const next = future[0];
      const newFuture = future.slice(1);
      return {
        past: [...past, present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  // --- END UNDO/REDO ---

  const updateProjectDetails = useCallback(
    (details: {
      name?: string;
      description?: string;
      thumbnailUrl?: string;
    }) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          name: details.name !== undefined ? details.name : currentProject.name,
          description:
            details.description !== undefined
              ? details.description
              : currentProject.description,
          thumbnailUrl:
            details.thumbnailUrl !== undefined
              ? details.thumbnailUrl
              : currentProject.thumbnailUrl,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // Timeline operations
  const addTimeline = useCallback(
    (
      timelineData: Omit<
        TimelineType,
        "id" | "events" | "pointsOfDivergence"
      > & {
        events?: Array<Omit<EventType, "id">>;
        pointsOfDivergence?: Array<Omit<PointOfDivergenceType, "id">>;
      },
    ) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const {
          events: inputEvents,
          pointsOfDivergence: inputPods,
          ...restTimelineData
        } = timelineData;
        const defaults = {
          name: "Untitled Timeline",
          description: "",
          color: "#4287f5",
          startDate: "",
          endDate: "",
          isMainTimeline: false,
          parentTimelineId: null,
          branchFromEventId: null,
          tags: [],
        };
        const newTimeline: TimelineType = {
          ...defaults,
          ...restTimelineData,
          id: uuidv4(),
          events: (inputEvents || []).map((e) => ({
            ...e,
            id: (e as EventType).id || uuidv4(),
          })),
          pointsOfDivergence: (inputPods || []).map((pod) => ({
            ...pod,
            id: (pod as PointOfDivergenceType).id || uuidv4(),
          })),
        };
        return {
          ...currentProject,
          timelines: [...(currentProject.timelines || []), newTimeline],
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );
  const updateTimeline = useCallback(
    (timeline: TimelineType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          timelines: (currentProject.timelines || []).map((t) =>
            t.id === timeline.id ? timeline : t,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteTimeline = useCallback(
    (timelineId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          timelines: (currentProject.timelines || []).filter(
            (t) => t.id !== timelineId,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // Event operations
  const addEvent = useCallback(
    (timelineId: ID, eventData: Omit<EventType, "id">) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const newEvent = { ...eventData, id: uuidv4() };
        return {
          ...currentProject,
          timelines: currentProject.timelines.map((tl) =>
            tl.id === timelineId
              ? { ...tl, events: [...tl.events, newEvent] }
              : tl,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const updateEvent = useCallback(
    (timelineId: ID, event: EventType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          timelines: currentProject.timelines.map((tl) =>
            tl.id === timelineId
              ? {
                  ...tl,
                  events: tl.events.map((e) => (e.id === event.id ? event : e)),
                }
              : tl,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteEvent = useCallback(
    (timelineId: ID, eventId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          timelines: currentProject.timelines.map((tl) =>
            tl.id === timelineId
              ? { ...tl, events: tl.events.filter((e) => e.id !== eventId) }
              : tl,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // Points of Divergence operations
  const addPointOfDivergence = useCallback(
    (timelineId: ID, podData: Omit<PointOfDivergenceType, "id">) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const newPod = { ...podData, id: uuidv4() };
        return {
          ...currentProject,
          timelines: currentProject.timelines.map((tl) =>
            tl.id === timelineId
              ? {
                  ...tl,
                  pointsOfDivergence: [...tl.pointsOfDivergence, newPod],
                }
              : tl,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const updatePointOfDivergence = useCallback(
    (timelineId: ID, pod: PointOfDivergenceType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          timelines: currentProject.timelines.map((tl) =>
            tl.id === timelineId
              ? {
                  ...tl,
                  pointsOfDivergence: tl.pointsOfDivergence.map((p) =>
                    p.id === pod.id ? pod : p,
                  ),
                }
              : tl,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deletePointOfDivergence = useCallback(
    (timelineId: ID, podId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          timelines: currentProject.timelines.map((tl) =>
            tl.id === timelineId
              ? {
                  ...tl,
                  pointsOfDivergence: tl.pointsOfDivergence.filter(
                    (p) => p.id !== podId,
                  ),
                }
              : tl,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // FIXED: Character operations with direct state updates
  const addCharacter = useCallback(
    (characterData: Omit<CharacterType, "id">): ID => {
      const newId = uuidv4();
      const newCharacter: CharacterType = {
        ...characterData,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Use direct setHistory for immediate update
      setHistory((currentHistory) => {
        if (!currentHistory.present) return currentHistory;

        const updatedProject = {
          ...currentHistory.present,
          characters: [
            ...(currentHistory.present.characters || []),
            newCharacter,
          ],
          updatedAt: new Date().toISOString(),
        };

        // Deep clone to ensure new references
        const clonedProject = JSON.parse(JSON.stringify(updatedProject));

        // Schedule autosave
        scheduleAutoSave(clonedProject);

        return {
          past: [...currentHistory.past, currentHistory.present],
          present: clonedProject,
          future: [] as ProjectType[],
        };
      });

      return newId;
    },
    [scheduleAutoSave],
  );

  const updateCharacter = useCallback(
    (character: CharacterType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          characters: (currentProject.characters || []).map((c) =>
            c.id === character.id
              ? { ...character, updatedAt: new Date().toISOString() }
              : c,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteCharacter = useCallback(
    (characterId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          characters: (currentProject.characters || []).filter(
            (c) => c.id !== characterId,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // FIXED: Location operations with direct state updates
  const addLocation = useCallback(
    (locationData: Omit<LocationType, "id">): ID => {
      const newId = uuidv4();
      const newLocation: LocationType = {
        ...locationData,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setHistory((currentHistory) => {
        if (!currentHistory.present) return currentHistory;

        const updatedProject = {
          ...currentHistory.present,
          locations: [...(currentHistory.present.locations || []), newLocation],
          updatedAt: new Date().toISOString(),
        };

        const clonedProject = JSON.parse(JSON.stringify(updatedProject));
        scheduleAutoSave(clonedProject);

        return {
          past: [...currentHistory.past, currentHistory.present],
          present: clonedProject,
          future: [] as ProjectType[],
        };
      });

      return newId;
    },
    [scheduleAutoSave],
  );

  const updateLocation = useCallback(
    (location: LocationType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          locations: (currentProject.locations || []).map((l) =>
            l.id === location.id
              ? { ...location, updatedAt: new Date().toISOString() }
              : l,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteLocation = useCallback(
    (locationId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const mapData = currentProject.mapData
          ? { ...currentProject.mapData }
          : undefined;
        if (mapData?.anchoredShapes) {
          mapData.anchoredShapes = mapData.anchoredShapes.filter(
            (shape) =>
              shape.anchor.locationId !== locationId &&
              !shape.secondaryAnchors?.some(
                (anchor) => anchor.locationId === locationId,
              ),
          );
        }
        return {
          ...currentProject,
          locations: (currentProject.locations || []).filter(
            (l) => l.id !== locationId,
          ),
          mapData: mapData,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // FIXED: Technology operations with direct state updates
  const addTechnology = useCallback(
    (technologyData: Omit<TechnologyType, "id">): ID => {
      const newId = uuidv4();
      const newTechnology: TechnologyType = {
        ...technologyData,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setHistory((currentHistory) => {
        if (!currentHistory.present) return currentHistory;

        const updatedProject = {
          ...currentHistory.present,
          technologies: [
            ...(currentHistory.present.technologies || []),
            newTechnology,
          ],
          updatedAt: new Date().toISOString(),
        };

        const clonedProject = JSON.parse(JSON.stringify(updatedProject));
        scheduleAutoSave(clonedProject);

        return {
          past: [...currentHistory.past, currentHistory.present],
          present: clonedProject,
          future: [] as ProjectType[],
        };
      });

      return newId;
    },
    [scheduleAutoSave],
  );

  const updateTechnology = useCallback(
    (technology: TechnologyType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          technologies: (currentProject.technologies || []).map((t) =>
            t.id === technology.id
              ? { ...technology, updatedAt: new Date().toISOString() }
              : t,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteTechnology = useCallback(
    (technologyId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          technologies: (currentProject.technologies || []).filter(
            (t) => t.id !== technologyId,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // FIXED: Culture operations with direct state updates
  const addCulture = useCallback(
    (cultureData: Omit<CultureType, "id">): ID => {
      const newId = uuidv4();
      const newCulture: CultureType = {
        ...cultureData,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setHistory((currentHistory) => {
        if (!currentHistory.present) return currentHistory;

        const updatedProject = {
          ...currentHistory.present,
          cultures: [...(currentHistory.present.cultures || []), newCulture],
          updatedAt: new Date().toISOString(),
        };

        const clonedProject = JSON.parse(JSON.stringify(updatedProject));
        scheduleAutoSave(clonedProject);

        return {
          past: [...currentHistory.past, currentHistory.present],
          present: clonedProject,
          future: [] as ProjectType[],
        };
      });

      return newId;
    },
    [scheduleAutoSave],
  );

  const updateCulture = useCallback(
    (culture: CultureType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          cultures: (currentProject.cultures || []).map((c) =>
            c.id === culture.id
              ? { ...culture, updatedAt: new Date().toISOString() }
              : c,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteCulture = useCallback(
    (cultureId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          cultures: (currentProject.cultures || []).filter(
            (c) => c.id !== cultureId,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // FIXED: Source Document operations with direct state updates
  const addSourceDocument = useCallback(
    (docData: Omit<SourceDocumentType, "id">): ID => {
      const newId = uuidv4();
      const newDoc: SourceDocumentType = {
        ...docData,
        id: newId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setHistory((currentHistory) => {
        if (!currentHistory.present) return currentHistory;

        const updatedProject = {
          ...currentHistory.present,
          sources: [...(currentHistory.present.sources || []), newDoc],
          updatedAt: new Date().toISOString(),
        };

        const clonedProject = JSON.parse(JSON.stringify(updatedProject));
        scheduleAutoSave(clonedProject);

        return {
          past: [...currentHistory.past, currentHistory.present],
          present: clonedProject,
          future: [] as ProjectType[],
        };
      });

      return newId;
    },
    [scheduleAutoSave],
  );

  const updateSourceDocument = useCallback(
    (doc: SourceDocumentType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          sources: (currentProject.sources || []).map((s) =>
            s.id === doc.id
              ? { ...doc, updatedAt: new Date().toISOString() }
              : s,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteSourceDocument = useCallback(
    (docId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          sources: (currentProject.sources || []).filter((s) => s.id !== docId),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // Report operations (renamed from Narrative)
  const addReport = useCallback(
    (
      reportData: Omit<ReportType, "id" | "scenes"> & {
        scenes?: Array<Omit<SceneType, "id">>;
      },
    ) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const {
          scenes: inputScenes,
          createdAt,
          ...restReportData
        } = reportData;
        const defaults = {
          title: "Untitled Report",
          description: "",
          timelineId: null,
          characterIds: [],
          tags: [],
        };
        const newReport: ReportType = {
          ...defaults,
          ...restReportData,
          id: uuidv4(),
          scenes: (inputScenes || []).map((s) => ({
            ...s,
            id: (s as SceneType).id || uuidv4(),
          })),
          createdAt: createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return {
          ...currentProject,
          reports: [...(currentProject.reports || []), newReport],
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const updateReport = useCallback(
    (report: ReportType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          reports: (currentProject.reports || []).map((n) =>
            n.id === report.id
              ? { ...report, updatedAt: new Date().toISOString() }
              : n,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteReport = useCallback(
    (reportId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          reports: (currentProject.reports || []).filter(
            (n) => n.id !== reportId,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // Scene operations
  const addTask = useCallback(
    (taskData: Omit<TaskType, "id" | "createdAt" | "updatedAt">): ID => {
      const id = uuidv4();
      const stamp = new Date().toISOString();
      const task: TaskType = {
        ...taskData,
        id,
        createdAt: stamp,
        updatedAt: stamp,
      };
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          tasks: [...(currentProject.tasks || []), task],
          updatedAt: stamp,
        };
      });
      return id;
    },
    [updateProjectDataAndAutoSave],
  );

  const updateTask = useCallback(
    (task: TaskType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const previous = (currentProject.tasks || []).find(
          (row) => row.id === task.id,
        );
        const becameDone =
          previous?.status !== "done" && task.status === "done";
        const stamp = new Date().toISOString();
        let timelines = currentProject.timelines || [];

        // Only the transition into "done" writes a timeline event. Adding a
        // task or editing its fields must not create history entries.
        if (becameDone) {
          const mainTimeline =
            timelines.find((timeline) => timeline.isMainTimeline) ||
            timelines[0];
          if (mainTimeline) {
            const now = new Date();
            const date = `${now.getFullYear()}-${String(
              now.getMonth() + 1,
            ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
            const event: EventType = {
              id: uuidv4(),
              title: `Completed: ${task.title}`.slice(0, 200),
              description: task.due
                ? `Task completed. Due ${task.due}${
                    task.dueEnd && task.dueEnd !== task.due
                      ? ` to ${task.dueEnd}`
                      : ""
                  }.`
                : "Task completed.",
              date,
              endDate: null,
              timelineId: mainTimeline.id,
              importance: 2,
              iconId: "default",
              causes: [],
              effects: [],
              linkedCharacterIds: [],
              linkedLocationIds: [],
              linkedTechnologyIds: [],
              linkedCultureIds: [],
              linkedSourceDocumentIds: [],
              linkedNarrativeIds: [],
              notes: "Auto-recorded when the task was marked done.",
              tags: ["task", "completed", `task:${task.id}`],
              isPointOfDivergence: false,
            };
            timelines = timelines.map((timeline) =>
              timeline.id === mainTimeline.id
                ? {
                    ...timeline,
                    events: [...(timeline.events || []), event],
                  }
                : timeline,
            );
          }
        }

        return {
          ...currentProject,
          tasks: (currentProject.tasks || []).map((row) =>
            row.id === task.id ? { ...task, updatedAt: stamp } : row,
          ),
          timelines,
          updatedAt: stamp,
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteTask = useCallback(
    (taskId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          tasks: (currentProject.tasks || []).filter((row) => row.id !== taskId),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const updateProfile = useCallback(
    (profile: OperativeProfileType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          profile: { ...profile, updatedAt: new Date().toISOString() },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const addFinanceSource = useCallback(
    (
      sourceData: Omit<
        FinanceSourceType,
        "id" | "createdAt" | "updatedAt"
      > & { id?: ID },
    ): ID => {
      const id = sourceData.id || uuidv4();
      const stamp = new Date().toISOString();
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const source: FinanceSourceType = {
          ...sourceData,
          id,
          createdAt: stamp,
          updatedAt: stamp,
        };
        return {
          ...currentProject,
          financeSources: [...(currentProject.financeSources || []), source],
          updatedAt: stamp,
        };
      });
      return id;
    },
    [updateProjectDataAndAutoSave],
  );

  const updateFinanceSource = useCallback(
    (source: FinanceSourceType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          financeSources: (currentProject.financeSources || []).map((row) =>
            row.id === source.id
              ? { ...source, updatedAt: new Date().toISOString() }
              : row,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteFinanceSource = useCallback(
    (sourceId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          financeSources: (currentProject.financeSources || []).filter(
            (row) => row.id !== sourceId,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const updateFinanceSettings = useCallback(
    (settings: FinanceSettingsType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          financeSettings: settings,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const addAsset = useCallback(
    (
      assetData: Omit<PersonalAssetType, "id" | "createdAt" | "updatedAt"> & {
        id?: ID;
      },
    ): ID => {
      const id = assetData.id || uuidv4();
      const stamp = new Date().toISOString();
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const asset: PersonalAssetType = {
          ...assetData,
          id,
          createdAt: stamp,
          updatedAt: stamp,
        };
        return {
          ...currentProject,
          assets: [...(currentProject.assets || []), asset],
          updatedAt: stamp,
        };
      });
      return id;
    },
    [updateProjectDataAndAutoSave],
  );

  const updateAsset = useCallback(
    (asset: PersonalAssetType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          assets: (currentProject.assets || []).map((row) =>
            row.id === asset.id
              ? { ...asset, updatedAt: new Date().toISOString() }
              : row,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteAsset = useCallback(
    (assetId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          assets: (currentProject.assets || []).filter(
            (row) => row.id !== assetId,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const upsertEntityType = useCallback(
    (entityType: DynamicEntityType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const existing = currentProject.entityTypes || [];
        const has = existing.some((row) => row.id === entityType.id);
        return {
          ...currentProject,
          entityTypes: has
            ? existing.map((row) =>
                row.id === entityType.id ? entityType : row,
              )
            : [...existing, entityType],
          entities: currentProject.entities || [],
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteEntityType = useCallback(
    (entityTypeId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          entityTypes: (currentProject.entityTypes || []).filter(
            (row) => row.id !== entityTypeId,
          ),
          entities: (currentProject.entities || []).filter(
            (row) => row.entityType !== entityTypeId,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const addGenericEntity = useCallback(
    (
      entity: Omit<GenericEntity, "id" | "createdAt" | "updatedAt"> & {
        id?: ID;
      },
    ): ID => {
      const id = entity.id || uuidv4();
      const stamp = new Date().toISOString();
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const row: GenericEntity = {
          ...entity,
          id,
          createdAt: stamp,
          updatedAt: stamp,
        };
        return {
          ...currentProject,
          entities: [...(currentProject.entities || []), row],
          updatedAt: stamp,
        };
      });
      return id;
    },
    [updateProjectDataAndAutoSave],
  );

  const updateGenericEntity = useCallback(
    (entity: GenericEntity) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          entities: (currentProject.entities || []).map((row) =>
            row.id === entity.id
              ? { ...entity, updatedAt: new Date().toISOString() }
              : row,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteGenericEntity = useCallback(
    (entityId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          entities: (currentProject.entities || []).filter(
            (row) => row.id !== entityId,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const addCaseDocument = useCallback(
    (docData: Omit<CaseDocumentType, "id"> & { id?: ID }): ID => {
      const id = docData.id || uuidv4();
      const doc: CaseDocumentType = { ...docData, id };
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          caseDocuments: [...(currentProject.caseDocuments || []), doc],
          updatedAt: new Date().toISOString(),
        };
      });
      return id;
    },
    [updateProjectDataAndAutoSave],
  );

  const updateCaseDocument = useCallback(
    (doc: CaseDocumentType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          caseDocuments: (currentProject.caseDocuments || []).map((row) =>
            row.id === doc.id ? doc : row,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteCaseDocument = useCallback(
    (docId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          caseDocuments: (currentProject.caseDocuments || []).filter(
            (row) => row.id !== docId,
          ),
          tasks: (currentProject.tasks || []).map((task) => ({
            ...task,
            documentIds: task.documentIds.filter((id) => id !== docId),
          })),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const addScene = useCallback(
    (reportId: ID, sceneData: Omit<SceneType, "id">) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        const newScene = { ...sceneData, id: uuidv4() };
        return {
          ...currentProject,
          reports: (currentProject.reports || []).map((n) =>
            n.id === reportId
              ? {
                  ...n,
                  scenes: [...n.scenes, newScene],
                  updatedAt: new Date().toISOString(),
                }
              : n,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const updateScene = useCallback(
    (reportId: ID, scene: SceneType) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          reports: (currentProject.reports || []).map((n) =>
            n.id === reportId
              ? {
                  ...n,
                  scenes: n.scenes.map((s) => (s.id === scene.id ? scene : s)),
                  updatedAt: new Date().toISOString(),
                }
              : n,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteScene = useCallback(
    (reportId: ID, sceneId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject) return null;
        return {
          ...currentProject,
          reports: (currentProject.reports || []).map((n) =>
            n.id === reportId
              ? {
                  ...n,
                  scenes: n.scenes.filter((s) => s.id !== sceneId),
                  updatedAt: new Date().toISOString(),
                }
              : n,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // Map operations
  const addAnchoredShape = useCallback(
    (shapeData: Omit<AnchoredShape, "id">) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject?.mapData) return currentProject;
        const newShape: AnchoredShape = {
          ...shapeData,
          id: uuidv4(),
          properties: {
            ...shapeData.properties,
            dateCreated:
              shapeData.properties.dateCreated || new Date().toISOString(),
          },
        };
        return {
          ...currentProject,
          mapData: {
            ...currentProject.mapData,
            anchoredShapes: [
              ...currentProject.mapData.anchoredShapes,
              newShape,
            ],
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const updateAnchoredShape = useCallback(
    (shape: AnchoredShape) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject?.mapData) return currentProject;
        return {
          ...currentProject,
          mapData: {
            ...currentProject.mapData,
            anchoredShapes: currentProject.mapData.anchoredShapes.map((s) =>
              s.id === shape.id
                ? {
                    ...shape,
                    properties: {
                      ...shape.properties,
                      dateModified: new Date().toISOString(),
                    },
                  }
                : s,
            ),
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const setAnchoredShapes = useCallback(
    (shapes: AnchoredShape[]) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject?.mapData) return currentProject;
        return {
          ...currentProject,
          mapData: { ...currentProject.mapData, anchoredShapes: shapes },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteAnchoredShape = useCallback(
    (shapeId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject?.mapData) return currentProject;
        return {
          ...currentProject,
          mapData: {
            ...currentProject.mapData,
            anchoredShapes: currentProject.mapData.anchoredShapes.filter(
              (s) => s.id !== shapeId,
            ),
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const getAnchoredShapesByTimeline = useCallback(
    (timelineId: ID): AnchoredShape[] => {
      if (!project?.mapData) return [];
      return project.mapData.anchoredShapes.filter(
        (shape) => shape.properties.timelineId === timelineId,
      );
    },
    [project],
  );

  const addMapScenario = useCallback(
    (scenarioData: Omit<MapScenario, "id">) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject?.mapData) return currentProject;
        const newScenario: MapScenario = {
          ...scenarioData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return {
          ...currentProject,
          mapData: {
            ...currentProject.mapData,
            scenarios: [...currentProject.mapData.scenarios, newScenario],
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const updateMapScenario = useCallback(
    (scenario: MapScenario) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject?.mapData) return currentProject;
        return {
          ...currentProject,
          mapData: {
            ...currentProject.mapData,
            scenarios: currentProject.mapData.scenarios.map((s) =>
              s.id === scenario.id
                ? { ...scenario, updatedAt: new Date().toISOString() }
                : s,
            ),
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const deleteMapScenario = useCallback(
    (scenarioId: ID) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject?.mapData) return currentProject;
        return {
          ...currentProject,
          mapData: {
            ...currentProject.mapData,
            scenarios: currentProject.mapData.scenarios.filter(
              (s) => s.id !== scenarioId,
            ),
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  const getMapScenariosByTimeline = useCallback(
    (timelineId: ID): MapScenario[] => {
      if (!project?.mapData) return [];
      return project.mapData.scenarios.filter(
        (scenario) => scenario.timelineId === timelineId,
      );
    },
    [project],
  );

  const updateMapSettings = useCallback(
    (settings: Partial<MapSettingsType>) => {
      updateProjectDataAndAutoSave((currentProject) => {
        if (!currentProject?.mapData) return currentProject;
        return {
          ...currentProject,
          mapData: {
            ...currentProject.mapData,
            defaultMapSettings: {
              ...currentProject.mapData.defaultMapSettings,
              ...settings,
            },
          },
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateProjectDataAndAutoSave],
  );

  // Batch operations
  const batchImportKnowledgeBase = useCallback(
    async (knowledgeBase: ImportedKnowledgeBase): Promise<void> => {
      console.warn(
        "Batch import knowledge base needs review for async safety.",
      );
      knowledgeBase.characters.forEach((item) => addCharacter(item));
      knowledgeBase.locations.forEach((item) => addLocation(item));
      knowledgeBase.technologies.forEach((item) => addTechnology(item));
      knowledgeBase.cultures.forEach((item) => addCulture(item));
      knowledgeBase.sources.forEach((item) => addSourceDocument(item));
    },
    [addCharacter, addLocation, addTechnology, addCulture, addSourceDocument],
  );

  const batchImportTimelines = useCallback(
    async (
      timelines: TimelineType[],
      knowledgeBase?: ImportedKnowledgeBase,
    ): Promise<void> => {
      console.warn("Batch import timelines needs review for async safety.");
      if (knowledgeBase) {
        await batchImportKnowledgeBase(knowledgeBase);
      }
      timelines.forEach((item) => addTimeline(item));
    },
    [batchImportKnowledgeBase, addTimeline],
  );

  // Save operations
  const markSaved = useCallback(() => {
    if (project) {
      setOriginalProject(JSON.parse(JSON.stringify(project)));
      setLastSavedAt(new Date().toISOString());
      setAutoSaveError(null);
      setIsAutoSavePending(false);
    }
  }, [project]);

  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (!project) return false;
    try {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      // Save with backward compatibility
      const projectToSaveCompat = {
        ...project,
        sourceDocuments: project.sources, // Keep both for compatibility
        narratives: project.reports,
      };

      let saved = false;
      if (isFileBasedProject && currentFilePath && isTauriEnvironment) {
        await saveProjectToFileSystem(projectToSaveCompat, currentFilePath);
        saved = true;
      } else {
        console.log("Save requires path, attempting Save As...");
        const saveAsResult = await saveChangesAs();
        return saveAsResult;
      }
      if (saved) {
        setOriginalProject(JSON.parse(JSON.stringify(project)));
        setLastSavedAt(new Date().toISOString());
        setAutoSaveError(null);
        setIsAutoSavePending(false);
        const recentProjectsStr =
          localStorage.getItem("recentProjects") || "[]";
        let recentProjects: any[] = JSON.parse(recentProjectsStr);
        const recentProjectEntry = {
          id: project.id,
          name: project.name,
          path: currentFilePath,
          type: "local_file",
          lastAccessed: new Date().toISOString(),
        };
        const existingIndex = recentProjects.findIndex(
          (p: any) => p.id === project.id,
        );
        if (existingIndex >= 0)
          recentProjects[existingIndex] = recentProjectEntry;
        else recentProjects.push(recentProjectEntry);
        localStorage.setItem(
          "recentProjects",
          JSON.stringify(recentProjects.slice(-5)),
        );
      }
      return saved;
    } catch (error) {
      console.error("Failed to save project:", error);
      return false;
    }
  }, [
    project,
    isFileBasedProject,
    currentFilePath,
    isTauriEnvironment,
  ]);

  const saveChangesAs = useCallback(async (): Promise<boolean> => {
    if (!project) return false;
    try {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
      if (isTauriEnvironment) {
        const { save } = await import("@tauri-apps/plugin-dialog");

        // Save with backward compatibility
        const projectToSaveCompat = {
          ...project,
          sourceDocuments: project.sources, // Keep both for compatibility
          narratives: project.reports,
        };

        const newPath = await save({
          title: "Save Project As",
          defaultPath: `${project.name}.ark`,
          filters: [{ name: "SkeletonKey Ark Project", extensions: ["ark"] }],
        });
        if (newPath && typeof newPath === "string") {
          await saveProjectToFileSystem(projectToSaveCompat, newPath);
          setCurrentFilePath(newPath);
          setIsFileBasedProject(true);
          setOriginalProject(JSON.parse(JSON.stringify(project)));
          setLastSavedAt(new Date().toISOString());
          setAutoSaveError(null);
          setIsAutoSavePending(false);
          setHistory({ past: [], present: project, future: [] });
          return true;
        }
      } else {
        console.error(
          "Save As is only supported in Tauri environment currently.",
        );
        return false;
      }
      return false;
    } catch (error) {
      console.error("Save As failed:", error);
      return false;
    }
  }, [project, isTauriEnvironment]);

  const discardChanges = useCallback(() => {
    if (originalProject) {
      setHistory({
        past: [],
        present: JSON.parse(JSON.stringify(originalProject)),
        future: [],
      });
    }
  }, [originalProject]);

  const enableAutoSave = useCallback(() => setIsAutoSaveEnabled(true), []);
  const disableAutoSave = useCallback(() => {
    setIsAutoSaveEnabled(false);
    setIsAutoSavePending(false);
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
  }, []);

  // Getter functions
  const getTimelineById = useCallback(
    (timelineId: ID) => project?.timelines.find((t) => t.id === timelineId),
    [project],
  );

  const getEventById = useCallback(
    (eventId: ID, timelineId?: ID) => {
      if (!project) return undefined;
      const targetTimeline = timelineId
        ? project.timelines.find((t) => t.id === timelineId)
        : null;
      if (targetTimeline)
        return targetTimeline.events.find((e) => e.id === eventId);
      for (const tl of project.timelines) {
        const event = tl.events.find((e) => e.id === eventId);
        if (event) return event;
      }
      return undefined;
    },
    [project],
  );

  const getCharacterById = useCallback(
    (characterId: ID) =>
      (project?.characters || []).find((c) => c.id === characterId),
    [project],
  );

  const getLocationById = useCallback(
    (locationId: ID) =>
      (project?.locations || []).find((l) => l.id === locationId),
    [project],
  );

  const getTechnologyById = useCallback(
    (technologyId: ID) =>
      (project?.technologies || []).find((t) => t.id === technologyId),
    [project],
  );

  const getCultureById = useCallback(
    (cultureId: ID) =>
      (project?.cultures || []).find((c) => c.id === cultureId),
    [project],
  );

  const getSourceDocumentById = useCallback(
    (docId: ID) => (project?.sources || []).find((s) => s.id === docId), // Changed from sourceDocuments
    [project],
  );

  const getReportById = useCallback(
    (reportId: ID) => (project?.reports || []).find((n) => n.id === reportId), // Changed from narratives
    [project],
  );

  const getSceneById = useCallback(
    (reportId: ID, sceneId: ID) =>
      getReportById(reportId)?.scenes.find((s) => s.id === sceneId),
    [getReportById],
  );

  const getAnchoredShapeById = useCallback(
    (shapeId: ID) =>
      project?.mapData?.anchoredShapes.find((s) => s.id === shapeId),
    [project],
  );

  const getMapScenarioById = useCallback(
    (scenarioId: ID) =>
      project?.mapData?.scenarios.find((s) => s.id === scenarioId),
    [project],
  );

  // Save shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s") return;
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isModifierPressed = isMac ? event.metaKey : event.ctrlKey;
      if (isModifierPressed) {
        event.preventDefault();
        if (project) {
          console.log("Save shortcut triggered (Ctrl+S / Cmd+S).");
          saveChanges();
        } else {
          console.log("Save shortcut ignored: No project loaded.");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [project, saveChanges]);

  return (
    <ProjectDataContext.Provider
      value={{
        project,
        originalProject,
        hasUnsavedChanges,
        currentFilePath,
        isFileBasedProject,
        setProject,
        setCurrentFilePath,
        setFilePath: setCurrentFilePath,
        setIsFileBased: setIsFileBasedProject,
        updateProjectDetails,
        undo,
        redo,
        canUndo,
        canRedo,
        addTimeline,
        updateTimeline,
        deleteTimeline,
        addEvent,
        updateEvent,
        deleteEvent,
        addPointOfDivergence,
        updatePointOfDivergence,
        deletePointOfDivergence,
        addCharacter,
        updateCharacter,
        deleteCharacter,
        addLocation,
        updateLocation,
        deleteLocation,
        addTechnology,
        updateTechnology,
        deleteTechnology,
        addCulture,
        updateCulture,
        deleteCulture,
        addSourceDocument,
        updateSourceDocument,
        deleteSourceDocument,
        addTask,
        updateTask,
        addAsset,
        updateAsset,
        deleteAsset,
        addFinanceSource,
        updateFinanceSource,
        deleteFinanceSource,
        updateFinanceSettings,
        updateProfile,
        upsertEntityType,
        deleteEntityType,
        addGenericEntity,
        updateGenericEntity,
        deleteGenericEntity,
        deleteTask,
        addCaseDocument,
        updateCaseDocument,
        deleteCaseDocument,
        addReport,
        updateReport,
        deleteReport,
        addNarrative: addReport,
        updateNarrative: updateReport,
        deleteNarrative: deleteReport,
        addScene,
        updateScene,
        deleteScene,
        addAnchoredShape,
        updateAnchoredShape,
        setAnchoredShapes,
        deleteAnchoredShape,
        getAnchoredShapesByTimeline,
        addMapScenario,
        updateMapScenario,
        deleteMapScenario,
        getMapScenariosByTimeline,
        updateMapSettings,
        batchImportKnowledgeBase,
        batchImportTimelines,
        getTimelineById,
        getEventById,
        getCharacterById,
        getLocationById,
        getTechnologyById,
        getCultureById,
        getSourceDocumentById,
        getReportById: getReportById, // Compatibility alias
        getSceneById,
        getAnchoredShapeById,
        getMapScenarioById,
        saveChanges,
        saveChangesAs,
        discardChanges,
        markSaved,
        enableAutoSave,
        disableAutoSave,
        isAutoSaveEnabled,
        isAutoSavePending,
        isSaving,
        lastSavedAt,
        autoSaveError,
      }}
    >
      {children}
    </ProjectDataContext.Provider>
  );
};

export const useProjectData = () => {
  const context = useContext(ProjectDataContext);
  if (context === undefined) {
    throw new Error("useProjectData must be used within a ProjectDataProvider");
  }
  return context;
};

export default ProjectDataContext;
