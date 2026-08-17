// ---------------------------------------------------------------------------
// caduceus — spec-compliance lens tests (v0.6.0 T07)
//
// TDD micro-cycle (T07 of caduceus-v0.6.0):
//   RED          → this file (lib/lens/spec-compliance.ts not yet implemented)
//   GREEN        → lib/lens/spec-compliance.ts implements design.md §6.5
//   TRIANGULATE  → tests 5-6: changeName fallback to dir basename
//   REFACTOR     → reuse extractIds / parsePrinciples from Task 4/5
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";

import { specComplianceLens } from "../../lib/lens/spec-compliance.ts";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const DEFAULT_FILES: Record<string, string> = {
  "proposal.md": "# Proposal\n\n## 1. Intent\n\n## 3. Scope\n",
  "design.md": "# Design\n",
  "tasks.md": "# Tasks\n",
  "requirements.md": "# Requirements\n",
  "constitution.md": "# Constitution\n",
};

function makeChangeDir(
  overrides: Record<string, string> = {},
  stateJson?: Record<string, unknown>,
): string {
  const dir = mkdtempSync(join(tmpdir(), "caduceus-spc-"));
  const files = { ...DEFAULT_FILES, ...overrides };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
  if (stateJson !== undefined) {
    const reviewDir = join(dir, ".review");
    mkdirSync(reviewDir, { recursive: true });
    writeFileSync(
      join(reviewDir, "state.json"),
      JSON.stringify(stateJson, null, 2),
      "utf8",
    );
  }
  return dir;
}

function cleanProposal(changeName: string): string {
  return [
    "# Proposal",
    "",
    "## 1. Intent",
    "Intent for " + changeName + ".",
    "",
    "## 3. Scope",
    "Scope of " + changeName + ".",
    "",
    "## 4. Success criteria",
    "Success.",
    "",
  ].join("\n");
}

function cleanConstitution(): string {
  return [
    "### CON-001: principle one",
    "- **Level**: MUST",
    "- **CWE**: CWE-829",
    "- **Description**:",
    "  Has CWE.",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Test 1 (RED): REQ-NNN in requirements.md not covered by any task → P1
// ---------------------------------------------------------------------------

test("T07-R-SPC-1: P1 when REQ-NNN in requirements.md has no task reference", async () => {
  const dir = makeChangeDir({
    "requirements.md": [
      "- **REQ-001 [MUST]**: covered.",
      "- **REQ-007 [MUST]**: orphan (no task references it).",
      "",
    ].join("\n"),
    "tasks.md": "# Tasks\n\n## Task 1: covers REQ-001\n- [ ] Step\n",
  });
  try {
    const out = await specComplianceLens.run(dir);
    const orphan = out.findings.find(
      (f) => f.severity === "P1" && /REQ-007/.test(f.summary),
    );
    assert.ok(orphan, `expected P1 for REQ-007 orphan; got: ${JSON.stringify(out.findings)}`);
    // REQ-001 IS referenced → no P1 for it
    assert.equal(
      out.findings.find((f) => /REQ-001/.test(f.summary)),
      undefined,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2 (RED): proposal.md §3 missing changeName → P2
// ---------------------------------------------------------------------------

test("T07-R-SPC-2: P2 when proposal.md §3 Scope omits the changeName", async () => {
  const dir = makeChangeDir(
    {
      "proposal.md": [
        "# Proposal",
        "",
        "## 3. Scope",
        "Some scope text but NO mention of the change name.",
        "",
      ].join("\n"),
    },
    { activeChange: "v0.6.0-lens-collection", state: "started" },
  );
  try {
    const out = await specComplianceLens.run(dir);
    const missing = out.findings.find(
      (f) => f.severity === "P2" && /change.*name|changeName|Scope/i.test(f.summary),
    );
    assert.ok(missing, `expected P2 for §3 missing changeName; got: ${JSON.stringify(out.findings)}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3 (RED): CON-NNN in constitution.md not referenced in proposal/design → P2
// ---------------------------------------------------------------------------

test("T07-R-SPC-3: P2 when CON-NNN in constitution.md has no proposal/design reference", async () => {
  const dir = makeChangeDir({
    "constitution.md": [
      "### CON-001: principle one",
      "- **Level**: MUST",
      "- **CWE**: CWE-829",
      "- **Description**:",
      "  Has CWE.",
      "",
      "### CON-005: principle five (orphan)",
      "- **Level**: SHOULD",
      "- **CWE**: N/A",
      "- **Description**:",
      "  Will be orphan (no proposal/design reference).",
      "",
    ].join("\n"),
    "proposal.md": "# Proposal\n\nReferences CON-001 only.",
    "design.md": "# Design\n\nReferences CON-001 only.",
  });
  try {
    const out = await specComplianceLens.run(dir);
    const orphan = out.findings.find(
      (f) => f.severity === "P2" && /CON-005/.test(f.summary),
    );
    assert.ok(orphan, `expected P2 for CON-005 orphan; got: ${JSON.stringify(out.findings)}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4 (RED): clean canonical change → 0 findings
// ---------------------------------------------------------------------------

test("T07-R-SPC-4: zero findings on clean canonical change", async () => {
  const dir = makeChangeDir(
    {
      "proposal.md": cleanProposal("test-change"),
      "design.md": "# Design\n\nReferences REQ-001 and CON-001.",
      "tasks.md": "# Tasks\n\n## Task 1: covers REQ-001\n- [ ] Step\n",
      "requirements.md": "- **REQ-001 [MUST]**: declared.\n",
      "constitution.md": cleanConstitution(),
    },
    { activeChange: "test-change", state: "started" },
  );
  try {
    const out = await specComplianceLens.run(dir);
    assert.equal(out.findings.length, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5 (TRIANGULATE): changeName falls back to directory basename
//           when no state.json present
// ---------------------------------------------------------------------------

test("T07-R-SPC-5: changeName falls back to directory basename when state.json missing", async () => {
  const dir = makeChangeDir({});
  const dirName = basename(dir); // e.g., "caduceus-spc-XXXXXX"
  // proposal.md §3 contains the dir basename → 0 P2 for §3
  const dirProposal = [
    "# Proposal",
    "",
    "## 3. Scope",
    "Scope of " + dirName + ".",
    "",
  ].join("\n");
  writeFileSync(join(dir, "proposal.md"), dirProposal, "utf8");
  try {
    const out = await specComplianceLens.run(dir);
    const missingName = out.findings.find(
      (f) => f.severity === "P2" && /change.*name|changeName/i.test(f.summary),
    );
    assert.equal(
      missingName,
      undefined,
      `expected NO §3 missing-changeName P2; got ${JSON.stringify(missingName)}`,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6 (TRIANGULATE): state.json activeChange wins over dir basename
// ---------------------------------------------------------------------------

test("T07-R-SPC-6: state.json activeChange wins over dir basename", async () => {
  const dir = makeChangeDir(
    {
      "proposal.md": [
        "# Proposal",
        "",
        "## 3. Scope",
        "Scope of explicit-name.",
        "",
      ].join("\n"),
    },
    { activeChange: "explicit-name", state: "started" },
  );
  try {
    const out = await specComplianceLens.run(dir);
    const missingName = out.findings.find(
      (f) => f.severity === "P2" && /change.*name|changeName/i.test(f.summary),
    );
    assert.equal(missingName, undefined);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: lens metadata is set
// ---------------------------------------------------------------------------

test("T07-R-SPC-7: lens metadata is set", () => {
  assert.equal(specComplianceLens.id, "spec-compliance");
  assert.equal(specComplianceLens.displayName, "Spec Compliance");
  assert.ok(specComplianceLens.description.length > 10);
});

// ---------------------------------------------------------------------------
// Test 8: corrupt state.json is tolerated (fallback to dir basename)
// ---------------------------------------------------------------------------

test("T07-R-SPC-8: corrupt state.json tolerated (falls back to dir basename)", async () => {
  const dir = makeChangeDir({});
  const dirName = basename(dir);
  // Write invalid JSON to state.json
  mkdirSync(join(dir, ".review"), { recursive: true });
  writeFileSync(
    join(dir, ".review", "state.json"),
    "{ this is not valid JSON",
    "utf8",
  );
  const proposal = [
    "# Proposal",
    "",
    "## 3. Scope",
    "Scope of " + dirName + ".",
    "",
  ].join("\n");
  writeFileSync(join(dir, "proposal.md"), proposal, "utf8");
  try {
    const out = await specComplianceLens.run(dir);
    // No P2 for §3 (corrupt state.json → fallback to dir basename → matches)
    const missingName = out.findings.find(
      (f) => f.severity === "P2" && /change.*name|changeName/i.test(f.summary),
    );
    assert.equal(missingName, undefined);
  } finally {
    rmSync(dir, { recursive: true });
  }
});