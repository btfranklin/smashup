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
  "README.md",
  "LICENSE",
  "AGENTS.md",
  ".github/workflows/validate.yml",
  "docs/README.md",
  "docs/ARCHITECTURE.md",
  "docs/OPERATIONS.md",
  "docs/QUALITY.md",
  "docs/LEGIBILITY-AUDIT.md",
  "docs/references/validation-surfaces.md",
  "docs/references/gameplay-tuning.md",
  "docs/exec-plans/tech-debt-tracker.md",
  "scripts/check-test-coverage.mjs",
  "src/app/bootstrap.ts",
  "src/game/session.ts",
  "src/game/runtime.ts",
  "src/game/debug.ts",
  "src/game/preview.ts",
  "vitest.config.ts",
  "tests/audio-transitions.spec.ts",
  "tests/bootstrap.spec.ts",
  "tests/render-game-to-text.spec.ts",
  "tests/helpers/fixtures.ts",
  "tests/helpers/canvas-recorder.ts",
  "tests/helpers/audio-stubs.ts",
  "tests/helpers/dom-harness.ts",
  "tests/helpers/payload-assertions.ts",
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

if (fs.existsSync(repoPath("playwright.config.ts"))) {
  failures.push(
    "playwright.config.ts: Playwright should not remain in the supported validation path after the Vitest migration.",
  );
}

requireContains(
  "AGENTS.md",
  [
    "README.md",
    "docs/README.md",
    "docs/ARCHITECTURE.md",
    "docs/OPERATIONS.md",
    "docs/QUALITY.md",
    "docs/references/validation-surfaces.md",
    "docs/references/gameplay-tuning.md",
    "LICENSE",
  ],
  "AGENTS.md should stay a short map that routes the agent to deeper sources of truth.",
);

requireContains(
  "docs/README.md",
  [
    "../README.md",
    "./ARCHITECTURE.md",
    "./OPERATIONS.md",
    "./QUALITY.md",
    "./references/validation-surfaces.md",
    "./references/gameplay-tuning.md",
    "./LEGIBILITY-AUDIT.md",
    "../LICENSE",
    "./exec-plans/tech-debt-tracker.md",
    "../ROADMAP.md",
    "../progress.md",
  ],
  "docs/README.md must index the deeper docs and existing planning memory.",
);

requireContains(
  "README.md",
  [
    "## Quick Start",
    "## Controls",
    "## Development",
    "## Project Layout",
    "## Automation Surfaces",
    "## License",
  ],
  "README.md should remain the public front door with setup, controls, validation, automation surfaces, and license guidance.",
);

requireContains(
  "LICENSE",
  ["MIT License", "Copyright (c) 2026 B.T. Franklin"],
  "LICENSE should preserve the public MIT license terms used by this project.",
);

requireContains(
  ".gitignore",
  [
    "# OS metadata",
    ".DS_Store",
    "# Node / tooling",
    "node_modules/",
    "# Build / coverage outputs",
    "dist/",
    "coverage/",
    "# Local inspection captures",
    "output/",
    "# Local env files",
    ".env.*",
  ],
  ".gitignore should keep local cruft, generated artifacts, inspection captures, and env files out of the repo.",
);

requireContains(
  "src/game/preview.ts",
  ["CAR_PRESET_IDS", "CAR_PREVIEW_SCENARIO_IDS"],
  "Preview parsing must derive ids from src/game/content.ts instead of hardcoding duplicate allowlists.",
);

requireContains(
  ".github/workflows/validate.yml",
  ["pull_request:", "npm ci", "npm run validate"],
  "CI should run the same install and validation path documented for local development.",
);

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts ?? {};
if (packageJson.license !== "MIT") {
  failures.push(
    'package.json: set "license" to "MIT" so package metadata matches LICENSE.',
  );
}
if (!scripts["check:repo"]) {
  failures.push(
    'package.json: add a "check:repo" script that runs scripts/check-repo-legibility.mjs.',
  );
}
if (!scripts.test) {
  failures.push(
    'package.json: add a "test" script that runs the Vitest suite.',
  );
}
if (!scripts["test:unit"]) {
  failures.push(
    'package.json: add a "test:unit" script so fast validation is executable rather than ad hoc.',
  );
}
if (!scripts["test:coverage"]) {
  failures.push(
    'package.json: add a "test:coverage" script so coverage-gated validation is executable rather than ad hoc.',
  );
}
if (
  typeof scripts.validate !== "string" ||
  !scripts.validate.includes("npm run check:repo") ||
  !scripts.validate.includes("npm run build") ||
  !scripts.validate.includes("npm run test:coverage")
) {
  failures.push(
    'package.json: "validate" must run repo legibility checks, the production build, and the Vitest coverage suite.',
  );
}
if (
  typeof scripts["test:coverage"] !== "string" ||
  !scripts["test:coverage"].includes("scripts/check-test-coverage.mjs")
) {
  failures.push(
    'package.json: "test:coverage" must run the calibrated per-surface coverage check after Vitest.',
  );
}

const devDependencies = packageJson.devDependencies ?? {};
if (devDependencies["@playwright/test"] || devDependencies.playwright) {
  failures.push(
    "package.json: remove Playwright devDependencies from the supported validation workflow.",
  );
}
for (const dependency of ["vitest", "jsdom", "@vitest/coverage-v8"]) {
  if (!devDependencies[dependency]) {
    failures.push(
      `package.json: add ${dependency} as a devDependency for the fast validation suite.`,
    );
  }
}

if (failures.length > 0) {
  console.error("Repo legibility check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Repo legibility check passed: public entrypoints, docs map, Vitest validation scripts, ignored artifact hygiene, and runtime module layout are in place.",
);
