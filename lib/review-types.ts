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

import type {
  LensId,
  LensFinding,
} from "./review-lens-framework.ts";

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
// LensRunStatus
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of a single lens run. One entry per required lens;
 * the state machine advances the status field as the review progresses:
 *   queued   → running → completed       (normal path)
 *   queued   → skipped                  (no `run` implementation registered)
 *   queued   → running → failed         (run threw; status recorded for
 *                                       inspection; the receipt still
 *                                       captures the failure, not a verdict)
 *
 * Named alias extracted from the inline union on LensRunSummary in
 * v0.6.0 (per design.md §5) so that LensRunDetail (which adds `failed`)
 * and downstream consumers share a single source of truth.
 */
export type LensRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

// ---------------------------------------------------------------------------
// LensRunSummary
// ---------------------------------------------------------------------------

/**
 * Lightweight per-lens run state. Pre-execution summary: one entry per
 * required lens, status starts at `queued`. Used in ReviewSnapshot
 * (in-memory state) and as the base for LensRunDetail.
 */
export type LensRunSummary = {
  lensId: LensId;
  status: LensRunStatus;
  personaRequired: boolean;
  findingsCount: number;
  startedAt: string | null;
  completedAt: string | null;
};

// ---------------------------------------------------------------------------
// LensRunDetail
// ---------------------------------------------------------------------------

/**
 * Rich per-lens run record persisted to the receipt (v0.6.0+, per
 * REQ-009 and design.md §5). Superset of LensRunSummary — adds the
 * actual findings array, timing, and truncation flag. A LensRunDetail
 * is structurally assignable to LensRunSummary (extra fields are
 * tolerated).
 */
export type LensRunDetail = LensRunSummary & {
  durationMs: number;
  findings: ReadonlyArray<LensFinding>;
  truncated?: boolean;
};
