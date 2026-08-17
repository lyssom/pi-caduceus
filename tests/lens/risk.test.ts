// ---------------------------------------------------------------------------
// caduceus — risk lens tests (v0.6.0 T03)
//
// TDD micro-cycle (T03 of caduceus-v0.6.0):
//   RED          → this file (lib/lens/risk.ts not yet implemented)
//   GREEN        → lib/lens/risk.ts implements design.md §6.1 algorithm
//   TRIANGULATE  → truncation at 20 + truncated flag
//   REFACTOR     → extract regex constants
//
// Per-lens canonical tests: each lens MUST produce a finding on a
// "dirty" change that contains the issue it detects, and zero findings
// on a clean canonical change (REQ-024 / REQ-025).
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { riskLens } from "../../lib/lens/risk.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temp change dir with the 5 canonical MD files. Caller-supplied
 * content overrides defaults; missing entries get a minimal stub.
 */
function makeChangeDir(overrides: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "caduceus-risk-"));
  for (const f of [
    "proposal.md",
    "design.md",
    "tasks.md",
    "requirements.md",
    "constitution.md",
  ]) {
    const body = overrides[f] ?? `# ${f}\n`;
    writeFileSync(join(dir, f), body, "utf8");
  }
  return dir;
}

// ---------------------------------------------------------------------------
// Test 1 (RED): dirty-keyword — "BREAKING" in proposal.md → 1+ P1 with line
// ---------------------------------------------------------------------------

test("T03-R-RISK-1: P1 finding for BREAKING keyword in proposal.md (with line)", async () => {
  const dir = makeChangeDir({
    "proposal.md": "# Proposal\n\nLine 2 has nothing.\n\nThis is a BREAKING change.\n",
  });
  try {
    assert.ok(riskLens.run, "risk lens must export a run function");
    const out = await riskLens.run(dir);
    const p1 = out.findings.find((f) => f.severity === "P1");
    assert.ok(p1, `expected P1 finding; got: ${JSON.stringify(out.findings)}`);
    assert.equal(p1.location, "proposal.md");
    assert.equal(typeof p1.line, "number");
    assert.ok(p1.line! >= 4, `expected line ≥ 4, got ${p1.line}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2 (RED): dirty-todo — ≥3 TODO/FIXME markers across artifacts → 1 P2
// ---------------------------------------------------------------------------

test("T03-R-RISK-2: P2 finding when ≥3 TODO/FIXME markers across artifacts", async () => {
  const dir = makeChangeDir({
    "proposal.md": "TODO: refactor this",
    "design.md": "FIXME: line too long\nFIXME: also here",
    "tasks.md": "TODO: third marker",
  });
  try {
    const out = await riskLens.run(dir);
    const p2 = out.findings.find((f) => f.severity === "P2");
    assert.ok(p2, `expected P2 finding; got: ${JSON.stringify(out.findings)}`);
    assert.match(p2.summary, /3|TODO|FIXME/);
    // P2 is a section-level finding; no `line` field expected
    assert.equal(p2.line, undefined);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3 (RED): dirty-files — >10 files in change dir → 1 P3
// ---------------------------------------------------------------------------

test("T03-R-RISK-3: P3 finding when change dir has >10 files", async () => {
  const dir = makeChangeDir();
  // Add 11 extra files to push the count from 5 → 16
  for (let i = 1; i <= 11; i++) {
    writeFileSync(join(dir, `extra-${i}.md`), `extra ${i}\n`, "utf8");
  }
  try {
    const out = await riskLens.run(dir);
    const p3 = out.findings.find((f) => f.severity === "P3");
    assert.ok(p3, `expected P3 finding; got: ${JSON.stringify(out.findings)}`);
    assert.match(p3.summary, />\s*10|files/);
    assert.equal(p3.line, undefined);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4 (RED): clean canonical change → 0 findings
// ---------------------------------------------------------------------------

test("T03-R-RISK-4: zero findings on clean canonical change", async () => {
  const dir = makeChangeDir();
  try {
    const out = await riskLens.run(dir);
    assert.equal(out.findings.length, 0);
    assert.equal(out.truncated, undefined);
    assert.equal(out.lensId, "risk");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5 (TRIANGULATE): >20 BREAKING keywords → capped at 20 + truncated: true
// ---------------------------------------------------------------------------

test("T03-R-RISK-5: findings capped at 20 with truncated: true (TRIANGULATE)", async () => {
  const lines: string[] = ["# Proposal"];
  for (let i = 0; i < 30; i++) {
    lines.push(`Line ${i}: this contains a BREAKING keyword #${i}`);
  }
  const dir = makeChangeDir({
    "proposal.md": lines.join("\n"),
  });
  try {
    const out = await riskLens.run(dir);
    assert.equal(out.findings.length, 20);
    assert.equal(out.truncated, true);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6 (TRIANGULATE): lens id / display name / description are stable
// ---------------------------------------------------------------------------

test("T03-R-RISK-6: lens metadata (id/displayName/description) is set", () => {
  assert.equal(riskLens.id, "risk");
  assert.equal(riskLens.displayName, "Risk");
  assert.ok(riskLens.description.length > 10);
});

// ---------------------------------------------------------------------------
// Test 7: keyword match is case-insensitive (BREAKING / breaking / Breaking)
// ---------------------------------------------------------------------------

test("T03-R-RISK-7: keyword match is case-insensitive (BREAKING / breaking / Breaking)", async () => {
  const dir = makeChangeDir({
    "proposal.md": "BREAKING one\nbreaking two\nBreaking three\nDeprecat four\ndeprecat five",
  });
  try {
    const out = await riskLens.run(dir);
    const p1s = out.findings.filter((f) => f.severity === "P1");
    assert.equal(p1s.length, 5, `expected 5 P1 findings; got ${p1s.length}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 8: hidden files (e.g. .review/) do NOT count toward the >10 threshold
// ---------------------------------------------------------------------------

test("T03-R-RISK-8: hidden files (starting with '.') excluded from file count", async () => {
  const dir = makeChangeDir();
  // Add 20 hidden files; should not trigger P3
  for (let i = 1; i <= 20; i++) {
    writeFileSync(join(dir, `.hidden-${i}`), "x", "utf8");
  }
  try {
    const out = await riskLens.run(dir);
    const p3 = out.findings.find((f) => f.severity === "P3");
    assert.equal(p3, undefined, `expected NO P3 (hidden files don't count)`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});