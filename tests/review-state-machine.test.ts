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
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  inspectReview,
  startReview,
  advanceReview,
  finalizeReview,
  validateReview,
  resetReview,
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

test("T07-R-STATE-6: finalizeReview transitions in-review → finalized and writes receipt", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    const result = await finalizeReview(fx.changeName, fx.cwd, true);
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

test("T07-R-STATE-7: finalizeReview from started (not in-review) throws not-in-review", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    await assert.rejects(
      finalizeReview(fx.changeName, fx.cwd, true),
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

test("T07-R-STATE-8: validateReview transitions finalized → validated on unchanged content", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    await finalizeReview(fx.changeName, fx.cwd, true);
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

test("T07-R-STATE-9: validateReview detects hash-mismatch after content tampered", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    await finalizeReview(fx.changeName, fx.cwd, true);
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

test("T07-R-STATE-11: abandon from validated throws invalid-transition (terminal state)", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    await finalizeReview(fx.changeName, fx.cwd, true);
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

test("T07-R-STATE-14: receipt captures the persona snapshot from startReview", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    await finalizeReview(fx.changeName, fx.cwd, true);
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

test("T07-R-STATE-15: state.json is atomically written (no .tmp residue)", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    await finalizeReview(fx.changeName, fx.cwd, true);
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

test("T07-R-STATE-16: non-binding persona allocates no lens runs", async () => {
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

test("T07-R-STATE-17: validateReview is idempotent on unchanged receipt", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    await finalizeReview(fx.changeName, fx.cwd, true);
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

// ---------------------------------------------------------------------------
// T10 tests (v0.6.0 state-machine integration with lens runs)
// ---------------------------------------------------------------------------

test("T10-R-STATE-18: finalizeReview with security persona runs 2 lenses (security + risk)", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, {
      activePersona: "security",
      mode: "default",
      locale: "auto",
    });
    advanceReview(fx.changeName, fx.cwd, "advance");
    const result = await finalizeReview(fx.changeName, fx.cwd, true);
    assert.equal(result.lensRuns.length, 2);
    const lensIds = result.lensRuns.map((r) => r.lensId).sort();
    assert.deepEqual(lensIds, ["risk", "security"]);
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

test("T10-R-STATE-19: finalizeReview with plain persona → 0 lens runs", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, {
      activePersona: "plain",
      mode: "plain",
      locale: "auto",
    });
    advanceReview(fx.changeName, fx.cwd, "advance");
    const result = await finalizeReview(fx.changeName, fx.cwd, true);
    assert.equal(result.lensRuns.length, 0);
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

test("T10-R-STATE-20 (TRIANGULATE): lens without run() gets status='skipped'", async () => {
  const fx = makeChangeDir();
  try {
    const { createLensRegistry } = await import(
      "../lib/review-lens-framework.ts"
    );
    const emptyReg = createLensRegistry();
    const { runLensSet } = await import("../lib/review-state-machine.ts");
    const runs = await runLensSet(
      emptyReg,
      { activePersona: "security", mode: "default", locale: "auto" },
      fx.changeDir,
    );
    // Security persona requires [security, risk] but registry is empty
    assert.equal(runs.length, 2);
    assert.ok(runs.every((r) => r.status === "skipped"));
    assert.ok(runs.every((r) => r.findings.length === 0));
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

test("T10-R-STATE-21 (TRIANGULATE): lens that throws gets status='failed'", async () => {
  const fx = makeChangeDir();
  try {
    const reg = (await import("../lib/review-lens-framework.ts"))
      .createLensRegistry();
    reg.register({
      id: "security",
      displayName: "Security",
      description: "throws",
      run: async () => {
        throw new Error("simulated lens failure");
      },
    });
    const { runLensSet } = await import("../lib/review-state-machine.ts");
    const runs = await runLensSet(
      reg,
      { activePersona: "security", mode: "default", locale: "auto" },
      fx.changeDir,
    );
    const security = runs.find((r) => r.lensId === "security");
    assert.ok(security);
    assert.equal(security!.status, "failed");
    assert.equal(security!.findings.length, 0);
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

test("T10-R-STATE-22 (TRIANGULATE): receipt lensRuns mirrors state lensRuns", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, {
      activePersona: "security",
      mode: "default",
      locale: "auto",
    });
    advanceReview(fx.changeName, fx.cwd, "advance");
    const result = await finalizeReview(fx.changeName, fx.cwd, true);
    const receipt = JSON.parse(
      readFileSync(
        join(fx.changeDir, ".review", "receipt.json"),
        "utf8",
      ),
    );
    assert.equal(receipt.lensRuns.length, result.lensRuns.length);
    for (let i = 0; i < receipt.lensRuns.length; i++) {
      assert.equal(receipt.lensRuns[i].lensId, result.lensRuns[i]!.lensId);
    }
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

test("T10-R-STATE-23: receipt contentHash unchanged regardless of lensRuns (REQ-012)", async () => {
  const fxA = makeChangeDir();
  const fxB = makeChangeDir();
  try {
    startReview(fxA.changeName, fxA.cwd, PERSONA);
    advanceReview(fxA.changeName, fxA.cwd, "advance");
    await finalizeReview(fxA.changeName, fxA.cwd, true);
    startReview(fxB.changeName, fxB.cwd, {
      activePersona: "security",
      mode: "default",
      locale: "auto",
    });
    advanceReview(fxB.changeName, fxB.cwd, "advance");
    await finalizeReview(fxB.changeName, fxB.cwd, true);
    const a = JSON.parse(
      readFileSync(join(fxA.changeDir, ".review", "receipt.json"), "utf8"),
    );
    const b = JSON.parse(
      readFileSync(join(fxB.changeDir, ".review", "receipt.json"), "utf8"),
    );
    assert.equal(a.contentHash, b.contentHash);
  } finally {
    rmSync(fxA.cwd, { recursive: true });
    rmSync(fxB.cwd, { recursive: true });
  }
});

// ---------------------------------------------------------------------------
// T11 tests (v0.6.0 resetReview real implementation)
// ---------------------------------------------------------------------------

test("T11-R-STATE-24: resetReview archives state.json on valid state", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    const result = resetReview(fx.changeName, fx.cwd);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(result.archivedPath, /state\.json\.corrupt-/);
      assert.ok(existsSync(join(fx.changeDir, ".review", result.archivedPath)));
      assert.ok(!existsSync(join(fx.changeDir, ".review", "state.json")));
    }
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

test("T11-R-STATE-25: resetReview returns { ok: false, reason: 'no-state' } when state.json absent", () => {
  const fx = makeChangeDir();
  try {
    const result = resetReview(fx.changeName, fx.cwd);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, "no-state");
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

test("T11-R-STATE-26 (TRIANGULATE): resetReview also archives receipt.json if present", async () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    advanceReview(fx.changeName, fx.cwd, "advance");
    await finalizeReview(fx.changeName, fx.cwd, true);
    assert.ok(existsSync(join(fx.changeDir, ".review", "receipt.json")));
    resetReview(fx.changeName, fx.cwd);
    assert.ok(!existsSync(join(fx.changeDir, ".review", "receipt.json")));
    // receipt.json should now be archived as receipt.json.corrupt-<ts>
    const reviewDir = join(fx.changeDir, ".review");
    const archivedReceipts = readdirSync(reviewDir).filter(
      (f) => f.startsWith("receipt.json.corrupt-"),
    );
    assert.ok(archivedReceipts.length >= 1);
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

test("T11-R-STATE-27 (TRIANGULATE): inspectIsCorrupted returns true on corrupt state.json", () => {
  const fx = makeChangeDir();
  try {
    mkdirSync(join(fx.changeDir, ".review"), { recursive: true });
    writeFileSync(
      join(fx.changeDir, ".review", "state.json"),
      "{ this is not valid JSON",
      "utf8",
    );
    const snap = inspectReview(fx.changeName, fx.cwd);
    assert.equal(snap.state, "corrupted");
    assert.ok(snap.error && snap.error.length > 0);
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});

test("T11-R-STATE-28 (TRIANGULATE): inspectIsCorrupted returns false on valid state.json", () => {
  const fx = makeChangeDir();
  try {
    startReview(fx.changeName, fx.cwd, PERSONA);
    const snap = inspectReview(fx.changeName, fx.cwd);
    assert.notEqual(snap.state, "corrupted");
  } finally {
    rmSync(fx.cwd, { recursive: true });
  }
});
