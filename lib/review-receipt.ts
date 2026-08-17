// ---------------------------------------------------------------------------
// caduceus — review receipt
//
// Content-bound JSON receipt for the review state machine. The receipt
// captures the active persona, lens runs, content hash over the 5
// artifacts, and a verification flag. No cryptographic signing
// (see design.md §3.4 — owner is sole user, no supply-chain threat).
//
// The content hash covers exactly 5 files (proposal, design, tasks,
// requirements, constitution), normalized for line endings and
// trailing whitespace so cross-platform edits don't spuriously
// invalidate receipts (per design.md §5.2).
//
// See design.md §3.4, §5.2, §5.3 for the contract.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import { join, basename } from "node:path";

import { CaduceusReviewError } from "./errors.ts";
import type { PersonaSnapshot, LensRunDetail } from "./review-types.ts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ReviewReceipt = {
  schemaVersion: 1;
  changeId: string;
  contentHash: string;
  /**
   * Per-lens run records. v0.5.0 receipts carry `[]` (empty array);
   * v0.6.0+ receipts carry populated `LensRunDetail[]` with findings.
   * The field type is widened from `LensRunSummary[]` (v0.5.0) to
   * `LensRunDetail[]` (v0.6.0+); empty arrays validate either way.
   */
  lensRuns: ReadonlyArray<LensRunDetail>;
  personaSnapshot: PersonaSnapshot;
  finalVerificationPassed: boolean;
  createdAt: string;
  finalizedAt: string | null;
  validatedAt: string | null;
};

export type ValidationResult = {
  valid: boolean;
  reason?: string;
};

// ---------------------------------------------------------------------------
// Internal: file list + normalization
// ---------------------------------------------------------------------------

/** The 5 files covered by the content hash, in stable order. */
const HASHED_FILES: ReadonlyArray<string> = Object.freeze([
  "proposal.md",
  "design.md",
  "tasks.md",
  "requirements.md",
  "constitution.md",
]);

/**
 * Normalize content for content-bound hashing. Applied to each file
 * before hashing. Per design.md §5.2:
 *   - CRLF → LF (Windows-safe)
 *   - Trailing whitespace per line stripped
 *   - Exactly one trailing newline
 * Idempotent: normalize(normalize(x)) === normalize(x).
 */
export function normalize(content: string): string {
  return content
    // Strip UTF-8 BOM (\uFEFF) at file start — Windows editors (Notepad,
    // some VS Code configs) save UTF-8 files with a BOM. Without this
    // strip, BOM-prefixed content would hash differently from clean
    // content and invalidate content-bound receipts.
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/, "\n");
}

// ---------------------------------------------------------------------------
// Public API: hash
// ---------------------------------------------------------------------------

/**
 * Compute the content hash over the 5 artifact files in the change
 * directory. Returns "sha256:<64-hex>". Throws
 * `CaduceusReviewError("missing-artifact")` if any required file
 * is absent.
 */
export function computeContentHash(changeDir: string): string {
  const parts: string[] = [];
  for (const filename of HASHED_FILES) {
    const path = join(changeDir, filename);
    if (!existsSync(path)) {
      throw new CaduceusReviewError(
        "missing-artifact",
        `Required artifact missing: ${filename}`,
      );
    }
    const raw = readFileSync(path, "utf8");
    parts.push(`--- ${filename} ---\n${normalize(raw)}\n`);
  }
  const joined = parts.join("");
  const hex = createHash("sha256").update(joined, "utf8").digest("hex");
  return `sha256:${hex}`;
}

// ---------------------------------------------------------------------------
// Public API: receipt CRUD
// ---------------------------------------------------------------------------

/**
 * Write a receipt to `<changeDir>/.review/receipt.json` atomically
 * (write to `.tmp`, rename). The receipt's contentHash is computed
 * from the current artifacts at write time.
 */
export function writeReceipt(
  changeDir: string,
  personaSnapshot: PersonaSnapshot,
  finalVerificationPassed: boolean,
  lensRuns: ReadonlyArray<LensRunDetail> = [],
): ReviewReceipt {
  const reviewDir = join(changeDir, ".review");
  mkdirSync(reviewDir, { recursive: true });

  const contentHash = computeContentHash(changeDir);
  const changeId = basename(changeDir);

  const receipt: ReviewReceipt = {
    schemaVersion: 1,
    changeId,
    contentHash,
    lensRuns,
    personaSnapshot,
    finalVerificationPassed,
    createdAt: new Date().toISOString(),
    finalizedAt: finalVerificationPassed ? new Date().toISOString() : null,
    validatedAt: null,
  };

  const finalPath = join(reviewDir, "receipt.json");
  const tmpPath = `${finalPath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  renameSync(tmpPath, finalPath);

  return receipt;
}

/**
 * Read a receipt from `<changeDir>/.review/receipt.json`. Throws
 * `CaduceusReviewError("no-receipt")` if the file doesn't exist.
 */
export function readReceipt(changeDir: string): ReviewReceipt {
  const path = join(changeDir, ".review", "receipt.json");
  if (!existsSync(path)) {
    throw new CaduceusReviewError(
      "no-receipt",
      `No receipt at ${path}; start a review first.`,
    );
  }
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as ReviewReceipt;
}

// ---------------------------------------------------------------------------
// Public API: validation
// ---------------------------------------------------------------------------

/**
 * Validate a receipt against the current artifacts and (optionally)
 * the current active persona. Returns:
 *   - `{ valid: true }` if everything matches
 *   - `{ valid: false, reason: "hash-mismatch" }` if content changed
 *   - `{ valid: false, reason: "persona-mismatch" }` if persona changed
 *   - `{ valid: false, reason: "no-receipt" }` if receipt is absent
 *
 * The persona parameter is optional; when omitted, persona
 * validation is skipped.
 */
export function validateReceipt(
  changeDir: string,
  persona?: PersonaSnapshot,
): ValidationResult {
  let receipt: ReviewReceipt;
  try {
    receipt = readReceipt(changeDir);
  } catch {
    return { valid: false, reason: "no-receipt" };
  }

  // Recompute hash; if artifacts changed, hash-mismatch wins
  let currentHash: string;
  try {
    currentHash = computeContentHash(changeDir);
  } catch {
    // If artifacts are missing now, treat as hash-mismatch
    return { valid: false, reason: "hash-mismatch" };
  }
  if (currentHash !== receipt.contentHash) {
    return { valid: false, reason: "hash-mismatch" };
  }

  // Persona check (only if caller provided a persona)
  if (persona && persona.activePersona !== receipt.personaSnapshot.activePersona) {
    return { valid: false, reason: "persona-mismatch" };
  }

  return { valid: true };
}
