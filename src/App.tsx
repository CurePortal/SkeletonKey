// src/App.tsx
import React, { useEffect, useCallback, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { AppStateProvider, useAppState } from "./contexts/AppStateContext";
import {
  ProjectDataProvider,
  useProjectData,
} from "./contexts/ProjectDataContext";
import { NotificationProvider, useNotification } from "./contexts/NotificationContext";
import { recentFieldLogEvents } from "./services/fieldLogService";
import { UIThemeProvider } from "./contexts/UIThemeContext";
import { SearchProvider } from "./contexts/SearchContext";
import { TauriProvider } from "./contexts/TauriContext";
import { APIProvider } from "./hooks/useUnifiedAPI";
import { loadProject } from "./services/projectService";
import type { ProjectType } from "./types/project";
import {
  loadMainProject,
  mergeFieldLogEvents,
  mergeProjects,
  openAnotherProject,
  projectSignature,
  saveMainProject,
  setMainProjectFilePath,
} from "./services/mainProjectService";
import {
  hqPullProject,
  hqPushProject,
  hqStatus,
} from "./services/hqBridgeService";
import Navbar from "./components/layout/Navbar";
import Sidebar from "./components/layout/Sidebar";
import StatusBar from "./components/layout/StatusBar";
import LoadingSpinner from "./components/common/LoadingSpinner";
import ModalRoot from "./components/ModalRoot";
import WelcomeScreen from "./pages/WelcomeScreen";
import DashboardPage from "./pages/DashboardPage";
import TimelineEditorPage from "./pages/TimelineEditorPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import MapEditorPage from "./pages/MapEditorPage";
import NarrativeBuilderPage from "./pages/NarrativeBuilderPage";
import FlowsIdeasPage from "./pages/FlowsIdeasPage";
import TasksPage from "./pages/TasksPage";
import PersonalAssetsPage from "./pages/PersonalAssetsPage";
import FinancePage from "./pages/FinancePage";
import ProfilePage from "./pages/ProfilePage";
import CaseDocumentsPage from "./pages/CaseDocumentsPage";
import SettingsPage from "./pages/SettingsPage";
import LLMAssistantPanel from "./components/LLM/LLMAnalysisPanel";
import SearchResultsPage from "./pages/SearchResultsPage";
import LLMAnalysisPage from "./pages/LLMAnalysisPage";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const ProjectContent: React.FC = () => {
  const { appState } = useAppState();
  const { project } = useProjectData();

  // 2. Settings View
  if (appState.viewMode === "settings") {
    return <SettingsPage />;
  }

  // 3. Search Results View
  if (appState.viewMode === "search-results") {
    return <SearchResultsPage />;
  }

  // --- If no project exists after checking the above, show Welcome Screen ---
  if (!project) {
    return <WelcomeScreen />;
  }

  // --- Handle views that require a project ---
  switch (appState.viewMode) {
    case "timeline":
    case "timeline-editor":
      return <TimelineEditorPage />;
    case "knowledge-base":
      return <KnowledgeBasePage />;
    case "map":
      return <MapEditorPage />;
    case "narrative":
      return <NarrativeBuilderPage section="narrative" />;
    case "flows-ideas":
      return <FlowsIdeasPage />;
    case "tasks":
      return <TasksPage />;
    case "assets":
      return <PersonalAssetsPage />;
    case "finances":
      return <FinancePage />;
    case "profile":
      return <ProfilePage />;
    case "documents":
      return <CaseDocumentsPage />;
    case "ai-analysis":
      return <LLMAnalysisPage />;
    case "dashboard":
    default:
      return <DashboardPage />;
  }
};

const AppWithProviders: React.FC = () => {
  return (
    <TauriProvider>
      <AppStateProvider>
        <ProjectDataProvider>
          <NotificationProvider>
            <UIThemeProvider>
              <SearchProvider>
                <APIProvider>
                  <AppLayout />
                </APIProvider>
              </SearchProvider>
            </UIThemeProvider>
          </NotificationProvider>
        </ProjectDataProvider>
      </AppStateProvider>
    </TauriProvider>
  );
};

const AppLayout: React.FC = () => {
  const { appState, setLLMPanelOpen, setViewMode } = useAppState();
  const {
    project,
    undo,
    redo,
    canUndo,
    canRedo,
    setProject,
    addTimeline,
    currentFilePath,
  } = useProjectData();
  const { showInfo, showError } = useNotification();

  const projectRef = useRef(project);
  const mainLoadedRef = useRef(false);
  const [mainProjectLoading, setMainProjectLoading] = useState(true);
  const [mainProjectError, setMainProjectError] = useState("");

  // --- Keyboard Shortcut Handler ---
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const targetElement = event.target as HTMLElement;
      // 1. Ignore key presses if the user is already in an input field.
      if (
        targetElement.tagName === "INPUT" ||
        targetElement.tagName === "TEXTAREA" ||
        targetElement.isContentEditable
      ) {
        return;
      }

      // 2. Handle the global "/" command shortcut (does not require a project).
      if (event.key === "/") {
        event.preventDefault(); // Prevent the default "/" typing or browser search
        const searchInput = document.getElementById(
          "project-search",
        ) as HTMLInputElement;

        if (searchInput) {
          searchInput.focus();
          // Manually set the value and dispatch an input event.
          // This is necessary to make React's controlled component update its state.
          searchInput.value = "/";
          searchInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return; // Shortcut handled, no need to continue.
      }

      // --- Project-Specific Shortcuts ---
      // 3. From this point on, a project is required.
      if (!project) return;

      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (isCtrlOrCmd) {
        if (event.key === "z" || event.key === "Z") {
          event.preventDefault();
          if (event.shiftKey) {
            if (canRedo) {
              redo();
            }
          } else {
            if (canUndo) {
              undo();
            }
          }
        } else if (event.key === "y" || event.key === "Y") {
          event.preventDefault();
          if (canRedo) {
            redo();
          }
        }
      }
    },
    [project, undo, redo, canUndo, canRedo],
  );

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // One main project, loaded automatically. There is no project gallery.
  useEffect(() => {
    if (mainLoadedRef.current) return;
    mainLoadedRef.current = true;
    let cancelled = false;
    void (async () => {
      if (projectRef.current) {
        setMainProjectLoading(false);
        return;
      }
      try {
        const main = await loadMainProject();
        if (cancelled) return;
        setProject(main.project, main.path, false);
        setViewMode("dashboard");
      } catch (error) {
        if (!cancelled) {
          setMainProjectError(
            error instanceof Error ? error.message : String(error),
          );
        }
      } finally {
        if (!cancelled) setMainProjectLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setProject, setViewMode]);

  // Agents fill the main project through the local HQ bridge. Pull newer
  // telemetry automatically; push a local project the agents do not have yet.
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    const sync = async () => {
      const current = projectRef.current;
      if (!current) return;
      let base = current;
      let incoming: ProjectType | null = null;

      try {
        const status = await hqStatus();
        if (!status.ok || cancelled) return;
        incoming = await hqPullProject();
        if (cancelled) return;
        base = mergeProjects(current, incoming);
      } catch {
        // HQ is optional; keep working when the MCP is not running.
      }

      try {
        const events = await recentFieldLogEvents();
        if (!cancelled && events.length) {
          base = mergeFieldLogEvents(base, events).project;
        }
      } catch {
        // The field log bridge is optional.
      }

      if (!cancelled) {
        const localChanged = projectSignature(base) !== projectSignature(current);
        const hqChanged = incoming
          ? projectSignature(base) !== projectSignature(incoming)
          : false;

        if (localChanged) {
          if (!currentFilePath) base.id = "main";
          setProject(base, currentFilePath, false);
          await saveMainProject(base, currentFilePath);
          showInfo("Main project updated.");
        }
        if (hqChanged) {
          const hqProject = {
            ...base,
            sourceDocuments: base.sources,
            narratives: base.reports,
          };
          await hqPushProject(hqProject as ProjectType);
        }
      }
    };
    void sync();
    const timer = setInterval(sync, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [project?.id, currentFilePath, setProject, showInfo]);

  // A connected phone always gets a dedicated Beacon timeline. This keeps
  // telemetry separate from the person's main record and makes HQ ingests
  // predictable.
  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    const check = async () => {
      let connected = false;
      for (const url of [
        "http://127.0.0.1:8788/beacon/health",
        "http://127.0.0.1:8787/health",
      ]) {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
          if (response.ok) {
            const data = await response.json();
            connected = Boolean(data?.ok);
            if (connected) break;
          }
        } catch {
          // Try the next endpoint.
        }
      }
      if (!connected || cancelled) return;
      const exists = (project.timelines || []).some(
        (timeline) => timeline.name.trim().toLowerCase() === "beacon",
      );
      if (exists) return;
      addTimeline({
        name: "Beacon",
        description: "Live phone beacon, movement, and telemetry.",
        events: [],
        pointsOfDivergence: [],
        startDate: "",
        endDate: "",
        isMainTimeline: false,
        parentTimelineId: null,
        color: "#22c55e",
        tags: ["beacon", "telemetry"],
      });
    };
    void check();
    const timer = setInterval(() => void check(), 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [project?.id, project?.timelines, addTimeline]);

  useEffect(() => {
    // 4. Attach the event listener globally, regardless of project state.
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    let unlistenOpenFile: (() => void) | undefined;
    let unlistenFileDrop: (() => void) | undefined;

    const setupFileListeners = async () => {
      try {
        // Listen for files opened from Finder (macOS double-click)
        unlistenOpenFile = await listen("open-ark-file", async (event) => {
          console.log("Opening ARK file from Finder:", event.payload);

          const filePath = event.payload as string;
          if (!filePath || !filePath.endsWith(".ark")) {
            console.error("Invalid file path received:", filePath);
            return;
          }

          try {
            // Load the project
            const result = await loadProject(filePath);

            if (result.success && result.data) {
              setMainProjectFilePath(result.data.filePath);
              setProject(
                result.data.project,
                result.data.filePath,
                false,
              );

              setViewMode("dashboard");
              console.log("Project loaded successfully from Finder");
            } else {
              console.error("Failed to load project:", result.error);
            }
          } catch (error) {
            console.error("Error loading project from Finder:", error);
          }
        });

        // Also fix the drag-and-drop handler
        unlistenFileDrop = await listen("tauri://file-drop", async (event) => {
          console.log("Files dropped:", event.payload);

          const files = event.payload as string[];
          const arkFile = files.find((f) => f.endsWith(".ark"));

          if (arkFile) {
            try {
              const result = await loadProject(arkFile);

              if (result.success && result.data) {
                setMainProjectFilePath(result.data.filePath || arkFile);
                setProject(
                  result.data.project,
                  result.data.filePath || arkFile,
                  false,
                );

                setViewMode("dashboard");
                console.log("Project loaded from drag-and-drop");
              }
            } catch (error) {
              console.error("Error loading dropped file:", error);
            }
          }
        });
      } catch (error) {
        console.error("Error setting up file listeners:", error);
      }
    };

    // Only setup listeners in Tauri environment
    if (
      typeof window !== "undefined" &&
      ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI_IPC__)
    ) {
      setupFileListeners();
    }

    // Cleanup on unmount
    return () => {
      unlistenOpenFile?.();
      unlistenFileDrop?.();
    };
  }, [setProject, setViewMode]); // FIXED: Updated dependencies
  if (
    mainProjectLoading ||
    appState.loadingStates.some(
      (state) =>
        state.operation === "initializing_app" ||
        state.operation === "loading_heavy_project",
    )
  ) {
    return (
      <LoadingSpinner fullScreen showLabel label="Loading application..." />
    );
  }

  if (!project && mainProjectError) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <h2 className="text-base font-semibold">Main project could not load</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {mainProjectError}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void openAnotherProject().catch((error) => {
                    showError(error instanceof Error ? error.message : String(error));
                  });
                }}
                className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium"
              >
                Open another project
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-xs"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
        <StatusBar appVersion="0.9.8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {project && <Sidebar />}
        <main className="flex-1 flex flex-col overflow-hidden">
          <ProjectContent />
        </main>
        {project && (
          <LLMAssistantPanel
            isOpen={appState.isLLMPanelOpen}
            onClose={() => setLLMPanelOpen(false)}
          />
        )}
      </div>
      <StatusBar appVersion="0.9.8" />
      <ModalRoot />
    </div>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    document.title = "SkeletonKey";
  }, []);

  return <AppWithProviders />;
};

export default App;
