// ---------------------------------------------------------------------------
// caduceus — security lens tests (v0.6.0 T05)
//
// TDD micro-cycle (T05 of caduceus-v0.6.0):
//   RED          → this file (lib/lens/security.ts not yet implemented)
//   GREEN        → lib/lens/security.ts implements design.md §6.3 algorithm
//   TRIANGULATE  → tests 5-6: MUST NOT / SHALL also trigger; CWE: N/A accepted
//   REFACTOR     → extract keyword constants
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { securityLens } from "../../lib/lens/security.ts";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const DEFAULT_FILES: Record<string, string> = {
  "proposal.md": "# Proposal\n",
  "design.md": "# Design\n",
  "tasks.md": "# Tasks\n",
  "requirements.md": "# Requirements\n",
  "constitution.md": "# Constitution\n",
};

function makeChangeDir(overrides: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "caduceus-security-"));
  const files = { ...DEFAULT_FILES, ...overrides };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
  return dir;
}

const CLEAN_CONSTITUTION = [
  "### CON-001: principle one",
  "- **Level**: MUST",
  "- **CWE**: CWE-829",
  "- **Description**:",
  "  Has CWE mapping.",
  "",
  "### CON-002: principle two",
  "- **Level**: SHOULD",
  "- **CWE**: N/A",
  "- **Description**:",
  "  SHOULD principle; CWE: N/A is acceptable.",
  "",
].join("\n");

// ---------------------------------------------------------------------------
// Test 1 (RED): MUST-level CON-NNN lacking CWE → P0
// ---------------------------------------------------------------------------

test("T05-R-SEC-1: P0 when MUST-level CON-NNN lacks CWE field", async () => {
  const constitution = [
    "### CON-001: principle without CWE",
    "- **Level**: MUST",
    "- **Description**:",
    "  Missing CWE field.",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "constitution.md": constitution });
  try {
    const out = await securityLens.run(dir);
    const p0 = out.findings.find(
      (f) => f.severity === "P0" && /CON-001/.test(f.summary),
    );
    assert.ok(p0, `expected P0 for CON-001; got: ${JSON.stringify(out.findings)}`);
    assert.equal(p0.location, "constitution.md");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2 (RED): secret keyword in tasks.md → P1 with line
// ---------------------------------------------------------------------------

test("T05-R-SEC-2: P1 per occurrence of secret keyword in tasks.md (with line)", async () => {
  const tasksMd = [
    "# Tasks",
    "",
    "## Task 1: Embed credentials",
    "- [ ] Store the password in env",
    "- [ ] Use api_key from config",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "tasks.md": tasksMd });
  try {
    const out = await securityLens.run(dir);
    const secrets = out.findings.filter(
      (f) => f.severity === "P1" && /secret|token|password|api.?key/i.test(f.summary),
    );
    assert.ok(secrets.length >= 2, `expected ≥2 P1; got ${secrets.length}`);
    secrets.forEach((f) => {
      assert.equal(typeof f.line, "number");
      assert.ok(f.line! >= 1);
    });
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3 (RED): curl|sh / wget|sh / sudo → P1 with line
// ---------------------------------------------------------------------------

test("T05-R-SEC-3: P1 per occurrence of curl|sh / wget|sh / sudo in tasks.md", async () => {
  const tasksMd = [
    "# Tasks",
    "",
    "## Task 1: Risky shell commands",
    "- [ ] curl | sh install.sh",
    "- [ ] wget | sh bootstrap.sh",
    "- [ ] sudo apt-get install foo",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "tasks.md": tasksMd });
  try {
    const out = await securityLens.run(dir);
    const matches = out.findings.filter(
      (f) => f.severity === "P1" && /curl|wget|sudo/.test(f.summary),
    );
    assert.ok(matches.length >= 3, `expected ≥3 P1; got ${matches.length}`);
    matches.forEach((f) => {
      assert.equal(typeof f.line, "number");
    });
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4 (RED): clean canonical change → 0 findings
// ---------------------------------------------------------------------------

test("T05-R-SEC-4: zero findings on clean canonical change", async () => {
  const tasksMd = [
    "# Tasks",
    "",
    "## Task 1: clean implementation",
    "- [ ] Step 1.1",
    "- [ ] Step 1.2",
    "",
  ].join("\n");
  const dir = makeChangeDir({
    "tasks.md": tasksMd,
    "constitution.md": CLEAN_CONSTITUTION,
  });
  try {
    const out = await securityLens.run(dir);
    assert.equal(out.findings.length, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5 (TRIANGULATE): MUST NOT and SHALL levels also trigger P0
// ---------------------------------------------------------------------------

test("T05-R-SEC-5: MUST NOT and SHALL levels also flagged for missing CWE (defense in depth)", async () => {
  const constitution = [
    "### CON-001: MUST NOT principle",
    "- **Level**: MUST NOT",
    "- **Description**:",
    "  Missing CWE.",
    "",
    "### CON-002: SHALL principle",
    "- **Level**: SHALL",
    "- **Description**:",
    "  Missing CWE.",
    "",
    "### CON-003: SHOULD principle (NOT triggered)",
    "- **Level**: SHOULD",
    "- **Description**:",
    "  SHOULD without CWE is OK.",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "constitution.md": constitution });
  try {
    const out = await securityLens.run(dir);
    const p0s = out.findings.filter(
      (f) => f.severity === "P0" && /CON-00[12]/.test(f.summary),
    );
    assert.equal(p0s.length, 2, `expected 2 P0 (MUST NOT + SHALL); got ${p0s.length}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6 (TRIANGULATE): 'CWE: N/A' on MUST-level is acceptable (no P0)
// ---------------------------------------------------------------------------

test("T05-R-SEC-6: 'CWE: N/A' on MUST-level is acceptable (no P0)", async () => {
  const constitution = [
    "### CON-001: process principle",
    "- **Level**: MUST",
    "- **CWE**: N/A",
    "- **Description**:",
    "  Explicit N/A.",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "constitution.md": constitution });
  try {
    const out = await securityLens.run(dir);
    const p0 = out.findings.find((f) => f.severity === "P0");
    assert.equal(p0, undefined, "expected NO P0 when CWE: N/A explicit");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: secret keyword also detected in design.md
// ---------------------------------------------------------------------------

test("T05-R-SEC-7: secret keyword also detected in design.md", async () => {
  const designMd = [
    "# Design",
    "",
    "## Implementation",
    "Use password-based auth.",
    "Token rotation every 24h.",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "design.md": designMd });
  try {
    const out = await securityLens.run(dir);
    const secrets = out.findings.filter(
      (f) => f.severity === "P1" && /password|token/i.test(f.summary),
    );
    assert.ok(secrets.length >= 2, `expected ≥2 P1 in design.md; got ${secrets.length}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 8: lens metadata is set
// ---------------------------------------------------------------------------

test("T05-R-SEC-8: lens metadata is set", () => {
  assert.equal(securityLens.id, "security");
  assert.equal(securityLens.displayName, "Security");
  assert.ok(securityLens.description.length > 10);
});