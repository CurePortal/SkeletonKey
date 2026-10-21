import React from "react";
import Button from "./Button";

type MessageType = "info" | "success" | "warning" | "error" | "neutral";

interface MessageBoxProps {
  type?: MessageType;
  title?: string;
  message: string | React.ReactNode;
  actions?: {
    label: string;
    onClick: () => void;
    variant?:
      | "primary"
      | "secondary"
      | "outline"
      | "danger"
      | "success"
      | "text";
  }[];
  onClose?: () => void;
  className?: string;
  showIcon?: boolean;
  isDismissible?: boolean;
}

const MessageBox: React.FC<MessageBoxProps> = ({
  type = "info",
  title,
  message,
  actions,
  onClose,
  className = "",
  showIcon = true,
  isDismissible = true,
}) => {
  // Configuration based on message type
  const typeConfig: Record<
    MessageType,
    {
      containerClass: string;
      iconClass: string;
      titleClass: string;
      icon: React.ReactNode;
    }
  > = {
    info: {
      containerClass:
        "bg-blue-50 border-blue-500 dark:bg-blue-900 dark:bg-opacity-20 dark:border-blue-600",
      iconClass: "text-blue-500 dark:text-blue-400",
      titleClass: "text-blue-800 dark:text-blue-300",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    success: {
      containerClass:
        "bg-green-50 border-green-500 dark:bg-green-900 dark:bg-opacity-20 dark:border-green-600",
      iconClass: "text-green-500 dark:text-green-400",
      titleClass: "text-green-800 dark:text-green-300",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    warning: {
      containerClass:
        "bg-yellow-50 border-yellow-500 dark:bg-yellow-900 dark:bg-opacity-20 dark:border-yellow-600",
      iconClass: "text-yellow-500 dark:text-yellow-400",
      titleClass: "text-yellow-800 dark:text-yellow-300",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    error: {
      containerClass:
        "bg-red-50 border-red-500 dark:bg-red-900 dark:bg-opacity-20 dark:border-red-600",
      iconClass: "text-red-500 dark:text-red-400",
      titleClass: "text-red-800 dark:text-red-300",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    neutral: {
      containerClass:
        "bg-gray-50 border-gray-300 dark:bg-gray-800 dark:border-gray-700",
      iconClass: "text-gray-500 dark:text-gray-400",
      titleClass: "text-gray-800 dark:text-gray-200",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  };

  const config = typeConfig[type];

  return (
    <div
      className={`border-l-4 p-4 rounded-r-md ${config.containerClass} ${className}`}
    >
      <div className="flex items-start">
        {showIcon && (
          <div className={`flex-shrink-0 mr-3 ${config.iconClass}`}>
            {config.icon}
          </div>
        )}

        <div className="flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${config.titleClass}`}>
              {title}
            </h3>
          )}

          <div
            className={`mt-1 text-sm ${title ? "text-gray-700 dark:text-gray-300" : config.titleClass}`}
          >
            {message}
          </div>

          {actions && actions.length > 0 && (
            <div className="mt-3 flex space-x-2">
              {actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || "primary"}
                  size="sm"
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {isDismissible && onClose && (
          <div className="flex-shrink-0 ml-3">
            <button
              type="button"
              className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${config.iconClass}`}
              onClick={onClose}
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBox;
