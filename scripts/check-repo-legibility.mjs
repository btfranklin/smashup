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
  "docs/references/performance-validation.md",
  "docs/exec-plans/tech-debt-tracker.md",
  "scripts/check-test-coverage.mjs",
  "playwright.config.ts",
  "playwright.performance.config.ts",
  "vite.browser.config.ts",
  "vite.performance.config.ts",
  "src/app/bootstrap.ts",
  "src/app/loop.ts",
  "src/app/menu.ts",
  "src/app/performance.ts",
  "src/vite-env.d.ts",
  "src/game/arena.ts",
  "src/game/content.ts",
  "src/game/career.ts",
  "src/game/awards.ts",
  "src/game/events.ts",
  "src/game/roundStats.ts",
  "src/game/roster.ts",
  "src/game/upgrades.ts",
  "src/game/session.ts",
  "src/game/runtime.ts",
  "src/game/debug.ts",
  "src/game/preview.ts",
  "src/game/render.ts",
  "src/game/render/arena.ts",
  "src/game/render/car.ts",
  "src/game/render/effects.ts",
  "src/game/render/overlays.ts",
  "vitest.config.ts",
  "tests/arena.spec.ts",
  "tests/events.spec.ts",
  "tests/round-stats.spec.ts",
  "tests/roster.spec.ts",
  "tests/upgrades.spec.ts",
  "tests/audio-transitions.spec.ts",
  "tests/awards.spec.ts",
  "tests/bootstrap.spec.ts",
  "tests/loop.spec.ts",
  "tests/menu.spec.ts",
  "tests/career.spec.ts",
  "tests/career-lifecycle.spec.ts",
  "tests/content.spec.ts",
  "tests/performance.spec.ts",
  "tests/render.spec.ts",
  "tests/render-game-to-text.spec.ts",
  "tests/helpers/fixtures.ts",
  "tests/helpers/canvas-recorder.ts",
  "tests/helpers/audio-stubs.ts",
  "tests/helpers/dom-harness.ts",
  "tests/helpers/payload-assertions.ts",
  "tests/browser/app-flow.spec.ts",
  "tests/browser/audio-lifecycle.spec.ts",
  "tests/browser/canvas-lifecycle.spec.ts",
  "tests/browser/career-finale.spec.ts",
  "tests/browser/performance.spec.ts",
  "tests/browser/controller-fixture.html",
  "tests/browser/controller-fixture.ts",
  "tests/browser/fixtures.ts",
].forEach((file) =>
  requireFile(
    file,
    "Add the missing repo map or validation artifact so a future agent run can discover it in-repo.",
  ),
);

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
    "docs/references/performance-validation.md",
    "docs/exec-plans/tech-debt-tracker.md",
    "LICENSE",
    "src/game/career.ts",
    "src/game/arena.ts",
    "src/game/awards.ts",
    "src/app/loop.ts",
    "src/app/menu.ts",
    "src/app/performance.ts",
    "src/game/render/",
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
    "./references/performance-validation.md",
    "./LEGIBILITY-AUDIT.md",
    "../LICENSE",
    "./exec-plans/tech-debt-tracker.md",
    "src/game/career.ts",
    "src/game/arena.ts",
    "src/game/awards.ts",
    "src/app/loop.ts",
    "src/app/menu.ts",
    "src/app/performance.ts",
    "src/game/render/",
  ],
  "docs/README.md must index the deeper docs and future-work artifacts.",
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
  "docs/QUALITY.md",
  [
    "## Architectural Guardrails",
    "npm run validate",
    "src/game/content.ts",
    "src/game/career.ts",
    "window.advanceTime(ms)",
    "window.render_game_to_text()",
    "tests/career-lifecycle.spec.ts",
    "npm run test:performance",
  ],
  "docs/QUALITY.md must preserve the executable architectural guardrails for content ids, split gameplay modules, and browser hooks.",
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
  [
    "pull_request:",
    "npm ci",
    "npx playwright install --with-deps chromium",
    "npm run validate",
  ],
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
if (!scripts.typecheck) {
  failures.push(
    'package.json: add a "typecheck" script that runs TypeScript without emitting files.',
  );
}
if (
  typeof scripts.validate !== "string" ||
  !scripts.validate.includes("npm run check:repo") ||
  !scripts.validate.includes("npm run typecheck") ||
  !scripts.validate.includes("npm run build") ||
  !scripts.validate.includes("npm run test:coverage") ||
  !scripts.validate.includes("npm run test:browser")
) {
  failures.push(
    'package.json: "validate" must run repo legibility checks, typecheck, the production build, Vitest coverage, and the real-browser suite.',
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

if (
  typeof scripts["build:browser"] !== "string" ||
  !scripts["build:browser"].includes("vite.browser.config.ts")
) {
  failures.push(
    'package.json: "build:browser" must create the ordinary production browser-test bundle with vite.browser.config.ts.',
  );
}
if (
  typeof scripts["test:browser"] !== "string" ||
  !scripts["test:browser"].includes("--grep-invert @performance")
) {
  failures.push(
    'package.json: "test:browser" must run the ordinary Chromium suite while excluding the hardware-sensitive @performance smoke.',
  );
}
if (
  typeof scripts["test:performance"] !== "string" ||
  !scripts["test:performance"].includes("playwright.performance.config.ts")
) {
  failures.push(
    'package.json: "test:performance" must use the isolated single-worker Playwright performance configuration.',
  );
}
if (
  typeof scripts["build:performance"] !== "string" ||
  !scripts["build:performance"].includes("vite.performance.config.ts")
) {
  failures.push(
    'package.json: "build:performance" must use the dedicated Vite configuration for the ignored multi-page fixture bundle.',
  );
}

const devDependencies = packageJson.devDependencies ?? {};
if (!devDependencies["@playwright/test"]) {
  failures.push(
    "package.json: add @playwright/test as a devDependency for the supported Chromium integration suite.",
  );
}
for (const dependency of [
  "@types/node",
  "vitest",
  "jsdom",
  "@vitest/coverage-v8",
]) {
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
  "Repo legibility check passed: public entrypoints, docs map, TypeScript/Vitest/Chromium validation scripts, and ignored artifact hygiene are in place.",
);
