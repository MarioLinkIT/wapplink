const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const LOG_PATH = path.join(ROOT, "WORK_LOG.json");
const POLICIES_PATH = path.join(ROOT, "POLICIES.json");
const POLICIES_BACKUP_PATH = path.join(ROOT, "POLICIES_BACKUP.json");

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
  let backupPolicies = null;
  if (fs.existsSync(POLICIES_BACKUP_PATH)) {
    const policiesDoc = loadJson(POLICIES_BACKUP_PATH);
    policiesSource = "POLICIES_BACKUP.json";
    backupPolicies = Array.isArray(policiesDoc.pol) ? policiesDoc.pol : [];
    policies = backupPolicies;
    declared = typeof policiesDoc.pol_hash === "string" ? policiesDoc.pol_hash : "";
  } else if (fs.existsSync(POLICIES_PATH)) {
    const policiesDoc = loadJson(POLICIES_PATH);
    policiesSource = "POLICIES.json";
    policies = Array.isArray(policiesDoc.pol) ? policiesDoc.pol : [];
    declared = typeof policiesDoc.pol_hash === "string" ? policiesDoc.pol_hash : "";
  }
  const currentPolicies = fs.existsSync(POLICIES_PATH)
    ? (loadJson(POLICIES_PATH).pol || [])
    : [];
  const missing = backupPolicies
    ? backupPolicies.filter((policy) => !currentPolicies.includes(policy))
    : [];
  const hash = computePolicyHash(policies);

  const shouldValidate = policies.length > 0 || declared;
  if (!shouldValidate) {
    console.log("policy check: skipped (no backup)");
    return;
  }
  if (missing.length) {
    console.error("POLICIES.json missing backup policies:", missing.join(" | "));
    process.exitCode = 1;
    return;
  }
  console.log("policy check: ok");
}

main();
