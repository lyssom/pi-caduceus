# caduceus v0.5.0 — Tasks

> **Status:** Tasks draft. Awaiting implementation (`sdd-apply`).
> **Date:** 2026-08
> **Change:** `caduceus-v0.5.0-lifecycle-foundation`
> **Source contracts:** [`proposal.md`](./proposal.md),
> [`design.md`](./design.md)

## Task ordering and dependencies

Tasks are ordered by implementation dependency. Each task
must complete before the next one starts. Strict TDD is
mandatory: RED → GREEN → TRIANGULATE → REFACTOR.

```text
T01 constitution-lint      (no deps)
T02 sdd-templates          (no deps)
T03 review-lens-framework  (no deps)
T04 persona-lens-router    (depends on T03)
T05 review-receipt         (no deps; tests use fixtures)
T06 sdd-flow               (depends on T02)
T07 review-state-machine   (depends on T03, T04, T05)
T08 slash-commands-core    (refactor existing 14; no deps)
T09 slash-commands-sdd     (depends on T06)
T10 slash-commands-review  (depends on T07)
T11 extension wiring       (depends on T09, T10)
T12 verify-package v0.5.0  (depends on T01)
T13 docs and changelog     (depends on all above)
T14 archive prep           (depends on all above)
```

Total estimated: ~3,200 LOC, ~36 new tests across 7 new test files.

## Per-task format

Each task below specifies:
- **Goal** — what this task delivers
- **LOC estimate** — implementation + test LOC
- **Files** — exact paths added or modified
- **Dependencies** — tasks that must be complete
- **Acceptance criteria** — falsifiable, runnable, observable
- **TDD evidence required** — RED → GREEN → TRIANGULATE → REFACTOR
  commits with passing test output

---

## T01. `lib/constitution-lint.ts`

**Goal**: 5 pure-function lint checks for `constitution.md`
format per `design.md §3.7` and `§6.2`.

**LOC estimate**: ~250 lib + ~150 test = 400

**Files**:
- `lib/constitution-lint.ts` (new)
- `tests/constitution-lint.test.ts` (new)
- `lib/lint.ts` (modified — register `CONSTITUTION_CHECKS`)
- `tests/lint.test.ts` (modified — add 5 new check assertions)

**Dependencies**: none

**Acceptance criteria**:
- `CONSTITUTION_CHECKS` exports 5 entries:
  `CONSTITUTION_EXISTS`, `CONSTITUTION_RFC2119`,
  `CONSTITUTION_CWE_MAPPING`, `CONSTITUTION_COUNT`,
  `CONSTITUTION_NO_DUPLICATE_IDS`
- Canonical constitution template (3 CON-NNN principles) passes
  all 5 checks (0 violations)
- Empty constitution fails `CONSTITUTION_EXISTS` and
  `CONSTITUTION_COUNT` with `severity: error`
- Constitution with no MUST/SHOULD (only MAY) passes
  `CONSTITUTION_COUNT` but with `severity: warning`
- Constitution with 2 principles sharing ID `CON-001` fails
  `CONSTITUTION_NO_DUPLICATE_IDS`
- Constitution with MUST principle lacking CWE field fails
  `CONSTITUTION_CWE_MAPPING` with `severity: warning`
- `lib/lint.ts` aggregates `CONSTITUTION_CHECKS` into the
  existing `lintPersonaContent` pipeline without breaking
  the 8 existing checks

**TDD evidence**:
- RED commit: `tests/constitution-lint.test.ts` exists,
  `lib/constitution-lint.ts` does not; `npm test` fails
- GREEN commit: minimum implementation; `npm test` passes
- TRIANGULATE commit: add 2nd canonical-template test forcing
  more general regex; passes
- REFACTOR commit: extract helpers, no behavior change; all tests pass

---

## T02. `lib/sdd-templates.ts`

**Goal**: 5 deterministic template renderers per `design.md §3.1`
plus the `requirements-template-version` / `constitution-template-version`
markers per `design.md §12 R1`.

**LOC estimate**: ~300 lib + ~150 test = 450

**Files**:
- `lib/sdd-templates.ts` (new)
- `tests/sdd-templates.test.ts` (new)

**Dependencies**: none

**Acceptance criteria**:
- `renderTemplate(id, ctx)` returns canonical content for each of
  the 5 templates
- Two calls with identical `ctx` produce **byte-identical** output
  (verified by `Buffer.compare`)
- All 5 templates carry their version marker
  (`<!-- caduceus:<id>-template-version 0.5.0 -->` at top)
- `requirements.md` template has level **inline on each line**
  (`**REQ-NNN [LEVEL]**:`), not in section headers
- `constitution.md` template uses `CON-NNN` prefix (no SEC- or COR-)
- `constitution.md` template does NOT include MITRE URL field
- `constitution.md` template uses multi-line `**Description**:`
  format with 2-space indent
- Unknown `id` throws `CaduceusTemplateError`

**TDD evidence**: as T01

---

## T03. `lib/review-lens-framework.ts`

**Goal**: `Lens` interface, `LensRegistry`, 5 named slot
constants, plus `LENS_REGISTRY_VERSION` per `design.md §3.5`
and `§12 R2`.

**LOC estimate**: ~150 lib + ~120 test = 270

**Files**:
- `lib/review-lens-framework.ts` (new)
- `tests/review-lens-framework.test.ts` (new)

**Dependencies**: none

**Acceptance criteria**:
- `LENS_SLOTS_V1` exports exactly:
  `["risk", "correctness", "security", "readability", "spec-compliance"]`
- `LENS_REGISTRY_VERSION === 1`
- `LENS_DISPLAY_NAMES` has entries for all 5 slot IDs
- `createLensRegistry()` returns a registry with `register`,
  `get`, `list`, `has` methods
- `register` rejects duplicate IDs (throws)
- `get` returns `undefined` for unknown IDs
- `list` returns all registered lenses
- Phase A: registry starts empty; slots exist as constants but
  no lens has `run` implemented

**TDD evidence**: as T01

---

## T04. `lib/persona-lens-router.ts`

**Goal**: Persona → required-lens-subset routing table plus
allocation helper per `design.md §3.6` and `§6.3`.

**LOC estimate**: ~120 lib + ~80 test = 200

**Files**:
- `lib/persona-lens-router.ts` (new)
- `tests/persona-lens-router.test.ts` (new)

**Dependencies**: T03

**Acceptance criteria**:
- `PERSONA_LENS_ROUTING` table matches `design.md §6.3` exactly:
  - `security` → `[security, risk]`
  - `reviewer` → `[readability, spec-compliance]`
  - `architect` → `[spec-compliance, risk]`
  - `debugger` → `[correctness]`
  - all others → `[]`
- `requiredLensesForPersona("security")` returns
  `["security", "risk"]` (order-preserving)
- `requiredLensesForPersona("unknown-persona")` returns `[]`
  (no throw; defensive)
- `allocateLensRuns(registry, snapshot)` returns 1
  `LensRunSummary` per required lens with `status: "queued"`
  (registry is empty in Phase A, so `skipped` is also acceptable;
  document choice in the function's docstring)
- Snapshots with unknown persona do not throw; they allocate
  no lens runs

**TDD evidence**: as T01

---

## T05. `lib/review-receipt.ts`

**Goal**: Content hash + receipt read/write/validate per
`design.md §3.4`, `§5.2`, `§5.3`. Includes normalization per
revised `design.md §5.2`.

**LOC estimate**: ~200 lib + ~120 test = 320

**Files**:
- `lib/review-receipt.ts` (new)
- `tests/review-receipt.test.ts` (new)

**Dependencies**: none (tests use hand-crafted fixtures, not sdd-flow)

**Acceptance criteria**:
- `normalize(content)`:
  - Folds CRLF to LF
  - Strips trailing whitespace per line
  - Ensures exactly one trailing newline
  - Idempotent: `normalize(normalize(x)) === normalize(x)`
- `computeContentHash(changeDir)`:
  - Returns `"sha256:<64-hex-chars>"`
  - Same 5 files in same order → same hash (deterministic)
  - Whitespace-only change in any file → hash changes
  - Missing file → throws `CaduceusReviewError("missing-artifact")`
- `writeReceipt` writes atomically (write to `.tmp`, rename)
- `readReceipt` parses JSON, throws `CaduceusReviewError("no-receipt")`
  if absent
- `validateReceipt(changeDir)`:
  - Returns `{ valid: true }` when current hash matches
  - Returns `{ valid: false, reason: "hash-mismatch" }` on change
  - Returns `{ valid: false, reason: "persona-mismatch" }` if
    active persona differs from `receipt.personaSnapshot.activePersona`
- Two `validateReceipt` calls on an unchanged receipt return
  identical results (idempotent)

**TDD evidence**: as T01

---

## T06. `lib/sdd-flow.ts`

**Goal**: 5 SDD command implementations per `design.md §3.2`
and `§4`. File I/O + error paths + active-change tracking.

**LOC estimate**: ~400 lib + ~180 test = 580

**Files**:
- `lib/sdd-flow.ts` (new)
- `tests/sdd-flow.test.ts` (new)
- `lib/errors.ts` (modified — add `CaduceusSDDError`)
- `tests/slash-commands.test.ts` (modified — verify error codes)

**Dependencies**: T02

**Acceptance criteria**:
- `sddInit`:
  - Creates `openspec/changes/<name>/` with 5 MD files
  - Throws `CaduceusSDDError("change-exists")` if dir exists
  - Throws `CaduceusSDDError("invalid-name")` if name fails regex
  - Sets `activeChange` in `~/.pi/agent/caduceus/state.json`
- `sddExplore`:
  - Reads active change dir, returns requirements.md skeleton
  - Throws if no active change
- `sddPropose`:
  - Generates `proposal.md` from template + requirements
  - Throws `CaduceusSDDError("requirements-missing")` if absent
- `sddApply`:
  - Reads `tasks.md`, updates checkboxes for `completedTasks`
  - Idempotent: same input → same output
- `sddArchive`:
  - Moves dir to `openspec/changes/archive/<date>-<name>/`
  - Appends row to `STATUS.md §8 Decision Records`
  - Throws `CaduceusSDDError("not-finalized")` if no receipt.json
    with `finalVerificationPassed: true`

**TDD evidence**: as T01

---

## T07. `lib/review-state-machine.ts`

**Goal**: 6-state, 5-transition state machine per `design.md §3.3`,
`§5.1`, including terminal-state semantics (validated and
abandoned are terminal).

**LOC estimate**: ~300 lib + ~200 test = 500

**Files**:
- `lib/review-state-machine.ts` (new)
- `tests/review-state-machine.test.ts` (new)

**Dependencies**: T03, T04, T05

**Acceptance criteria**:
- All 6 valid transitions succeed and produce correct snapshots
- All invalid transitions throw `CaduceusReviewError("invalid-transition")`:
  - `idle → advance` (must `start` first)
  - `started → finalize` (must `advance` first)
  - `finalized → start` (must `abandon` first)
  - `validated → advance` (terminal; must `abandon` first)
  - `validated → abandon` (terminal; only `validate → validated` allowed)
  - `abandoned → anything except start`
- `transitionHistory` records every transition with timestamp
- State file (`state.json`) and receipt file (`receipt.json`)
  written atomically
- `inspectReview` returns `state: "corrupted"` snapshot (not throw)
  when JSON parse fails (per `design.md §12 R3`)
- Content hash includes the **normalized** content (per T05)

**TDD evidence**: as T01; emphasis on TRIANGULATE — each invalid
transition needs its own test (the table has 6+ invalid combinations)

---

## T08. `lib/slash-commands-core.ts` (refactor)

**Goal**: Refactor existing 14 slash command handlers into a
sub-module to make room for v0.5.0's 10 new commands (per
`design.md §12 R4`).

**LOC estimate**: ~100 lib refactor + ~50 test updates = 150

**Files**:
- `lib/slash-commands-core.ts` (new — extracted from slash-commands.ts)
- `lib/slash-commands.ts` (modified — re-export + dispatch)
- `tests/slash-commands.test.ts` (modified — verify no behavior change)

**Dependencies**: none (refactor only, no new behavior)

**Acceptance criteria**:
- All 14 existing slash commands continue to work
- All 186 existing tests pass unchanged
- `lib/slash-commands.ts` is now ≤ 5KB (down from 18KB)
- `lib/slash-commands-core.ts` is ≤ 13KB
- The `register(pi, deps)` signature is identical to the
  pre-refactor implementation

**TDD evidence**:
- RED: skip (refactor, not new behavior)
- GREEN: refactor lands; all existing tests pass
- TRIANGULATE: add 1 test that asserts the new file size budget
- REFACTOR: clean up

---

## T09. `lib/slash-commands-sdd.ts`

**Goal**: 5 SDD slash command handlers per `design.md §4.2`.

**LOC estimate**: ~150 lib + ~80 test = 230

**Files**:
- `lib/slash-commands-sdd.ts` (new)
- `tests/sdd-flow.test.ts` (modified — add slash-command integration tests)

**Dependencies**: T06

**Acceptance criteria**:
- 5 commands registered:
  - `/caduceus:sdd:init <name>`
  - `/caduceus:sdd:explore <topic>`
  - `/caduceus:sdd:propose <name>`
  - `/caduceus:sdd:apply`
  - `/caduceus:sdd:archive`
- All commands delegate to `lib/sdd-flow.ts` functions
- Error messages from `CaduceusSDDError` propagated verbatim
- Commands appear in `/caduceus:status` output under "SDD" section

**TDD evidence**: as T01

---

## T10. `lib/slash-commands-review.ts`

**Goal**: 5 review slash command handlers per `design.md §3.3`.

**LOC estimate**: ~150 lib + ~80 test = 230

**Files**:
- `lib/slash-commands-review.ts` (new)
- `tests/review-state-machine.test.ts` (modified — add slash-command integration tests)

**Dependencies**: T07

**Acceptance criteria**:
- 5 commands registered:
  - `/caduceus:review:inspect`
  - `/caduceus:review:start`
  - `/caduceus:review:advance <transition>`
  - `/caduceus:review:finalize`
  - `/caduceus:review:validate`
- All commands delegate to `lib/review-state-machine.ts` functions
- Error messages from `CaduceusReviewError` propagated verbatim
- Commands appear in `/caduceus:status` output under "Review" section
- New command `/caduceus:review:reset` (per `design.md §12 R3`)
  archives corrupt state.json and starts fresh

**TDD evidence**: as T01

---

## T11. `extensions/caduceus.ts` wiring

**Goal**: Register the 3 new sub-modules' slash commands in the
extension entry.

**LOC estimate**: ~50 (mostly additions)

**Files**:
- `extensions/caduceus.ts` (modified)
- `tests/extension-entry.test.ts` (modified)

**Dependencies**: T09, T10

**Acceptance criteria**:
- `extensions/caduceus.ts` calls `registerSlashCommandsCore(pi, deps)`,
  `registerSlashCommandsSdd(pi, deps)`,
  `registerSlashCommandsReview(pi, deps)`
- All 24 slash commands (14 + 10) appear in `/caduceus:status`
  output
- Order: existing 14 first (backward compat), then SDD, then Review
- Extension entry file size grows by < 100 LOC

**TDD evidence**:
- RED: existing test fails to see new commands
- GREEN: wire-up added; tests pass
- TRIANGULATE: add assertion that command order matches spec

---

## T12. `scripts/verify-package.mjs` v0.5.0

**Goal**: Add Checks 15, 16, 17 per `design.md §9`.

**LOC estimate**: ~150 (script only; no test files)

**Files**:
- `scripts/verify-package.mjs` (modified)
- `tests/verify-package.test.ts` (new — for the 3 new checks)

**Dependencies**: T01 (so CONSTITUTION_CHECKS exists for Check 17 reference)

**Acceptance criteria**:
- Check 15: scanning `lib/*.ts` + `extensions/*.ts` for
  `from "pi-review"` etc. returns 0 matches on the canonical tree
- Check 16: `package.json` has no `dependencies` / `peerDependencies`
  / `optionalDependencies` / `devDependencies` entry whose name
  matches the FORBIDDEN list (except `@earendil-works/pi-coding-agent`)
- Check 17: scanning `prompts/*.md` for forbidden package names
  returns 0 matches
- Total checks: 17/17
- All existing 14 checks continue to pass
- Adding a forbidden `import` to any source file causes the script
  to exit 1 with a clear error message

**TDD evidence**: as T01

---

## T13. Documentation updates

**Goal**: Update 4 docs to reflect v0.5.0 changes.

**LOC estimate**: ~400 (mostly prose)

**Files**:
- `README.md` (modified)
- `CHANGELOG.md` (modified — v0.5.0 entry)
- `STATUS.md` (modified — apply all 5 amendments per
  [`proposal.md §9`](./proposal.md))
- `openspec/AGENTS.md` (modified — update non-negotiable invariants)

**Dependencies**: T01-T12

**Acceptance criteria**:
- `README.md` "Slash Commands" table lists all 24 commands
- `README.md` new section "Lifecycle Foundation" explains the
  phased rollout
- `CHANGELOG.md` v0.5.0 entry follows the existing v0.4.0 format
- `STATUS.md` carries all 5 amendments verbatim from proposal §9
- `openspec/AGENTS.md` §3 invariants list reflects v0.5.0
  (DNA-3 revised, new invariants added)
- No broken links or stale references in any doc

**TDD evidence**: not applicable (docs); manual review by lyssom

---

## T14. Archive preparation

**Goal**: Self-archive the v0.5.0 change so the change lifecycle
proves itself on the change that introduces it.

**LOC estimate**: ~50

**Files**:
- `openspec/changes/archive/2026-08-caduceus-v0.5.0-lifecycle-foundation/`
  (created by `sdd-archive`)
- `STATUS.md` (modified — append v0.5.0 row)

**Dependencies**: T01-T13

**Acceptance criteria**:
- All 17 pre-publish checks pass
- All ≥ 219 tests pass (186 existing + 33 new)
- `npm run verify` exits 0
- `npm test` exits 0
- `sdd-archive` invoked on `caduceus-v0.5.0-lifecycle-foundation`
  moves the change to `archive/`
- Receipt for this change has `finalVerificationPassed: true`
- `STATUS.md §8` has a new row: `2026-08 (v0.5.0) ...`

**TDD evidence**: not applicable; manual verification

---

## Acceptance summary

After all 14 tasks complete:

| Metric | Target | Verified by |
|---|---|---|
| Tests | ≥ 219 pass (186 + 33) | `npm test` |
| Pre-publish checks | 17/17 pass | `npm run verify` |
| Source LOC delta | ~3,000–3,200 | `git diff --stat v0.4.0 v0.5.0` |
| Slash commands | 24 (14 + 10) | `/caduceus:status` |
| New lint checks | 5 (constitution) + 1 (template version) | `lib/lint.ts` |
| DNA-3 amendment | Applied | `STATUS.md §3` |
| §5.4 amendment | Applied | `STATUS.md §5.4` |
| §7 amendment | Applied | `STATUS.md §7` |
| §8 entries | 4 new rows | `STATUS.md §8` |
| Forbidden deps | 0 | `verify-package.mjs` Check 16 |
| Receipts | content-bound, persona-aware | `lib/review-receipt.ts` |

---

> **End of tasks.** Awaiting lyssom approval to enter `sdd-apply`.
