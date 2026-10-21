// In src/main.tsx - Place these lines at the VERY TOP of the file
console.log(
  `%c[App Entry Point - ${new Date().toISOString()}] TOP LEVEL CHECK: typeof window.__TAURI_IPC__ is: ${typeof (window as any).__TAURI_IPC__}`,
  "color: magenta; font-weight: bold;",
  (window as any).__TAURI_IPC__,
);
console.log(
  `%c[App Entry Point - ${new Date().toISOString()}] TOP LEVEL CHECK: typeof window.__TAURI_METADATA__ is: ${typeof (window as any).__TAURI_METADATA__}`,
  "color: magenta; font-weight: bold;",
  (window as any).__TAURI_METADATA__,
);

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/main.css";
import "leaflet/dist/leaflet.css";

// Initialize the React app
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />,
);
