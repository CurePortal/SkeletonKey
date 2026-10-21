// src/contexts/TauriContext.tsx

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface TauriContextType {
  isTauri: boolean;
  isReady: boolean;
  appVersion?: string;
  platform?: string;
  arch?: string;
  osVersion?: string;
  locale?: string;
  theme?: "light" | "dark";
  tauriVersion?: string;
  appName?: string;
  error?: string;
}

// Define a more specific type for window.__TAURI__ if known, or use 'any'
interface TauriGlobal {
  convertFileSrc: (src: string, protocol?: string) => string; // protocol is optional in some versions
  app?: {
    getVersion: () => Promise<string>;
    getName: () => Promise<string>;
    getTauriVersion: () => Promise<string>;
  };
  os?: {
    platform: () => Promise<string>;
    arch: () => Promise<string>;
    version: () => Promise<string>;
    locale: () => Promise<string | null>; // Adjusted for potential null
  };
  theme?: {
    getCurrent: () => Promise<"light" | "dark">;
  };
  // Add other Tauri modules if needed, e.g., window, shell, event, etc.
}

// Simple, reliable detection - ONLY consider it Tauri if IPC is available
const detectTauriSimple = (): boolean => {
  if (typeof window === "undefined") return false;

  // The ONLY reliable way to know we're in Tauri is if IPC is available
  // Without IPC, we can't communicate with the backend, so we're not really in Tauri
  const hasIPC = typeof (window as any).__TAURI_IPC__ === "function";

  if (hasIPC) {
    console.log("[TauriDetection] IPC bridge found - running in Tauri");
    return true;
  }

  console.log("[TauriDetection] No IPC bridge - running in browser");
  return false;
};

const TauriContext = createContext<TauriContextType>({
  isTauri: false,
  isReady: false,
});

interface TauriProviderProps {
  children: ReactNode;
}

export const TauriProvider: React.FC<TauriProviderProps> = ({ children }) => {
  // Get immediate detection result
  const initialIsTauri = detectTauriSimple();

  const [tauriInfo, setTauriInfo] = useState<TauriContextType>({
    isTauri: initialIsTauri,
    isReady: false,
  });

  useEffect(() => {
    console.log(`[TauriProvider] Initial detection: ${initialIsTauri}`);
    console.log(`[TauriProvider] Location: ${window.location.href}`);

    const finalizeDetection = async () => {
      try {
        const info: TauriContextType = {
          isTauri: initialIsTauri,
          isReady: true,
        };

        // If we think it's Tauri and globals exist, try to get details
        const tauriGlobal = (window as any).__TAURI__ as
          | TauriGlobal
          | undefined; // TS2339 Fix for __TAURI__

        if (initialIsTauri && tauriGlobal) {
          try {
            if (tauriGlobal.app) {
              // TS2339 Fix
              info.appVersion = await tauriGlobal.app
                .getVersion() // TS2339 Fix
                .catch(() => undefined);
              info.appName = await tauriGlobal.app
                .getName() // TS2339 Fix
                .catch(() => undefined);
              info.tauriVersion = await tauriGlobal.app
                .getTauriVersion() // TS2339 Fix
                .catch(() => undefined);
            }

            if (tauriGlobal.os) {
              // TS2339 Fix
              info.platform = await tauriGlobal.os
                .platform() // TS2339 Fix
                .catch(() => undefined);
              info.arch = await tauriGlobal.os
                .arch() // TS2339 Fix
                .catch(() => undefined);
              info.osVersion = await tauriGlobal.os
                .version() // TS2339 Fix
                .catch(() => undefined);
              const localeResult = await tauriGlobal.os
                .locale()
                .catch(() => null); // TS2339 Fix
              info.locale = localeResult === null ? undefined : localeResult; // Handle null from locale
            }

            if (tauriGlobal.theme) {
              // TS2339 Fix
              info.theme = await tauriGlobal.theme
                .getCurrent() // TS2339 Fix
                .catch(() => undefined);
            }
          } catch (error) {
            console.warn("[TauriProvider] Error getting Tauri details:", error);
          }
        }

        console.log("[TauriProvider] Final info:", info);
        setTauriInfo(info);
      } catch (error) {
        console.error("[TauriProvider] Error during finalization:", error);
        setTauriInfo({
          isTauri: initialIsTauri,
          isReady: true,
          error: error instanceof Error ? error.message : "Detection failed",
        });
      }
    };

    // Small delay to let any globals load, then finalize
    const timer = setTimeout(finalizeDetection, 100);
    return () => clearTimeout(timer);
  }, [initialIsTauri]);

  return (
    <TauriContext.Provider value={tauriInfo}>{children}</TauriContext.Provider>
  );
};

export const useTauri = () => {
  const context = useContext(TauriContext);
  if (context === undefined) {
    throw new Error("useTauri must be used within a TauriProvider");
  }
  return context;
};

export default TauriContext;
