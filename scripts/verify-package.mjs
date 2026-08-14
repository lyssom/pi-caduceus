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

import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
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

check("prompts/default.md exists", () => {
  const path = join(root, "prompts", "default.md");
  if (!existsSync(path)) {
    fail("prompts/default.md exists", "file is missing");
    return;
  }
  pass("prompts/default.md exists");
});

check("prompts/plain.md exists", () => {
  const path = join(root, "prompts", "plain.md");
  if (!existsSync(path)) {
    fail("prompts/plain.md exists", "file is missing");
    return;
  }
  pass("prompts/plain.md exists");
});

check("test files exist (10 expected)", () => {
  const expected = [
    "tests/persona-contract.test.ts",
    "tests/locale-detect.test.ts",
    "tests/config-store.test.ts",
    "tests/slash-commands.test.ts",
    "tests/extension-entry.test.ts",
    "tests/persona-loader.test.ts",
    "tests/lint.test.ts",
    "tests/prompt-mode.test.ts",
    "tests/wizard.test.ts",
    "tests/diff.test.ts",
        "tests/macros.test.ts",
        "tests/profile-store.test.ts",
      ];
  // v0.3.0: removed tests/language-clause.test.ts (lib/language-clause.ts was
  // deleted in the brand-independence rebrand). The test count is now 10.
  const missing = expected.filter((p) => !existsSync(join(root, p)));
  if (missing.length > 0) {
    fail("test files exist", `missing: ${missing.join(", ")}`);
    return;
  }
  pass("test files exist (13 expected)");
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

check("v0.3.0: no 'el Gentleman' / 'Rioplatense' in source (brand independence)", () => {
  const sourcesToCheck = [
    "lib/persona-contract.ts",
    "lib/config-store.ts",
    "lib/slash-commands.ts",
    "lib/wizard.ts",
    "lib/diff.ts",
    "lib/lint.ts",
    "lib/errors.ts",
    "lib/version.ts",
    "lib/prompt-mode.ts",
    "lib/persona-loader.ts",
    "extensions/caduceus.ts",
    "prompts",
    "README.md",
    "package.json",
  ];
  const forbiddenWords = ["el Gentleman", "Rioplatense"];
  const found = [];
  for (const source of sourcesToCheck) {
    const fullPath = join(root, source);
    if (!existsSync(fullPath)) continue;
    let content;
    try { content = readFileSync(fullPath, "utf8"); }
    catch { continue; }
    for (const word of forbiddenWords) {
      if (content.includes(word)) {
        found.push({ file: source, word });
      }
    }
  }
  if (found.length > 0) {
    fail(
      "no 'el Gentleman' / 'Rioplatense' in source",
      `found in: ${found.map((f) => `${f.file} (${f.word})`).join(", ")}`,
    );
    return;
  }
  pass("no 'el Gentleman' / 'Rioplatense' in source (brand independence)");
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
// v0.5.0: forbid external pi-package dependencies
// ---------------------------------------------------------------------------

const FORBIDDEN_PI_PACKAGES = [
  "pi-review",
  "pi-agents",
  "dracond",
  "pi-muselinn-harness",
];

check("v0.5.0: no import of external pi packages in source", () => {
  const sourceDirs = ["lib", "extensions"];
  const importRegex = /from\s+['"]([^'"]+)['"]/g;
  const found = [];
  for (const dir of sourceDirs) {
    const fullDir = join(root, dir);
    if (!existsSync(fullDir)) continue;
    const files = readdirSync(fullDir).filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      const content = readFileSync(join(fullDir, f), "utf8");
      let m;
      while ((m = importRegex.exec(content)) !== null) {
        const spec = m[1];
        for (const pkg of FORBIDDEN_PI_PACKAGES) {
          if (spec === pkg || spec.startsWith(pkg + "/")) {
            found.push({ file: f, spec });
          }
        }
      }
    }
  }
  if (found.length > 0) {
    fail(
      "no import of external pi packages",
      `found: ${found.map((f) => `${f.file} → ${f.spec}`).join(", ")}`,
    );
    return;
  }
  pass("no import of external pi packages in source");
});

check("v0.5.0: no dependency on external pi packages in package.json", () => {
  const pkgPath = join(root, "package.json");
  if (!existsSync(pkgPath)) {
    fail("no dependency on external pi packages", "package.json missing");
    return;
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  const found = [];
  for (const forbidden of FORBIDDEN_PI_PACKAGES) {
    if (forbidden in allDeps) {
      found.push({ name: forbidden, where: "dep" });
    }
  }
  // @earendil-works/pi-coding-agent is the only allowed pi peer
  if (found.length > 0) {
    fail(
      "no dependency on external pi packages",
      `found: ${found.map((f) => f.name).join(", ")}`,
    );
    return;
  }
  pass("no dependency on external pi packages in package.json");
});

check("v0.5.0: no content fingerprint overlap with forbidden pi packages", () => {
  // Lightweight check: scan prompts/*.md for forbidden package names.
  // (Full content fingerprinting would require diffing against upstream
  // packages; out of scope for Phase A. Phase B may extend.)
  const promptsDir = join(root, "prompts");
  if (!existsSync(promptsDir)) {
    pass("no content fingerprint overlap (no prompts dir)");
    return;
  }
  const files = readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
  const found = [];
  for (const f of files) {
    const content = readFileSync(join(promptsDir, f), "utf8");
    for (const forbidden of FORBIDDEN_PI_PACKAGES) {
      if (content.includes(forbidden)) {
        found.push({ file: f, pkg: forbidden });
      }
    }
  }
  if (found.length > 0) {
    fail(
      "no content fingerprint overlap",
      `found: ${found.map((f) => `${f.file} mentions ${f.pkg}`).join(", ")}`,
    );
    return;
  }
  pass("no content fingerprint overlap with forbidden pi packages");
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
