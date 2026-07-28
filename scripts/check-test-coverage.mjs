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

const explicitCoverageExclusions = {
  "src/main.ts": "Thin browser entrypoint; bootstrap behavior is covered through src/app/bootstrap.ts.",
  "src/game/types.ts": "Type-only declarations emit no runtime behavior.",
  "src/vite-env.d.ts": "Vite ambient declarations emit no runtime behavior.",
};

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
  "src/app/loop.ts": {
    lines: 90,
    statements: 90,
    functions: 90,
    branches: 80,
  },
  "src/app/menu.ts": {
    lines: 90,
    statements: 90,
    functions: 100,
    branches: 75,
  },
  "src/app/performance.ts": {
    lines: 95,
    statements: 95,
    functions: 93,
    branches: 89,
  },
  "src/game/ai.ts": {
    lines: 95,
    statements: 95,
    functions: 100,
    branches: 85,
  },
  "src/game/arena.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
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
  "src/game/awards.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  "src/game/career.ts": {
    lines: 96,
    statements: 96,
    functions: 96,
    branches: 70,
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
  "src/game/deformation.ts": {
    lines: 98,
    statements: 98,
    functions: 100,
    branches: 90,
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
  "src/game/events.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  "src/game/fragments.ts": {
    lines: 89,
    statements: 89,
    functions: 100,
    branches: 80,
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
  "src/game/render/arena.ts": {
    lines: 85,
    statements: 85,
    functions: 100,
    branches: 70,
  },
  "src/game/render/car.ts": {
    lines: 93,
    statements: 93,
    functions: 100,
    branches: 90,
  },
  "src/game/render/effects.ts": {
    lines: 90,
    statements: 90,
    functions: 100,
    branches: 80,
  },
  "src/game/render/overlays.ts": {
    lines: 90,
    statements: 90,
    functions: 100,
    branches: 75,
  },
  "src/game/roster.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  "src/game/roundStats.ts": {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
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
  "src/game/upgrades.ts": {
    lines: 97,
    statements: 97,
    functions: 100,
    branches: 80,
  },
};

function listTypeScriptFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(path.relative(root, absolutePath).split(path.sep).join("/"));
    }
  }
  return files;
}

for (const relativePath of listTypeScriptFiles(path.join(root, "src"))) {
  if (
    !(relativePath in fileThresholds) &&
    !(relativePath in explicitCoverageExclusions)
  ) {
    failures.push(
      `${relativePath}: add calibrated per-file coverage thresholds or an explicit exclusion with a durable reason.`,
    );
  }
}

for (const [relativePath, reason] of Object.entries(
  explicitCoverageExclusions,
)) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(
      `${relativePath}: remove the stale coverage exclusion or restore the documented source file.`,
    );
  }
  if (!reason.trim()) {
    failures.push(`${relativePath}: coverage exclusion reason must not be empty.`);
  }
}

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
