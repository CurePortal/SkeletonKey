import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync } from "node:fs";

let token = process.env.BEACON_TOKEN || "";
if (!token && process.env.BEACON_ENV) {
  const env = readFileSync(process.env.BEACON_ENV, "utf8");
  token = (env.match(/^BEACON_TOKEN=(.*)$/m) || [])[1]?.trim() || "";
}

const transport = new StdioClientTransport({
  command: "node",
  args: ["mcp/skeletonkey-mcp.mjs"],
  env: {
    ...process.env,
    SK_STATE_DIR: "/tmp/sk-mcp-test",
    SK_PROJECT_FILE: "/tmp/sk-mcp-test/project.json",
    SK_MCP_PORT: "8798",
    BEACON_TOKEN: token,
  },
});
const client = new Client({ name: "sk-mcp-test", version: "0.1.0" }, { capabilities: {} });
await client.connect(transport);
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.[0]?.text || "";
  console.log(name, text.slice(0, 300).replace(/\n/g, " "));
  return text;
};
await call("skeleton_init", { name: "HQ Test", reset: true });
await call("skeleton_location_upsert", { name: "Golden Gate Bridge", lat: 37.8199, lon: -122.4783, type: "other" });
await call("skeleton_event_add", { title: "Arrived", date: "2026-10-20", description: "Test event", location: "Golden Gate Bridge", tags: ["test"] });
await call("skeleton_ingest_beacon", { track: 10 });
await call("skeleton_capture_chat", { text: "I am at the bridge.", role: "user" });
await call("skeleton_status");
await call("skeleton_export", { path: "/tmp/sk-mcp-test/export.ark.json" });
await client.close();
console.log("done");
