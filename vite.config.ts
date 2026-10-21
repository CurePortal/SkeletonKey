import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const isProduction = !process.env.TAURI_DEBUG;

  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), "");

  // Debug logging for environment variables (only in development or when TAURI_DEBUG is set)
  if (!isProduction || process.env.TAURI_DEBUG) {
    console.log("🔧 Tauri Vite Config Debug:");
    console.log("   Mode:", mode);
    console.log("   Is Production:", isProduction);
    console.log("   TAURI_DEBUG:", process.env.TAURI_DEBUG);
    console.log("   NODE_ENV:", process.env.NODE_ENV);
    console.log("   CWD:", process.cwd());

    // Log environment files being checked
    const envFiles = [
      ".env",
      `.env.local`,
      `.env.${mode}`,
      `.env.${mode}.local`,
    ];
    console.log("   Env files checked:", envFiles);

    // Log VITE_ prefixed variables (without exposing sensitive data)
    const viteVars = Object.keys(env).filter((key) => key.startsWith("VITE_"));
    console.log("   VITE_ variables found:", viteVars.length, viteVars);

    // Validate critical variables for cloud sync
    const criticalVars = [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_CLOUDFLARE_R2_API_URL",
    ];

    const missingVars = criticalVars.filter((varName) => !env[varName]);
    if (missingVars.length > 0) {
      console.error(
        "❌ Missing critical environment variables for cloud sync:",
        missingVars,
      );
      console.error("   Cloud sync will not work without these variables!");
    } else {
      console.log("✅ All critical cloud sync environment variables found");
    }
  }

  return {
    plugins: [react()],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    clearScreen: false,

    // Tauri expects a fixed port, fail if that port is not available
    server: {
      host: "127.0.0.1",
      port: 1420,
      strictPort: true,
    },

    // To make use of `TAURI_DEBUG` and other env variables
    // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
    envPrefix: ["VITE_", "TAURI_"],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    // Explicitly define some build-time constants for debugging
    define: {
      __VITE_MODE__: JSON.stringify(mode),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __IS_TAURI_PROD__: JSON.stringify(isProduction),
    },

    build: {
      // Tauri supports es2021
      target: ["es2021", "chrome100", "safari13"],

      // CHANGED: Use Terser for production minification
      minify: isProduction ? "terser" : false,

      // Produce sourcemaps for debug builds
      sourcemap: !!process.env.TAURI_DEBUG,

      // Generate build info for debugging
      reportCompressedSize: !isProduction,

      // CHANGED: Terser options for console removal
      terserOptions: isProduction
        ? {
            compress: {
              // Remove all console.* statements
              drop_console: true,
              // Remove debugger statements
              drop_debugger: true,
              // Remove unused code
              dead_code: true,
              // Other optimizations
              passes: 2,
            },
            mangle: {
              // Mangle all names except globals
              keep_fnames: false,
            },
            format: {
              // Remove all comments
              comments: false,
            },
          }
        : undefined,

      // Rollup options for better environment variable handling
      rollupOptions: {
        // Ensure environment variables are properly processed
        output: {
          // Add build info to help with debugging
          banner: !isProduction
            ? "/* Tauri Debug Build - Environment variables loaded */"
            : undefined,
        },
      },
    },
  };
});
