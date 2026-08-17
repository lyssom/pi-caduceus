// ---------------------------------------------------------------------------
// caduceus — correctness lens tests (v0.6.0 T04)
//
// TDD micro-cycle (T04 of caduceus-v0.6.0):
//   RED          → this file (lib/lens/correctness.ts not yet implemented)
//   GREEN        → lib/lens/correctness.ts implements design.md §6.2 algorithm
//   TRIANGULATE  → tests 6-8: multi-P1, clean canonical, lens metadata
//   REFACTOR     → extractReqIds / extractConIds helpers shared with T07
//
// Per-lens canonical tests (REQ-024 / REQ-025):
//   - dirty change → ≥1 finding per detection class
//   - clean change → 0 findings
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { correctnessLens } from "../../lib/lens/correctness.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_FILES: Record<string, string> = {
  "proposal.md": "# Proposal\n",
  "design.md": "# Design\n",
  "tasks.md": "# Tasks\n",
  "requirements.md": "# Requirements\n",
  "constitution.md": "# Constitution\n",
};

function makeChangeDir(overrides: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "caduceus-correctness-"));
  const files = { ...DEFAULT_FILES, ...overrides };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
  return dir;
}

// ---------------------------------------------------------------------------
// Test 1 (RED): design.md references REQ-NNN not in requirements.md → P1
// ---------------------------------------------------------------------------

test("T04-R-CORRECT-1: P1 when design.md references REQ-NNN not in requirements.md", async () => {
  const dir = makeChangeDir({
    "design.md": "Design references REQ-999 but requirements.md only has REQ-001.",
    "requirements.md": "- **REQ-001 [MUST]**: declared.",
  });
  try {
    const out = await correctnessLens.run(dir);
    const p1 = out.findings.find(
      (f) => f.severity === "P1" && /REQ-999/.test(f.summary),
    );
    assert.ok(p1, `expected P1 for REQ-999; got: ${JSON.stringify(out.findings)}`);
    assert.equal(p1.location, "design.md");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2 (RED): design.md references CON-NNN not in constitution.md → P2
// ---------------------------------------------------------------------------

test("T04-R-CORRECT-2: P2 when design.md references CON-NNN not in constitution.md", async () => {
  const dir = makeChangeDir({
    "design.md": "Design references CON-999 but constitution.md only has CON-001.",
    "constitution.md": "### CON-001: principle one",
  });
  try {
    const out = await correctnessLens.run(dir);
    const p2 = out.findings.find(
      (f) => f.severity === "P2" && /CON-999/.test(f.summary),
    );
    assert.ok(p2, `expected P2 for CON-999; got: ${JSON.stringify(out.findings)}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3 (RED): v0.6.0-marker tasks.md missing "Done when:" → P2 per task
// ---------------------------------------------------------------------------

test("T04-R-CORRECT-3: P2 per task missing 'Done when:' on v0.6.0-marker tasks.md", async () => {
  const tasksMd = [
    "<!-- caduceus:tasks-template-version 0.6.0 -->",
    "",
    "# Tasks",
    "",
    "## Task 1: First task",
    "- [ ] Step 1.1",
    "",
    "## Task 2: Second task",
    "- [ ] Step 2.1",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "tasks.md": tasksMd });
  try {
    const out = await correctnessLens.run(dir);
    const missing = out.findings.filter((f) =>
      /Done when/i.test(f.summary),
    );
    assert.equal(
      missing.length,
      2,
      `expected 2 missing Done-when findings; got ${missing.length}`,
    );
    missing.forEach((f) => assert.equal(f.severity, "P2"));
    assert.ok(missing.some((f) => /Task 1/.test(f.summary)));
    assert.ok(missing.some((f) => /Task 2/.test(f.summary)));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4 (RED): v0.5.0-marker tasks.md exempts "Done when:" detection
// ---------------------------------------------------------------------------

test("T04-R-CORRECT-4: v0.5.0-marker tasks.md exempts 'Done when:' detection (REQ-020)", async () => {
  const tasksMd = [
    "<!-- caduceus:tasks-template-version 0.5.0 -->",
    "",
    "# Tasks",
    "",
    "## Task 1: First task",
    "- [ ] Step 1.1",
    "",
    "## Task 2: Second task",
    "- [ ] Step 2.1",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "tasks.md": tasksMd });
  try {
    const out = await correctnessLens.run(dir);
    const missing = out.findings.filter((f) =>
      /Done when/i.test(f.summary),
    );
    assert.equal(
      missing.length,
      0,
      `expected NO Done-when findings on v0.5.0 marker; got ${JSON.stringify(missing)}`,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5 (RED): task with zero checkboxes → P2 (always fires)
// ---------------------------------------------------------------------------

test("T04-R-CORRECT-5: P2 when task has zero checkbox steps (always fires)", async () => {
  const tasksMd = [
    "<!-- caduceus:tasks-template-version 0.6.0 -->",
    "",
    "# Tasks",
    "",
    "## Task 1: Empty task (no checkboxes)",
    "",
    "## Task 2: Has checkboxes",
    "- [ ] Step 2.1",
    "**Done when:** criterion",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "tasks.md": tasksMd });
  try {
    const out = await correctnessLens.run(dir);
    const empty = out.findings.find(
      (f) =>
        f.severity === "P2" &&
        /Task 1/.test(f.summary) &&
        /checkbox/i.test(f.summary),
    );
    assert.ok(empty, `expected P2 for empty Task 1; got: ${JSON.stringify(out.findings)}`);
    // Task 2 has checkboxes AND Done when — no finding for it
    assert.equal(
      out.findings.find((f) => /Task 2/.test(f.summary)),
      undefined,
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6 (TRIANGULATE): clean canonical change → 0 findings
// ---------------------------------------------------------------------------

test("T04-R-CORRECT-6: zero findings on clean canonical change (TRIANGULATE)", async () => {
  const tasksMd = [
    "<!-- caduceus:tasks-template-version 0.6.0 -->",
    "",
    "# Tasks",
    "",
    "## Task 1: First task",
    "- [ ] Step 1.1",
    "**Done when:** criterion 1",
    "",
    "## Task 2: Second task",
    "- [ ] Step 2.1",
    "**Done when:** criterion 2",
    "",
  ].join("\n");
  const dir = makeChangeDir({
    "design.md": "# Design\n\nReferences REQ-001 and CON-001.",
    "tasks.md": tasksMd,
    "requirements.md": "- **REQ-001 [MUST]**: declared.",
    "constitution.md": "### CON-001: principle one",
  });
  try {
    const out = await correctnessLens.run(dir);
    assert.equal(
      out.findings.length,
      0,
      `expected 0 findings; got: ${JSON.stringify(out.findings)}`,
    );
    assert.equal(out.truncated, undefined);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7 (TRIANGULATE): multiple P1 findings for multiple orphaned REQs
// ---------------------------------------------------------------------------

test("T04-R-CORRECT-7: multiple P1 findings for multiple orphaned REQ-NNN", async () => {
  const dir = makeChangeDir({
    "design.md":
      "design.md references REQ-100, REQ-200, REQ-300, but reqs only has REQ-001.",
    "requirements.md": "- **REQ-001 [MUST]**: declared.",
  });
  try {
    const out = await correctnessLens.run(dir);
    const p1s = out.findings.filter((f) => f.severity === "P1");
    assert.ok(p1s.length >= 3, `expected ≥3 P1; got ${p1s.length}`);
    assert.ok(p1s.some((f) => /REQ-100/.test(f.summary)));
    assert.ok(p1s.some((f) => /REQ-200/.test(f.summary)));
    assert.ok(p1s.some((f) => /REQ-300/.test(f.summary)));
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 8: lens metadata is set
// ---------------------------------------------------------------------------

test("T04-R-CORRECT-8: lens metadata (id/displayName/description) is set", () => {
  assert.equal(correctnessLens.id, "correctness");
  assert.equal(correctnessLens.displayName, "Correctness");
  assert.ok(correctnessLens.description.length > 10);
});

// ---------------------------------------------------------------------------
// Test 9: missing files are tolerated (empty / no markdown)
// ---------------------------------------------------------------------------

test("T04-R-CORRECT-9: missing design.md or requirements.md yields no P1/P2", async () => {
  // Empty default files only — no REQ/CON IDs anywhere
  const dir = makeChangeDir({
    "design.md": "",
    "requirements.md": "",
    "constitution.md": "",
    "tasks.md": "",
  });
  try {
    const out = await correctnessLens.run(dir);
    const crossRef = out.findings.filter(
      (f) =>
        f.severity === "P1" ||
        (f.severity === "P2" && /CON-\d+|REQ-\d+/.test(f.summary)),
    );
    assert.equal(crossRef.length, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});