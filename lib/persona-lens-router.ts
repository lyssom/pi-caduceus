// ---------------------------------------------------------------------------
// caduceus — persona lens router
//
// Maps the active persona to a required-lens subset for the review
// state machine. Only 4 of the 10 built-in personas trigger lens
// requirements (security, reviewer, architect, debugger); the rest
// allocate no lens runs.
//
// See design.md §3.6 for the API contract and §6.3 for the full
// routing table.
// ---------------------------------------------------------------------------

import type { LensId, LensRegistry } from "./review-lens-framework.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Snapshot of the persona + mode + locale at the moment a review
 * starts. Used to decide which lenses are required and to record
 * the routing decision in the receipt (so the receipt is invalid
 * if the persona changes — see design.md §5.3).
 */
export type PersonaSnapshot = {
  activePersona: string;
  mode: "default" | "plain" | "auto";
  locale: string;
};

export type LensRunSummary = {
  lensId: LensId;
  status: "queued" | "running" | "skipped" | "completed";
  personaRequired: boolean;
  findingsCount: number;
  startedAt: string | null;
  completedAt: string | null;
};

export type LensSelectionRule = {
  persona: string;
  required: ReadonlyArray<LensId>;
};

// ---------------------------------------------------------------------------
// Routing table (per design.md §6.3)
// ---------------------------------------------------------------------------

/**
 * Static routing table. Each entry maps a persona name to its
 * required lens subset. Personas not in the table allocate no lens
 * runs (they are non-binding by design).
 *
 * Phase A only: 4 binding personas. Future phases may add more.
 */
export const PERSONA_LENS_ROUTING: ReadonlyArray<LensSelectionRule> =
  Object.freeze([
    { persona: "security", required: Object.freeze(["security", "risk"]) },
    {
      persona: "reviewer",
      required: Object.freeze(["readability", "spec-compliance"]),
    },
    {
      persona: "architect",
      required: Object.freeze(["spec-compliance", "risk"]),
    },
    { persona: "debugger", required: Object.freeze(["correctness"]) },
  ]);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the required lens IDs for a given persona name. Defensive:
 * returns an empty array for unknown personas (does not throw).
 * Order is preserved from the routing table.
 */
export function requiredLensesForPersona(persona: string): ReadonlyArray<LensId> {
  const entry = PERSONA_LENS_ROUTING.find((r) => r.persona === persona);
  return entry ? entry.required : [];
}

/**
 * Allocate a LensRunSummary for each lens required by the persona
 * snapshot. All runs start in `queued` status with `personaRequired:
 * true`. The state machine advances them: `queued → running →
 * completed` (or `→ skipped` if the lens has no `run` implementation,
 * per design.md §3.5).
 *
 * The `registry` parameter is accepted for forward compatibility;
 * the router always emits `queued` (the state machine owns the
 * `skipped` decision).
 */
export function allocateLensRuns(
  _registry: LensRegistry,
  snapshot: PersonaSnapshot,
): ReadonlyArray<LensRunSummary> {
  const required = requiredLensesForPersona(snapshot.activePersona);
  return Object.freeze(
    required.map(
      (lensId): LensRunSummary =>
        Object.freeze({
          lensId,
          status: "queued",
          personaRequired: true,
          findingsCount: 0,
          startedAt: null,
          completedAt: null,
        }),
    ),
  );
}
