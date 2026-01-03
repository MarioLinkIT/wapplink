const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WATCH_TARGETS = [path.join(ROOT, "server.js"), path.join(ROOT, "public")];
let child = null;
let timer = null;
let restarting = false;

function startServer() {
  if (child) return;
  child = spawn(process.execPath, [path.join(ROOT, "server.js")], { stdio: "inherit" });
  child.on("exit", () => {
    child = null;
    if (restarting) {
      restarting = false;
      startServer();
    }
  });
  child.on("error", () => {});
}

function stopServer() {
  if (!child) return;
  restarting = true;
  child.kill("SIGTERM");
}

function restartServer() {
  if (!child) {
    startServer();
    return;
  }
  stopServer();
}

function debounceRestart() {
  clearTimeout(timer);
  timer = setTimeout(restartServer, 200);
}

WATCH_TARGETS.forEach((target) => {
  try {
    fs.watch(target, { recursive: true }, debounceRestart);
  } catch (err) {
    if (fs.lstatSync(target).isFile()) {
      fs.watch(target, debounceRestart);
    }
  }
});

startServer();

process.on("SIGINT", () => {
  if (child) child.kill("SIGTERM");
  process.exit(0);
});

process.on("SIGTERM", () => {
  if (child) child.kill("SIGTERM");
  process.exit(0);
});
