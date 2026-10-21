// src/hooks/useTauri.ts
import { useState, useEffect } from "react";

interface TauriInfo {
  isTauri: boolean;
  isReady: boolean;
  isDesktop: boolean;
  isWeb: boolean;
  platformName: string;
  runtimeDescription: string;
  appVersion?: string;
  platform?: string;
  arch?: string;
  osVersion?: string;
  locale?: string;
  theme?: "light" | "dark" | string;
  tauriVersion?: string;
  appName?: string;
  error?: string;
}

export const useTauriHook = (): TauriInfo => {
  const [tauriInfo, setTauriInfo] = useState<TauriInfo>({
    isTauri: false,
    isReady: false,
    isDesktop: false,
    isWeb: true,
    platformName: "web",
    runtimeDescription: "Web Browser",
  });

  useEffect(() => {
    const detectEnvironment = async () => {
      try {
        // Wait for Tauri to potentially initialize
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds total

        const waitForTauri = async (): Promise<boolean> => {
          attempts++;

          // Check if we're in a Tauri context (URL-based check)
          const isTauriUrl =
            window.location.hostname === "tauri.localhost" ||
            window.location.hostname === "localhost";

          if (!isTauriUrl) {
            console.log("[useTauriHook] Not a Tauri URL, treating as web");
            return false;
          }

          // For Tauri v2, check for the IPC object
          const hasIPC =
            typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

          console.log(`[useTauriHook] Attempt ${attempts}/${maxAttempts}:`, {
            hasIPC,
            internalsType: typeof (window as any).__TAURI_INTERNALS__,
          });

          if (hasIPC) {
            console.log("[useTauriHook] Tauri v2 IPC bridge ready!");
            return true;
          }

          if (attempts < maxAttempts) {
            // Wait 100ms and try again
            await new Promise((resolve) => setTimeout(resolve, 100));
            return waitForTauri();
          }

          console.warn(
            "[useTauriHook] Tauri IPC bridge not found after 5 seconds",
          );
          return false;
        };

        const isTauri = await waitForTauri();

        const baseInfo: TauriInfo = {
          isTauri,
          isDesktop: isTauri,
          isWeb: !isTauri,
          platformName: isTauri ? "desktop" : "web",
          runtimeDescription: isTauri ? "Tauri Desktop App" : "Web Browser",
          isReady: true,
        };

        if (!isTauri) {
          console.log("[useTauriHook] Running in web mode");
          setTauriInfo(baseInfo);
          return;
        }

        console.log(
          "[useTauriHook] Tauri v2 environment detected, gathering app info...",
        );

        // Now we know Tauri is available, gather additional info
        try {
          const info: TauriInfo = { ...baseInfo };

          // Import Tauri v2 APIs
          const { getVersion, getName, getTauriVersion } = await import(
            "@tauri-apps/api/app"
          );

          // Get app information
          try {
            const [appVersion, appName, tauriVersion] = await Promise.all([
              getVersion(),
              getName(),
              getTauriVersion(),
            ]);

            info.appVersion = appVersion;
            info.appName = appName;
            info.tauriVersion = tauriVersion;

            console.log("[useTauriHook] App info:", {
              appVersion,
              appName,
              tauriVersion,
            });
          } catch (e) {
            console.error("[useTauriHook] Failed to get app info:", e);
          }

          info.platform = navigator.platform || "linux";
          info.arch = "";
          info.osVersion = "";

          console.log("[useTauriHook] Final Tauri info:", info);
          setTauriInfo(info);
        } catch (error) {
          console.error("[useTauriHook] Error gathering Tauri info:", error);
          setTauriInfo({
            ...baseInfo,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      } catch (error) {
        console.error(
          "[useTauriHook] Error during environment detection:",
          error,
        );
        setTauriInfo({
          isTauri: false,
          isReady: true,
          isDesktop: false,
          isWeb: true,
          platformName: "web",
          runtimeDescription: "Web Browser (Error)",
          error: error instanceof Error ? error.message : "Detection failed",
        });
      }
    };

    detectEnvironment();
  }, []);

  return tauriInfo;
};
