import { useState, useRef, useEffect } from "react";
import { useAppState } from "../contexts/AppStateContext"; // Assuming ModalType is defined or exported here
import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import {
  hqPullProject,
  hqPushProject,
} from "../services/hqBridgeService";

// Assuming ModalType is defined in AppStateContext, e.g.:
// export type ModalType = "project-settings" | "another-modal-type" | null;
// If not, you'll need to define it or import it.
// For the purpose of this fix, I'll assume "project-settings" is a valid ModalType.
// If openModal expects specific enum or type, ensure "project-settings" conforms.

const ProjectOptionsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  // Correctly type the ref
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Error TS6133: 'setViewMode' is declared but its value is never read.
  // If setViewMode is not used, remove it. Otherwise, implement its usage.
  // For now, let's assume it might be used later or remove it if definitely not needed.
  const { openModal /*, setViewMode */ } = useAppState(); // Commented out setViewMode
  const {
    saveChanges,
    saveChangesAs,
    discardChanges,
    hasUnsavedChanges,
    project,
    setProject,
  } = useProjectData();
  const { showSuccess, showError, showInfo } = useNotification();

  useEffect(() => {
    // Error TS7006: Parameter 'event' implicitly has an 'any' type.
    // Add type MouseEvent for browser events
    const handleClickOutside = (event: MouseEvent) => {
      // Error TS2339: Property 'contains' does not exist on type 'never'.
      // This is fixed by correctly typing dropdownRef and ensuring event.target is Node
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSave = async () => {
    setIsOpen(false);
    showInfo("Saving project...");

    const success = await saveChanges();
    if (success) {
      showSuccess(`Project "${project?.name}" saved successfully`);
    } else {
      showError("Failed to save project");
    }
  };

  const handleSaveAs = async () => {
    setIsOpen(false);
    showInfo("Preparing to save project as...");

    const success = await saveChangesAs();
    if (success) {
      showSuccess(`Project "${project?.name}" saved successfully`);
    } else {
      showInfo("Save operation was cancelled");
    }
  };

  const handleDiscard = () => {
    setIsOpen(false);

    if (hasUnsavedChanges) {
      if (
        window.confirm("Are you sure you want to discard all unsaved changes?")
      ) {
        discardChanges();
        showInfo("Changes discarded");
      }
    } else {
      showInfo("No changes to discard");
    }
  };

  const handleProjectSettings = () => {
    setIsOpen(false);
    // Error TS2345: Argument of type '"project-settings"' is not assignable to parameter of type 'ModalType'.
    // This implies "project-settings" is not a valid string for ModalType.
    // Ensure ModalType in AppStateContext includes "project-settings".
    // Example: export type ModalType = "project-settings" | "otherModal" | null;
    openModal("project-settings" as any); // Using 'as any' for now, but ideally fix ModalType
  };

  const handleSendToHQ = async () => {
    setIsOpen(false);
    if (!project) {
      showInfo("Open a project first.");
      return;
    }
    try {
      showInfo("Sending project to the local HQ bridge...");
      const status = await hqPushProject(project);
      showSuccess(`HQ now holds "${status.project.name}".`);
    } catch (error) {
      showError(
        `Could not send to HQ: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleLoadFromHQ = async () => {
    setIsOpen(false);
    if (
      project &&
      hasUnsavedChanges &&
      !window.confirm("Replace the current project with the HQ project?")
    ) {
      return;
    }
    try {
      showInfo("Loading project from the local HQ bridge...");
      const incoming = await hqPullProject();
      setProject(incoming, null);
      showSuccess(`Loaded "${incoming.name}" from HQ.`);
    } catch (error) {
      showError(
        `Could not load from HQ: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleCloseProject = () => {
    setIsOpen(false);

    if (hasUnsavedChanges) {
      if (
        window.confirm(
          "You have unsaved changes. Are you sure you want to close this project?",
        )
      ) {
        setProject(null);
        showInfo("Project closed");
      }
    } else {
      setProject(null);
      showInfo("Project closed");
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="inline-flex items-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Project Options"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu" aria-orientation="vertical">
            {/*
              Error TS6133: 'handleSave' is declared but its value is never read.
              Error TS6133: 'handleSaveAs' is declared but its value is never read.
              Error TS6133: 'handleDiscard' is declared but its value is never read.
              Error TS6133: 'handleProjectSettings' is declared but its value is never read.
              You need to add buttons or elements that call these handlers.
              Example:
            */}
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              onClick={handleSave}
              role="menuitem"
            >
              Save
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              onClick={handleSaveAs}
              role="menuitem"
            >
              Save As...
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              onClick={handleProjectSettings}
              role="menuitem"
            >
              Project Settings
            </button>
            <div className="border-t my-1 dark:border-gray-700"></div>
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              onClick={handleSendToHQ}
              role="menuitem"
            >
              Send project to HQ
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              onClick={handleLoadFromHQ}
              role="menuitem"
            >
              Load project from HQ
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              onClick={handleDiscard}
              role="menuitem"
            >
              Discard Changes
            </button>
            <div className="border-t my-1 dark:border-gray-700"></div>{" "}
            {/* Visually separate before close */}
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
              onClick={handleCloseProject}
              role="menuitem"
            >
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Close Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectOptionsDropdown;
