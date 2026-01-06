const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const LOG_PATH = path.join(ROOT, "WORK_LOG.json");
const POLICIES_PATH = path.join(ROOT, "POLICIES.json");
const REQUIRED_POLICIES = [
  "Auto update/optimize code + WORK_LOG.json (no approval for log)",
  "Propose abstractions; implement only after approval",
  "Lean principles (KISS/DRY/YAGNI)",
  "Merge/shorten policies only if meaning preserved",
];

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function computePolicyHash(policies) {
  const data = JSON.stringify(policies || []);
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 12);
}

function main() {
  const log = loadJson(LOG_PATH);
  let policiesSource = "WORK_LOG.json";
  let policies = Array.isArray(log.pol) ? log.pol : [];
  let declared = typeof log.pol_hash === "string" ? log.pol_hash : "";
  if (fs.existsSync(POLICIES_PATH)) {
    const policiesDoc = loadJson(POLICIES_PATH);
    policiesSource = "POLICIES.json";
    policies = Array.isArray(policiesDoc.pol) ? policiesDoc.pol : [];
    declared = typeof policiesDoc.pol_hash === "string" ? policiesDoc.pol_hash : "";
  }
  const missing = REQUIRED_POLICIES.filter((policy) => !policies.includes(policy));
  const hash = computePolicyHash(policies);

  if (missing.length) {
    console.error(`${policiesSource} policy missing:`, missing.join(" | "));
    process.exitCode = 1;
  }
  if (declared && declared !== hash) {
    console.error(`${policiesSource} policy hash mismatch: ${declared} vs ${hash}`);
    process.exitCode = 1;
  }
  if (!missing.length && (!declared || declared === hash)) {
    console.log(`${policiesSource} policy check: ok`);
  }
}

main();
