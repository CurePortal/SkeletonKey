/**
 * Hook to initialize and provide access to the Unified API
 * Place this in: src/hooks/useUnifiedAPI.tsx (note: .tsx extension)
 */

import React, {
  useEffect,
  useRef,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useProjectData } from "../contexts/ProjectDataContext";
import { useNotification } from "../contexts/NotificationContext";
import { useAppState } from "../contexts/AppStateContext";
import { api, terminal } from "../services/unifiedApiService";

export const useUnifiedAPI = () => {
  const projectDataContext = useProjectData();
  const notificationContext = useNotification();
  const appStateContext = useAppState();
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      // Initialize the API with contexts
      api.initialize(projectDataContext, {
        notification: notificationContext,
        appState: appStateContext,
      });
      // Make API available globally for terminal access
      if (typeof window !== "undefined") {
        (window as any).api = api;
        (window as any).terminal = terminal;

        // Log initialization to console
        console.log(
          "%c🚀 SkeletonKey API Initialized",
          "color: #4287f5; font-weight: bold;",
        );
        console.log(
          '%cType "terminal.help()" for available commands',
          "color: #888;",
        );
      }

      isInitialized.current = true;
    }
  }, [projectDataContext, notificationContext, appStateContext]);

  return { api, terminal };
};

/**
 * API Provider Component to wrap the app
 */

interface APIContextType {
  api: typeof api;
  terminal: typeof terminal;
}

const APIContext = createContext<APIContextType | undefined>(undefined);

export const APIProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { api: apiInstance, terminal: terminalInstance } = useUnifiedAPI();

  return (
    <APIContext.Provider
      value={{ api: apiInstance, terminal: terminalInstance }}
    >
      {children}
    </APIContext.Provider>
  );
};

export const useAPI = () => {
  const context = useContext(APIContext);
  if (!context) {
    throw new Error("useAPI must be used within APIProvider");
  }
  return context;
};
