// src/utils/tauriDetection.ts - ACCURATE detection that doesn't false-positive

export const isTauriEnvironmentSimple = (): boolean => {
  if (typeof window === "undefined") return false;

  const { protocol, hostname, port } = window.location;
  const webAppHost = (import.meta.env.VITE_WEBAPP_HOST as string | undefined) || "";

  console.log("[TauriDetection] Checking environment...", {
    protocol,
    hostname,
    port,
    userAgent: navigator.userAgent.substring(0, 100),
    hasGlobals: !!(
      (window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__
    ),
  });

  // 1. A configured production web host is definitely a browser build
  if (webAppHost && hostname === webAppHost) {
    console.log("[TauriDetection] Production web app - browser");
    return false;
  }

  // 2. Check for Tauri globals (REQUIRED for actual Tauri)
  const hasTauriGlobals = !!(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).isTauri ||
    (window as any).__TAURI__ ||
    (window as any).__TAURI_METADATA__
  );

  if (hasTauriGlobals) {
    console.log("[TauriDetection] Tauri globals found - definitely Tauri");
    return true;
  }

  // 3. Check user agent for Tauri (real Tauri apps have different UA)
  const userAgent = navigator.userAgent;
  if (userAgent.includes("Tauri")) {
    console.log("[TauriDetection] Tauri user agent detected");
    return true;
  }

  // 4. Check for tauri:// protocol
  if (protocol === "tauri:") {
    console.log("[TauriDetection] Tauri protocol detected");
    return true;
  }

  // 5. For localhost - DO NOT assume Tauri just because of port!
  // Port 1420 can be accessed by browser too!
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const portNum = parseInt(port) || (protocol === "https:" ? 443 : 80);

    console.log("[TauriDetection] Localhost detected", {
      port: portNum,
      hasGlobals: hasTauriGlobals,
      userAgent: userAgent.includes("Safari") ? "Safari" : "Other",
    });

    // Only return true for Tauri ports IF we have other indicators
    if ([1420, 1421, 1422].includes(portNum)) {
      // Check for Safari - if it's Safari, definitely not Tauri
      if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
        console.log(
          "[TauriDetection] Safari on Tauri port - this is browser testing",
        );
        return false;
      }

      // Check for Chrome - could be browser testing
      if (userAgent.includes("Chrome")) {
        console.log(
          "[TauriDetection] Chrome on Tauri port - this is browser testing",
        );
        return false;
      }

      // If no clear browser indicators and we're on Tauri port, might be Tauri
      console.log(
        "[TauriDetection] Tauri port but no globals - likely browser testing",
      );
      return false;
    }

    // Common web dev ports are definitely browser
    if ([3000, 3001, 5173, 5174, 8080, 8000, 4200].includes(portNum)) {
      console.log("[TauriDetection] Web dev port - browser");
      return false;
    }

    // Unknown localhost port - conservative
    console.log("[TauriDetection] Unknown localhost port - assuming browser");
    return false;
  }

  // 6. Non-localhost, non-web-app - could be Tauri, but be conservative
  console.log("[TauriDetection] Non-localhost - checking for other indicators");

  // Check if we're in a webview context without browser chrome
  const hasNavigator = !!window.navigator;
  const hasWindowChrome = !!(window as any).chrome; // Accessing window.chrome might need 'any'

  if (
    hasNavigator &&
    !hasWindowChrome &&
    !userAgent.includes("Safari") &&
    !userAgent.includes("Chrome")
  ) {
    console.log("[TauriDetection] Possible Tauri context (no browser chrome)");
    return true;
  }

  console.log("[TauriDetection] No clear Tauri indicators - assuming browser");
  return false;
};

// Async version that's more conservative
export const isTauriEnvironmentAsync = async (
  timeoutMs = 1000,
): Promise<boolean> => {
  const immediate = isTauriEnvironmentSimple();

  // If we already have a definitive answer, return it
  if (immediate) {
    return true;
  }

  // For localhost, give a short time for globals to appear, but don't assume
  const { hostname, port } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const portNum = parseInt(port) || 80;

  if (isLocalhost && [1420, 1421, 1422].includes(portNum)) {
    console.log(
      "[TauriDetection] Localhost Tauri port - waiting briefly for globals...",
    );

    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkGlobals = () => {
        const hasGlobals = !!(
          (window as any).__TAURI_INTERNALS__ ||
          (window as any).isTauri ||
          (window as any).__TAURI__
        );

        if (hasGlobals) {
          console.log("[TauriDetection] Globals appeared - confirmed Tauri");
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeoutMs) {
          console.log(
            "[TauriDetection] Timeout waiting for globals - this is browser testing",
          );
          resolve(false);
          return;
        }

        setTimeout(checkGlobals, 50);
      };

      checkGlobals();
    });
  }

  return immediate;
};

// All other functions stay the same
export const isTauriEnvironment = isTauriEnvironmentSimple;
export const isBrowser = (): boolean => !isTauriEnvironmentSimple();
export const isWebApp = (): boolean => {
  if (typeof window === "undefined") return false;
  const webAppHost = (import.meta.env.VITE_WEBAPP_HOST as string | undefined) || "";
  return Boolean(webAppHost) && window.location.hostname === webAppHost;
};
export const isDesktopApp = (): boolean => isTauriEnvironmentSimple();

export const getEnvironmentInfo = () => {
  if (typeof window === "undefined") {
    return {
      environment: "SSR",
      protocol: "none",
      hostname: "none",
      port: "none",
    };
  }

  const { protocol, hostname, href, port } = window.location;
  const isTauriCurrent = isTauriEnvironmentSimple();

  return {
    environment: isTauriCurrent ? "desktop" : "browser",
    isTauri: isTauriCurrent,
    protocol,
    hostname,
    port,
    href,
    isWebApp: isWebApp(),
    isDesktopApp: isDesktopApp(),
    hasGlobals: !!(
      (window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__
    ),
    userAgent: navigator.userAgent,
    browserType: navigator.userAgent.includes("Safari")
      ? "Safari"
      : navigator.userAgent.includes("Chrome")
        ? "Chrome"
        : "Other",
  };
};

export const isTauri = isTauriEnvironmentSimple;
export const isTauriAsync = isTauriEnvironmentAsync;
