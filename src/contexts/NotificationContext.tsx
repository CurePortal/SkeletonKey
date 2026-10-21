import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { NotificationMessage, NotificationType } from "../types";

interface NotificationContextType {
  // Notification management
  notifications: NotificationMessage[];
  addNotification: (
    message: string,
    type: NotificationType,
    options?: {
      title?: string;
      duration?: number;
      dismissible?: boolean;
    },
  ) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;

  // Shorthand methods for different notification types
  showSuccess: (
    message: string,
    options?: { title?: string; duration?: number },
  ) => void;
  showError: (
    message: string,
    options?: { title?: string; duration?: number },
  ) => void;
  showInfo: (
    message: string,
    options?: { title?: string; duration?: number },
  ) => void;
  showWarning: (
    message: string,
    options?: { title?: string; duration?: number },
  ) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

interface NotificationProviderProps {
  children: ReactNode;
  maxNotifications?: number;
  defaultDuration?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  maxNotifications = 5,
  defaultDuration = 5000, // 5 seconds
}) => {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);

  // Remove notifications that have expired
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    notifications.forEach((notification) => {
      if (notification.duration !== undefined && notification.duration > 0) {
        const timer = setTimeout(() => {
          removeNotification(notification.id);
        }, notification.duration);

        timers.push(timer);
      }
    });

    // Clean up timers
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [notifications]);

  // Add a new notification
  const addNotification = (
    message: string,
    type: NotificationType,
    options?: {
      title?: string;
      duration?: number;
      dismissible?: boolean;
    },
  ) => {
    const newNotification: NotificationMessage = {
      id: `notification-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      message,
      type,
      title: options?.title,
      duration: options?.duration ?? defaultDuration,
      dismissible: options?.dismissible ?? true,
    };

    setNotifications((prev) => {
      // Remove oldest notifications if we're over the limit
      const updatedNotifications = [...prev, newNotification];
      if (updatedNotifications.length > maxNotifications) {
        return updatedNotifications.slice(-maxNotifications);
      }
      return updatedNotifications;
    });

    return newNotification.id;
  };

  // Remove a notification by ID
  const removeNotification = (id: string) => {
    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id),
    );
  };

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Shorthand methods for different notification types
  const showSuccess = (
    message: string,
    options?: { title?: string; duration?: number },
  ) => {
    return addNotification(message, "success", options);
  };

  const showError = (
    message: string,
    options?: { title?: string; duration?: number },
  ) => {
    return addNotification(message, "error", options);
  };

  const showInfo = (
    message: string,
    options?: { title?: string; duration?: number },
  ) => {
    return addNotification(message, "info", options);
  };

  const showWarning = (
    message: string,
    options?: { title?: string; duration?: number },
  ) => {
    return addNotification(message, "warning", options);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        clearAllNotifications,
        showSuccess,
        showError,
        showInfo,
        showWarning,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use the NotificationContext
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error(
      "useNotification must be used within a NotificationProvider",
    );
  }
  return context;
};

export default NotificationContext;
