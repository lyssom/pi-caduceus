#!/usr/bin/env node
// ---------------------------------------------------------------------------
// caduceus v0.5.0 — self-archive demo
//
// Runs the full SDD + review lifecycle on the v0.5.0 change
// directory itself, demonstrating that the new lifecycle harness
// works end-to-end. Run from the repo root:
//
//   node scripts/self-archive-v0.5.0.mjs
//
// Exits 0 on success; non-zero on failure.
// ---------------------------------------------------------------------------



import { sddApply, sddArchive } from "../lib/sdd-flow.ts";
import {
  startReview,
  advanceReview,
  finalizeReview,
  validateReview,
} from "../lib/review-state-machine.ts";

const cwd = process.cwd();
const changeName = "caduceus-v0.5.0-lifecycle-foundation";

function log(stage, message) {
  console.log(`[${stage}] ${message}`);
}

async function main() {
  const changeDir = `${cwd}/openspec/changes/${changeName}`;

  // sddInit is skipped: the change dir already exists with proposal/
  // design/tasks.md files written during the v0.5.0 design process.
  // (sddInit's name regex ^[a-z0-9][a-z0-9-]*$ rejects dots in the
  // version segment; the real change dir uses dotted versions.)
  log("sdd-init", "Skipped — change dir pre-exists (3 MD files).");

  log("sdd-apply", "Marking tasks 1, 2, 3 as completed...");
  sddApply({ changeName, completedTasks: [1, 2, 3], cwd });

  log("review-start", "Starting review with persona 'architect'...");
  startReview(changeName, cwd, {
    activePersona: "architect",
    mode: "default",
    locale: "auto",
  });

  log("review-advance", "Advancing started → in-review...");
  advanceReview(changeName, cwd, "advance");

  log("review-finalize", "Finalizing with finalVerificationPassed=true...");
  const finalizeResult = finalizeReview(changeName, cwd, true);
  if (!finalizeResult.finalVerificationPassed) {
    throw new Error("finalizeReview returned finalVerificationPassed=false");
  }

  log("review-validate", "Validating receipt against current artifacts...");
  const validateResult = validateReview(changeName, cwd);
  if (!validateResult.receiptValid) {
    throw new Error(
      `validateReview returned receiptValid=false (state=${validateResult.state})`,
    );
  }

  log("sdd-archive", "Moving change to archive/...");
  sddArchive({ changeName, cwd });

  log("done", "Self-archive complete.");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`[FAIL] ${err?.message ?? err}`);
    process.exit(1);
  },
);