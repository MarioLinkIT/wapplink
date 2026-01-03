const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const WATCH_TARGETS = [path.join(ROOT, "server.js"), path.join(ROOT, "public")];
let timer = null;

function runUpdate() {
  const child = spawn(process.execPath, [path.join(__dirname, "update-work-log.js")], {
    stdio: "ignore",
  });
  child.on("error", () => {});
}

function debounceUpdate() {
  clearTimeout(timer);
  timer = setTimeout(runUpdate, 200);
}

WATCH_TARGETS.forEach((target) => {
  try {
    fs.watch(target, { recursive: true }, debounceUpdate);
  } catch (err) {
    // Fallback to single-file watch if recursive is unsupported.
    if (fs.lstatSync(target).isFile()) {
      fs.watch(target, debounceUpdate);
    }
  }
});

runUpdate();
