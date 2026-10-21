// src/services/urlService.ts
import { isTauriEnvironmentSimple } from "../utils/tauriDetection";

export async function openUrl(url: string): Promise<void> {
  try {
    const isTauri = isTauriEnvironmentSimple();

    console.log(`[urlService] Opening URL: ${url}, isTauri: ${isTauri}`);

    if (isTauri) {
      try {
        const { openUrl: tauriOpenUrl } = await import(
          "@tauri-apps/plugin-opener"
        );
        console.log("[urlService] Using Tauri opener plugin");
        await tauriOpenUrl(url);
      } catch (error) {
        console.error("Failed to open URL with Tauri opener plugin:", error);
        console.log("[urlService] Falling back to window.open in Tauri");
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } else {
      console.log("[urlService] Using browser window.open");
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    console.error("Failed to open URL:", error);
    try {
      console.log("[urlService] Using final fallback window.open");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (fallbackError) {
      console.error("All URL opening methods failed:", fallbackError);
      throw new Error(`Failed to open ${url}. Please visit the URL manually.`);
    }
  }
}
