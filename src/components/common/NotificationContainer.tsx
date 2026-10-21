import { useNotification } from "../../contexts/NotificationContext";
import { NotificationType } from "../../types";

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  // Get icon based on notification type
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case "success":
        return (
          <svg
            className="h-6 w-6 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "error":
        return (
          <svg
            className="h-6 w-6 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "warning":
        return (
          <svg
            className="h-6 w-6 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case "info":
      default:
        return (
          <svg
            className="h-6 w-6 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  // Get background color based on notification type
  const getBackgroundColor = (type: NotificationType) => {
    switch (type) {
      case "success":
        return "bg-green-50 dark:bg-green-900 dark:bg-opacity-20";
      case "error":
        return "bg-red-50 dark:bg-red-900 dark:bg-opacity-20";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20";
      case "info":
      default:
        return "bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20";
    }
  };

  // Get border color based on notification type
  const getBorderColor = (type: NotificationType) => {
    switch (type) {
      case "success":
        return "border-green-400 dark:border-green-600";
      case "error":
        return "border-red-400 dark:border-red-600";
      case "warning":
        return "border-yellow-400 dark:border-yellow-600";
      case "info":
      default:
        return "border-blue-400 dark:border-blue-600";
    }
  };

  // Get text color based on notification type
  const getTextColor = (type: NotificationType) => {
    switch (type) {
      case "success":
        return "text-green-800 dark:text-green-200";
      case "error":
        return "text-red-800 dark:text-red-200";
      case "warning":
        return "text-yellow-800 dark:text-yellow-200";
      case "info":
      default:
        return "text-blue-800 dark:text-blue-200";
    }
  };

  return (
    <div
      className="fixed bottom-4 right-4 flex flex-col space-y-2 z-notification pointer-events-none"
      style={{ maxWidth: "90vw", width: "400px" }}
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`
            rounded-lg border shadow-md p-4 flex items-start pointer-events-auto
            animate-fade-in
            ${getBackgroundColor(notification.type)}
            ${getBorderColor(notification.type)}
          `}
        >
          <div className="flex-shrink-0 mr-3">{getIcon(notification.type)}</div>

          <div className="flex-1">
            {notification.title && (
              <h4 className={`font-medium ${getTextColor(notification.type)}`}>
                {notification.title}
              </h4>
            )}
            <p className={`text-sm mt-1 ${getTextColor(notification.type)}`}>
              {notification.message}
            </p>
          </div>

          {notification.dismissible !== false && (
            <button
              onClick={() => removeNotification(notification.id)}
              className="flex-shrink-0 ml-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 focus:outline-none"
              aria-label="Close"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;
