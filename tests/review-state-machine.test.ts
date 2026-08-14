// ---------------------------------------------------------------------------
// caduceus — review state machine tests
//
// TDD micro-cycle (T07 of caduceus-v0.5.0):
//   RED          → this file (imports fail; lib/review-state-machine.ts missing)
//   GREEN        → lib/review-state-machine.ts implements the 6-state machine
//   TRIANGULATE  → additional cases (corrupted state.json, atomic writes,
//                   persona snapshot propagation, transition history)
//
// State machine design (per design.md §3.3, §5.1):
//   States: idle | started | in-review | finalized | validated | abandoned
//   Transitions:
//     idle        → start       → started
//     started     → advance     → in-review
//     in-review   → advance     → in-review  (idempotent)
//     in-review   → finalize    → finalized
//     finalized   → validate    → validated
//     validated   → validate    → validated  (idempotent)
//     idle/started/in-review/finalized → abandon → abandoned  (terminal)
//     validated → * (FORBIDDEN — terminal state)
//
// Terminal states: validated, abandoned. From validated, only
// `validate → validated` is allowed (no abandon).
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  inspectReview,
  startReview,
  advanceReview,
  finalizeReview,
  validateReview,
} from "../lib/review-state-machine.ts";
import { CaduceusReviewError } from "../lib/errors.ts";
import type { PersonaSnapshot } from "../lib/review-types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERSONA: PersonaSnapshot = {
  activePersona: "architect",
  mode: "default",
  locale: "auto",
};

interface ChangeFixture {
  cwd: string;
  changeName: string;
  changeDir: string;
}

function makeChangeDir(changeName: string = "test-change"): ChangeFixture {
  const cwd = mkdtempSync(join(tmpdir(), "caduceus-state-"));
  const changeDir = join(cwd, "openspec", "changes", changeName);
  // Create the changeDir and the 5 required files (so computeContentHash works)
  mkdirSync(changeDir, { recursive: true });
  for (const f of ["proposal.md", "design.md", "tasks.md", "requirements.md", "constitution.md"]) {
    writeFileSync(join(changeDir, f), `# ${f}\n`);
  }
  return { cwd, changeName, changeDir };
}

// ---------------------------------------------------------------------------
// Test 1: inspectReview on fresh change returns idle snapshot
// ---------------------------------------------------------------------------

test("T07-R-STATE-1: inspectReview returns idle snapshot for fresh change", () => {
  const fx = makeChangeDir();
  try {
    const snap = inspectReview(fx.changeName, fx.cwd);
    assert.equal(snap.state, "idle");
    assert.equal(snap.changeId, fx.changeName);
    assert.equal(snap.lensRuns.length, 0);
    assert.equal(snap.transitionHistory.length, 0);
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2: startReview from idle → started, captures persona
// ---------------------------------------------------------------------------

test("T07-R-STATE-2: startReview transitions idle → started and captures persona", () => {
  const fx = makeChangeDir();
  try {
    const snap = startReview(fx.changeName, fx.cwd, PERSONA);
    assert.equal(snap.state, "started");
    assert.equal(snap.personaSnapshot.activePersona, "architect");
    // architect persona requires [spec-compliance, risk]
    assert.equal(snap.lensRuns.length, 2);
    const lensIds = snap.lensRuns.map((r) => r.lensId).sort();
    assert.deepEqual(lensIds, ["risk", "spec-compliance"]);
    // All runs queued
    for (const run of snap.lensRuns) {
      assert.equal(run.status, "queued");
      assert.equal(run.personaRequired, true);
    }
    // State file written
    assert.ok(existsSync(join(fx.changeDir, ".review", "state.json")));
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: startReview from non-idle → throws
// ---------------------------------------------------------------------------

test("T07-R-STATE-3: startReview from non-idle throws CaduceusReviewError(already-started)", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    assert.throws(
      () => startReview(fx.changeName, fx.cwd, PERSONA),
      (err: unknown) => {
        assert.ok(err instanceof CaduceusReviewError);
        assert.equal((err as CaduceusReviewError).code, "already-started");
        return true;
      },
    );
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 4: advanceReview from started → in-review
// ---------------------------------------------------------------------------

test("T07-R-STATE-4: advanceReview transitions started → in-review", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    const snap = advanceReview(fx.changeName, fx.cwd, "advance");
    assert.equal(snap.state, "in-review");
    assert.equal(snap.transitionHistory.length, 2); // start, advance
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5: advanceReview from idle → throws (must start first)
// ---------------------------------------------------------------------------

test("T07-R-STATE-5: advanceReview from idle throws invalid-transition", () => {
  const fx = makeChangeDir();
  try {
    assert.throws(
      () => advanceReview(fx.changeName, fx.cwd, "advance"),
      (err: unknown) => {
        assert.ok(err instanceof CaduceusReviewError);
        assert.equal((err as CaduceusReviewError).code, "invalid-transition");
        return true;
      },
    );
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6: finalizeReview from in-review → finalized + writes receipt
// ---------------------------------------------------------------------------

test("T07-R-STATE-6: finalizeReview transitions in-review → finalized and writes receipt", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    const result = finalizeReview(fx.changeName, fx.cwd, true);
    assert.equal(result.state, "finalized");
    assert.equal(result.finalVerificationPassed, true);
    assert.ok(
      existsSync(join(fx.changeDir, ".review", "receipt.json")),
      "receipt.json not written",
    );
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: finalizeReview from non-in-review → throws
// ---------------------------------------------------------------------------

test("T07-R-STATE-7: finalizeReview from started (not in-review) throws not-in-review", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    assert.throws(
      () => finalizeReview(fx.changeName, fx.cwd, true),
      (err: unknown) => {
        assert.ok(err instanceof CaduceusReviewError);
        assert.equal((err as CaduceusReviewError).code, "not-in-review");
        return true;
      },
    );
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 8: validateReview from finalized → validated
// ---------------------------------------------------------------------------

test("T07-R-STATE-8: validateReview transitions finalized → validated on unchanged content", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    finalizeReview(fx.changeName, fx.cwd, true);
    const result = validateReview(fx.changeName, fx.cwd);
    assert.equal(result.state, "validated");
    assert.equal(result.receiptValid, true);
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 9: validateReview detects hash-mismatch after content change
// ---------------------------------------------------------------------------

test("T07-R-STATE-9: validateReview detects hash-mismatch after content tampered", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    finalizeReview(fx.changeName, fx.cwd, true);
    // Tamper with content
    writeFileSync(join(fx.changeDir, "proposal.md"), "# proposal.md\n\nTampered.\n");
    const result = validateReview(fx.changeName, fx.cwd);
    assert.equal(result.state, "validated");  // state still transitions
    assert.equal(result.receiptValid, false);  // but receipt is invalid
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 10: abandon from any non-terminal state → abandoned
// ---------------------------------------------------------------------------

test("T07-R-STATE-10: abandon transitions non-terminal state → abandoned", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    const snap = advanceReview(fx.changeName, fx.cwd, "abandon");
    assert.equal(snap.state, "abandoned");
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 11: abandon from validated → throws (validated is terminal)
// ---------------------------------------------------------------------------

test("T07-R-STATE-11: abandon from validated throws invalid-transition (terminal state)", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    finalizeReview(fx.changeName, fx.cwd, true);
    validateReview(fx.changeName, fx.cwd);
    assert.throws(
      () => advanceReview(fx.changeName, fx.cwd, "abandon"),
      (err: unknown) => {
        assert.ok(err instanceof CaduceusReviewError);
        assert.equal((err as CaduceusReviewError).code, "invalid-transition");
        return true;
      },
    );
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 12: inspectReview returns "corrupted" snapshot on parse failure
// ---------------------------------------------------------------------------

test("T07-R-STATE-12: inspectReview returns 'corrupted' snapshot on invalid state.json", () => {
  const fx = makeChangeDir();
  try {
    mkdirSync(join(fx.changeDir, ".review"), { recursive: true });
    writeFileSync(join(fx.changeDir, ".review", "state.json"), "{ this is not valid JSON");
    const snap = inspectReview(fx.changeName, fx.cwd);
    assert.equal(snap.state, "corrupted");
    assert.ok(snap.error !== undefined && snap.error.length > 0);
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 13 (TRIANGULATE): transitionHistory records timestamps
// ---------------------------------------------------------------------------

test("T07-R-STATE-13: transitionHistory records ISO timestamps for each transition", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    const snap = advanceReview(fx.changeName, fx.cwd, "advance");
    assert.equal(snap.transitionHistory.length, 3);  // start, advance, advance
    for (const entry of snap.transitionHistory) {
      assert.match(entry.at, /^\d{4}-\d{2}-\d{2}T/);  // ISO 8601
      assert.ok(["idle", "started", "in-review"].includes(entry.from));
      assert.ok(["started", "in-review"].includes(entry.to));
    }
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 14 (TRIANGULATE): receipt captures persona snapshot
// ---------------------------------------------------------------------------

test("T07-R-STATE-14: receipt captures the persona snapshot from startReview", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    finalizeReview(fx.changeName, fx.cwd, true);
    const receipt = JSON.parse(
      readFileSync(join(fx.changeDir, ".review", "receipt.json"), "utf8"),
    );
    assert.equal(receipt.personaSnapshot.activePersona, "architect");
    assert.equal(receipt.personaSnapshot.mode, "default");
    assert.equal(receipt.personaSnapshot.locale, "auto");
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 15 (TRIANGULATE): state.json is atomically written (no .tmp left behind)
// ---------------------------------------------------------------------------

test("T07-R-STATE-15: state.json is atomically written (no .tmp residue)", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    finalizeReview(fx.changeName, fx.cwd, true);
    // After multiple writes, no .tmp file should remain
    assert.ok(!existsSync(join(fx.changeDir, ".review", "state.json.tmp")));
    assert.ok(!existsSync(join(fx.changeDir, ".review", "receipt.json.tmp")));
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 16 (TRIANGULATE): non-binding persona (e.g., pirate) allocates no lens runs
// ---------------------------------------------------------------------------

test("T07-R-STATE-16: non-binding persona allocates no lens runs", () => {
  const fx = makeChangeDir();
  try {
    const snap = startReview(fx.changeName, fx.cwd, {
      activePersona: "pirate",
      mode: "default",
      locale: "auto",
    });
    assert.equal(snap.lensRuns.length, 0);
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// Test 17 (TRIANGULATE): validateReview is idempotent (called twice)
// ---------------------------------------------------------------------------

test("T07-R-STATE-17: validateReview is idempotent on unchanged receipt", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    finalizeReview(fx.changeName, fx.cwd, true);
    const a = validateReview(fx.changeName, fx.cwd);
    const b = validateReview(fx.changeName, fx.cwd);
    assert.equal(a.state, "validated");
    assert.equal(b.state, "validated");
    assert.equal(a.receiptValid, true);
    assert.equal(b.receiptValid, true);
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});
