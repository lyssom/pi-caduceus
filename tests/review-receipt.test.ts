// ---------------------------------------------------------------------------
// caduceus — review receipt tests
//
// TDD micro-cycle (T05 of caduceus-v0.5.0):
//   RED          → this file (imports fail; lib/review-receipt.ts missing)
//   GREEN        → lib/review-receipt.ts implements hash + CRUD + validate
//   TRIANGULATE  → additional cases (atomic writes, persona snapshot in hash)
//
// Tests use a per-test temp directory with hand-crafted fixtures
// (no dependency on sdd-flow, per design.md §8.1 step 5).
//
// See design.md §3.4, §5.2, §5.3 for the API contract.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  computeContentHash,
  writeReceipt,
  readReceipt,
  validateReceipt,
} from "../lib/review-receipt.ts";
import { CaduceusReviewError } from "../lib/errors.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChangeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "caduceus-receipt-"));
  // Create the 5 required files
  for (const f of ["proposal.md", "design.md", "tasks.md", "requirements.md", "constitution.md"]) {
    writeFileSync(join(dir, f), `# ${f}\n\nContent of ${f}.\n`);
  }
  return dir;
}

const PERSONA = {
  activePersona: "architect",
  mode: "default" as const,
  locale: "auto",
};

// ---------------------------------------------------------------------------
// Test 1: computeContentHash returns sha256: prefix + 64 hex chars
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-1: computeContentHash returns 'sha256:<64-hex>'", () => {
  const dir = makeChangeDir();
  try {
    const hash = computeContentHash(dir);
    assert.match(hash, /^sha256:[0-9a-f]{64}$/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2: same inputs → same hash (deterministic)
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-2: computeContentHash is deterministic for identical inputs", () => {
  const dir = makeChangeDir();
  try {
    const a = computeContentHash(dir);
    const b = computeContentHash(dir);
    assert.equal(a, b);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: different content → different hash
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-3: computeContentHash detects content changes", () => {
  const dir = makeChangeDir();
  try {
    const before = computeContentHash(dir);
    writeFileSync(join(dir, "proposal.md"), "# proposal.md\n\nChanged content.\n");
    const after = computeContentHash(dir);
    assert.notEqual(before, after);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4: missing required file → CaduceusReviewError("missing-artifact")
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-4: missing required file throws CaduceusReviewError", () => {
  const dir = makeChangeDir();
  try {
    rmSync(join(dir, "requirements.md"));
    assert.throws(
      () => computeContentHash(dir),
      (err: unknown) => {
        assert.ok(err instanceof CaduceusReviewError);
        assert.equal((err as CaduceusReviewError).code, "missing-artifact");
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5: writeReceipt creates receipt.json
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-5: writeReceipt creates .review/receipt.json", () => {
  const dir = makeChangeDir();
  try {
    writeReceipt(dir, PERSONA, true);
    assert.ok(existsSync(join(dir, ".review", "receipt.json")));
    const parsed = JSON.parse(readFileSync(join(dir, ".review", "receipt.json"), "utf8"));
    assert.equal(parsed.finalVerificationPassed, true);
    assert.equal(parsed.personaSnapshot.activePersona, "architect");
    assert.equal(parsed.changeId, "test");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6: readReceipt parses a written receipt
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-6: readReceipt parses a written receipt round-trip", () => {
  const dir = makeChangeDir();
  try {
    writeReceipt(dir, PERSONA, false);
    const receipt = readReceipt(dir);
    assert.equal(receipt.finalVerificationPassed, false);
    assert.equal(receipt.personaSnapshot.activePersona, "architect");
    assert.match(receipt.contentHash, /^sha256:/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: readReceipt on missing file → CaduceusReviewError("no-receipt")
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-7: readReceipt throws CaduceusReviewError when receipt.json missing", () => {
  const dir = makeChangeDir();
  try {
    assert.throws(
      () => readReceipt(dir),
      (err: unknown) => {
        assert.ok(err instanceof CaduceusReviewError);
        assert.equal((err as CaduceusReviewError).code, "no-receipt");
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 8: validateReceipt returns { valid: true } on unchanged content
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-8: validateReceipt returns { valid: true } when content hash matches", () => {
  const dir = makeChangeDir();
  try {
    writeReceipt(dir, PERSONA, true);
    const result = validateReceipt(dir);
    assert.equal(result.valid, true);
    assert.equal(result.reason, undefined);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 9: validateReceipt returns { valid: false, reason: "hash-mismatch" } on content change
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-9: validateReceipt detects hash mismatch after content change", () => {
  const dir = makeChangeDir();
  try {
    writeReceipt(dir, PERSONA, true);
    writeFileSync(join(dir, "proposal.md"), "# proposal.md\n\nTampered.\n");
    const result = validateReceipt(dir);
    assert.equal(result.valid, false);
    assert.equal(result.reason, "hash-mismatch");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 10: validateReceipt detects persona mismatch
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-10: validateReceipt detects persona mismatch", () => {
  const dir = makeChangeDir();
  try {
    writeReceipt(dir, PERSONA, true);
    // Same content hash, different persona passed in
    const result = validateReceipt(dir, {
      activePersona: "pirate",  // different from receipt's "architect"
      mode: "default",
      locale: "auto",
    });
    assert.equal(result.valid, false);
    assert.equal(result.reason, "persona-mismatch");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 11: validateReceipt is idempotent (running twice on unchanged receipt)
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-11: validateReceipt is idempotent on unchanged receipt", () => {
  const dir = makeChangeDir();
  try {
    writeReceipt(dir, PERSONA, true);
    const a = validateReceipt(dir);
    const b = validateReceipt(dir);
    assert.deepEqual(a, b);
    assert.equal(a.valid, true);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 12 (TRIANGULATE): CRLF in content is normalized before hashing
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-12: CRLF line endings are normalized (Windows-safe)", () => {
  const dir = makeChangeDir();
  try {
    writeFileSync(join(dir, "proposal.md"), "# proposal.md\r\n\r\nCRLF content.\r\n");
    const crlfHash = computeContentHash(dir);
    // Rewrite with LF only — same logical content
    writeFileSync(join(dir, "proposal.md"), "# proposal.md\n\nCRLF content.\n");
    const lfHash = computeContentHash(dir);
    assert.equal(crlfHash, lfHash, "CRLF and LF should produce same hash");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 13 (TRIANGULATE): trailing whitespace is normalized
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-13: trailing whitespace does not affect hash", () => {
  const dir = makeChangeDir();
  try {
    writeFileSync(join(dir, "proposal.md"), "# proposal.md\n\nTrailing spaces.   \n");
    const trailingHash = computeContentHash(dir);
    writeFileSync(join(dir, "proposal.md"), "# proposal.md\n\nTrailing spaces.\n");
    const cleanHash = computeContentHash(dir);
    assert.equal(trailingHash, cleanHash);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 14 (TRIANGULATE): receipt includes changeId from directory name
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-14: receipt changeId is derived from directory name", () => {
  const dir = makeChangeDir();
  try {
    writeReceipt(dir, PERSONA, true);
    const receipt = readReceipt(dir);
    // The basename of the tmp dir; we just assert it's a non-empty string
    assert.ok(typeof receipt.changeId === "string");
    assert.ok(receipt.changeId.length > 0);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 15 (TRIANGULATE): receipt is content-bound to all 5 files
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-15: receipt hash changes when ANY of the 5 files changes", () => {
  const dir = makeChangeDir();
  try {
    const original = computeContentHash(dir);
    const files = ["proposal.md", "design.md", "tasks.md", "requirements.md", "constitution.md"];
    for (const f of files) {
      const dirCopy = makeChangeDir();
      try {
        writeFileSync(join(dirCopy, f), `# ${f}\n\nDifferent content for ${f}.\n`);
        const modified = computeContentHash(dirCopy);
        assert.notEqual(
          original,
          modified,
          `changing ${f} should change hash but didn't`,
        );
      } finally {
        rmSync(dirCopy, { recursive: true });
      }
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});
