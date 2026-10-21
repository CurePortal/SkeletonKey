import React from "react";
import Button from "./Button";

interface ErrorDisplayProps {
  title?: string;
  message: string;
  details?: string;
  suggestion?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  variant?: "inline" | "card" | "banner" | "fullPage";
  showIcon?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  title = "Error",
  message,
  details,
  suggestion,
  onRetry,
  onDismiss,
  className = "",
  variant = "inline",
  showIcon = true,
}) => {
  // Icon component
  const ErrorIcon = () => (
    <svg
      className={`
        ${variant === "inline" ? "h-5 w-5" : "h-6 w-6"}
        text-red-500
      `}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
  );

  // Render different variants
  switch (variant) {
    case "fullPage":
      return (
        <div
          className={`flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 px-4 ${className}`}
        >
          <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 text-center">
            <div className="mb-4 flex justify-center">
              {showIcon && <ErrorIcon />}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {title}
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mb-4">{message}</p>
            {details && (
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md text-sm text-gray-800 dark:text-gray-200 mb-4 text-left overflow-auto max-h-40">
                {details}
              </div>
            )}
            {suggestion && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {suggestion}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              {onRetry && (
                <Button onClick={onRetry} variant="primary">
                  Try Again
                </Button>
              )}
              {onDismiss && (
                <Button
                  onClick={onDismiss}
                  variant={onRetry ? "outline" : "primary"}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
      );

    case "card":
      return (
        <div
          className={`bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900 rounded-lg shadow-sm p-4 ${className}`}
        >
          <div className="flex items-start">
            {showIcon && (
              <div className="flex-shrink-0 mr-3">
                <ErrorIcon />
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                {title}
              </h3>
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                <p>{message}</p>
              </div>
              {details && (
                <div className="mt-2 text-xs bg-red-50 dark:bg-gray-700 p-2 rounded text-red-700 dark:text-red-300 overflow-auto max-h-32">
                  {details}
                </div>
              )}
              {suggestion && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {suggestion}
                </p>
              )}
              {(onRetry || onDismiss) && (
                <div className="mt-3 flex gap-2">
                  {onRetry && (
                    <Button onClick={onRetry} variant="primary" size="sm">
                      Try Again
                    </Button>
                  )}
                  {onDismiss && (
                    <Button onClick={onDismiss} variant="outline" size="sm">
                      Dismiss
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );

    case "banner":
      return (
        <div
          className={`bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border-l-4 border-red-500 p-4 ${className}`}
        >
          <div className="flex items-start">
            {showIcon && (
              <div className="flex-shrink-0 mr-3">
                <ErrorIcon />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-400">
                {title}
              </p>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                {message}
              </p>
              {details && (
                <div className="mt-2 text-xs bg-red-100 dark:bg-gray-800 p-2 rounded text-red-800 dark:text-red-300 overflow-auto max-h-32">
                  {details}
                </div>
              )}
              {suggestion && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-200">
                  {suggestion}
                </p>
              )}
              {(onRetry || onDismiss) && (
                <div className="mt-3 flex gap-2">
                  {onRetry && (
                    <Button onClick={onRetry} variant="primary" size="sm">
                      Try Again
                    </Button>
                  )}
                  {onDismiss && (
                    <Button onClick={onDismiss} variant="outline" size="sm">
                      Dismiss
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );

    case "inline":
    default:
      return (
        <div className={`text-red-600 dark:text-red-400 ${className}`}>
          <div className="flex items-center">
            {showIcon && <ErrorIcon />}
            <span className="ml-2 text-sm font-medium">{message}</span>
          </div>
          {details && (
            <div className="mt-1 text-xs bg-red-50 dark:bg-red-900 dark:bg-opacity-20 p-2 rounded overflow-auto max-h-20">
              {details}
            </div>
          )}
          {suggestion && (
            <p className="mt-1 text-xs text-red-500 dark:text-red-300">
              {suggestion}
            </p>
          )}
          {(onRetry || onDismiss) && (
            <div className="mt-2 flex gap-2">
              {onRetry && (
                <Button onClick={onRetry} variant="primary" size="sm">
                  Try Again
                </Button>
              )}
              {onDismiss && (
                <Button onClick={onDismiss} variant="outline" size="sm">
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </div>
      );
  }
};

export default ErrorDisplay;
