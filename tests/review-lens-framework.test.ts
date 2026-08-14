// ---------------------------------------------------------------------------
// caduceus — review lens framework tests
//
// TDD micro-cycle (T03 of caduceus-v0.5.0):
//   RED          → this file (imports fail; lib/review-lens-framework.ts missing)
//   GREEN        → lib/review-lens-framework.ts implements the framework
//   TRIANGULATE  → additional cases (registry state isolation, custom lens)
//
// Phase A: registry starts empty; 5 named lens SLOTS exist as constants
// but no lens has `run` implemented. Phase B will populate lens
// implementations.
//
// See design.md §3.5, §12 R2 for the LENS_REGISTRY_VERSION rationale.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  LENS_SLOTS_V1,
  LENS_REGISTRY_VERSION,
  LENS_DISPLAY_NAMES,
  createLensRegistry,
  type Lens,
  type LensId,
} from "../lib/review-lens-framework.ts";

// ---------------------------------------------------------------------------
// Test 1: LENS_SLOTS_V1 exports exactly 5 named slots in stable order
// ---------------------------------------------------------------------------

test("T03-R-LENS-1: LENS_SLOTS_V1 has exactly 5 entries", () => {
  assert.equal(LENS_SLOTS_V1.length, 5);
  assert.deepEqual(
    [...LENS_SLOTS_V1],
    [
      "risk",
      "correctness",
      "security",
      "readability",
      "spec-compliance",
    ],
  );
});

// ---------------------------------------------------------------------------
// Test 2: LENS_REGISTRY_VERSION === 1
// ---------------------------------------------------------------------------

test("T03-R-LENS-2: LENS_REGISTRY_VERSION === 1", () => {
  assert.equal(LENS_REGISTRY_VERSION, 1);
});

// ---------------------------------------------------------------------------
// Test 3: LENS_DISPLAY_NAMES has entries for all 5 slot IDs
// ---------------------------------------------------------------------------

test("T03-R-LENS-3: LENS_DISPLAY_NAMES has a display name for every slot", () => {
  for (const id of LENS_SLOTS_V1) {
    assert.ok(
      LENS_DISPLAY_NAMES[id],
      `LENS_DISPLAY_NAMES missing entry for '${id}'`,
    );
    assert.ok(
      LENS_DISPLAY_NAMES[id].length > 0,
      `LENS_DISPLAY_NAMES['${id}'] is empty`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test 4: createLensRegistry() returns a fresh registry
// ---------------------------------------------------------------------------

test("T03-R-LENS-4: createLensRegistry returns a registry with the expected API", () => {
  const registry = createLensRegistry();
  assert.equal(typeof registry.register, "function");
  assert.equal(typeof registry.get, "function");
  assert.equal(typeof registry.list, "function");
  assert.equal(typeof registry.has, "function");
});

// ---------------------------------------------------------------------------
// Test 5: fresh registry starts empty
// ---------------------------------------------------------------------------

test("T03-R-LENS-5: fresh registry is empty (Phase A: no lens implementations)", () => {
  const registry = createLensRegistry();
  assert.equal(registry.list().length, 0);
  assert.equal(registry.has("security"), false);
  assert.equal(registry.get("security"), undefined);
});

// ---------------------------------------------------------------------------
// Test 6: register adds a lens
// ---------------------------------------------------------------------------

test("T03-R-LENS-6: register adds a lens retrievable by ID", () => {
  const registry = createLensRegistry();
  const lens: Lens = {
    id: "security",
    displayName: "Security",
    description: "Catches security issues",
  };
  registry.register(lens);
  assert.equal(registry.has("security"), true);
  assert.deepEqual(registry.get("security"), lens);
  assert.equal(registry.list().length, 1);
});

// ---------------------------------------------------------------------------
// Test 7: register rejects duplicate IDs (throws)
// ---------------------------------------------------------------------------

test("T03-R-LENS-7: register throws on duplicate lens ID", () => {
  const registry = createLensRegistry();
  const lens: Lens = {
    id: "security",
    displayName: "Security",
    description: "test",
  };
  registry.register(lens);
  assert.throws(
    () => registry.register(lens),
    /already registered|dup/i,
  );
});

// ---------------------------------------------------------------------------
// Test 8: get returns undefined for unknown IDs
// ---------------------------------------------------------------------------

test("T03-R-LENS-8: get returns undefined for unknown lens IDs", () => {
  const registry = createLensRegistry();
  assert.equal(registry.get("nonexistent"), undefined);
  // Even after registering one lens, other IDs are undefined
  registry.register({
    id: "security",
    displayName: "Security",
    description: "x",
  });
  assert.equal(registry.get("correctness"), undefined);
});

// ---------------------------------------------------------------------------
// Test 9: list returns all registered lenses
// ---------------------------------------------------------------------------

test("T03-R-LENS-9: list returns all registered lenses", () => {
  const registry = createLensRegistry();
  registry.register({ id: "risk", displayName: "Risk", description: "r" });
  registry.register({ id: "security", displayName: "Sec", description: "s" });
  const all = registry.list();
  assert.equal(all.length, 2);
  const ids = all.map((l) => l.id).sort();
  assert.deepEqual(ids, ["risk", "security"]);
});

// ---------------------------------------------------------------------------
// Test 10 (TRIANGULATE): each registry instance is independent
// ---------------------------------------------------------------------------

test("T03-R-LENS-10: each createLensRegistry call returns an independent registry", () => {
  const r1 = createLensRegistry();
  const r2 = createLensRegistry();
  r1.register({ id: "security", displayName: "S", description: "x" });
  assert.equal(r1.has("security"), true);
  assert.equal(r2.has("security"), false, "r2 should not see r1's lenses");
});

// ---------------------------------------------------------------------------
// Test 11 (TRIANGULATE): Lens with run function is preserved
// ---------------------------------------------------------------------------

test("T03-R-LENS-11: lens with run function preserves the run field", () => {
  const registry = createLensRegistry();
  const runFn = async () => ({
    lensId: "security" as LensId,
    findings: [],
    durationMs: 42,
  });
  registry.register({
    id: "security",
    displayName: "Security",
    description: "test",
    run: runFn,
  });
  const lens = registry.get("security");
  assert.ok(lens);
  assert.equal(typeof lens.run, "function");
});

// ---------------------------------------------------------------------------
// Test 12 (TRIANGULATE): LENS_SLOTS_V1 is a frozen array
// ---------------------------------------------------------------------------

test("T03-R-LENS-12: LENS_SLOTS_V1 is not mutable by callers", () => {
  assert.equal(Object.isFrozen(LENS_SLOTS_V1), true, "LENS_SLOTS_V1 should be frozen");
});

// ---------------------------------------------------------------------------
// Test 13 (TRIANGULATE): list returns the same array reference until modified
// ---------------------------------------------------------------------------

test("T03-R-LENS-13: list returns a snapshot array (safe to iterate)", () => {
  const registry = createLensRegistry();
  const snapshot1 = registry.list();
  registry.register({ id: "security", displayName: "S", description: "x" });
  const snapshot2 = registry.list();
  assert.equal(snapshot1.length, 0);
  assert.equal(snapshot2.length, 1);
});
