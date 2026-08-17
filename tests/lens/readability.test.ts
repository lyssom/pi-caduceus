// ---------------------------------------------------------------------------
// caduceus — readability lens tests (v0.6.0 T06)
//
// TDD micro-cycle (T06 of caduceus-v0.6.0):
//   RED          → this file (lib/lens/readability.ts not yet implemented)
//   GREEN        → lib/lens/readability.ts implements design.md §6.4 algorithm
//   TRIANGULATE  → tests 5-6: multi-file large; no double-counting
//   REFACTOR     → extract shared line counter / section parser
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readabilityLens } from "../../lib/lens/readability.ts";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const CLEAN_PROPOSAL = [
  "# Proposal",
  "",
  "## 1. Intent",
  "Some intent.",
  "",
  "## 2. Why now",
  "Why.",
  "",
  "## 3. Scope",
  "Scope.",
  "",
  "## 4. Success criteria",
  "Success.",
  "",
].join("\n");

function makeChangeDir(overrides: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "caduceus-readability-"));
  const defaults: Record<string, string> = {
    "proposal.md": CLEAN_PROPOSAL,
    "design.md": "# Design\n",
    "tasks.md": "# Tasks\n",
    "requirements.md": "# Requirements\n",
    "constitution.md": "# Constitution\n",
  };
  const files = { ...defaults, ...overrides };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, "utf8");
  }
  return dir;
}

// ---------------------------------------------------------------------------
// Test 1 (RED): 250-line proposal.md → P2 (large file)
// ---------------------------------------------------------------------------

test("T06-R-READ-1: P2 when any MD file > 200 lines", async () => {
  const lines = ["# Proposal", ""];
  for (let i = 0; i < 250; i++) lines.push(`Line ${i + 1}: filler content`);
  const dir = makeChangeDir({ "proposal.md": lines.join("\n") });
  try {
    const out = await readabilityLens.run(dir);
    const large = out.findings.find(
      (f) => f.severity === "P2" && /200 lines|>200/.test(f.summary),
    );
    assert.ok(large, `expected P2 for large file; got: ${JSON.stringify(out.findings)}`);
    assert.match(large.location, /proposal\.md/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2 (RED): proposal.md missing "## 4. Success criteria" → P2
// ---------------------------------------------------------------------------

test("T06-R-READ-2: P2 per missing required section in proposal.md", async () => {
  const proposal = [
    "# Proposal",
    "",
    "## 1. Intent",
    "Has intent.",
    "",
    "## 2. Why now",
    "Why.",
    "",
    "## 3. Scope",
    "Scope.",
    "",
    // '## 4. Success criteria' deliberately omitted
  ].join("\n");
  const dir = makeChangeDir({ "proposal.md": proposal });
  try {
    const out = await readabilityLens.run(dir);
    const missing = out.findings.filter(
      (f) => f.severity === "P2" && /Success criteria/.test(f.summary),
    );
    assert.equal(missing.length, 1, `expected 1 missing-section P2; got ${missing.length}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3 (RED): ##### heading (depth 5) → P3 (excessive depth)
// ---------------------------------------------------------------------------

test("T06-R-READ-3: P3 when any MD file has depth-5 heading", async () => {
  const proposal = [
    "# Proposal",
    "",
    "## 1. Intent",
    "",
    "### 1.1 Subsection",
    "",
    "#### 1.1.1 Sub-subsection",
    "",
    "##### 1.1.1.1 Excessive depth",
    "This triggers P3.",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "proposal.md": proposal });
  try {
    const out = await readabilityLens.run(dir);
    const depth = out.findings.find(
      (f) => f.severity === "P3" && /depth|heading/i.test(f.summary),
    );
    assert.ok(depth, `expected P3 for excessive depth; got: ${JSON.stringify(out.findings)}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4 (RED): clean canonical change → 0 findings
// ---------------------------------------------------------------------------

test("T06-R-READ-4: zero findings on clean canonical change", async () => {
  const dir = makeChangeDir();
  try {
    const out = await readabilityLens.run(dir);
    assert.equal(out.findings.length, 0);
    assert.equal(out.truncated, undefined);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5 (TRIANGULATE): multi-file large → P2 per file (no double-counting)
// ---------------------------------------------------------------------------

test("T06-R-READ-5: multi-file large produces one P2 per file", async () => {
  const lines250 = (n: number) => {
    const out = [`# File ${n}`, ""];
    for (let i = 0; i < 250; i++) out.push(`Line ${i + 1}: filler`);
    return out.join("\n");
  };
  const dir = makeChangeDir({
    "proposal.md": lines250(1),
    "design.md": lines250(2),
    "tasks.md": "# Tasks\n", // small, not triggered
  });
  try {
    const out = await readabilityLens.run(dir);
    const large = out.findings.filter(
      (f) => f.severity === "P2" && /200 lines|>200/.test(f.summary),
    );
    assert.equal(large.length, 2, `expected 2 P2 (one per large file); got ${large.length}`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6 (TRIANGULATE): depth check counts only consecutive '#' at line start
// ---------------------------------------------------------------------------

test("T06-R-READ-6: '#' inside paragraph text does NOT count as heading", async () => {
  // '# something' inside prose is not a heading; only ##-prefixed lines count
  const proposal = [
    "# Proposal",
    "",
    "## 1. Intent",
    "Use a # in text: '#hashtag'.",
    "",
  ].join("\n");
  const dir = makeChangeDir({ "proposal.md": proposal });
  try {
    const out = await readabilityLens.run(dir);
    // No depth-5+ heading; no P3 expected
    const depth = out.findings.find((f) => f.severity === "P3");
    assert.equal(depth, undefined);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: lens metadata is set
// ---------------------------------------------------------------------------

test("T06-R-READ-7: lens metadata is set", () => {
  assert.equal(readabilityLens.id, "readability");
  assert.equal(readabilityLens.displayName, "Readability");
  assert.ok(readabilityLens.description.length > 10);
});

// ---------------------------------------------------------------------------
// Test 8: missing proposal.md → no P2 for missing sections
// ---------------------------------------------------------------------------

test("T06-R-READ-8: missing proposal.md → no missing-section P2", async () => {
  const dir = makeChangeDir({ "proposal.md": "" });
  try {
    const out = await readabilityLens.run(dir);
    const missing = out.findings.filter(
      (f) => /missing.*section|required section/i.test(f.summary),
    );
    assert.equal(missing.length, 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});