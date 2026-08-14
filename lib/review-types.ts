// ---------------------------------------------------------------------------
// caduceus — review types (shared)
//
// Shared types used by both lib/persona-lens-router.ts and
// lib/review-receipt.ts (and will be used by lib/review-state-machine.ts
// in T07). Extracted here to break a 3-level import chain
// (review-receipt → persona-lens-router → review-lens-framework).
//
// See design.md §3.4, §3.5, §3.6 for type contracts.
// ---------------------------------------------------------------------------

import type { LensId } from "./review-lens-framework.ts";

// ---------------------------------------------------------------------------
// PersonaSnapshot
// ---------------------------------------------------------------------------

/**
 * Snapshot of the persona + mode + locale at the moment a review
 * starts. Captured in the receipt so that switching personas
 * invalidates the receipt (see design.md §5.3).
 */
export type PersonaSnapshot = {
  activePersona: string;
  mode: "default" | "plain" | "auto";
  locale: string;
};

// ---------------------------------------------------------------------------
// LensRunSummary
// ---------------------------------------------------------------------------

/**
 * Per-lens run state. One entry per required lens; the state machine
 * advances the status field as the review progresses:
 *   queued → running → completed
 *   queued → skipped (if the lens has no `run` implementation)
 */
export type LensRunSummary = {
  lensId: LensId;
  status: "queued" | "running" | "skipped" | "completed";
  personaRequired: boolean;
  findingsCount: number;
  startedAt: string | null;
  completedAt: string | null;
};
