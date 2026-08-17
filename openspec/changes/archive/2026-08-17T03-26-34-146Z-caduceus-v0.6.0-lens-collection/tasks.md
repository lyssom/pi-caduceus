<!-- caduceus:tasks-template-version 0.6.0 -->

# caduceus v0.6.0 — Tasks

> **Date:** 2026-08-14
> **Change:** `caduceus-v0.6.0-lens-collection`
> **Method:** Strict TDD — RED → GREEN → TRIANGULATE → REFACTOR per task.

## Task 1: Bump template version + renderTasks upgrade

> Foundation: every other task depends on the v0.6.0 marker being
> present in `tasks.md`. Bump first.

- [ ] Step 1.1 — RED test: write a failing test in
  `tests/sdd-templates.test.ts` asserting `TEMPLATE_VERSION === "0.6.0"`
  and `renderTasks` includes "## Verification contract" section with a
  `**Done when:**` placeholder per task.
- [ ] Step 1.2 — GREEN: bump `TEMPLATE_VERSION` constant in
  `lib/sdd-templates.ts`; update all 5 marker strings; add the optional
  verification contract section to `renderTasks` body (with `**Done when:**`
  on its own line, indented under each `## Task N:`).
- [ ] Step 1.3 — TRIANGULATE: add a second test asserting that all 5
  templates carry the `<!-- caduceus:<id>-template-version 0.6.0 -->`
  marker and that the markers are byte-stable across two consecutive
  `renderTasks()` calls.
- [ ] Step 1.4 — REFACTOR: extract a `renderTaskContract(taskNumber)`
  helper that produces the per-task verification block.

## Task 2: Type extensions (LensFinding.line, LensFindings.truncated, LensRunDetail)

> Foundation: types must be in place before any lens implementation
> can compile. Do this immediately after Task 1.

- [ ] Step 2.1 — RED: test in `tests/review-types.test.ts` (new file)
  asserting that `LensFinding` accepts `line?: number`, `LensFindings`
  accepts `truncated?: boolean`, and the new `LensRunDetail` type
  carries `lensId`, `status`, `findingsCount`, `durationMs`, `findings`,
  `personaRequired`, `startedAt`, `completedAt`, `truncated?`.
- [ ] Step 2.2 — GREEN: extend types in `lib/review-types.ts` —
  add `line?: number` to `LensFinding`, `truncated?: boolean` to
  `LensFindings`, new `LensRunDetail` type, new `LensRunStatus` union.
- [ ] Step 2.3 — TRIANGULATE: test that `LensRunDetail.findings` is
  `ReadonlyArray<LensFinding>` (immutable) and that
  `LensRunStatus` includes `"failed"` (the new state for caught exceptions
  in `runLensSet`).
- [ ] Step 2.4 — REFACTOR: extract `LensRunStatus` union into a
  named type alias if not already exported.

## Task 3: Implement `lib/lens/risk.ts`

- [ ] Step 3.1 — RED: write `tests/lens/risk.test.ts` (new file)
  asserting:
  - `dirty-keyword`: a proposal.md containing "BREAKING CHANGE" → 1+
    P1 finding with `line` set.
  - `dirty-todo`: ≥3 TODO/FIXME across artifacts → 1 P2 finding.
  - `dirty-files`: >10 files in change dir → 1 P3 finding.
  - `clean`: empty canonical change → 0 findings.
- [ ] Step 3.2 — GREEN: implement `run(changeDir)` in
  `lib/lens/risk.ts` with regex + counters; emit findings with P1/P2/P3
  severities per the algorithm in design.md §6.1.
- [ ] Step 3.3 — TRIANGULATE: test truncation at 20 findings → cap +
  `truncated: true` flag set on `LensFindings` summary.
- [ ] Step 3.4 — REFACTOR: extract regex constants and shared
  keyword sets to module top.

## Task 4: Implement `lib/lens/correctness.ts`

> The "Done when" detection rule is gated by the v0.6.0 template
> version marker (REQ-020 / CON-008).

- [ ] Step 4.1 — RED: write `tests/lens/correctness.test.ts` asserting:
  - `dirty-design-req`: design.md mentions REQ-999 not in
    requirements.md → 1+ P1 finding.
  - `dirty-con`: design.md mentions CON-999 not in constitution.md →
    1+ P2 finding.
  - `dirty-done-when`: v0.6.0-marker tasks.md missing "Done when:" →
    1+ P2 finding.
  - `clean-v0.5`: v0.5.0-marker canonical change → 0 findings
    (template marker exempt).
  - `dirty-no-checkboxes`: task with no `[ ]` → 1+ P2 finding.
- [ ] Step 4.2 — GREEN: implement `run(changeDir)` with cross-file
  parsers (REQ-NNN, CON-NNN extraction); emit findings per
  design.md §6.2.
- [ ] Step 4.3 — TRIANGULATE: test that v0.5.0 marker exempts
  "Done when" detection (no false positives on archived changes).
- [ ] Step 4.4 — REFACTOR: extract shared regex parsers (e.g.,
  `extractReqIds(text)`, `extractConIds(text)`) for reuse with
  `spec-compliance.ts` (Task 7).

## Task 5: Implement `lib/lens/security.ts`

- [ ] Step 5.1 — RED: write `tests/lens/security.test.ts` asserting:
  - `dirty-cwe`: constitution with MUST-level CON-NNN lacking CWE
    → 1+ P0 finding.
  - `dirty-secret`: tasks.md with "password" keyword → 1+ P1 finding
    with `line` set.
  - `dirty-curl-sh`: tasks.md with `curl | sh` → 1+ P1 finding.
  - `clean`: canonical constitution with CWE mappings → 0 findings.
- [ ] Step 5.2 — GREEN: implement `run(changeDir)` with constitution
  parser + keyword scan; emit findings per design.md §6.3.
- [ ] Step 5.3 — TRIANGULATE: test that MUST NOT and SHALL levels
  are also flagged for missing CWE (defense in depth).
- [ ] Step 5.4 — REFACTOR: extract keyword constants and regex to
  module top.

## Task 6: Implement `lib/lens/readability.ts`

- [ ] Step 6.1 — RED: write `tests/lens/readability.test.ts` asserting:
  - `dirty-large`: 250-line proposal.md → 1+ P2 finding.
  - `dirty-sections`: proposal.md missing "## 4. Success criteria" →
    1+ P2 finding.
  - `dirty-depth`: 5-level deep heading → 1+ P3 finding.
  - `clean`: canonical proposal.md → 0 findings.
- [ ] Step 6.2 — GREEN: implement `run(changeDir)` with line counter,
  + section parser; emit findings per design.md §6.4.
- [ ] Step 6.3 — TRIANGULATE: test that multi-file changes each get
  their own large-file findings (no double-counting).
- [ ] Step 6.4 — REFACTOR: extract shared file-line counter and
  section parser.

## Task 7: Implement `lib/lens/spec-compliance.ts`

- [ ] Step 7.1 — RED: write `tests/lens/spec-compliance.test.ts`
  asserting:
  - `dirty-orphan-req`: requirements.md with REQ-007 not covered by
    any task → 1+ P1 finding.
  - `dirty-changename`: §3 missing the change name → 1+ P2 finding.
  - `dirty-orphan-con`: constitution CON-005 not referenced → 1+
    P2 finding.
  - `clean`: canonical change → 0 findings.
- [ ] Step 7.2 — GREEN: implement `run(changeDir)` with req/con
  coverage analysis; emit findings per design.md §6.5.
- [ ] Step 7.3 — TRIANGULATE: test that `changeName` falls back to
  directory basename when `state.json` has no `activeChange`.
- [ ] Step 7.4 — REFACTOR: extract proposal parser (reuse helpers
  from Task 4).

## Task 8: `lib/lens/index.ts` — defaultLensRegistry factory

- [ ] Step 8.1 — RED: test in `tests/lens/index.test.ts` asserting
  `defaultLensRegistry().list().length === 5` and `.has()` returns true
  for all 5 lens IDs.
- [ ] Step 8.2 — GREEN: implement factory in `lib/lens/index.ts` that
  imports the 5 lens files and registers each on a fresh `LensRegistry`.
  Export both `defaultLensRegistry()` and `registerDefaultLenses(reg)`.
- [ ] Step 8.3 — TRIANGULATE: test that `createLensRegistry()` (no
  default population) still returns an empty registry — backward compat
  for test isolation (REQ-004 implicit).
- [ ] Step 8.4 — REFACTOR: extract a `LENS_MODULES` array for
  registration.

## Task 9: Receipt extension (writeReceipt 4-arg, validateReceipt compat)

> Receipt extension is the contract; without it Task 10 cannot
> persist lens runs.

- [ ] Step 9.1 — RED: test in `tests/review-receipt.test.ts` asserting
  `writeReceipt(cd, snap, true)` with no 4th arg → `lensRuns: []` in
  the JSON (v0.5.0-compatible shape); with `lensRuns=[...]` 4th arg →
  populated `lensRuns` array in JSON.
- [ ] Step 9.2 — GREEN: extend `writeReceipt` signature with optional
  `lensRuns: ReadonlyArray<LensRunDetail>` 4th param, defaulting to `[]`.
- [ ] Step 9.3 — TRIANGULATE: test `validateReceipt` accepts both
  v0.5.0 fixture (`lensRuns: []`) and v0.6.0 fixture (`lensRuns: [...]`)
  for the same contentHash.
- [ ] Step 9.4 — REFACTOR: extract a `serializeLensRun(run)` helper
  for stable JSON ordering.

## Task 10: State machine integration (runLensSet + finalizeReview)

> This is the integration step that ties lenses into the review
> state machine.

- [ ] Step 10.1 — RED: test in `tests/review-state-machine.test.ts`
  asserting:
  - `finalizeReview` with persona=`security` → receipt with 2
    populated `LensRunDetail` entries (security + risk).
  - `finalizeReview` with persona=`plain` → receipt with 0 lens runs
    (backward-compat empty array).
- [ ] Step 10.2 — GREEN: implement `runLensSet` in
  `lib/review-state-machine.ts` per design.md §7.1; modify
  `finalizeReview` to call `runLensSet(registry, persona, cd)` and pass
  the result to `writeReceipt` 4th arg. Make `finalizeReview` `async`.
- [ ] Step 10.3 — TRIANGULATE: test that a lens whose `run` is
  `undefined` (e.g., a freshly-created `LensRegistry`) gets
  `status: "skipped"` with empty findings.
- [ ] Step 10.4 — REFACTOR: extract lens registration helper so
  `createLensRegistry() + registerDefaultLenses()` is one call.

## Task 11: resetReview + inspectIsCorrupted real implementation

- [ ] Step 11.1 — RED: test in `tests/review-state-machine.test.ts`
  asserting:
  - `resetReview` on valid state → `{ ok: true, archivedPath }` and
    state.json moved to `.review/state.json.corrupt-<ts>`.
  - `resetReview` on no state → `{ ok: false, reason: "no-state" }`.
- [ ] Step 11.2 — GREEN: implement `resetReview` in
  `lib/review-state-machine.ts` per design.md §9.
- [ ] Step 11.3 — TRIANGULATE: test `inspectIsCorrupted` returns
  `true` when `state.json` exists but is not valid JSON.
- [ ] Step 11.4 — REFACTOR: extract `archiveReviewFile(filename, ts)`
  helper shared between state and receipt archival.

## Task 12: formatSnapshot lens runs block + slash commands wiring

- [ ] Step 12.1 — RED: test in `tests/slash-commands-review.test.ts`
  asserting `formatSnapshot(snap)` output includes a `lens runs:`
  block with each required lens's `lensId`, `status`, and
  `findingsCount`.
- [ ] Step 12.2 — GREEN: extend `formatSnapshot` in
  `lib/slash-commands-review.ts` per design.md §10. Block rendered
  only when `snap.lensRuns.length > 0`.
- [ ] Step 12.3 — TRIANGULATE: test that
  `extensions/caduceus.ts:252` no longer uses the `({ ok: false })`
  stub — wire to the real `resetReview` implementation.
- [ ] Step 12.4 — REFACTOR: extract a `formatLensRuns(lensRuns)`
  helper.

## Task 13: Documentation updates

- [ ] Step 13.1 — Update `README.md`: add "Lens Framework" subsection
  to the "Lifecycle Foundation" section; describe the 5 lenses,
  P0/P1/P2/P3 severity, and how to interpret lens findings.
- [ ] Step 13.2 — Update `CHANGELOG.md`: add `[0.6.0]` entry with all
  changes from proposal §3.1 + design §4.
- [ ] Step 13.3 — Update `STATUS.md`: §2 (snapshot), §2.1 (what
  ships), §7 (mark v0.6.0 shipped; v0.7.0 next), §8 (decision records).
- [ ] Step 13.4 — Update `openspec/AGENTS.md`: add non-negotiable
  invariant #11 (v0.6.0+ tasks.md "Done when:" contract enforcement
  gated by template marker).

## Task 14: Final verification

> This task is the apply-phase gate. Nothing in §7 of v0.5.0
> archive-acceptance criteria is optional.

- [ ] Step 14.1 — Run `npm test`; verify ≥359 tests pass (309 v0.5.0
  + ≥50 new); capture stdout to a log.
- [ ] Step 14.2 — Run `node scripts/verify-package.mjs`; verify 17/17
  pre-publish checks pass; capture stdout to a log.
- [ ] Step 14.3 — Verify v0.5.0 backward compat: the 309 prior tests
  MUST appear in the passing set with identical line numbers (no
  silent test-file renaming).
- [ ] Step 14.4 — Run `npm pack --dry-run`; verify tarball size delta
  vs. v0.5.0 (89.5 kB → +15 kB ≈ ≤110 kB target).
- [ ] Step 14.5 — Run `node --test tests/constitution-lint.test.ts`
  on the v0.6.0 constitution.md; expect 0 errors and ≤3 warnings
  (CON-004/005/007 CWE:N/A warnings).

## Verification contract (per task)

- **Task 1**: Done when `lib/sdd-templates.ts` exports `TEMPLATE_VERSION === "0.6.0"`, all 5 templates render the v0.6.0 marker, and `renderTasks` output contains a `**Done when:**` line per task.
- **Task 2**: Done when `lib/review-types.ts` exports `LensFinding` (with `line?`), `LensFindings` (with `truncated?`), `LensRunStatus`, and `LensRunDetail`.
- **Task 3**: Done when `lib/lens/risk.ts` exports a `Lens` whose `run` returns correct findings for the 5 canonical cases.
- **Task 4**: Done when `lib/lens/correctness.ts` exports a `Lens` whose `run` returns correct findings for the 5 canonical cases AND respects the v0.5.0/v0.6.0 template marker gate.
- **Task 5**: Done when `lib/lens/security.ts` exports a `Lens` whose `run` returns correct findings for the 5 canonical cases.
- **Task 6**: Done when `lib/lens/readability.ts` exports a `Lens` whose `run` returns correct findings for the 5 canonical cases.
- **Task 7**: Done when `lib/lens/spec-compliance.ts` exports a `Lens` whose `run` returns correct findings for the 5 canonical cases.
- **Task 8**: Done when `lib/lens/index.ts` exports `defaultLensRegistry()` that registers all 5 lenses.
- **Task 9**: Done when `writeReceipt` accepts the 4th `lensRuns` param; `validateReceipt` accepts both v0.5.0 and v0.6.0 receipt shapes.
- **Task 10**: Done when `finalizeReview` calls `runLensSet` and writes populated `lensRuns` to the receipt; `plain` persona produces empty `lensRuns`.
- **Task 11**: Done when `resetReview` archives state.json atomically; `inspectIsCorrupted` correctly detects corrupt JSON.
- **Task 12**: Done when `formatSnapshot` includes the `lens runs:` block and `extensions/caduceus.ts` wires the real `resetReview`.
- **Task 13**: Done when README, CHANGELOG, STATUS, AGENTS are updated with no `npm test` regressions.
- **Task 14**: Done when `npm test` ≥359, `verify-package.mjs` 17/17, tarball delta ≤20 kB, constitution-lint 0 errors.