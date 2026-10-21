import React, { useState, useEffect, useCallback } from "react";
import { useAppState } from "../../contexts/AppStateContext";
import { useProjectData } from "../../contexts/ProjectDataContext";
// Corrected import: useTauriHook is imported and can be aliased to useTauri if preferred
import { useTauriHook as useTauri } from "../../hooks/useTauri"; // Or change usage below to useTauriHook

interface EnvironmentDebugProps {
  showInProduction?: boolean;
  onClose?: () => void;
}

interface SystemInfo {
  userAgent: string;
  platform: string;
  language: string;
  cookieEnabled: boolean;
  onLine: boolean;
  hardwareConcurrency: number;
  memory?: PerformanceMemory; // More specific type
  connection?: NetworkInformation; // More specific type
}

// Define more specific types if known, for now 'any' is kept from original for brevity
interface PerformanceMetrics {
  memoryUsage?: PerformanceMemory;
  timing?: PerformanceTiming;
  navigation?: PerformanceNavigation; // More specific type for performance.navigation
}

// For performance.memory (subset used)
interface PerformanceMemory {
  jsHeapSizeLimit: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
}

// For navigator.connection (subset used)
interface NetworkInformation extends EventTarget {
  readonly effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  readonly downlink?: number;
  readonly rtt?: number;
  // Add other properties if needed
}

// For performance.navigation (subset used)
interface PerformanceNavigation {
  readonly type: number;
  readonly redirectCount: number;
  // Add other properties if needed
}

const EnvironmentDebug: React.FC<EnvironmentDebugProps> = ({
  showInProduction = false,
  onClose,
}) => {
  // Only show in development unless explicitly allowed
  if (import.meta.env.PROD && !showInProduction) {
    return null;
  }

  const [activeTab, setActiveTab] = useState("environment");
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [performanceMetrics, setPerformanceMetrics] =
    useState<PerformanceMetrics>({});
  const [networkLogs, setNetworkLogs] = useState<any[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<any[]>([]);
  const [storageInfo, setStorageInfo] = useState<any>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Get app context data
  const { appState } = useAppState();
  const { project, hasUnsavedChanges } = useProjectData();
  const tauriInfo = useTauri(); // This will now correctly use useTauriHook

  // Environment variables with better categorization
  const envVars = {
    // Built-in Vite variables
    MODE: import.meta.env.MODE,
    PROD: import.meta.env.PROD,
    DEV: import.meta.env.DEV,
    BASE_URL: import.meta.env.BASE_URL,
    SSR: import.meta.env.SSR,
  };

  const allEnvKeys = Object.keys(import.meta.env);
  const viteEnvKeys = allEnvKeys.filter((key) => key.startsWith("VITE_"));

  // Collect system information
  useEffect(() => {
    const info: SystemInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
    };

    // Add memory info if available
    if ("memory" in performance) {
      info.memory = (
        performance as Performance & { memory: PerformanceMemory }
      ).memory;
    }

    // Add connection info if available
    if ("connection" in navigator) {
      info.connection = (
        navigator as Navigator & { connection: NetworkInformation }
      ).connection;
    }

    setSystemInfo(info);

    // Get performance metrics
    if ("performance" in window) {
      setPerformanceMetrics({
        memoryUsage: (
          performance as Performance & { memory: PerformanceMemory }
        ).memory,
        timing: performance.timing,
        navigation: (
          performance as Performance & { navigation: PerformanceNavigation }
        ).navigation,
      });
    }

    // Get storage information
    const getStorageInfo = () => {
      const storage: any = {
        localStorage: {
          available: typeof Storage !== "undefined",
          length: localStorage.length,
          keys: Object.keys(localStorage),
        },
        sessionStorage: {
          available: typeof Storage !== "undefined",
          length: sessionStorage.length,
          keys: Object.keys(sessionStorage),
        },
        indexedDB: {
          available: "indexedDB" in window,
        },
      };

      // Check quota if available
      if ("storage" in navigator && "estimate" in navigator.storage) {
        navigator.storage.estimate().then((estimate) => {
          storage.quota = estimate;
          setStorageInfo({ ...storage });
        });
      } else {
        setStorageInfo(storage);
      }
    };

    getStorageInfo();
  }, [refreshKey]);

  // Intercept console logs
  useEffect(() => {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      setConsoleLogs((prev) => [
        ...prev.slice(-49),
        {
          type: "log",
          message: args
            .map((arg) =>
              typeof arg === "object" ? JSON.stringify(arg) : String(arg),
            )
            .join(" "),
          timestamp: new Date().toISOString(),
        },
      ]);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      setConsoleLogs((prev) => [
        ...prev.slice(-49),
        {
          type: "error",
          message: args
            .map((arg) =>
              typeof arg === "object" ? JSON.stringify(arg) : String(arg),
            )
            .join(" "),
          timestamp: new Date().toISOString(),
        },
      ]);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      setConsoleLogs((prev) => [
        ...prev.slice(-49),
        {
          type: "warn",
          message: args
            .map((arg) =>
              typeof arg === "object" ? JSON.stringify(arg) : String(arg),
            )
            .join(" "),
          timestamp: new Date().toISOString(),
        },
      ]);
      originalWarn.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  // Intercept fetch requests
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args: [RequestInfo | URL, RequestInit?]) => {
      const start = performance.now();
      const requestInfo = args[0];

      // FIX 1: Correctly determine URL
      let url: string;
      if (typeof requestInfo === "string") {
        url = requestInfo;
      } else if (requestInfo instanceof URL) {
        url = requestInfo.href;
      } else {
        // It's a Request object
        url = requestInfo.url;
      }

      try {
        const response = await originalFetch(...args);
        const duration = performance.now() - start;

        setNetworkLogs((prev) => [
          ...prev.slice(-49),
          {
            url,
            method:
              args[1]?.method ||
              (typeof requestInfo === "object" && "method" in requestInfo
                ? requestInfo.method
                : "GET"),
            status: response.status,
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
            type: "fetch",
            success: response.ok,
          },
        ]);

        return response;
      } catch (error) {
        const duration = performance.now() - start;

        // FIX 2: Handle 'unknown' error type
        let errorMessage = "An unknown fetch error occurred";
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === "string") {
          errorMessage = error;
        } else {
          try {
            errorMessage = JSON.stringify(error);
          } catch {
            // Fallback if stringify fails
          }
        }

        setNetworkLogs((prev) => [
          ...prev.slice(-49),
          {
            url,
            method:
              args[1]?.method ||
              (typeof requestInfo === "object" && "method" in requestInfo
                ? requestInfo.method
                : "GET"),
            error: errorMessage,
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
            type: "fetch",
            success: false,
          },
        ]);
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log("Debug info copied to clipboard");
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  }, []);

  const exportDebugInfo = useCallback(() => {
    const debugData = {
      timestamp: new Date().toISOString(),
      environment: {
        envVars,
        allViteKeys: viteEnvKeys,
      },
      system: systemInfo,
      performance: performanceMetrics,
      tauri: tauriInfo,
      appState: {
        viewMode: appState.viewMode,
        isLLMPanelOpen: appState.isLLMPanelOpen,
        loadingStates: appState.loadingStates,
      },
      project: project
        ? {
            id: project.id,
            name: project.name,
            hasUnsavedChanges,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          }
        : null,
      storage: storageInfo,
      recentLogs: consoleLogs.slice(-20),
      recentNetwork: networkLogs.slice(-20),
    };

    copyToClipboard(JSON.stringify(debugData, null, 2));
  }, [
    envVars,
    viteEnvKeys,
    systemInfo,
    performanceMetrics,
    tauriInfo,
    appState,
    project,
    hasUnsavedChanges,
    storageInfo,
    consoleLogs,
    networkLogs,
    copyToClipboard,
  ]);

  const clearLogs = useCallback(() => {
    setConsoleLogs([]);
    setNetworkLogs([]);
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const isPopup = !!onClose;

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    // Added return type for clarity
    padding: "6px 12px",
    cursor: "pointer",
    borderBottom: isActive ? "2px solid #4CAF50" : "2px solid transparent",
    color: isActive ? "#4CAF50" : "#ccc",
    fontSize: "11px",
    fontWeight: isActive ? "bold" : "normal",
  });

  const tabs = [
    { id: "environment", label: "Environment" },
    { id: "system", label: "System" },
    { id: "performance", label: "Performance" },
    { id: "tauri", label: "Tauri" },
    { id: "appstate", label: "App State" },
    { id: "storage", label: "Storage" },
    { id: "network", label: "Network" },
    { id: "console", label: "Console" },
  ];

  const renderKeyValue = (key: string, value: any, dangerous = false) => (
    <div key={key} style={{ marginBottom: "4px", fontSize: "11px" }}>
      <span style={{ color: "#81C784" }}>{key}:</span>{" "}
      <span
        style={{
          color: dangerous
            ? "#F44336"
            : value === "UNDEFINED"
              ? "#F44336"
              : "#E1F5FE",
          fontWeight: value === "UNDEFINED" ? "bold" : "normal",
          wordBreak: "break-all",
        }}
      >
        {typeof value === "object" && value !== null
          ? JSON.stringify(value)
          : String(value)}
      </span>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "environment":
        return (
          <div>
            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                Vite Environment:
              </h4>
              {Object.entries(envVars).map(([key, value]) =>
                renderKeyValue(key, value),
              )}
            </div>

            <div>
              <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                All VITE_ Variables ({viteEnvKeys.length}):
              </h4>
              {viteEnvKeys.length === 0 ? (
                <div style={{ color: "#F44336", fontWeight: "bold" }}>
                  ❌ No VITE_ variables found!
                </div>
              ) : (
                <div
                  style={{
                    maxHeight: "100px",
                    overflow: "auto",
                    fontSize: "10px",
                  }}
                >
                  {viteEnvKeys.map((key) => (
                    <div key={key} style={{ marginBottom: "2px" }}>
                      <span style={{ color: "#81C784" }}>{key}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "system":
        return systemInfo ? (
          <div>
            {renderKeyValue("User Agent", systemInfo.userAgent)}
            {renderKeyValue("Platform", systemInfo.platform)}
            {renderKeyValue("Language", systemInfo.language)}
            {renderKeyValue("Cookies Enabled", systemInfo.cookieEnabled)}
            {renderKeyValue("Online", systemInfo.onLine)}
            {renderKeyValue("CPU Cores", systemInfo.hardwareConcurrency)}

            {systemInfo.memory && (
              <div style={{ marginTop: "10px" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                  Memory:
                </h4>
                {renderKeyValue(
                  "Used",
                  `${Math.round(systemInfo.memory.usedJSHeapSize / 1024 / 1024)} MB`,
                )}
                {renderKeyValue(
                  "Total",
                  `${Math.round(systemInfo.memory.totalJSHeapSize / 1024 / 1024)} MB`,
                )}
                {renderKeyValue(
                  "Limit",
                  `${Math.round(systemInfo.memory.jsHeapSizeLimit / 1024 / 1024)} MB`,
                )}
              </div>
            )}

            {systemInfo.connection && (
              <div style={{ marginTop: "10px" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                  Connection:
                </h4>
                {renderKeyValue(
                  "Type",
                  systemInfo.connection.effectiveType || "N/A",
                )}
                {renderKeyValue(
                  "Downlink",
                  `${systemInfo.connection.downlink} Mbps`,
                )}
                {renderKeyValue("RTT", `${systemInfo.connection.rtt} ms`)}
              </div>
            )}
          </div>
        ) : (
          <div>Loading system info...</div>
        );

      case "performance":
        return (
          <div>
            {performanceMetrics.memoryUsage && (
              <div style={{ marginBottom: "15px" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                  Memory Usage:
                </h4>
                {renderKeyValue(
                  "Used JS Heap",
                  `${Math.round(performanceMetrics.memoryUsage.usedJSHeapSize / 1024 / 1024)} MB`,
                )}
                {renderKeyValue(
                  "Total JS Heap",
                  `${Math.round(performanceMetrics.memoryUsage.totalJSHeapSize / 1024 / 1024)} MB`,
                )}
                {renderKeyValue(
                  "Heap Limit",
                  `${Math.round(performanceMetrics.memoryUsage.jsHeapSizeLimit / 1024 / 1024)} MB`,
                )}
              </div>
            )}

            {performanceMetrics.timing && (
              <div style={{ marginBottom: "15px" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                  Page Timing:
                </h4>
                {renderKeyValue(
                  "DOM Content Loaded",
                  `${performanceMetrics.timing.domContentLoadedEventEnd - performanceMetrics.timing.navigationStart}ms`,
                )}
                {renderKeyValue(
                  "Page Load",
                  `${performanceMetrics.timing.loadEventEnd - performanceMetrics.timing.navigationStart}ms`,
                )}
                {renderKeyValue(
                  "DNS Lookup",
                  `${performanceMetrics.timing.domainLookupEnd - performanceMetrics.timing.domainLookupStart}ms`,
                )}
              </div>
            )}

            <div>
              <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                Current Performance:
              </h4>
              {renderKeyValue("Now", `${Math.round(performance.now())}ms`)}
              {renderKeyValue(
                "Time Origin",
                new Date(performance.timeOrigin).toISOString(),
              )}
            </div>
          </div>
        );

      case "tauri":
        return (
          <div>
            {renderKeyValue("Is Tauri App", tauriInfo.isTauri)}
            {renderKeyValue("Ready", tauriInfo.isReady)}
            {tauriInfo.error && renderKeyValue("Error", tauriInfo.error, true)}

            {tauriInfo.isTauri ? (
              <div>
                {tauriInfo.appVersion &&
                  renderKeyValue("App Version", tauriInfo.appVersion)}
                {tauriInfo.appName &&
                  renderKeyValue("App Name", tauriInfo.appName)}
                {tauriInfo.tauriVersion &&
                  renderKeyValue("Tauri Version", tauriInfo.tauriVersion)}
                {tauriInfo.platform &&
                  renderKeyValue("Platform", tauriInfo.platform)}
                {tauriInfo.arch &&
                  renderKeyValue("Architecture", tauriInfo.arch)}
                {tauriInfo.osVersion &&
                  renderKeyValue("OS Version", tauriInfo.osVersion)}
                {tauriInfo.locale && renderKeyValue("Locale", tauriInfo.locale)}
                {tauriInfo.theme && renderKeyValue("Theme", tauriInfo.theme)}

                <div style={{ marginTop: "10px" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                    Available APIs:
                  </h4>
                  {/* FIX 3: Use type assertion for window.__TAURI__ */}
                  {(window as any).__TAURI__ &&
                    Object.keys((window as any).__TAURI__).map((api) => (
                      <div
                        key={api}
                        style={{ fontSize: "10px", color: "#81C784" }}
                      >
                        ✓ {api}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div style={{ color: "#FFA726" }}>
                Running in web browser mode
              </div>
            )}
          </div>
        );

      case "appstate":
        return (
          <div>
            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                App State:
              </h4>
              {renderKeyValue("View Mode", appState.viewMode)}
              {renderKeyValue("LLM Panel Open", appState.isLLMPanelOpen)}
              {renderKeyValue("Loading States", appState.loadingStates.length)}

              {appState.loadingStates.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <h5
                    style={{
                      margin: "0 0 4px 0",
                      color: "#FFA726",
                      fontSize: "10px",
                    }}
                  >
                    Active Operations:
                  </h5>
                  {appState.loadingStates.map((state, i) => (
                    <div key={i} style={{ fontSize: "10px", color: "#E1F5FE" }}>
                      • {state.operation}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {project && (
              <div>
                <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                  Project:
                </h4>
                {renderKeyValue("ID", project.id)}
                {renderKeyValue("Name", project.name)}
                {renderKeyValue("Has Unsaved Changes", hasUnsavedChanges)}
                {renderKeyValue(
                  "Created",
                  new Date(project.createdAt).toLocaleString(),
                )}
                {renderKeyValue(
                  "Updated",
                  new Date(project.updatedAt).toLocaleString(),
                )}
              </div>
            )}
          </div>
        );

      case "storage":
        return (
          <div>
            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                Local Storage:
              </h4>
              {renderKeyValue("Available", storageInfo.localStorage?.available)}
              {renderKeyValue("Items", storageInfo.localStorage?.length)}
              {storageInfo.localStorage?.keys.length > 0 && (
                <div
                  style={{
                    marginTop: "4px",
                    maxHeight: "60px",
                    overflow: "auto",
                  }}
                >
                  {storageInfo.localStorage.keys.map((key: string) => (
                    <div
                      key={key}
                      style={{ fontSize: "10px", color: "#81C784" }}
                    >
                      • {key}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                Session Storage:
              </h4>
              {renderKeyValue(
                "Available",
                storageInfo.sessionStorage?.available,
              )}
              {renderKeyValue("Items", storageInfo.sessionStorage?.length)}
            </div>

            <div style={{ marginBottom: "15px" }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                IndexedDB:
              </h4>
              {renderKeyValue("Available", storageInfo.indexedDB?.available)}
            </div>

            {storageInfo.quota && (
              <div>
                <h4 style={{ margin: "0 0 8px 0", color: "#FFA726" }}>
                  Storage Quota:
                </h4>
                {renderKeyValue(
                  "Used",
                  `${Math.round((storageInfo.quota.usage || 0) / 1024 / 1024)} MB`,
                )}
                {renderKeyValue(
                  "Quota",
                  `${Math.round((storageInfo.quota.quota || 0) / 1024 / 1024)} MB`,
                )}
              </div>
            )}
          </div>
        );

      case "network":
        return (
          <div>
            <div
              style={{
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h4 style={{ margin: "0", color: "#FFA726" }}>
                Network Requests ({networkLogs.length}):
              </h4>
              <button
                onClick={clearLogs}
                style={{
                  background: "#333",
                  border: "1px solid #555",
                  color: "#ccc",
                  padding: "2px 6px",
                  fontSize: "10px",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ maxHeight: "200px", overflow: "auto" }}>
              {networkLogs.length === 0 ? (
                <div style={{ color: "#666", fontSize: "10px" }}>
                  No network requests captured yet
                </div>
              ) : (
                networkLogs
                  .slice(-10) // Consider showing more or making this configurable
                  .reverse()
                  .map((log, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom: "8px",
                        fontSize: "10px",
                        borderBottom: "1px solid #333",
                        paddingBottom: "4px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          style={{ color: log.success ? "#4CAF50" : "#F44336" }}
                        >
                          {log.method} {log.status || "ERR"}
                        </span>
                        <span style={{ color: "#666" }}>{log.duration}ms</span>
                      </div>
                      <div style={{ color: "#E1F5FE", wordBreak: "break-all" }}>
                        {log.url}
                      </div>
                      {log.error && (
                        <div style={{ color: "#F44336" }}>
                          Error: {log.error}
                        </div>
                      )}
                      <div style={{ color: "#666" }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        );

      case "console":
        return (
          <div>
            <div
              style={{
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h4 style={{ margin: "0", color: "#FFA726" }}>
                Console Logs ({consoleLogs.length}):
              </h4>
              <button
                onClick={clearLogs}
                style={{
                  background: "#333",
                  border: "1px solid #555",
                  color: "#ccc",
                  padding: "2px 6px",
                  fontSize: "10px",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
            <div style={{ maxHeight: "200px", overflow: "auto" }}>
              {consoleLogs.length === 0 ? (
                <div style={{ color: "#666", fontSize: "10px" }}>
                  No console logs captured yet
                </div>
              ) : (
                consoleLogs
                  .slice(-15) // Consider showing more or making this configurable
                  .reverse()
                  .map((log, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom: "6px",
                        fontSize: "10px",
                        borderBottom: "1px solid #333",
                        paddingBottom: "4px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          style={{
                            color:
                              log.type === "error"
                                ? "#F44336"
                                : log.type === "warn"
                                  ? "#FFA726"
                                  : "#4CAF50",
                          }}
                        >
                          {log.type.toUpperCase()}
                        </span>
                        <span style={{ color: "#666" }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ color: "#E1F5FE", wordBreak: "break-all" }}>
                        {log.message}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        );

      default:
        return <div>Select a tab</div>;
    }
  };

  return (
    <div
      style={{
        position: isPopup ? "relative" : "fixed",
        top: isPopup ? "auto" : "10px",
        right: isPopup ? "auto" : "10px",
        backgroundColor: "#1a1a1a",
        color: "#ffffff",
        borderRadius: "8px",
        fontFamily: "monospace",
        fontSize: "12px",
        width: isPopup ? "450px" : "500px",
        height: isPopup ? "500px" : "600px",
        zIndex: 9999,
        border: "2px solid #333",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 15px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: "0", color: "#4CAF50", fontSize: "14px" }}>
          🔧 Debug Panel ({import.meta.env.MODE})
        </h3>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={refresh}
            style={{
              background: "#333",
              border: "1px solid #555",
              color: "#ccc",
              padding: "4px 8px",
              fontSize: "10px",
              borderRadius: "3px",
              cursor: "pointer",
            }}
            title="Refresh Data"
          >
            🔄
          </button>
          <button
            onClick={exportDebugInfo}
            style={{
              background: "#333",
              border: "1px solid #555",
              color: "#ccc",
              padding: "4px 8px",
              fontSize: "10px",
              borderRadius: "3px",
              cursor: "pointer",
            }}
            title="Copy Debug Info to Clipboard"
          >
            📋
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                color: "#666",
                cursor: "pointer",
                fontSize: "16px",
                padding: "0",
                lineHeight: "1",
              }}
              title="Close Debug Panel"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #333",
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={tabStyle(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: "15px",
          overflow: "auto",
          fontSize: "11px",
        }}
      >
        {renderTabContent()}
      </div>

      {/* Footer */}
      <div
        style={{
          fontSize: "9px",
          color: "#666",
          borderTop: "1px solid #333",
          padding: "8px 15px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          Environment: {viteEnvKeys.length} vars | Runtime:{" "}
          {tauriInfo.isTauri ? "Tauri" : "Web"} | Memory:{" "}
          {systemInfo?.memory
            ? `${Math.round(systemInfo.memory.usedJSHeapSize / 1024 / 1024)}MB`
            : "N/A"}
        </span>
        <span>Last updated: {new Date().toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default EnvironmentDebug;
