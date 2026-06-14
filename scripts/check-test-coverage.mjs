import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const summaryPath = path.join(root, "coverage", "coverage-summary.json");

if (!fs.existsSync(summaryPath)) {
  console.error(
    "Coverage check failed: coverage/coverage-summary.json is missing. Run Vitest with --coverage first.",
  );
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const failures = [];

// Overall coverage keeps the full repo honest while allowing a few imperative
// browser/runtime branches to remain below the pure-rule module floors.
const overallThresholds = {
  lines: 93,
  statements: 93,
  functions: 95,
  branches: 80,
};

for (const [metric, threshold] of Object.entries(overallThresholds)) {
  const actual = summary.total?.[metric]?.pct;
  if (typeof actual !== "number" || actual < threshold) {
    failures.push(
      `total ${metric}: expected at least ${threshold}%, got ${actual ?? "missing"}%`,
    );
  }
}

// File thresholds are calibrated by surface: content/contracts and small rule
// helpers stay near-complete, while bootstrap/runtime/rendering get explicit
// floors that fit their browser and drawing branches.
const fileThresholds = {
  "src/app/bootstrap.ts": {
    lines: 80,
    statements: 80,
    functions: 90,
    branches: 60,
  },
  "src/game/ai.ts": {
    lines: 95,
    statements: 95,
    functions: 100,
    branches: 85,
  },
  "src/game/audio.ts": {
    lines: 97,
    statements: 97,
    functions: 100,
    branches: 75,
  },
  "src/game/audioTransitions.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  "src/game/conditions.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  "src/game/content.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  "src/game/damage.ts": {
    lines: 93,
    statements: 93,
    functions: 100,
    branches: 82,
  },
  "src/game/debris.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  "src/game/debug.ts": {
    lines: 88,
    statements: 88,
    functions: 80,
    branches: 80,
  },
  "src/game/dust.ts": {
    lines: 96,
    statements: 96,
    functions: 100,
    branches: 90,
  },
  "src/game/math.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  "src/game/physics.ts": {
    lines: 96,
    statements: 96,
    functions: 100,
    branches: 86,
  },
  "src/game/preview.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  "src/game/render.ts": {
    lines: 93,
    statements: 93,
    functions: 100,
    branches: 90,
  },
  "src/game/runtime.ts": {
    lines: 90,
    statements: 90,
    functions: 85,
    branches: 74,
  },
  "src/game/selectors.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  "src/game/session.ts": {
    lines: 98,
    statements: 98,
    functions: 100,
    branches: 89,
  },
  "src/game/smoke.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
};

for (const [relativePath, thresholds] of Object.entries(fileThresholds)) {
  const absolutePath = path.join(root, relativePath);
  const metrics = summary[absolutePath];
  if (!metrics) {
    failures.push(`${relativePath}: coverage entry missing from summary output.`);
    continue;
  }
  for (const [metric, threshold] of Object.entries(thresholds)) {
    const actual = metrics?.[metric]?.pct;
    if (typeof actual !== "number" || actual < threshold) {
      failures.push(
        `${relativePath} ${metric}: expected at least ${threshold}%, got ${actual ?? "missing"}%`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Coverage check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  "Coverage check passed: overall and per-surface thresholds are in range.",
);
