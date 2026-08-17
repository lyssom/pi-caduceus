// ---------------------------------------------------------------------------
// caduceus — lens index tests (v0.6.0 T08)
//
// TDD micro-cycle (T08 of caduceus-v0.6.0):
//   RED          → this file (lib/lens/index.ts not yet implemented)
//   GREEN        → lib/lens/index.ts exports defaultLensRegistry() +
//                  registerDefaultLenses(reg)
//   TRIANGULATE  → tests 3-4: cross-file lens type compatibility; all run
//                  functions callable
//   REFACTOR     → LENS_MODULES array
//
// Backward-compat contract: createLensRegistry() (in lib/review-lens-
// framework.ts) must REMAIN empty by default for test isolation
// (REQ-021 implicit). defaultLensRegistry() is a separate factory that
// pre-populates the 5 lens implementations.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";

import { LENS_SLOTS_V1 } from "../../lib/review-lens-framework.ts";
import {
  defaultLensRegistry,
  registerDefaultLenses,
} from "../../lib/lens/index.ts";

// ---------------------------------------------------------------------------
// Test 1 (RED): defaultLensRegistry() registers all 5 lens implementations
// ---------------------------------------------------------------------------

test("T08-R-INDEX-1: defaultLensRegistry registers all 5 lens implementations", () => {
  const reg = defaultLensRegistry();
  assert.equal(reg.list().length, 5);
  for (const id of LENS_SLOTS_V1) {
    assert.ok(reg.has(id), `registry must have lens '${id}'`);
  }
});

// ---------------------------------------------------------------------------
// Test 2 (RED): registerDefaultLenses(reg) populates an existing registry
// ---------------------------------------------------------------------------

test("T08-R-INDEX-2: registerDefaultLenses(populates an empty registry)", async () => {
  const { createLensRegistry } = await import(
    "../../lib/review-lens-framework.ts"
  );
  const reg = createLensRegistry();
  assert.equal(reg.list().length, 0, "fresh registry should be empty before registration");
  registerDefaultLenses(reg);
  assert.equal(reg.list().length, 5);
});

// ---------------------------------------------------------------------------
// Test 3 (TRIANGULATE): all 5 lens .run functions are callable
// ---------------------------------------------------------------------------

test("T08-R-INDEX-3: all 5 lens .run functions are callable (TRIANGULATE)", async () => {
  const reg = defaultLensRegistry();
  const tmpDir = "/tmp/caduceus-empty-dir-no-such-path";
  for (const id of LENS_SLOTS_V1) {
    const lens = reg.get(id);
    assert.ok(lens, `lens '${id}' must be registered`);
    assert.equal(typeof lens.run, "function", `lens '${id}' must have a run function`);
    // The run function must accept a changeDir string and return a Promise.
    // We pass a non-existent dir to verify the function is callable without
    // throwing (each lens handles missing files gracefully).
    const result = lens.run!(tmpDir);
    assert.ok(result instanceof Promise, `lens '${id}' run must return Promise`);
    const findings = await result;
    assert.equal(findings.lensId, id);
    assert.ok(Array.isArray(findings.findings));
  }
});

// ---------------------------------------------------------------------------
// Test 4 (TRIANGULATE): each lens has matching id (registry lensId === Lens.id)
// ---------------------------------------------------------------------------

test("T08-R-INDEX-4: each registered lens.id matches its lensId on LensFindings", () => {
  const reg = defaultLensRegistry();
  for (const lens of reg.list()) {
    assert.ok(typeof lens.id === "string");
    assert.ok(LENS_SLOTS_V1.includes(lens.id));
  }
});

// ---------------------------------------------------------------------------
// Test 5: registerDefaultLenses throws if a lens id is already registered
// ---------------------------------------------------------------------------

test("T08-R-INDEX-5: registerDefaultLenses throws on duplicate registration", () => {
  const reg = defaultLensRegistry();
  // Already populated; second call must throw.
  assert.throws(
    () => registerDefaultLenses(reg),
    /already registered/,
  );
});

// ---------------------------------------------------------------------------
// Test 6: LENS_SLOTS_V1 stable order (defensive — ordering matters for
// byte-stable lensRuns serialization)
// ---------------------------------------------------------------------------

test("T08-R-INDEX-6: LENS_SLOTS_V1 order is stable (defensive)", () => {
  assert.deepEqual(
    Array.from(LENS_SLOTS_V1),
    [
      "risk",
      "correctness",
      "security",
      "readability",
      "spec-compliance",
    ],
  );
});