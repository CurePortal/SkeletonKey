// src/components/layout/Navbar.tsx
import React, {
  useState,
  useRef,
  ChangeEvent,
  useEffect,
  KeyboardEvent,
  MouseEvent,
} from "react";
import Button from "../common/Button";
import { useAppState } from "../../contexts/AppStateContext";
import { useProjectData } from "../../contexts/ProjectDataContext"; // Ensure this is the corrected context
import { useUITheme } from "../../contexts/UIThemeContext";
import { useNotification } from "../../contexts/NotificationContext";
import { exportProjectAsAHP } from "../../services/projectService";
import { openAnotherProject } from "../../services/mainProjectService";
import { ProjectType } from "../../types/project";
import {
  FiSearch,
  FiX,
  FiMoreVertical,
  FiRotateCcw, // Icon for Undo
  FiRotateCw, // Icon for Redo
} from "react-icons/fi";

const Navbar: React.FC = () => {
  const {
    appState,
    toggleLLMPanel,
    toggleSidebar,
    openModal,
    setViewMode,
    setSearchQuery: setGlobalSearchQuery,
  } = useAppState();
  const { isLLMPanelOpen, searchQuery: globalSearchQuery, viewMode } = appState;

  // --- MODIFIED: Destructure undo/redo and related flags ---
  const { project, setProject, undo, redo, canUndo, canRedo } =
    useProjectData();
  // --- END MODIFICATION ---

  const { setTheme, isDarkMode } = useUITheme();
  const { showSuccess, showError, showInfo } = useNotification();

  const [isOpeningFile, setIsOpeningFile] = useState(false);
  const fileInputRefNavbar = useRef<HTMLInputElement>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false); // Add export loading state
  const projectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (globalSearchQuery !== localSearchTerm) {
      setLocalSearchTerm(globalSearchQuery || "");
    }
  }, [globalSearchQuery, localSearchTerm]); // Added localSearchTerm dependency

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (
        projectMenuRef.current &&
        !projectMenuRef.current.contains(event.target as Node)
      ) {
        setIsProjectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [projectMenuRef]);

  const readProjectFileNavbar = async (file: File): Promise<ProjectType> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          if (event.target && typeof event.target.result === "string") {
            const fileContent: string = event.target.result;
            const projectData = JSON.parse(fileContent) as ProjectType;
            if (
              !projectData ||
              !projectData.id ||
              !projectData.name ||
              !Array.isArray(projectData.timelines)
            ) {
              reject(
                new Error(
                  "Invalid project file format. Essential fields are missing.",
                ),
              );
              return;
            }
            resolve(projectData);
          } else {
            reject(
              new Error("File content is invalid or event target is missing."),
            );
          }
        } catch (err) {
          if (err instanceof Error)
            reject(new Error(`Failed to parse project file: ${err.message}`));
          else
            reject(
              new Error(
                "Failed to parse project file: An unknown error occurred.",
              ),
            );
        }
      };
      reader.onerror = () => reject(new Error("Error reading file."));
      reader.readAsText(file);
    });
  };

  const handleFileChangeNavbar = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    if (!event.target?.files?.length) return;
    const file = event.target.files[0];
    setIsOpeningFile(true);
    try {
      const projectData = await readProjectFileNavbar(file);
      setProject(projectData, undefined); // Pass undefined for filePath if not applicable here
      setViewMode("dashboard");
      showSuccess(`Project "${projectData.name}" loaded successfully`);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An unknown error occurred while loading the project.";
      showError(`Failed to load project: ${errorMessage}`);
    } finally {
      setIsOpeningFile(false);
      if (fileInputRefNavbar.current) fileInputRefNavbar.current.value = "";
    }
  };

  const triggerFileSelectNavbar = () => fileInputRefNavbar.current?.click();
  const toggleTheme = () => setTheme(isDarkMode ? "light" : "dark");

  const handleExportAHP = async () => {
    if (!project) {
      showError("No project to export");
      return;
    }

    setIsExporting(true);
    showInfo("Preparing to export project...");

    try {
      const result = await exportProjectAsAHP(project);
      if (result) {
        showSuccess(
          `Project "${project.name}" exported successfully as ${result}`,
          { title: "Export Successful", duration: 5000 },
        );
      } else {
        showInfo("Export was cancelled or no file selected for saving.");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      showError(`Failed to export project: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogoClick = () => setViewMode("dashboard");

  const handleLLMPanelClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    toggleLLMPanel();
  };

  const aiAssistantButtonClasses = isLLMPanelOpen ? "" : "";
  const aiAssistantButtonVariant = isLLMPanelOpen ? undefined : "outline";

  const handleSearchInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newQuery = event.target.value;
    setLocalSearchTerm(newQuery);

    if (!project) {
      if (newQuery.trim()) {
        showInfo("Please open or create a project to search.");
      }
      if (!newQuery.trim() && globalSearchQuery !== "") {
        setGlobalSearchQuery("");
      }
      return;
    }

    setGlobalSearchQuery(newQuery);

    if (newQuery.trim()) {
      if (viewMode !== "search-results") {
        setViewMode("search-results");
      }
    } else {
      if (viewMode === "search-results") {
        setViewMode("dashboard");
      }
    }
  };

  const clearSearchInputAndState = () => {
    setLocalSearchTerm("");
    setGlobalSearchQuery("");
    if (viewMode === "search-results") {
      setViewMode("dashboard");
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (project && localSearchTerm.trim()) {
        setGlobalSearchQuery(localSearchTerm.trim());
        if (viewMode !== "search-results") {
          setViewMode("search-results");
        }
      } else if (!project && localSearchTerm.trim()) {
        showInfo("Please open or create a project to search.");
      }
    }
  };

  const handleOpenAnotherProject = async () => {
    setIsProjectMenuOpen(false);
    try {
      await openAnotherProject();
    } catch (error) {
      showError(
        `Could not open that project: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleNewMainProject = () => {
    setIsProjectMenuOpen(false);
    openModal("new-project");
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRefNavbar}
        accept=".ark,.ahp,.json"
        onChange={handleFileChangeNavbar}
        className="hidden"
        aria-hidden="true"
      />
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 h-12 px-2 sm:px-3 flex items-center justify-between print:hidden">
        {/* Left side: Sidebar Toggle + Logo */}
        <div className="flex items-center space-x-1 md:space-x-2">
          <button
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none rounded-md" // Added rounded-md
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <button
            onClick={handleLogoClick}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity p-1.5 rounded-md" // Added padding and rounded-md
            aria-label="Go to projects panel"
          >
            <img
              src="/logo.svg"
              alt="SkeletonKey Tool Logo"
              className="h-7 w-7"
            />
            <span className="text-base font-semibold text-gray-900 dark:text-white hidden md:inline">
              SkeletonKey
            </span>
          </button>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-grow max-w-md lg:max-w-xl mx-2 sm:mx-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="search"
              name="project-search"
              id="project-search"
              className="block w-full pl-10 pr-10 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder={
                project ? "Search project..." : "Open project to search"
              }
              value={localSearchTerm}
              onChange={handleSearchInputChange}
              onKeyDown={handleSearchKeyDown}
            />
            {localSearchTerm && (
              <button
                onClick={clearSearchInputAndState}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Clear search"
              >
                <FiX className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* --- UNDO/REDO BUTTONS - CHANGED TO <button> --- */}
          {project && (
            <>
              <button
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiRotateCcw className="h-5 w-5" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiRotateCw className="h-5 w-5" />
              </button>
            </>
          )}
          {/* --- END UNDO/REDO BUTTONS --- */}

          {project && (
            <Button
              variant={aiAssistantButtonVariant}
              className={aiAssistantButtonClasses}
              size="sm"
              onClick={handleLLMPanelClick}
              leftIcon={
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
              }
            >
              <span className="hidden sm:inline">AI Assistant</span>
            </Button>
          )}
          {project && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAHP}
                disabled={isExporting}
                leftIcon={
                  isExporting ? (
                    <svg
                      className="h-4 w-4 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                      />
                    </svg>
                  )
                }
              >
                <span className="hidden sm:inline">
                  {isExporting ? "Exporting..." : "Export"}
                </span>
              </Button>
            </>
          )}
          {!project && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleOpenAnotherProject()}
                disabled={isOpeningFile}
                leftIcon={
                  isOpeningFile ? (
                    <svg
                      className="h-4 w-4 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  )
                }
              >
                <span className="hidden sm:inline">
                  {isOpeningFile ? "Loading..." : "Open"}
                </span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => openModal("new-project")}
                leftIcon={
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                }
              >
                <span className="hidden sm:inline">New</span>
              </Button>
            </>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
            aria-label={
              isDarkMode ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {isDarkMode ? (
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
          {project && (
            <div className="relative" ref={projectMenuRef}>
              <button
                onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)}
                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                aria-label="Project options"
                aria-haspopup="true"
                aria-expanded={isProjectMenuOpen}
              >
                <FiMoreVertical className="h-5 w-5" />
              </button>
              {isProjectMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 z-50">
                  <button
                    onClick={handleNewMainProject}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    role="menuitem"
                  >
                    New main project
                  </button>
                  <button
                    onClick={() => void handleOpenAnotherProject()}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    role="menuitem"
                  >
                    Open another project
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
