<!-- caduceus:requirements-template-version 0.6.0 -->

# Requirements — caduceus-v0.6.0-lens-collection

> RFC 2119 enforcement levels (MUST / SHOULD / MAY).
> Each requirement has a unique ID for traceability.
> Enforcement level is on the requirement line itself, not in section headers.

## Lens implementations

- **REQ-001 [MUST]**: The `lib/lens/` module MUST export 5 lens
  implementations — `risk`, `correctness`, `security`, `readability`,
  `spec-compliance` — each conforming to the `Lens` type from
  `lib/review-lens-framework.ts`.

- **REQ-002 [MUST]**: Each lens `run` function MUST perform pure-TS
  static analysis over the 5 MD artifacts (proposal.md, design.md,
  tasks.md, requirements.md, constitution.md) and MUST NOT perform
  network calls, process invocations, dynamic-imports of untrusted
  paths, or LLM-based reasoning.

- **REQ-003 [MUST]**: Each lens `run` function MUST return a
  `LensFindings` object with `lensId`, `findings`
  (ReadonlyArray<LensFinding>), and `durationMs`.

- **REQ-004 [MUST]**: `LensFinding` MUST carry `severity`
  (P0|P1|P2|P3), `summary`, `location`, and `recommendation` fields.
  `LensFinding.line?: number` MAY be present for findings that point
  to a specific source line; the field MUST be omitted for section-
  level findings.

- **REQ-005 [MUST]**: When a lens produces > 20 findings, the findings
  array MUST be capped at 20 and a `truncated: true` flag MUST be set
  on the `LensFindings` summary; the cap MUST apply per lens, not per
  finding.

## State machine integration

- **REQ-006 [MUST]**: `finalizeReview` MUST execute the persona-
  required lenses (per `lib/persona-lens-router.ts`) via a new
  internal `runLensSet(registry, personaSnapshot, changeDir)` function
  and MUST capture the result into the receipt.

- **REQ-007 [MUST]**: `runLensSet` MUST return
  `Promise<ReadonlyArray<LensRunDetail>>` where each entry carries
  `lensId`, `status` (`completed|skipped|failed`), `findingsCount`,
  `durationMs`, `findings: ReadonlyArray<LensFinding>`.

- **REQ-008 [MUST]**: When the persona requires no lenses (e.g.,
  `plain` persona), `runLensSet` MUST return `[]` and `finalizeReview`
  MUST write a receipt with empty `lensRuns` (backward-compatible with
  v0.5.0 receipts).

## Receipt extension

- **REQ-009 [MUST]**: `ReviewReceipt.lensRuns` MUST be typed as
  `ReadonlyArray<LensRunDetail>` (new type), where each entry carries
  `lensId`, `status`, `findingsCount`, `durationMs`, `findings`, and
  optional `truncated`.

- **REQ-010 [MUST]**: `writeReceipt(changeDir, personaSnapshot,
  finalVerificationPassed, lensRuns?)` MUST accept an optional fourth
  parameter `lensRuns`; when omitted, MUST default to `[]`
  (v0.5.0-compatible behavior).

- **REQ-011 [MUST]**: `validateReceipt` MUST accept both v0.5.0
  receipts (with `lensRuns: []`) and v0.6.0 receipts (with populated
  `lensRuns`).

- **REQ-012 [MUST]**: `ReviewReceipt.contentHash` MUST continue to
  cover only the 5 MD artifacts; the `lensRuns` field MUST NOT
  contribute to the content hash (verifiable by snapshot tests).

## resetReview real implementation

- **REQ-013 [MUST]**: `resetReview(changeName, cwd)` MUST atomically
  archive the current `.review/state.json` to
  `.review/state.json.corrupt-<ISO-timestamp>` and MUST clear the
  `.review/` directory. On success, MUST return
  `{ ok: true, archivedPath: <relative path> }`.

- **REQ-014 [MUST]**: `resetReview` MUST return
  `{ ok: false, reason: "no-state" }` when no `.review/state.json`
  exists, and MUST NOT throw.

- **REQ-015 [MUST]**: The archive operation MUST be atomic: in case of
  failure mid-archive, the original `state.json` MUST remain intact.

## Inspect output

- **REQ-016 [MUST]**: `formatSnapshot(snap)` MUST include a `lens
  runs:` block listing each required lens with its `lensId`, `status`,
  and `findingsCount`.

- **REQ-017 [MUST]**: The block MUST be rendered in the same human-
  readable format as other snapshot fields and MUST NOT break existing
  snapshot consumers (i.e., the existing 6 fields above the block).

## Template / contract upgrade

- **REQ-018 [MUST]**: `lib/sdd-templates.ts` MUST bump
  `TEMPLATE_VERSION` from `"0.5.0"` to `"0.6.0"` and update all 5
  template markers (`<!-- caduceus:<id>-template-version 0.6.0 -->`).

- **REQ-019 [MUST]**: `renderTasks` MUST include an optional
  `## Verification contract (per task)` section providing a `**Done
  when:**` placeholder per task; v0.6.0+ tasks.md files SHOULD include
  this section, but its absence MUST NOT cause lint failure.

- **REQ-020 [MUST]**: The `correctness` lens "Done when" detection
  MUST fire ONLY on changes whose `tasks.md` carries the v0.6.0
  template version marker; v0.5.0 changes MUST be exempt (no false
  positives on archived changes).

## Backward compatibility & non-regression

- **REQ-021 [MUST]**: All 309 v0.5.0 tests MUST pass unchanged after
  v0.6.0 is applied (strict non-regression).

- **REQ-022 [MUST]**: `node scripts/verify-package.mjs` MUST exit 0
  with all 17/17 pre-publish checks passing; no new checks added in
  v0.6.0.

- **REQ-023 [MUST]**: The number of new tests added MUST be ≥ 50 and
  ≤ 80 (proposal §4 target); the running total at archive MUST be in
  `[359, 389]`.

## Lens canonical coverage

- **REQ-024 [SHOULD]**: Each lens SHOULD produce at least one finding
  on a "dirty" change that contains the issue it detects (per-lens
  "dirty" test).

- **REQ-025 [SHOULD]**: Each lens SHOULD produce zero findings on a
  clean canonical change (per-lens "clean" test).

- **REQ-026 [SHOULD]**: The risk lens SHOULD count files in the change
  directory and emit a P3 finding when count > 10 (heuristic only;
  threshold tunable in v0.6.x patch).

- **REQ-027 [SHOULD]**: `lib/lens/index.ts` SHOULD export
  `defaultLensRegistry()` that registers all 5 lenses in a fresh
  `LensRegistry`.

## Optional / deferred

- **REQ-028 [MAY]**: v0.8.0+ MAY evaluate a detached auditor worker
  pattern (dracond-style); if pursued, it MUST ship as a separate
  `caduceus-auditor` companion package. This MUST NOT block v0.6.0.

- **REQ-029 [MAY]**: Per-lens threshold configuration (severity →
  fail/warn mapping) MAY be added in a v0.6.x patch; v0.6.0 ships with
  hardcoded sensible defaults.

## Documentation

- **REQ-030 [MUST]**: `README.md` MUST add a "Lens Framework"
  subsection to the "Lifecycle Foundation" section describing the 5
  lenses, P0/P1/P2/P3 severity, and how to interpret lens findings in
  `/caduceus:review:inspect` output.

- **REQ-031 [MUST]**: `CHANGELOG.md` MUST add a v0.6.0 entry under
  `[0.6.0]` describing the 5 lens implementations, state machine
  integration, receipt extension, `resetReview` promotion, and
  inspect output enhancement.

- **REQ-032 [MUST]**: `STATUS.md` MUST update §2 (snapshot), §2.1
  (what ships), §7 (mark v0.6.0 shipped; v0.7.0 next), and §8
  (decision records).

- **REQ-033 [MUST]**: `openspec/AGENTS.md` MUST add non-negotiable
  invariant #11: v0.6.0+ tasks.md MAY include `## Verification
  contract (per task)`; the `correctness` lens only enforces it on
  v0.6.0+ changes.