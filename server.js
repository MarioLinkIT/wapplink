const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const MODE = process.env.MODE || "builder";
const ROOT = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const STATE_FILE = path.join(DATA_DIR, "state.json");
const IS_GUEST = MODE === "guest";

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const safePath = path.normalize(decoded).replace(/^([/\\])+/, "");
  return path.join(root, safePath);
}

async function ensureDataDir() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
}

async function readState() {
  try {
    const data = await fs.promises.readFile(STATE_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      return {
        pages: [
          {
            id: "page_1",
            name: "Page 1",
            containers: [{ id: "container_1", name: "Container 1", buttons: [] }],
          },
        ],
        currentPageId: "page_1",
        startPageId: "page_1",
        canvasMode: "fixed",
        guestBg: "#0b0b10",
      };
    }
    throw err;
  }
}

async function saveState(state) {
  await ensureDataDir();
  await fs.promises.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

const server = http.createServer(async (req, res) => {
  try {
    if (IS_GUEST && req.method === "POST") {
      return send(res, 403, "Forbidden");
    }

    if (IS_GUEST && (req.url === "/build" || req.url === "/build/" || req.url === "/index.html")) {
      res.writeHead(302, { Location: "/" });
      return res.end();
    }

    if (req.method === "GET" && req.url === "/state") {
      const state = await readState();
      return sendJson(res, 200, state);
    }

    if (!IS_GUEST && req.method === "POST" && req.url === "/save") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const pages = Array.isArray(parsed.pages) ? parsed.pages : [];
          const sanitizeContainer = (container) => {
            const buttons = Array.isArray(container.buttons) ? container.buttons : [];
            const children = Array.isArray(container.containers) ? container.containers : [];
            return {
              id: String(container.id || ""),
              name: String(container.name || "Container"),
              x: Number(container.x || 0),
              y: Number(container.y || 0),
              width: Number(container.width || 0),
              height: Number(container.height || 0),
              bgColor:
                typeof container.bgColor === "string" ? String(container.bgColor) : "",
              borderColor:
                typeof container.borderColor === "string"
                  ? String(container.borderColor)
                  : "",
              borderStyle:
                typeof container.borderStyle === "string"
                  ? String(container.borderStyle)
                  : "",
              borderWidth:
                typeof container.borderWidth === "number" &&
                Number.isFinite(container.borderWidth)
                  ? Number(container.borderWidth)
                  : null,
              units:
                container.units && typeof container.units === "object"
                  ? {
                      x: String(container.units.x || "%"),
                      y: String(container.units.y || "%"),
                      width: String(container.units.width || "%"),
                      height: String(container.units.height || "%"),
                    }
                  : { x: "%", y: "%", width: "%", height: "%" },
              buttons: buttons
                .map((btn) => ({
                  id: String(btn.id || ""),
                  label: String(btn.label || "Button"),
                  x: Number(btn.x || 0),
                  y: Number(btn.y || 0),
                  width: Number(btn.width || 0),
                  height: Number(btn.height || 0),
                  bgColor: typeof btn.bgColor === "string" ? String(btn.bgColor) : "",
                  borderColor:
                    typeof btn.borderColor === "string" ? String(btn.borderColor) : "",
                  borderStyle:
                    typeof btn.borderStyle === "string" ? String(btn.borderStyle) : "",
                  borderWidth:
                    typeof btn.borderWidth === "number" && Number.isFinite(btn.borderWidth)
                      ? Number(btn.borderWidth)
                      : null,
                  units:
                    btn.units && typeof btn.units === "object"
                      ? {
                          x: String(btn.units.x || "%"),
                          y: String(btn.units.y || "%"),
                          width: String(btn.units.width || "%"),
                          height: String(btn.units.height || "%"),
                        }
                      : { x: "%", y: "%", width: "%", height: "%" },
                  action:
                    btn.action && btn.action.type === "page"
                      ? {
                          type: "page",
                          pageId: String(btn.action.pageId || ""),
                        }
                      : { type: "none" },
                }))
                .filter((btn) => btn.id),
              containers: children.map(sanitizeContainer).filter((child) => child.id),
            };
          };
          const DEFAULT_PAGE_BG = "#0b0b10";
          const DEFAULT_PAGE_GLOW = "#27f7d7";
          const fallbackBg =
            typeof parsed.guestBg === "string" && parsed.guestBg.trim()
              ? parsed.guestBg
              : DEFAULT_PAGE_BG;
          const sanitizedPages = pages
            .map((page) => {
              const containers = Array.isArray(page.containers) ? page.containers : [];
              const sanitizedContainers = containers
                .map((container) => sanitizeContainer(container))
                .filter((container) => container.id);
              if (!sanitizedContainers.length && Array.isArray(page.buttons)) {
                sanitizedContainers.push({
                  id: "container_1",
                  name: "Container 1",
                  buttons: page.buttons
                    .map((btn) => ({
                      id: String(btn.id || ""),
                      label: String(btn.label || "Button"),
                      x: Number(btn.x || 0),
                      y: Number(btn.y || 0),
                      width: Number(btn.width || 0),
                      height: Number(btn.height || 0),
                      bgColor: typeof btn.bgColor === "string" ? String(btn.bgColor) : "",
                      borderColor:
                        typeof btn.borderColor === "string" ? String(btn.borderColor) : "",
                      borderStyle:
                        typeof btn.borderStyle === "string" ? String(btn.borderStyle) : "",
                      borderWidth:
                        typeof btn.borderWidth === "number" && Number.isFinite(btn.borderWidth)
                          ? Number(btn.borderWidth)
                          : null,
                      units:
                        btn.units && typeof btn.units === "object"
                          ? {
                              x: String(btn.units.x || "%"),
                              y: String(btn.units.y || "%"),
                              width: String(btn.units.width || "%"),
                              height: String(btn.units.height || "%"),
                            }
                          : { x: "%", y: "%", width: "%", height: "%" },
                      action:
                        btn.action && btn.action.type === "page"
                          ? {
                              type: "page",
                              pageId: String(btn.action.pageId || ""),
                            }
                          : { type: "none" },
                    }))
                    .filter((btn) => btn.id),
                });
              }
              if (!sanitizedContainers.length) {
                sanitizedContainers.push({
                  id: "container_1",
                  name: "Container 1",
                  buttons: [],
                });
              }
              return {
                id: String(page.id || ""),
                name: String(page.name || "Page"),
                bg:
                  typeof page.bg === "string" && page.bg.trim()
                    ? page.bg
                    : fallbackBg,
                glow:
                  typeof page.glow === "string" && page.glow.trim()
                    ? page.glow
                    : DEFAULT_PAGE_GLOW,
                containers: sanitizedContainers,
              };
            })
            .filter((page) => page.id);
          const fallbackPage = {
            id: "page_1",
            name: "Page 1",
            bg: fallbackBg,
            glow: DEFAULT_PAGE_GLOW,
            containers: [{ id: "container_1", name: "Container 1", buttons: [] }],
          };
          const sanitized = {
            pages: sanitizedPages.length ? sanitizedPages : [fallbackPage],
            currentPageId:
              typeof parsed.currentPageId === "string" && parsed.currentPageId
                ? parsed.currentPageId
                : (sanitizedPages[0] || fallbackPage).id,
            startPageId:
              typeof parsed.startPageId === "string" && parsed.startPageId
                ? parsed.startPageId
                : (sanitizedPages[0] || fallbackPage).id,
            canvasMode: parsed.canvasMode === "full" ? "full" : "fixed",
            expandedContainers: Array.isArray(parsed.expandedContainers)
              ? parsed.expandedContainers
                  .map((id) => String(id || ""))
                  .filter((id) => id)
              : [],
            expandedPages: Array.isArray(parsed.expandedPages)
              ? parsed.expandedPages
                  .map((id) => String(id || ""))
                  .filter((id) => id)
              : [],
            selectedNode:
              parsed.selectedNode && typeof parsed.selectedNode === "object"
                ? {
                    type: String(parsed.selectedNode.type || ""),
                    pageId: String(parsed.selectedNode.pageId || ""),
                    containerId: String(parsed.selectedNode.containerId || ""),
                    buttonId: String(parsed.selectedNode.buttonId || ""),
                  }
                : { type: "", pageId: "", containerId: "", buttonId: "" },
          };
          await saveState(sanitized);
          sendJson(res, 200, { ok: true });
        } catch (err) {
          send(res, 400, "Invalid JSON");
        }
      });
      return;
    }

    if (req.method === "GET") {
      let mappedUrl = req.url;
      if (mappedUrl === "/" || mappedUrl === "/view" || mappedUrl === "/view/") {
        mappedUrl = "/view.html";
      }
      if (mappedUrl === "/build" || mappedUrl === "/build/") {
        mappedUrl = "/index.html";
      }
      if (IS_GUEST && (mappedUrl === "/index.html" || mappedUrl === "/app.js")) {
        return send(res, 404, "Not found");
      }
      const filePath = safeJoin(ROOT, mappedUrl === "/" ? "/index.html" : mappedUrl);
      if (!filePath.startsWith(ROOT)) {
        return send(res, 403, "Forbidden");
      }
      fs.promises
        .stat(filePath)
        .then(async (stat) => {
          if (stat.isDirectory()) {
            return send(res, 403, "Forbidden");
          }
          const ext = path.extname(filePath).toLowerCase();
          const types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".json": "application/json; charset=utf-8",
            ".svg": "image/svg+xml",
          };
          const contentType = types[ext] || "application/octet-stream";
          const content = await fs.promises.readFile(filePath);
          res.writeHead(200, { "Content-Type": contentType });
          res.end(content);
        })
        .catch(() => send(res, 404, "Not found"));
      return;
    }

    send(res, 405, "Method not allowed");
  } catch (err) {
    send(res, 500, "Server error");
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
