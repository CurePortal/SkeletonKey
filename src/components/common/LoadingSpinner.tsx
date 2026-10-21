import React from "react";

interface LoadingSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  color?: "primary" | "secondary" | "white" | "gray" | "current";
  className?: string;
  fullScreen?: boolean;
  label?: string;
  showLabel?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  color = "primary",
  className = "",
  fullScreen = false,
  label = "Loading...",
  showLabel = false,
}) => {
  // Size classes
  const sizeMap = {
    xs: "h-3 w-3",
    sm: "h-5 w-5",
    md: "h-8 w-8",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  // Color classes
  const colorMap = {
    primary: "text-blue-600",
    secondary: "text-gray-600 dark:text-gray-300",
    white: "text-white",
    gray: "text-gray-400",
    current: "text-current",
  };

  // Full screen container
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 z-50">
        <div className="flex flex-col items-center justify-center">
          <svg
            className={`animate-spin ${sizeMap[size]} ${colorMap[color]} ${className}`}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            data-testid="loading-spinner"
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
          {label && showLabel && (
            <span className="mt-2 text-gray-700 dark:text-gray-300 font-medium">
              {label}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Inline spinner
  return (
    <div className={`flex items-center ${showLabel ? "space-x-2" : ""}`}>
      <svg
        className={`animate-spin ${sizeMap[size]} ${colorMap[color]} ${className}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        data-testid="loading-spinner"
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
      {label && showLabel && (
        <span className="text-gray-700 dark:text-gray-300 font-medium">
          {label}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;
