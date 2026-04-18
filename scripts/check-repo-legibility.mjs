import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function repoPath(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(repoPath(relativePath), "utf8");
}

function requireFile(relativePath, remediation) {
  if (!fs.existsSync(repoPath(relativePath))) {
    failures.push(`${relativePath}: ${remediation}`);
  }
}

function requireContains(relativePath, fragments, remediation) {
  if (!fs.existsSync(repoPath(relativePath))) {
    failures.push(`${relativePath}: ${remediation}`);
    return;
  }
  const content = read(relativePath);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) {
      failures.push(`${relativePath}: missing "${fragment}". ${remediation}`);
    }
  }
}

[
  "AGENTS.md",
  "docs/README.md",
  "docs/ARCHITECTURE.md",
  "docs/OPERATIONS.md",
  "docs/QUALITY.md",
  "docs/LEGIBILITY-AUDIT.md",
  "docs/references/validation-surfaces.md",
  "docs/exec-plans/tech-debt-tracker.md",
  "src/game/session.ts",
  "src/game/runtime.ts",
  "src/game/debug.ts",
  "src/game/preview.ts",
  "tests/game-smoke.spec.ts",
  "tests/audio-transitions.spec.ts",
].forEach((file) =>
  requireFile(
    file,
    "Add the missing repo map or validation artifact so a future agent run can discover it in-repo.",
  ),
);

if (fs.existsSync(repoPath("src/game/game.ts"))) {
  failures.push(
    "src/game/game.ts: legacy catch-all file should not exist. Extend session/runtime/debug modules instead of recreating the old god module.",
  );
}

requireContains(
  "AGENTS.md",
  [
    "docs/README.md",
    "docs/ARCHITECTURE.md",
    "docs/OPERATIONS.md",
    "docs/QUALITY.md",
    "docs/references/validation-surfaces.md",
  ],
  "AGENTS.md should stay a short map that routes the agent to deeper sources of truth.",
);

requireContains(
  "docs/README.md",
  [
    "./ARCHITECTURE.md",
    "./OPERATIONS.md",
    "./QUALITY.md",
    "./references/validation-surfaces.md",
    "./exec-plans/tech-debt-tracker.md",
    "../ROADMAP.md",
    "../progress.md",
  ],
  "docs/README.md must index the deeper docs and existing planning memory.",
);

requireContains(
  "src/game/preview.ts",
  ["CAR_PRESET_IDS", "CAR_PREVIEW_SCENARIO_IDS"],
  "Preview parsing must derive ids from src/game/content.ts instead of hardcoding duplicate allowlists.",
);

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts ?? {};
if (!scripts["check:repo"]) {
  failures.push(
    'package.json: add a "check:repo" script that runs scripts/check-repo-legibility.mjs.',
  );
}
if (!scripts["test:e2e"]) {
  failures.push(
    'package.json: add a "test:e2e" script so browser validation is executable rather than ad hoc.',
  );
}
if (
  typeof scripts.validate !== "string" ||
  !scripts.validate.includes("npm run check:repo") ||
  !scripts.validate.includes("npm run test:e2e")
) {
  failures.push(
    'package.json: "validate" must run repo legibility checks and Playwright smoke coverage.',
  );
}

if (failures.length > 0) {
  console.error("Repo legibility check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Repo legibility check passed: docs map, validation scripts, and runtime module layout are in place.",
);
