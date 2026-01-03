const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LOG_PATH = path.join(ROOT, "WORK_LOG.json");
const SERVER_PATH = path.join(ROOT, "server.js");
const PUBLIC_DIR = path.join(ROOT, "public");

function listPublicFiles() {
  try {
    return fs
      .readdirSync(PUBLIC_DIR)
      .filter((name) => !name.startsWith("."))
      .map((name) => path.join("public", name));
  } catch (err) {
    return [];
  }
}

function extractApiRoutes() {
  const api = {};
  try {
    const content = fs.readFileSync(SERVER_PATH, "utf-8");
    if (content.includes("GET\" && req.url === \"/state\"")) {
      api["GET /state"] = "returns {buttons:[]}";
    }
    if (content.includes("POST\" && req.url === \"/save\"")) {
      api["POST /save"] = "writes sanitized buttons to data/state.json";
    }
  } catch (err) {
    return api;
  }
  return api;
}

function buildLog() {
  const clientFiles = listPublicFiles();
  const log = {
    p: "websitebuilder",
    a: {
      s: "server.js",
      c: clientFiles.length ? clientFiles : ["public/index.html", "public/styles.css", "public/app.js"],
      d: "data/state.json",
    },
    api: extractApiRoutes(),
    ui: [
      "add button",
      "drag move",
      "dblclick rename",
      "save/load",
      "guest view",
      "cyberpunk theme",
      "canvas mode toggle",
      "guest bg picker",
    ],
    run: "MODE=guest node server.js -> / (view), node server.js -> /build (builder)",
    auto: {
      u: "node scripts/update-work-log.js",
      w: "node scripts/watch-work-log.js",
      d: "node scripts/dev.js",
    },
    pol: ["Whenever you change files, update the log", "Optimize log file for own efficiency"],
    ts: new Date().toISOString(),
  };

  fs.writeFileSync(LOG_PATH, JSON.stringify(log));
}

buildLog();
