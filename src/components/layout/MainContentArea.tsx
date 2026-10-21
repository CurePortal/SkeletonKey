import React, { ReactNode } from "react";
import { useAppState } from "../../contexts/AppStateContext";

interface MainContentAreaProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  inlineActions?: ReactNode;
  showBackButton?: boolean;
  onBackClick?: () => void;
  noPadding?: boolean;
}

const MainContentArea: React.FC<MainContentAreaProps> = ({
  children,
  title,
  subtitle,
  actions,
  inlineActions,
  showBackButton = false,
  onBackClick,
  noPadding = false,
}) => {
  const { appState } = useAppState();

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Content Header */}
      {(title || actions) && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex flex-wrap items-center justify-between">
          <div className="flex items-center mb-2 md:mb-0">
            {showBackButton && (
              <button
                onClick={onBackClick}
                className="mr-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                aria-label="Go back"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <div>
              {title && (
                <h1 className="text-lg font-medium text-gray-900 dark:text-white">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
            {inlineActions && (
              <div className="ml-4 flex flex-wrap items-center gap-2">
                {inlineActions}
              </div>
            )}
          </div>
          {actions && (
            <div className="flex items-center space-x-2">{actions}</div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div
        className={`
          flex-1 overflow-auto
          ${!noPadding ? "px-4 py-4" : ""}
          ${!title && !actions && !noPadding ? "pt-4" : ""}
        `}
      >
        {children}
      </div>

      {/* Loading Indicator (if needed) */}
      {appState.loadingStates.length > 0 && (
        <div className="absolute bottom-4 right-4 rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 p-3 flex items-center">
          <svg
            className="animate-spin h-5 w-5 text-blue-600 mr-2"
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
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {appState.loadingStates.length === 1
              ? appState.loadingStates[0].operation.replace(/_/g, " ")
              : `${appState.loadingStates.length} operations in progress`}
            ...
          </span>
        </div>
      )}
    </div>
  );
};

export default MainContentArea;
