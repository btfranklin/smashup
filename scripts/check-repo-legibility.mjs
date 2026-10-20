import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const failures = [];

function repoPath(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(repoPath(relativePath), "utf8");
}

function requireFile(relativePath, purpose) {
  if (!fs.existsSync(repoPath(relativePath))) {
    failures.push(`${relativePath}: missing ${purpose}.`);
  }
}

const rootEntrypoints = {
  "README.md": "public project entrypoint",
  "LICENSE": "public license",
  "AGENTS.md": "agent task-routing entrypoint",
  "docs/README.md": "durable documentation index",
  "package.json": "package and command manifest",
};

for (const [relativePath, purpose] of Object.entries(rootEntrypoints)) {
  requireFile(relativePath, purpose);
}

function listMarkdownFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(absolutePath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(absolutePath);
    }
  }
  return files;
}

function validateLocalMarkdownLinks(absolutePath) {
  const content = fs.readFileSync(absolutePath, "utf8");
  const sourcePath = path.relative(root, absolutePath);
  const linkPattern = /!?\[[^\]]*]\(([^)]+)\)/g;

  for (const match of content.matchAll(linkPattern)) {
    const rawTarget = match[1].trim().replace(/^<|>$/g, "");
    const targetWithoutTitle = rawTarget.split(/\s+["'][^"']*["']$/)[0];
    if (
      targetWithoutTitle.startsWith("#") ||
      /^[a-z][a-z\d+.-]*:/i.test(targetWithoutTitle)
    ) {
      continue;
    }

    const linkPath = decodeURIComponent(targetWithoutTitle.split(/[?#]/, 1)[0]);
    if (!linkPath) {
      continue;
    }

    const resolvedPath = linkPath.startsWith("/")
      ? path.join(root, linkPath)
      : path.resolve(path.dirname(absolutePath), linkPath);
    const relativeTarget = path.relative(root, resolvedPath);
    if (
      relativeTarget.startsWith(`..${path.sep}`) ||
      relativeTarget === ".."
    ) {
      failures.push(
        `${sourcePath}: local link "${rawTarget}" resolves outside the repository.`,
      );
    } else if (!fs.existsSync(resolvedPath)) {
      failures.push(
        `${sourcePath}: local link "${rawTarget}" does not resolve to a repository file.`,
      );
    }
  }
}

for (const absolutePath of [
  repoPath("README.md"),
  repoPath("AGENTS.md"),
  ...listMarkdownFiles(repoPath("docs")),
]) {
  if (fs.existsSync(absolutePath)) {
    validateLocalMarkdownLinks(absolutePath);
  }
}

const packageJson = JSON.parse(read("package.json"));
const scripts = packageJson.scripts ?? {};
const requiredScripts = [
  "dev",
  "build",
  "check:repo",
  "check:docs",
  "typecheck",
  "test:unit",
  "test:coverage",
  "build:browser",
  "test:browser",
  "build:performance",
  "test:performance",
  "validate",
];

for (const scriptName of requiredScripts) {
  if (
    typeof scripts[scriptName] !== "string" ||
    scripts[scriptName].trim() === ""
  ) {
    failures.push(
      `package.json: add a non-empty "${scriptName}" script for the documented validation workflow.`,
    );
  }
}

if (
  typeof scripts["check:repo"] === "string" &&
  !scripts["check:repo"].includes("scripts/check-repo-legibility.mjs")
) {
  failures.push(
    'package.json: "check:repo" must run scripts/check-repo-legibility.mjs.',
  );
}
if (
  typeof scripts["test:coverage"] === "string" &&
  !scripts["test:coverage"].includes("scripts/check-test-coverage.mjs")
) {
  failures.push(
    'package.json: "test:coverage" must run scripts/check-test-coverage.mjs after Vitest coverage.',
  );
}

const validationCommands = [
  "npm run check:repo",
  "npm run check:docs",
  "npm run typecheck",
  "npm run build",
  "npm run test:coverage",
  "npm run test:browser",
];
for (const command of validationCommands) {
  if (
    typeof scripts.validate === "string" &&
    !scripts.validate.includes(command)
  ) {
    failures.push(
      `package.json: "validate" must include "${command}" in the authoritative validation chain.`,
    );
  }
}

if (packageJson.license !== "MIT") {
  failures.push(
    'package.json: set "license" to "MIT" so package metadata matches LICENSE.',
  );
}
if (
  fs.existsSync(repoPath("LICENSE")) &&
  !read("LICENSE").startsWith("MIT License")
) {
  failures.push(
    'LICENSE: its declared license must match package.json "license": "MIT".',
  );
}

for (const artifactDirectory of ["dist", "coverage", "output"]) {
  const ignored = spawnSync(
    "git",
    ["check-ignore", "--quiet", "--no-index", artifactDirectory],
    { cwd: root },
  );
  if (ignored.status !== 0) {
    failures.push(
      `.gitignore: generated artifact directory "${artifactDirectory}/" must be ignored.`,
    );
  }
}

const workflowPath = ".github/workflows/validate.yml";
requireFile(workflowPath, "CI validation workflow");
if (
  fs.existsSync(repoPath(workflowPath)) &&
  !/^\s*run:\s*npm run validate\s*$/m.test(read(workflowPath))
) {
  failures.push(
    `${workflowPath}: CI must invoke the same "npm run validate" command used locally.`,
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
  "Repo legibility check passed: entrypoints, local documentation links, package scripts, license metadata, ignored artifacts, and CI wiring are coherent.",
);
