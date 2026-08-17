// ---------------------------------------------------------------------------
// caduceus — review types tests (v0.6.0 T02)
//
// TDD micro-cycle (T02 of caduceus-v0.6.0):
//   RED          → this file (LensFinding.line / LensFindings.truncated /
//                  LensRunDetail not yet defined)
//   GREEN        → lib/review-types.ts + lib/review-lens-framework.ts extend
//                  the types per REQ-004 / REQ-009 / design.md §5
//   TRIANGULATE  → Test 5: LensRunDetail structurally compatible with
//                  LensRunSummary (LensRunDetail ⊇ LensRunSummary)
//
// Type-level tests: each test compiles only when the target type accepts
// the asserted shape. A missing field is a compile error = RED.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  PersonaSnapshot,
  LensRunSummary,
  LensRunStatus,
  LensRunDetail,
} from "../lib/review-types.ts";
import type {
  LensFinding,
  LensFindings,
  LensId,
} from "../lib/review-lens-framework.ts";

// ---------------------------------------------------------------------------
// Test 1 (RED): LensFinding accepts optional `line?: number` (REQ-004)
// ---------------------------------------------------------------------------

test("T02-R-TYPE-1: LensFinding accepts optional line field", () => {
  // With line (keyword-style finding)
  const f1: LensFinding = {
    severity: "P1",
    summary: "secret-like keyword 'password'",
    location: "tasks.md",
    recommendation: "Avoid embedding secrets in MD.",
    line: 17,
  };
  // Without line (section-level finding)
  const f2: LensFinding = {
    severity: "P2",
    summary: "REQ-007 not covered by tasks",
    location: "requirements.md",
    recommendation: "Add task referencing REQ-007.",
  };
  assert.equal(f1.line, 17);
  assert.equal(f2.line, undefined);
});

// ---------------------------------------------------------------------------
// Test 2 (RED): LensFindings accepts optional `truncated?: boolean`
// (REQ-005)
// ---------------------------------------------------------------------------

test("T02-R-TYPE-2: LensFindings accepts optional truncated field", () => {
  const f1: LensFindings = {
    lensId: "risk",
    findings: [],
    durationMs: 5,
  };
  const f2: LensFindings = {
    lensId: "risk",
    findings: [],
    durationMs: 5,
    truncated: true,
  };
  assert.equal(f1.truncated, undefined);
  assert.equal(f2.truncated, true);
});

// ---------------------------------------------------------------------------
// Test 3 (RED): LensRunStatus type alias exists with all 5 lifecycle values
// ---------------------------------------------------------------------------

test("T02-R-TYPE-3: LensRunStatus includes all 5 lifecycle values", () => {
  // Compile-time check: each value must be assignable to LensRunStatus
  const s1: LensRunStatus = "queued";
  const s2: LensRunStatus = "running";
  const s3: LensRunStatus = "completed";
  const s4: LensRunStatus = "skipped";
  const s5: LensRunStatus = "failed";
  assert.ok(s1 && s2 && s3 && s4 && s5);
});

// ---------------------------------------------------------------------------
// Test 4 (RED): LensRunDetail type exists with required fields (REQ-009)
// ---------------------------------------------------------------------------

test("T02-R-TYPE-4: LensRunDetail exists with all required fields", () => {
  const detail: LensRunDetail = {
    lensId: "security",
    status: "completed",
    personaRequired: true,
    findingsCount: 1,
    startedAt: "2026-08-14T12:00:00.000Z",
    completedAt: "2026-08-14T12:00:00.005Z",
    durationMs: 5,
    findings: [
      {
        severity: "P1",
        summary: "secret-like keyword 'password'",
        location: "tasks.md",
        recommendation: "Use a secrets manager.",
        line: 17,
      },
    ],
    truncated: false,
  };
  assert.equal(detail.findings.length, 1);
  assert.equal(detail.findings[0].line, 17);
  assert.equal(detail.durationMs, 5);
});

// ---------------------------------------------------------------------------
// Test 5 (TRIANGULATE): LensRunDetail is structurally compatible with
// LensRunSummary (LensRunDetail ⊇ LensRunSummary; receipt contains a
// superset of state-snapshot lensRuns)
// ---------------------------------------------------------------------------

test("T02-R-TYPE-5: LensRunDetail is assignable to LensRunSummary", () => {
  const detail: LensRunDetail = {
    lensId: "risk",
    status: "completed",
    personaRequired: true,
    findingsCount: 0,
    startedAt: null,
    completedAt: null,
    durationMs: 0,
    findings: [],
  };
  // LensRunDetail MUST be assignable to LensRunSummary (subset rule)
  const summary: LensRunSummary = detail;
  assert.equal(summary.lensId, "risk");
  assert.equal(summary.status, "completed");
});

// ---------------------------------------------------------------------------
// Test 6 (TRIANGULATE): PersonaSnapshot still works (regression guard)
// ---------------------------------------------------------------------------

test("T02-R-TYPE-6: PersonaSnapshot still exports the v0.5.0 shape", () => {
  const snap: PersonaSnapshot = {
    activePersona: "security",
    mode: "default",
    locale: "auto",
  };
  assert.equal(snap.activePersona, "security");
  assert.equal(snap.mode, "default");
  assert.equal(snap.locale, "auto");
});

// ---------------------------------------------------------------------------
// Test 7 (TRIANGULATE): LensId still exports the v0.5.0 5 values
// ---------------------------------------------------------------------------

test("T02-R-TYPE-7: LensId still exports the v0.5.0 5 slot values", () => {
  const ids: LensId[] = [
    "risk",
    "correctness",
    "security",
    "readability",
    "spec-compliance",
  ];
  assert.equal(ids.length, 5);
});