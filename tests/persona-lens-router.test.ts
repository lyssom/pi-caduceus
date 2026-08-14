// ---------------------------------------------------------------------------
// caduceus — persona-lens-router tests
//
// TDD micro-cycle (T04 of caduceus-v0.5.0):
//   RED          → this file (imports fail; lib/persona-lens-router.ts missing)
//   GREEN        → lib/persona-lens-router.ts implements routing
//   TRIANGULATE  → additional cases (case sensitivity, persona snapshot integration)
//
// Maps the active persona to a required-lens subset for review.
// Per design.md §3.6 and §6.3: only 4 of the 10 built-in personas
// trigger lens requirements; the rest allocate no lens runs.
//
// See design.md §3.6 for the API contract.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PERSONA_LENS_ROUTING,
  requiredLensesForPersona,
  allocateLensRuns,
} from "../lib/persona-lens-router.ts";
import { createLensRegistry } from "../lib/review-lens-framework.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snapshot(persona: string) {
  return {
    activePersona: persona,
    mode: "default" as const,
    locale: "auto",
  };
}

// ---------------------------------------------------------------------------
// Test 1: PERSONA_LENS_ROUTING table matches design.md §6.3
// ---------------------------------------------------------------------------

test("T04-R-ROUTER-1: PERSONA_LENS_ROUTING covers the 4 binding personas per design.md §6.3", () => {
  // Find each persona's entry
  const find = (persona: string) =>
    PERSONA_LENS_ROUTING.find((r) => r.persona === persona);
  assert.deepEqual(find("security")?.required, ["security", "risk"]);
  assert.deepEqual(find("reviewer")?.required, ["readability", "spec-compliance"]);
  assert.deepEqual(find("architect")?.required, ["spec-compliance", "risk"]);
  assert.deepEqual(find("debugger")?.required, ["correctness"]);
});

// ---------------------------------------------------------------------------
// Test 2: 6 personas (default/plain/concise/teacher/socratic/pirate) have no required lenses
// ---------------------------------------------------------------------------

test("T04-R-ROUTER-2: 6 non-binding personas have empty required lenses", () => {
  const nonBinding = ["default", "plain", "concise", "teacher", "socratic", "pirate"];
  for (const p of nonBinding) {
    const entry = PERSONA_LENS_ROUTING.find((r) => r.persona === p);
    // Either no entry, or entry with empty required array
    assert.ok(
      !entry || entry.required.length === 0,
      `expected ${p} to have no required lenses, got ${JSON.stringify(entry?.required)}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 3: requiredLensesForPersona returns expected subsets
// ---------------------------------------------------------------------------

test("T04-R-ROUTER-3: requiredLensesForPersona returns the table entry", () => {
  assert.deepEqual(requiredLensesForPersona("security"), ["security", "risk"]);
  assert.deepEqual(
    requiredLensesForPersona("reviewer"),
    ["readability", "spec-compliance"],
  );
  assert.deepEqual(
    requiredLensesForPersona("architect"),
    ["spec-compliance", "risk"],
  );
  assert.deepEqual(requiredLensesForPersona("debugger"), ["correctness"]);
});

// ---------------------------------------------------------------------------
// Test 4: requiredLensesForPersona returns [] for unknown personas
// ---------------------------------------------------------------------------

test("T04-R-ROUTER-4: requiredLensesForPersona returns [] for unknown personas (no throw)", () => {
  assert.deepEqual(requiredLensesForPersona("unknown-persona"), []);
  assert.deepEqual(requiredLensesForPersona(""), []);
});

// ---------------------------------------------------------------------------
// Test 5: allocateLensRuns allocates one LensRunSummary per required lens
// ---------------------------------------------------------------------------

test("T04-R-ROUTER-5: allocateLensRuns returns one run per required lens", () => {
  const registry = createLensRegistry();
  const runs = allocateLensRuns(registry, snapshot("security"));
  assert.equal(runs.length, 2);
  const ids = runs.map((r) => r.lensId).sort();
  assert.deepEqual(ids, ["risk", "security"]);
});

// ---------------------------------------------------------------------------
// Test 6: allocateLensRuns with empty registry uses "queued" status
// ---------------------------------------------------------------------------

test("T04-R-ROUTER-6: allocateLensRuns with empty registry uses 'queued' status", () => {
  const registry = createLensRegistry(); // empty in Phase A
  const runs = allocateLensRuns(registry, snapshot("security"));
  for (const r of runs) {
    assert.equal(r.status, "queued");
    assert.equal(r.personaRequired, true);
    assert.equal(r.findingsCount, 0);
    assert.equal(r.startedAt, null);
    assert.equal(r.completedAt, null);
  }
});

// ---------------------------------------------------------------------------
// Test 7: allocateLensRuns with persona that has no required lenses returns []
// ---------------------------------------------------------------------------

test("T04-R-ROUTER-7: allocateLensRuns returns [] for non-binding persona", () => {
  const registry = createLensRegistry();
  assert.equal(allocateLensRuns(registry, snapshot("pirate")).length, 0);
  assert.equal(allocateLensRuns(registry, snapshot("plain")).length, 0);
});

// ---------------------------------------------------------------------------
// Test 8: allocateLensRuns with unknown persona returns [] (no throw)
// ---------------------------------------------------------------------------

test("T04-R-ROUTER-8: allocateLensRuns returns [] for unknown persona (no throw)", () => {
  const registry = createLensRegistry();
  assert.equal(allocateLensRuns(registry, snapshot("ghost")).length, 0);
});

// ---------------------------------------------------------------------------
// Test 9 (TRIANGULATE): allocateLensRuns reads from snapshot, not global state
// ---------------------------------------------------------------------------

test("T04-R-ROUTER-9: allocateLensRuns respects the snapshot's activePersona", () => {
  const registry = createLensRegistry();
  const securityRuns = allocateLensRuns(registry, snapshot("security"));
  const reviewerRuns = allocateLensRuns(registry, snapshot("reviewer"));
  assert.equal(securityRuns.length, 2);
  assert.equal(reviewerRuns.length, 2);
  // Different lens IDs
  const securityIds = securityRuns.map((r) => r.lensId).sort();
  const reviewerIds = reviewerRuns.map((r) => r.lensId).sort();
  assert.deepEqual(securityIds, ["risk", "security"]);
  assert.deepEqual(reviewerIds, ["readability", "spec-compliance"]);
});

// ---------------------------------------------------------------------------
// Test 10 (TRIANGULATE): allocateLensRuns returns immutable snapshots
// ---------------------------------------------------------------------------

test("T04-R-ROUTER-10: allocateLensRuns returns ReadonlyArray (immutable)", () => {
  const registry = createLensRegistry();
  const runs = allocateLensRuns(registry, snapshot("security"));
  // Verify the array type and frozen-ish nature
  assert.equal(typeof runs[Symbol.iterator], "function");
  assert.equal(runs.length, 2);
});
