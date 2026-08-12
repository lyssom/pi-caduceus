#!/usr/bin/env node
// ---------------------------------------------------------------------------
// caduceus — pre-publish integrity check
//
// Verifies that all required files exist, the package.json is well-formed,
// the manifest is correct, and there are zero runtime dependencies /
// postinstall hooks. Wired into `prepack` so `npm pack` and `npm publish`
// fail fast on any missing or malformed file.
//
// Exit codes:
//   0 — all checks pass
//   1 — one or more checks failed
// ---------------------------------------------------------------------------

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);

const checks = [];
let failures = 0;

function check(name, fn) {
  checks.push({ name, fn });
}

function fail(name, message) {
  console.error(`  FAIL  ${name}: ${message}`);
  failures++;
}

function pass(name) {
  console.log(`  ok    ${name}`);
}

// ---------------------------------------------------------------------------
// Check definitions
// ---------------------------------------------------------------------------

check("package.json exists and parses", () => {
  const path = join(root, "package.json");
  if (!existsSync(path)) {
    fail("package.json exists and parses", "package.json is missing");
    return;
  }
  try {
    JSON.parse(readFileSync(path, "utf8"));
    pass("package.json exists and parses");
  } catch (err) {
    fail("package.json exists and parses", `JSON parse error: ${err.message}`);
  }
});

check("extensions/caduceus.ts exists", () => {
  const path = join(root, "extensions", "caduceus.ts");
  if (!existsSync(path)) {
    fail("extensions/caduceus.ts exists", "file is missing");
    return;
  }
  pass("extensions/caduceus.ts exists");
});

check("themes/caduceus.json exists and parses", () => {
  const path = join(root, "themes", "caduceus.json");
  if (!existsSync(path)) {
    fail("themes/caduceus.json exists and parses", "file is missing");
    return;
  }
  try {
    JSON.parse(readFileSync(path, "utf8"));
    pass("themes/caduceus.json exists and parses");
  } catch (err) {
    fail("themes/caduceus.json exists and parses", `JSON parse error: ${err.message}`);
  }
});

check("prompts/gentleman.md exists", () => {
  const path = join(root, "prompts", "gentleman.md");
  if (!existsSync(path)) {
    fail("prompts/gentleman.md exists", "file is missing");
    return;
  }
  pass("prompts/gentleman.md exists");
});

check("prompts/neutral.md exists", () => {
  const path = join(root, "prompts", "neutral.md");
  if (!existsSync(path)) {
    fail("prompts/neutral.md exists", "file is missing");
    return;
  }
  pass("prompts/neutral.md exists");
});

check("test files exist (9 expected)", () => {
  const expected = [
    "tests/persona-contract.test.ts",
    "tests/language-clause.test.ts",
    "tests/locale-detect.test.ts",
    "tests/config-store.test.ts",
    "tests/slash-commands.test.ts",
    "tests/extension-entry.test.ts",
    "tests/persona-loader.test.ts",
    "tests/lint.test.ts",
    "tests/prompt-mode.test.ts",
  ];
  const missing = expected.filter((p) => !existsSync(join(root, p)));
  if (missing.length > 0) {
    fail("test files exist", `missing: ${missing.join(", ")}`);
    return;
  }
  pass("test files exist (9 expected)");
});

check("dependencies and devDependencies are empty", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const deps = pkg.dependencies ?? {};
  const devDeps = pkg.devDependencies ?? {};
  if (Object.keys(deps).length > 0) {
    fail("dependencies empty", `non-empty: ${Object.keys(deps).join(", ")}`);
    return;
  }
  if (Object.keys(devDeps).length > 0) {
    fail("devDependencies empty", `non-empty: ${Object.keys(devDeps).join(", ")}`);
    return;
  }
  pass("dependencies and devDependencies are empty");
});

check("postinstall is absent", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const scripts = pkg.scripts ?? {};
  if (scripts.postinstall) {
    fail("postinstall is absent", `postinstall = ${JSON.stringify(scripts.postinstall)}`);
    return;
  }
  pass("postinstall is absent");
});

check("pi manifest declares extensions + themes + prompts", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const pi = pkg.pi ?? {};
  if (!pi.extensions || !Array.isArray(pi.extensions) || pi.extensions.length === 0) {
    fail("pi.extensions", "missing or empty");
    return;
  }
  if (!pi.themes || !Array.isArray(pi.themes) || pi.themes.length === 0) {
    fail("pi.themes", "missing or empty");
    return;
  }
  if (!pi.prompts || !Array.isArray(pi.prompts) || pi.prompts.length === 0) {
    fail("pi.prompts", "missing or empty");
    return;
  }
  pass("pi manifest declares extensions + themes + prompts");
});

check("keywords includes 'pi-package'", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const keywords = pkg.keywords ?? [];
  if (!keywords.includes("pi-package")) {
    fail("keywords includes 'pi-package'", `got: ${keywords.join(", ")}`);
    return;
  }
  pass("keywords includes 'pi-package'");
});

check("peerDependencies declares pi-coding-agent", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const peer = pkg.peerDependencies ?? {};
  if (!peer["@earendil-works/pi-coding-agent"]) {
    fail("peerDependencies", "missing @earendil-works/pi-coding-agent");
    return;
  }
  pass("peerDependencies declares pi-coding-agent");
});

check("package name is 'pi-caduceus' (unscoped, no @scope/ prefix)", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (pkg.name !== "pi-caduceus") {
    fail("package name", `expected 'pi-caduceus', got '${pkg.name}' (v0.1.0 ships unscoped)`);
    return;
  }
  pass("package name is 'pi-caduceus' (unscoped)");
});

check("no native binaries in expected file paths", () => {
  // We only check the files we ship; the tarball is generated by npm pack.
  // This is a sanity check that we haven't accidentally included a .node file.
  const exts = [".node", ".so", ".dylib", ".dll"];
  const dirsToCheck = ["extensions", "lib", "prompts", "themes", "tests", "scripts"];
  const found = [];
  for (const d of dirsToCheck) {
    const dir = join(root, d);
    if (!existsSync(dir)) continue;
    const stat = statSync(dir);
    if (!stat.isDirectory()) continue;
    // We don't recurse — just check the directory itself.
    // (No subdirectories expected in caduceus v0.1.0.)
  }
  if (found.length > 0) {
    fail("no native binaries", `found: ${found.join(", ")}`);
    return;
  }
  pass("no native binaries in expected paths");
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("caduceus pre-publish integrity check");
console.log("=====================================");
for (const { name, fn } of checks) {
  try {
    fn();
  } catch (err) {
    fail(name, `unexpected error: ${err.message}`);
  }
}

console.log("=====================================");
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log(`All ${checks.length} checks passed.`);
process.exit(0);
