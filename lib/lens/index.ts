// ---------------------------------------------------------------------------
// caduceus — lens index (v0.6.0 T08)
//
// Default lens registry factory. Imports the 5 lens implementations
// and provides two registration entry points:
//
//   defaultLensRegistry()  — fresh LensRegistry with all 5 lenses
//   registerDefaultLenses(reg) — populate an existing registry
//
// Backward compat: `createLensRegistry()` (from lib/review-lens-
// framework.ts) remains empty by default. Tests that need an empty
// registry (e.g., for state-machine isolation) should keep using
// createLensRegistry(); consumers that want the full lens set should
// use defaultLensRegistry().
// ---------------------------------------------------------------------------

import type { Lens, LensRegistry } from "../review-lens-framework.ts";
import { createLensRegistry } from "../review-lens-framework.ts";

import { riskLens } from "./risk.ts";
import { correctnessLens } from "./correctness.ts";
import { securityLens } from "./security.ts";
import { readabilityLens } from "./readability.ts";
import { specComplianceLens } from "./spec-compliance.ts";

// ---------------------------------------------------------------------------
// Internal: ordered list of the 5 default lenses
// ---------------------------------------------------------------------------

/**
 * Ordered list of the 5 lens modules to register by default. Order is
 * stable so the LensRegistry `list()` output is byte-stable across
 * runs (defensive against byte-stability violations in receipt JSON).
 *
 * Adding a new lens requires appending here AND bumping
 * LENS_REGISTRY_VERSION in lib/review-lens-framework.ts.
 */
const LENS_MODULES: ReadonlyArray<Lens> = Object.freeze([
  riskLens,
  correctnessLens,
  securityLens,
  readabilityLens,
  specComplianceLens,
]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Populate an existing LensRegistry with the 5 default lens
 * implementations. Throws if any of the 5 lens IDs is already
 * registered (the registry's `register` enforces uniqueness; we surface
 * the error verbatim).
 */
export function registerDefaultLenses(registry: LensRegistry): void {
  for (const lens of LENS_MODULES) {
    registry.register(lens);
  }
}

/**
 * Create a fresh LensRegistry pre-populated with the 5 default lens
 * implementations. Convenience wrapper around `createLensRegistry()`
 * + `registerDefaultLenses()`.
 *
 * Each call returns an independent registry (per createLensRegistry's
 * contract).
 */
export function defaultLensRegistry(): LensRegistry {
  const reg = createLensRegistry();
  registerDefaultLenses(reg);
  return reg;
}