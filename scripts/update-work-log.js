const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const LOG_PATH = path.join(ROOT, "WORK_LOG.json");
const VALIDATE_SCRIPT = path.join(__dirname, "validate-work-log.js");
const SERVER_PATH = path.join(ROOT, "server.js");
const POLICIES_PATH = path.join(ROOT, "POLICIES.json");
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
    pol_ref: fs.existsSync(POLICIES_PATH) ? "POLICIES.json" : null,
    pol_hash: null,
    ts: new Date().toISOString(),
  };

  if (fs.existsSync(POLICIES_PATH)) {
    try {
      const policiesDoc = JSON.parse(fs.readFileSync(POLICIES_PATH, "utf8"));
      if (Array.isArray(policiesDoc.pol)) {
        log.pol_hash = crypto
          .createHash("sha256")
          .update(JSON.stringify(policiesDoc.pol))
          .digest("hex")
          .slice(0, 12);
      }
    } catch (err) {
      log.pol_hash = null;
    }
  }

  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  if (fs.existsSync(VALIDATE_SCRIPT)) {
    const { spawnSync } = require("child_process");
    spawnSync("node", [VALIDATE_SCRIPT], { stdio: "inherit" });
  }
}

buildLog();
