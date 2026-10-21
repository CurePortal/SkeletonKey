// Temporary debug component - add this anywhere in your app
import React from "react";

const URLDebug: React.FC = () => {
  if (typeof window === "undefined") return null;

  const { protocol, hostname, port, href } = window.location;

  const webAppHost = (import.meta.env.VITE_WEBAPP_HOST as string | undefined) || "";

  // Our detection logic
  const isBrowser =
    (protocol === "http:" || protocol === "https:") &&
    ((Boolean(webAppHost) && hostname === webAppHost) ||
      hostname === "localhost" ||
      hostname === "127.0.0.1");

  const isTauri = !isBrowser;

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        left: "10px",
        background: "black",
        color: "white",
        padding: "10px",
        fontFamily: "monospace",
        fontSize: "12px",
        zIndex: 10000,
        border: "1px solid red",
      }}
    >
      <div>
        <strong>URL DEBUG:</strong>
      </div>
      <div>Full URL: {href}</div>
      <div>Protocol: {protocol}</div>
      <div>Hostname: {hostname}</div>
      <div>Port: {port}</div>
      <div>Is Browser: {isBrowser.toString()}</div>
      <div>Is Tauri: {isTauri.toString()}</div>
      <div>---</div>
      <div>window.__TAURI__: {!!(window as any).__TAURI__ ? "YES" : "NO"}</div>
      <div>
        window.__TAURI_INTERNALS__:{" "}
        {!!(window as any).__TAURI_INTERNALS__ ? "YES" : "NO"}
      </div>
      <div>window.isTauri: {!!(window as any).isTauri ? "YES" : "NO"}</div>
    </div>
  );
};

export default URLDebug;
