// ---------------------------------------------------------------------------
// caduceus — review state machine
//
// 6-state, 5-transition state machine for the review gate (v0.5.0).
// Per design.md §3.3 and §5.1:
//
//   States: idle | started | in-review | finalized | validated | abandoned
//   (corrupted is a synthetic state surfaced by inspectReview when
//    state.json cannot be parsed.)
//
//   Transitions:
//     idle        → start       → started        (via startReview)
//     started     → advance     → in-review      (via advanceReview)
//     in-review   → advance     → in-review      (idempotent)
//     in-review   → finalize    → finalized      (via finalizeReview)
//     finalized   → validate    → validated      (via validateReview)
//     validated   → validate    → validated      (idempotent)
//     idle/started/in-review/finalized → abandon → abandoned
//     (validated is terminal; no transition out except validate→validated)
//     (abandoned is terminal; to re-review, use /caduceus:review:reset)
//
// Storage: openspec/changes/<name>/.review/state.json (atomic write)
//          openspec/changes/<name>/.review/receipt.json (atomic write)
//
// See design.md §3.3, §5.1, §12 R3 (corrupted-state recovery).
// ---------------------------------------------------------------------------

import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";

import { CaduceusReviewError } from "./errors.ts";
import {
  type PersonaSnapshot,
  type LensRunSummary,
} from "./review-types.ts";
import { createLensRegistry } from "./review-lens-framework.ts";
import { allocateLensRuns } from "./persona-lens-router.ts";
import { writeReceipt, readReceipt, computeContentHash } from "./review-receipt.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ReviewState =
  | "idle"
  | "started"
  | "in-review"
  | "finalized"
  | "validated"
  | "abandoned"
  | "corrupted";

export type ReviewTransition = "advance" | "abandon";

export type TransitionRecord = {
  from: ReviewState;
  to: ReviewState;
  at: string;
};

export type ReviewSnapshot = {
  schemaVersion: 1;
  changeId: string;
  state: ReviewState;
  lensRuns: ReadonlyArray<LensRunSummary>;
  personaSnapshot: PersonaSnapshot;
  lastTransitionAt: string;
  transitionHistory: ReadonlyArray<TransitionRecord>;
  error?: string;  // populated when state === "corrupted"
};

export type FinalizeResult = ReviewSnapshot & {
  finalVerificationPassed: boolean;
};

export type ValidateResult = ReviewSnapshot & {
  receiptValid: boolean;
};

// ---------------------------------------------------------------------------
// Internal: paths + atomic I/O
// ---------------------------------------------------------------------------

const STATE_FILE = "state.json";
const RECEIPT_FILE = "receipt.json";

function changeDir(changeName: string, cwd: string): string {
  return join(cwd, "openspec", "changes", changeName);
}

function reviewDir(cd: string): string {
  return join(cd, ".review");
}

function statePath(cd: string): string {
  return join(reviewDir(cd), STATE_FILE);
}

function atomicWriteJSON(path: string, data: unknown): void {
  mkdirSync(reviewDir(join(path, "..")), { recursive: true });
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  renameSync(tmpPath, path);
}

function readState(cd: string): ReviewSnapshot | null {
  const p = statePath(cd);
  if (!existsSync(p)) return null;
  const raw = readFileSync(p, "utf8");
  return JSON.parse(raw) as ReviewSnapshot;
}

// ---------------------------------------------------------------------------
// Initial / fallback snapshots
// ---------------------------------------------------------------------------

function initialSnapshot(changeName: string): ReviewSnapshot {
  return Object.freeze({
    schemaVersion: 1,
    changeId: changeName,
    state: "idle",
    lensRuns: Object.freeze([]),
    personaSnapshot: Object.freeze({
      activePersona: "",
      mode: "default",
      locale: "auto",
    }),
    lastTransitionAt: new Date().toISOString(),
    transitionHistory: Object.freeze([]),
  }) as ReviewSnapshot;
}

function corruptedSnapshot(changeName: string, error: string): ReviewSnapshot {
  return Object.freeze({
    schemaVersion: 1,
    changeId: changeName,
    state: "corrupted",
    lensRuns: Object.freeze([]),
    personaSnapshot: Object.freeze({
      activePersona: "",
      mode: "default",
      locale: "auto",
    }),
    lastTransitionAt: new Date().toISOString(),
    transitionHistory: Object.freeze([]),
    error,
  }) as ReviewSnapshot;
}

// ---------------------------------------------------------------------------
// Public API: inspect (read-only)
// ---------------------------------------------------------------------------

export function inspectReview(changeName: string, cwd: string): ReviewSnapshot {
  const cd = changeDir(changeName, cwd);
  try {
    const snap = readState(cd);
    if (snap) return snap;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return corruptedSnapshot(changeName, `state.json parse error: ${msg}`);
  }
  return initialSnapshot(changeName);
}

// ---------------------------------------------------------------------------
// Public API: start
// ---------------------------------------------------------------------------

export function startReview(
  changeName: string,
  cwd: string,
  personaSnapshot: PersonaSnapshot,
): ReviewSnapshot {
  const cd = changeDir(changeName, cwd);

  // Reject if a non-idle state file exists.
  try {
    const existing = readState(cd);
    if (existing) {
      throw new CaduceusReviewError(
        "already-started",
        `Review already in state '${existing.state}'; use /caduceus:review:reset to start fresh.`,
      );
    }
  } catch (err) {
    if (err instanceof CaduceusReviewError) throw err;
    // Corrupt state.json: surface as CaduceusReviewError so the caller
    // knows to invoke reset.
    const msg = err instanceof Error ? err.message : String(err);
    throw new CaduceusReviewError(
      "already-started",
      `State file corrupted: ${msg}; use /caduceus:review:reset.`,
    );
  }

  // Allocate lens runs for the persona.
  const registry = createLensRegistry();
  const lensRuns = allocateLensRuns(registry, personaSnapshot);

  const now = new Date().toISOString();
  const snap: ReviewSnapshot = {
    schemaVersion: 1,
    changeId: changeName,
    state: "started",
    lensRuns,
    personaSnapshot,
    lastTransitionAt: now,
    transitionHistory: [
      { from: "idle", to: "started", at: now },
    ],
  };

  atomicWriteJSON(statePath(cd), snap);
  return snap;
}

// ---------------------------------------------------------------------------
// Public API: advance (advance / abandon)
// ---------------------------------------------------------------------------

export function advanceReview(
  changeName: string,
  cwd: string,
  transition: ReviewTransition,
): ReviewSnapshot {
  const cd = changeDir(changeName, cwd);
  const current = requireState(cd, changeName);

  let nextState: ReviewState;
  if (transition === "advance") {
    if (current.state === "started") nextState = "in-review";
    else if (current.state === "in-review") nextState = "in-review"; // idempotent
    else
      throw new CaduceusReviewError(
        "invalid-transition",
        `Cannot 'advance' from state '${current.state}'.`,
      );
  } else if (transition === "abandon") {
    // Terminal states cannot be abandoned.
    if (current.state === "validated" || current.state === "abandoned") {
      throw new CaduceusReviewError(
        "invalid-transition",
        `Cannot 'abandon' from terminal state '${current.state}'.`,
      );
    }
    if (current.state === "idle") {
      throw new CaduceusReviewError(
        "invalid-transition",
        `Cannot 'abandon' from state 'idle'; nothing to abandon.`,
      );
    }
    nextState = "abandoned";
  } else {
    throw new CaduceusReviewError(
      "invalid-transition",
      `Unknown transition: '${transition as string}'.`,
    );
  }

  return persistTransition(cd, current, nextState);
}

// ---------------------------------------------------------------------------
// Public API: finalize
// ---------------------------------------------------------------------------

export function finalizeReview(
  changeName: string,
  cwd: string,
  finalVerificationPassed: boolean,
): FinalizeResult {
  const cd = changeDir(changeName, cwd);
  const current = requireState(cd, changeName);

  if (current.state !== "in-review") {
    throw new CaduceusReviewError(
      "not-in-review",
      `Cannot finalize from state '${current.state}'; must be 'in-review'.`,
    );
  }

  // Write the receipt using the persona snapshot captured at startReview.
  writeReceipt(cd, current.personaSnapshot, finalVerificationPassed);

  // The receipt carries its own lensRuns snapshot; mirror it into the state.
  const receipt = readReceipt(cd);
  const next: ReviewSnapshot = {
    ...current,
    state: "finalized",
    lensRuns: receipt.lensRuns.length > 0 ? receipt.lensRuns : current.lensRuns,
    lastTransitionAt: new Date().toISOString(),
    transitionHistory: [
      ...current.transitionHistory,
      { from: current.state, to: "finalized", at: new Date().toISOString() },
    ],
  };
  atomicWriteJSON(statePath(cd), next);

  return { ...next, finalVerificationPassed };
}

// ---------------------------------------------------------------------------
// Public API: validate
// ---------------------------------------------------------------------------

export function validateReview(
  changeName: string,
  cwd: string,
): ValidateResult {
  const cd = changeDir(changeName, cwd);
  const current = requireState(cd, changeName);

  if (current.state !== "finalized" && current.state !== "validated") {
    throw new CaduceusReviewError(
      "not-finalized",
      `Cannot validate from state '${current.state}'; must be 'finalized' or 'validated'.`,
    );
  }

  // Re-validate the receipt against current artifacts.
  let receiptValid = true;
  try {
    const receipt = readReceipt(cd);
    const currentHash = computeContentHash(cd);
    if (currentHash !== receipt.contentHash) {
      receiptValid = false;
    }
    if (current.personaSnapshot.activePersona !== receipt.personaSnapshot.activePersona) {
      receiptValid = false;
    }
  } catch {
    receiptValid = false;
  }

  // Idempotent: from validated, stay in validated with the same result.
  const next: ReviewSnapshot = current.state === "validated"
    ? current
    : {
        ...current,
        state: "validated",
        lastTransitionAt: new Date().toISOString(),
        transitionHistory: [
          ...current.transitionHistory,
          { from: current.state, to: "validated", at: new Date().toISOString() },
        ],
      };

  if (current.state !== "validated") {
    atomicWriteJSON(statePath(cd), next);
  }

  return { ...next, receiptValid };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function requireState(cd: string, changeName: string): ReviewSnapshot {
  try {
    const snap = readState(cd);
    if (snap) return snap;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new CaduceusReviewError(
      "invalid-transition",
      `State file corrupted: ${msg}; use /caduceus:review:reset.`,
    );
  }
  // No state file: synthesize an idle snapshot so callers can surface
  // invalid-transition rather than already-started.
  return initialSnapshot(changeName);
}

function persistTransition(
  cd: string,
  current: ReviewSnapshot,
  nextState: ReviewState,
): ReviewSnapshot {
  const now = new Date().toISOString();
  const next: ReviewSnapshot = {
    ...current,
    state: nextState,
    lastTransitionAt: now,
    transitionHistory: [
      ...current.transitionHistory,
      { from: current.state, to: nextState, at: now },
    ],
  };
  atomicWriteJSON(statePath(cd), next);
  return next;
}
