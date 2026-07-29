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
  "src/main.ts":
    "Thin browser entrypoint; bootstrap behavior is covered through src/app/bootstrap.ts.",
  "src/game/types.ts": "Type-only declarations emit no runtime behavior.",
  "src/vite-env.d.ts": "Vite ambient declarations emit no runtime behavior.",
};

const overallThresholds = {
  lines: 93,
  statements: 93,
  functions: 95,
  branches: 80,
};

const coverageProfiles = {
  strict: {
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100,
  },
  gameplay: {
    lines: 95,
    statements: 95,
    functions: 100,
    branches: 85,
  },
  rendering: {
    lines: 90,
    statements: 90,
    functions: 100,
    branches: 80,
  },
  orchestration: {
    lines: 90,
    statements: 90,
    functions: 90,
    branches: 80,
  },
  "browser-composition": {
    lines: 80,
    statements: 80,
    functions: 90,
    branches: 60,
  },
};

const fileProfiles = {
  "src/app/bootstrap.ts": "browser-composition",
  "src/app/loop.ts": "orchestration",
  "src/app/menu.ts": "orchestration",
  "src/app/performance.ts": "orchestration",
  "src/game/ai.ts": "gameplay",
  "src/game/arena.ts": "strict",
  "src/game/audio.ts": "gameplay",
  "src/game/audioTransitions.ts": "strict",
  "src/game/awards.ts": "strict",
  "src/game/career.ts": "gameplay",
  "src/game/conditions.ts": "strict",
  "src/game/content.ts": "strict",
  "src/game/contentIds.ts": "strict",
  "src/game/damage.ts": "gameplay",
  "src/game/debris.ts": "strict",
  "src/game/debug.ts": "orchestration",
  "src/game/deformation.ts": "gameplay",
  "src/game/dust.ts": "gameplay",
  "src/game/events.ts": "strict",
  "src/game/fragments.ts": "rendering",
  "src/game/math.ts": "strict",
  "src/game/physics.ts": "gameplay",
  "src/game/preview.ts": "strict",
  "src/game/render.ts": "rendering",
  "src/game/render/arena.ts": "rendering",
  "src/game/render/car.ts": "rendering",
  "src/game/render/effects.ts": "rendering",
  "src/game/render/overlays.ts": "rendering",
  "src/game/roster.ts": "strict",
  "src/game/roundStats.ts": "strict",
  "src/game/runtime.ts": "orchestration",
  "src/game/selectors.ts": "strict",
  "src/game/session.ts": "gameplay",
  "src/game/smoke.ts": "strict",
  "src/game/upgrades.ts": "gameplay",
};

// Overrides record only the ways a source surface intentionally differs from
// its profile. Together with the profiles, these preserve the prior effective
// per-file floors exactly.
const thresholdOverrides = {
  "src/app/menu.ts": { functions: 100, branches: 75 },
  "src/app/performance.ts": {
    lines: 95,
    statements: 95,
    functions: 93,
    branches: 89,
  },
  "src/game/audio.ts": { lines: 97, statements: 97, branches: 75 },
  "src/game/career.ts": {
    lines: 96,
    statements: 96,
    functions: 96,
    branches: 70,
  },
  "src/game/damage.ts": { lines: 93, statements: 93, branches: 82 },
  "src/game/debug.ts": {
    lines: 88,
    statements: 88,
    functions: 80,
  },
  "src/game/deformation.ts": {
    lines: 98,
    statements: 98,
    branches: 90,
  },
  "src/game/dust.ts": { lines: 96, statements: 96, branches: 90 },
  "src/game/fragments.ts": { lines: 89, statements: 89 },
  "src/game/physics.ts": { lines: 96, statements: 96, branches: 86 },
  "src/game/render.ts": {
    lines: 93,
    statements: 93,
    branches: 90,
  },
  "src/game/render/arena.ts": {
    lines: 85,
    statements: 85,
    branches: 70,
  },
  "src/game/render/car.ts": {
    lines: 93,
    statements: 93,
    branches: 90,
  },
  "src/game/render/overlays.ts": { branches: 75 },
  "src/game/runtime.ts": { functions: 85, branches: 74 },
  "src/game/session.ts": {
    lines: 98,
    statements: 98,
    functions: 100,
    branches: 89,
  },
  "src/game/upgrades.ts": {
    lines: 97,
    statements: 97,
    branches: 80,
  },
};

for (const [metric, threshold] of Object.entries(overallThresholds)) {
  const actual = summary.total?.[metric]?.pct;
  if (typeof actual !== "number" || actual < threshold) {
    failures.push(
      `total ${metric}: expected at least ${threshold}%, got ${actual ?? "missing"}%`,
    );
  }
}

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
    !(relativePath in fileProfiles) &&
    !(relativePath in explicitCoverageExclusions)
  ) {
    failures.push(
      `${relativePath}: assign a named coverage profile or add an explicit exclusion with a durable reason.`,
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

for (const [relativePath, profileName] of Object.entries(fileProfiles)) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(
      `${relativePath}: remove the stale coverage profile assignment or restore the source file.`,
    );
    continue;
  }

  const profile = coverageProfiles[profileName];
  if (!profile) {
    failures.push(
      `${relativePath}: coverage profile "${profileName}" is not defined.`,
    );
    continue;
  }

  const metrics = summary[absolutePath];
  if (!metrics) {
    failures.push(`${relativePath}: coverage entry missing from summary output.`);
    continue;
  }

  const thresholds = {
    ...profile,
    ...thresholdOverrides[relativePath],
  };
  for (const [metric, threshold] of Object.entries(thresholds)) {
    const actual = metrics?.[metric]?.pct;
    if (typeof actual !== "number" || actual < threshold) {
      failures.push(
        `${relativePath} ${metric}: expected at least ${threshold}%, got ${actual ?? "missing"}%`,
      );
    }
  }
}

for (const relativePath of Object.keys(thresholdOverrides)) {
  if (!(relativePath in fileProfiles)) {
    failures.push(
      `${relativePath}: threshold override has no coverage profile assignment.`,
    );
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
  "Coverage check passed: overall thresholds and named per-surface profiles are in range.",
);
