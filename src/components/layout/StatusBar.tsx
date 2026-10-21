import React, { useState } from "react";
import { useProjectData } from "../../contexts/ProjectDataContext";
import { useAppState } from "../../contexts/AppStateContext";
import useDebouncedSave from "../../hooks/useDebouncedSave";

interface StatusBarProps {
  appVersion?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ appVersion = "1.0.0" }) => {
  const { project, hasUnsavedChanges } = useProjectData();
  const { appState } = useAppState();
  const { isPendingSave } = useDebouncedSave();

  // Format a date string
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (error) {
      return dateString;
    }
  };

  return (
    <>
      <div className="h-6 px-3 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-xs flex items-center justify-between relative">
        {/* Left section: Project status */}
        <div className="flex items-center space-x-4">
          {project ? (
            <>
              <span className="text-gray-600 dark:text-gray-400">
                {isPendingSave ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-3 w-3 text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving...
                  </span>
                ) : hasUnsavedChanges ? (
                  <span className="flex items-center text-amber-600 dark:text-amber-400">
                    <svg
                      className="mr-1 h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Unsaved changes
                  </span>
                ) : (
                  <span className="flex items-center text-green-600 dark:text-green-400">
                    <svg
                      className="mr-1 h-3 w-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Saved
                  </span>
                )}
              </span>

              <span className="text-gray-500 dark:text-gray-500 hidden sm:inline">
                Last modified: {formatDate(project.updatedAt)}
              </span>

            </>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              No project open
            </span>
          )}
        </div>

        {/* Right section: Application status */}
        <div className="flex items-center space-x-4">
          {/* Loading states count */}
          {appState.loadingStates.length > 0 && (
            <span className="text-blue-600 dark:text-blue-400 flex items-center">
              <svg
                className="animate-spin -ml-1 mr-1 h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {appState.loadingStates.length}{" "}
              {appState.loadingStates.length === 1 ? "operation" : "operations"}
            </span>
          )}

          {/* App version */}
          <span className="text-gray-500 dark:text-gray-500 hidden md:inline">
            RC v{appVersion}
          </span>
        </div>
      </div>
    </>
  );
};

export default StatusBar;
