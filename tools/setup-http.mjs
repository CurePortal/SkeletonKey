#!/usr/bin/env node
// SkeletonKey setup service.
//
// One local process the app can ask to install/check the things SkeletonKey
// needs: Ollama, offline maps (Valhalla + gazetteer), and the local
// bridge/MCP services. Long jobs run detached with a log; the UI polls /jobs.
//
//   node tools/setup-http.mjs        # http://127.0.0.1:8797
//
// Nothing here uses an account or a cloud service. Downloads are only from the
// projects the user explicitly chooses (ollama.com, Geofabrik, package repos).

import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STATE_DIR = process.env.SK_STATE_DIR || join(homedir(), ".local", "state", "skeletonkey");
const JOB_DIR = join(STATE_DIR, "setup");
const PORT = Number(process.env.SK_SETUP_PORT || 8797);
const HOST = process.env.SK_SETUP_HOST || "127.0.0.1";
const MAPS_HOME = process.env.MAPS_HOME || join(homedir(), "maps");
const DEFAULT_REGION = process.env.SK_DEFAULT_REGION || "north-america";

mkdirSync(JOB_DIR, { recursive: true });

const TARGETS = {
  ollama: "scripts/setup/ollama.sh",
  maps: "scripts/setup/maps.sh",
  services: "scripts/setup/services.sh",
  hq: "scripts/setup/hq.sh",
  all: "scripts/setup/all.sh",
};

const jobs = new Map();

function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Cache-Control": "no-store",
  });
  res.end(text);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function which(command) {
  try {
    return execFileSync("bash", ["-lc", `command -v ${command}`], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

async function probe(url, timeout = 2500) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    return response.ok;
  } catch {
    return false;
  }
}

async function ollamaModels() {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.models || []).map((row) => row.name).filter(Boolean);
  } catch {
    return [];
  }
}

function dirSize(path) {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

async function status() {
  const [valhallaHttp, bridge, mcp, opencode, models] = await Promise.all([
    probe("http://127.0.0.1:8002/status"),
    probe("http://127.0.0.1:8788/health"),
    probe("http://127.0.0.1:8799/health"),
    probe("http://127.0.0.1:4096/global/health"),
    ollamaModels(),
  ]);
  const ollamaBin = which("ollama");
  const tileDir = join(MAPS_HOME, "valhalla_tiles");
  const gazetteer = join(MAPS_HOME, "overlay", "overlay.sqlite");
  const recentJobs = [...jobs.values()]
    .sort((a, b) => b.started.localeCompare(a.started))
    .slice(0, 8)
    .map((job) => ({ id: job.id, target: job.target, status: job.status, started: job.started, log: job.log }));

  return {
    ok: true,
    repoDir: REPO_DIR,
    stateDir: STATE_DIR,
    mapsHome: MAPS_HOME,
    defaults: { region: DEFAULT_REGION },
    runtime: {
      node: process.version,
      nodePath: process.execPath,
      bash: which("bash"),
      git: which("git"),
      python: which("python3"),
      osmium: which("osmium"),
      valhallaBuild: which("valhalla_build_tiles"),
      valhallaService: which("valhalla_service"),
      ollama: ollamaBin,
      opencode: which("opencode"),
      curl: which("curl"),
      systemctl: which("systemctl"),
    },
    ollama: {
      installed: Boolean(ollamaBin),
      running: models.length > 0 || (await probe("http://127.0.0.1:11434/api/tags")),
      models,
    },
    maps: {
      tileDir,
      tilesBuilt: existsSync(tileDir),
      tileSize: dirSize(tileDir),
      gazetteer,
      gazetteerBuilt: existsSync(gazetteer),
      gazetteerSize: dirSize(gazetteer),
      valhallaRunning: valhallaHttp,
      built: existsSync(tileDir) && existsSync(gazetteer),
    },
    services: { bridge, mcp, opencode },
    jobs: recentJobs,
  };
}

function writeJob(job) {
  try {
    writeFileSync(join(JOB_DIR, `${job.id}.json`), JSON.stringify(job, null, 2));
  } catch {
    // Job status is best-effort.
  }
}

function startJob(target, options = {}) {
  const script = TARGETS[target];
  if (!script) throw new Error(`unknown setup target: ${target}`);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const id = `${target}-${stamp}`;
  const log = join(JOB_DIR, `${id}.log`);
  const scriptPath = join(REPO_DIR, script);
  if (!existsSync(scriptPath)) throw new Error(`setup script missing: ${scriptPath}`);
  const fd = openSync(log, "a");
  const env = {
    ...process.env,
    REPO_DIR,
    MAPS_HOME,
    REGION: String(options.region || DEFAULT_REGION),
    SK_JOB_ID: id,
  };
  const child = spawn("bash", [scriptPath], {
    cwd: REPO_DIR,
    env,
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  const job = {
    id,
    target,
    pid: child.pid,
    started: new Date().toISOString(),
    region: env.REGION,
    log,
    status: "running",
    exitCode: null,
  };
  jobs.set(id, job);
  writeJob(job);
  child.on("exit", (code) => {
    job.status = code === 0 ? "done" : "error";
    job.exitCode = code;
    job.finished = new Date().toISOString();
    jobs.set(id, job);
    writeJob(job);
  });
  child.unref();
  return job;
}

function tail(path, lines = 120) {
  try {
    const text = readFileSync(path, "utf8");
    return text.split("\n").slice(-lines).join("\n");
  } catch {
    return "";
  }
}

function jobInfo(id) {
  const job = jobs.get(id);
  if (!job) {
    try {
      return JSON.parse(readFileSync(join(JOB_DIR, `${id}.json`), "utf8"));
    } catch {
      return null;
    }
  }
  return { ...job, tail: tail(job.log) };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    });
    res.end();
    return;
  }
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json(res, 200, { ok: true, service: "skeletonkey-setup", repoDir: REPO_DIR });
    }
    if (req.method === "GET" && url.pathname === "/status") {
      return json(res, 200, await status());
    }
    if (req.method === "POST" && url.pathname === "/install") {
      const body = await readJson(req);
      const target = String(body.target || "all");
      const job = startJob(target, body);
      return json(res, 200, { ok: true, job });
    }
    if (req.method === "GET" && url.pathname === "/jobs") {
      return json(res, 200, { jobs: [...jobs.values()].slice(-20) });
    }
    if (req.method === "GET" && url.pathname.startsWith("/jobs/")) {
      const id = decodeURIComponent(url.pathname.slice("/jobs/".length));
      const info = jobInfo(id);
      if (!info) return json(res, 404, { error: "job not found" });
      return json(res, 200, info);
    }
    if (req.method === "DELETE" && url.pathname.startsWith("/jobs/")) {
      const id = decodeURIComponent(url.pathname.slice("/jobs/".length));
      const job = jobs.get(id);
      if (!job) return json(res, 404, { error: "job not found" });
      try {
        process.kill(-job.pid, "SIGTERM");
      } catch {
        try { process.kill(job.pid, "SIGTERM"); } catch {}
      }
      job.status = "cancelled";
      job.finished = new Date().toISOString();
      writeJob(job);
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: "unknown endpoint" });
  } catch (error) {
    return json(res, 400, { error: String(error?.message || error) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`skeletonkey-setup: http://${HOST}:${PORT}`);
  console.log(`skeletonkey-setup: repo ${REPO_DIR}`);
});
