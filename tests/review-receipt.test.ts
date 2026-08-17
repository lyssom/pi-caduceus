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
    // changeId is derived from directory basename; just assert non-empty
    assert.ok(typeof parsed.changeId === "string" && parsed.changeId.length > 0);
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
// v0.6.0 T09 tests — receipt extension (lensRuns field)
// ---------------------------------------------------------------------------

import type { LensRunDetail } from "../lib/review-types.ts";

const SAMPLE_LENS_RUN: LensRunDetail = {
  lensId: "security",
  status: "completed",
  personaRequired: true,
  findingsCount: 1,
  startedAt: "2026-08-14T12:00:00.000Z",
  completedAt: "2026-08-14T12:00:00.005Z",
  durationMs: 5,
  findings: [
    {
      severity: "P1",
      summary: "secret-like keyword 'password' in tasks.md",
      location: "tasks.md",
      recommendation: "Use a secrets manager.",
      line: 17,
    },
  ],
  truncated: false,
};

// ---------------------------------------------------------------------------
// Test T09-1 (RED): writeReceipt with no 4th arg → lensRuns: []
// ---------------------------------------------------------------------------

test("T09-R-RECEIPT-1: writeReceipt 3-arg defaults lensRuns to [] (v0.5.0-compatible)", () => {
  const dir = makeChangeDir();
  try {
    const r = writeReceipt(dir, PERSONA, true);
    assert.equal(r.lensRuns.length, 0);
    // Read raw JSON and confirm shape
    const raw = JSON.parse(
      readFileSync(join(dir, ".review", "receipt.json"), "utf8"),
    );
    assert.deepEqual(raw.lensRuns, []);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test T09-2 (RED): writeReceipt with lensRuns 4th arg → populated
// ---------------------------------------------------------------------------

test("T09-R-RECEIPT-2: writeReceipt 4-arg populates lensRuns (v0.6.0 shape)", () => {
  const dir = makeChangeDir();
  try {
    const r = writeReceipt(dir, PERSONA, true, [SAMPLE_LENS_RUN]);
    assert.equal(r.lensRuns.length, 1);
    assert.equal(r.lensRuns[0]!.lensId, "security");
    assert.equal(r.lensRuns[0]!.findings.length, 1);
    assert.equal(r.lensRuns[0]!.findings[0]!.line, 17);
    // Raw JSON shape
    const raw = JSON.parse(
      readFileSync(join(dir, ".review", "receipt.json"), "utf8"),
    );
    assert.equal(raw.lensRuns.length, 1);
    assert.equal(raw.lensRuns[0].lensId, "security");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test T09-3 (TRIANGULATE): validateReceipt accepts v0.5.0 fixture (lensRuns: [])
// ---------------------------------------------------------------------------

test("T09-R-RECEIPT-3: validateReceipt accepts v0.5.0 fixture (lensRuns: [])", () => {
  const dir = makeChangeDir();
  try {
    // Write a v0.6.0 receipt with empty lensRuns (mimics v0.5.0 shape)
    writeReceipt(dir, PERSONA, true, []);
    const result = validateReceipt(dir);
    assert.equal(result.valid, true);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test T09-4 (TRIANGULATE): validateReceipt accepts v0.6.0 fixture (populated lensRuns)
// ---------------------------------------------------------------------------

test("T09-R-RECEIPT-4: validateReceipt accepts v0.6.0 fixture (populated lensRuns)", () => {
  const dir = makeChangeDir();
  try {
    writeReceipt(dir, PERSONA, true, [SAMPLE_LENS_RUN]);
    const result = validateReceipt(dir);
    assert.equal(result.valid, true);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test T09-5: receipt contentHash unchanged by lensRuns (REQ-012)
// ---------------------------------------------------------------------------

test("T09-R-RECEIPT-5: receipt contentHash unchanged regardless of lensRuns", () => {
  const dirA = makeChangeDir();
  const dirB = makeChangeDir();
  try {
    // Same 5 MD files in both dirs; only lensRuns differs
    writeReceipt(dirA, PERSONA, true, []);
    writeReceipt(dirB, PERSONA, true, [SAMPLE_LENS_RUN]);
    const a = JSON.parse(readFileSync(join(dirA, ".review", "receipt.json"), "utf8"));
    const b = JSON.parse(readFileSync(join(dirB, ".review", "receipt.json"), "utf8"));
    assert.equal(a.contentHash, b.contentHash, "contentHash must NOT depend on lensRuns");
  } finally {
    rmSync(dirA, { recursive: true });
    rmSync(dirB, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test T09-6: writeReceipt rejects non-LensRunDetail objects (defensive)
// ---------------------------------------------------------------------------

test("T09-R-RECEIPT-6: writeReceipt serializes lensRuns with full detail fields", () => {
  const dir = makeChangeDir();
  try {
    const r = writeReceipt(dir, PERSONA, true, [
      SAMPLE_LENS_RUN,
      { ...SAMPLE_LENS_RUN, lensId: "risk", findingsCount: 0, findings: [], truncated: true },
    ]);
    // Read raw JSON; confirm ordering and field shape
    const raw = JSON.parse(
      readFileSync(join(dir, ".review", "receipt.json"), "utf8"),
    );
    assert.equal(raw.lensRuns.length, 2);
    assert.equal(raw.lensRuns[0].lensId, "security");
    assert.equal(raw.lensRuns[1].lensId, "risk");
    assert.equal(raw.lensRuns[1].truncated, true);
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
// Test 15 (I3 bug-fix RED): UTF-8 BOM at file start is normalized away
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-15a: UTF-8 BOM at file start is normalized away", () => {
  const dir = makeChangeDir();
  try {
    // Write BOM-prefixed content (\uFEFF is the UTF-8 BOM character)
    writeFileSync(join(dir, "proposal.md"), "\uFEFF# proposal.md\n\nWith BOM.\n");
    const bomHash = computeContentHash(dir);
    // Write same content without BOM
    writeFileSync(join(dir, "proposal.md"), "# proposal.md\n\nWith BOM.\n");
    const cleanHash = computeContentHash(dir);
    assert.equal(bomHash, cleanHash, "BOM and non-BOM should produce same hash");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 16 (TRIANGULATE): receipt is content-bound to all 5 files
// ---------------------------------------------------------------------------

test("T05-R-RECEIPT-16: receipt hash changes when ANY of the 5 files changes", () => {
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
