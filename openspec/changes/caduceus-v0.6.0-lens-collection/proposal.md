# caduceus v0.6.0 — Lens Collection (MINOR)

> **Status:** Proposal draft. Awaiting `design` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.6.0-lens-collection`
> **Source contracts:** [`STATUS.md §7 v0.6.0`](../../../STATUS.md),
> [`openspec/changes/caduceus-v0.5.0-lifecycle-foundation/design.md`](../../caduceus-v0.5.0-lifecycle-foundation/design.md)
> **Upstream:** v0.5.0 is live on npm + GitHub
> **Authority:** lyssom (project owner per `openspec/config.yaml`)

## 1. Intent

Ship **caduceus v0.6.0** — the second phase of the four-phase
lifecycle evolution, closing Phase B (full lens collection)
and the second half of the v0.5.0 / v0.7.0 / v0.8.0 roadmap.

v0.5.0 shipped the lens **framework** (5 named slots, registry,
persona-aware routing) but the lens `run` functions themselves
are stubs that return empty findings. v0.6.0 populates the
framework with 5 real static-analysis lens implementations,
wires their execution into the review state machine, captures
the findings in the receipt, and promotes `resetReview` from
a no-op stub to a real archive-and-clear operation.

Four additions:

1. **5 real lens implementations** — `risk`, `correctness`,
   `security`, `readability`, `spec-compliance` — all pure-TS
   static analysis over the 5 MD artifacts. No LLM, no network,
   no native binary. Each lens produces `LensFindings` with
   severity-sorted issues.

2. **State machine integration** — `advanceReview("advance")`
   in the `in-review` state now actually executes the persona-
   required lenses on the change directory, capturing results.

3. **Receipt extension** — `ReviewReceipt.lensRuns` (currently
   always `[]` after `writeReceipt`) now carries the actual lens
   results: status, findingsCount, duration, and findings array.
   Backward-compatible: empty `lensRuns` from v0.5.0 receipts
   still validate.

4. **`resetReview` promotion** — the no-op stub wired in
   `extensions/caduceus.ts` (since v0.5.0) becomes a real
   archive-and-clear operation: `state.json` is moved to
   `.review/state.json.corrupt-<ISO-timestamp>`; the change
   can then be re-initialized cleanly.

Plus one enhancement:
5. **Inspect output** — `/caduceus:review:inspect` displays the
   lens result summary (status + finding counts per lens)
   alongside the existing snapshot fields.

## 2. Why now

Three converging forces:

| Pressure | Source | v0.6.0 response |
|---|---|---|
| Phase B is the natural next step from v0.5.0's lens framework | `STATUS.md §7` roadmap + `tasks.md` T14 acceptance | Implement 5 lenses; wire execution; capture in receipt |
| `resetReview` stub is a known UX gap — `/caduceus:review:reset` doesn't actually reset | `extensions/caduceus.ts` comment | Real archive + clear logic |
| Lens findings need a place to live | `LensFindings` type already defined in `lib/review-lens-framework.ts`; not yet captured in `ReviewReceipt` | Receipt carries lens runs and findings |

The work is bounded (~1700 LOC, ~80 tests) and can ship without
breaking v0.5.0 compatibility (backward-compat: empty `lensRuns`
in v0.5.0 receipts still validate; lens registry stays empty
until populated).

## 3. Scope (locked)

### 3.1 In scope for v0.6.0

- **5 lens implementations** in new `lib/lens/` directory:
  - `lib/lens/risk.ts` — surface high-impact changes (P1 on
    "BREAKING"/"DEPRECAT" keywords; P2 on 3+ TODO/FIXME markers)
  - `lib/lens/correctness.ts` — invariant/regression scan
    (P1 on design.md referencing REQ-NNN not in requirements.md;
    P2 on tasks.md without checkboxes; P2 on broken CON-NNN refs)
  - `lib/lens/security.ts` — CWE/MITRE + secret-strings scan
    (P0 on constitution MUST-principle without CWE; P1 on
    "password"/"api_key"/"token"/"secret" in MD; P1 on
    "curl | sh" / "wget | sh" / "sudo " in tasks.md)
  - `lib/lens/readability.ts` — structure heuristics
    (P2 on file > 200 lines; P3 on section depth > 4; P2 on
    missing required sections in proposal.md)
  - `lib/lens/spec-compliance.ts` — task ↔ spec alignment
    (P1 on tasks.md without REQ-NNN references; P2 on
    proposal.md Scope section missing changeName; P2 on
    constitution principles not referenced in design/proposal)

  Each lens is a pure function:
  ```ts
  type Lens = {
    id: LensId;
    displayName: string;
    description: string;
    run: (changeDir: string) => Promise<LensFindings>;
  };
  ```

- **Lens registry population** — register the 5 lenses in a
  default registry exported from `lib/lens/index.ts`. The
  existing `createLensRegistry()` API is used.

- **State machine integration** in `lib/review-state-machine.ts`:
  - `finalizeReview(changeName, cwd, passed)` runs the persona-
    required lenses (per `lib/persona-lens-router.ts` routing)
    on the change directory, captures results, and writes them
    into the receipt.
  - `inspectReview` and the snapshot's `lensRuns` field reflect
    the actual lens results post-finalize.

- **Receipt extension** in `lib/review-receipt.ts`:
  - `ReviewReceipt.lensRuns` becomes an array of `LensRunDetail`
    (new type) carrying `findings: LensFinding[]` per lens.
  - `writeReceipt` accepts an optional `lensRuns` parameter
    (backward-compat: defaults to empty array).
  - `validateReceipt` accepts v0.5.0 receipts (no findings) AND
    v0.6.0 receipts (with findings).

- **`resetReview` real implementation** in
  `lib/review-state-machine.ts`:
  - Read current `state.json`; if valid, move to
    `.review/state.json.corrupt-<ISO-timestamp>`.
  - Clear `.review/` (the receipt is also archived if present).
  - Return `{ ok: true, archivedPath: <path> }`.
  - `extensions/caduceus.ts` no longer needs the no-op stub;
    wire to the real implementation.

- **Inspect output enhancement** in
  `lib/slash-commands-review.ts`:
  - `formatSnapshot` adds a `lens runs:` block listing each
    required lens with status + finding count.

- **Tests** (strict TDD, RED → GREEN → TRIANGULATE → REFACTOR):
  - Per-lens tests: 5 lenses × ~6 tests = ~30 tests
  - State machine integration: ~6 tests
  - Receipt extension: ~4 tests
  - `resetReview` real impl: ~4 tests
  - Inspect output: ~3 tests
  - **Total: ~50 new tests** (target ≥ 50, ceiling 80)

- **Documentation**:
  - `README.md` — add "Lens Framework" subsection to the
    "Lifecycle Foundation" section
  - `CHANGELOG.md` — v0.6.0 entry
  - `STATUS.md` — §7 v0.6.0 detail; §2 snapshot; §8 new row
  - `openspec/AGENTS.md` — non-negotiable invariants (lens
    coverage requirements)

### 3.2 Explicitly out of scope (deferred to v0.6.x patch or v0.7.0+)

- ❌ LLM-based lens (`run` calls a model API) — violates
  0-runtime-deps; would need a separate `caduceus-gen` package
- ❌ Network calls (any kind)
- ❌ Auto-block on P0 findings — v0.6.0 only reports; Phase D
  (v0.8.0) may add blocking; v0.7.0 may add per-lens thresholds
- ❌ User-configurable thresholds (severity → fail/warn mapping)
  — Phase B has hardcoded sensible defaults; configurable in
  v0.6.x patch only if user demand emerges
- ❌ Cross-file / cross-change lens — each lens is per-change
- ❌ Network / process invocation (e.g., running `tsc` for
  correctness lens) — Phase B is pure-TS static analysis only
- ❌ Lens-level configuration (per-lens on/off, custom rules) —
  v0.6.x patch if needed

### 3.3 Backward compatibility

- All 309 v0.5.0 tests must pass unchanged
- v0.5.0 receipts (with `lensRuns: []`) still validate via
  `validateReceipt`; new `lensRuns` field is optional in
  v0.5.0 format, mandatory in v0.6.0 format
- Lens registry stays empty until explicitly populated; v0.6.0
  ships a default-populated registry from `lib/lens/index.ts`
  but the existing `createLensRegistry()` empty behavior is
  preserved for tests
- `extensions/caduceus.ts` wiring changes: `resetReview` stub
  replaced with real implementation; all other deps unchanged

## 4. Success criteria (all must be true at archive)

1. `npm test` exits 0; full suite ≥ 359 tests (was 309 in v0.5.0),
   0 failures. Target: ~50 new tests, ceiling 80.
2. `node scripts/verify-package.mjs` exits 0; 17/17 pre-publish
   checks pass (no new checks added in v0.6.0; the 3 v0.5.0
   external-package-forbid checks remain authoritative).
3. **5 lens implementations**:
   - `lib/lens/risk.ts`, `correctness.ts`, `security.ts`,
     `readability.ts`, `spec-compliance.ts` all export a `Lens`
     with a real `run` function.
   - Each `run` returns a `LensFindings` object with at least
     one finding when the change has the issue it detects.
   - Each `run` returns empty findings on a clean canonical
     change (verified by per-lens canonical test).
4. **State machine integration**:
   - `finalizeReview` with `passed=true` produces a receipt
     with non-empty `lensRuns` array when the persona requires
     lenses (e.g., `security` persona → 2 lens runs).
   - `finalizeReview` with `passed=true` produces a receipt
     with empty `lensRuns` when the persona requires no lenses
     (e.g., `plain` persona).
   - Receipt hash unchanged by lens execution (only the 5 MD
     files contribute to content hash, not the findings).
5. **Receipt extension**:
   - `ReviewReceipt.lensRuns` is `LensRunDetail[]` with each
     entry carrying `status`, `findingsCount`, `durationMs`,
     and `findings: LensFinding[]`.
   - `writeReceipt` accepts an optional `lensRuns` parameter
     and includes it in the JSON.
   - `validateReceipt` accepts both v0.5.0 receipts (empty
     `lensRuns`) and v0.6.0 receipts (populated `lensRuns`).
6. **`resetReview` real implementation**:
   - Calling on a change with valid `state.json` archives it
     to `.review/state.json.corrupt-<ISO-timestamp>` and
     returns `{ ok: true, archivedPath: <path> }`.
   - Calling on a change with no state file returns
     `{ ok: false, reason: "no-state" }`.
   - `extensions/caduceus.ts` wires the real implementation
     (no more stub).
7. **Inspect output**:
   - `formatSnapshot` includes a `lens runs:` block listing
     each required lens with status + finding count.
8. **Backward compat**:
   - All 309 v0.5.0 tests pass unchanged.
   - `caduceus` package installs cleanly on a clean clone.
9. **v0.6.0 published to npm** with tag `latest` (auto-
   promoted by the npm registry on first publish).

## 5. Open questions for the user (none blocking)

- Q1: Should the lens findings include a `line: number` field
  alongside `location` (which is currently a free-form string
  like "proposal.md" or "section §3")? — **My recommendation:**
  add `line: number` for findings that point to a specific line
  (e.g., keyword matches), keep `location: string` for section-
  level findings.
- Q2: When a lens produces > 20 findings, should we cap the
  array and add a `truncated: true` flag? — **My recommendation:**
  cap at 20 + truncated flag. Avoids huge receipts on bad
  changes.
- Q3: Should the `risk` lens also count the number of files
  in the change directory as a "size" metric? — **My recommendation:**
  yes; threshold is configurable later; for v0.6.0 default to
  P3 if > 10 files (heuristic only).

## 6. Marketing plan (non-SDD, separate workstream)

- **Forum post (D-1)**: "caduceus v0.6.0: 5 real lenses land".
  Highlight: review state machine now actually executes
  analysis; receipts carry findings; `resetReview` is real.
- **Strategy blog post (D+0 or D+1)**: shorter than v0.5.0's;
  cover the lens implementation philosophy (static analysis,
  no LLM, persona-aware), the receipt extension, and the
  roadmap to v0.7.0 (subagents) and v0.8.0 (goal loop).
- **No breaking changes announcement**: v0.6.0 is fully
  additive; v0.5.0 users see 5 new files in `lib/lens/` and
  the receipt format extended (old receipts still validate).

## 7. Rollback

v0.6.0 is fully additive and backward-compatible. Rolling
back to v0.5.0:

1. `pi remove npm:pi-caduceus`
2. `pi install npm:pi-caduceus@0.5.0`
3. Any change archived under v0.6.0 still validates (the receipt
   format is a superset of v0.5.0).
4. Any change mid-flight (started under v0.6.0 but not yet
   finalized) may have `lensRuns: []` in its state; v0.5.0
   reads it as empty and the review finalizes without lens
   data — no data loss.
5. The 5 new `lib/lens/*.ts` files are simply not loaded by
   v0.5.0; no cleanup needed.

## 8. Next phase

`sdd-design` — write
`openspec/changes/caduceus-v0.6.0-lens-collection/design.md`
covering:

- Per-lens implementation: file location, exported `Lens`,
  `run` algorithm, severity thresholds, canonical-test inputs
- State machine integration: where `runLensSet` is called,
  how findings feed into the receipt
- Receipt schema extension: full `LensRunDetail` JSON shape
- `resetReview` algorithm: atomicity, error paths
- `formatSnapshot` enhancement: lens runs block layout
- File change list (new + modified)
- Test file mapping

Then `sdd-tasks` — ~12 implementation tasks. Estimated
~1700 LOC, ~50 new tests, ~6-8 hours end-to-end.

After v0.6.0 ships, the next change is `v0.7.0` (Phase C —
subagent orchestration). The lens framework and receipt
extension are prerequisites.

## 9. Amendment to STATUS.md

Smaller than v0.5.0's amendments (no DNA-3 revision; no
brand-independence change). Updates:

- **§2 (snapshot)**: v0.6.0 details (5 lens impls, 359+ tests,
  receipt format extended).
- **§2.1 (what ships)**: lens implementation list, receipt
  extension, `resetReview` promotion, inspect output.
- **§7 (roadmap)**: mark v0.6.0 as shipped; v0.7.0 becomes
  next.
- **§8 (decision records)**: append 3-4 new rows.

## 10. Design references

The following prior work informed the v0.6.0 design.
caduceus does **not import, bridge to, or depend on** any
external package.

| Reference | What was taken | What was NOT taken |
|---|---|---|
| v0.5.0 review state machine | The 6-state machine, persona-aware lens routing, content-bound receipt structure | All code lives in caduceus |
| `lib/constitution-lint.ts` (v0.5.0) | Pattern for pure-function static analysis checks with severity + location; inspiration for lens interface | All lens rules are caduceus-original |
| Marri 2026 "Constitutional SDD" | Lens-finding severity pattern (P0 = block, P1 = warn, P2/P3 = info) | caduceus does NOT auto-block on P0 |
| OpenSpec artifact structure | The 5-MD-file shape (proposal/design/tasks/requirements/constitution) that lenses analyze | caduceus uses its own templates |
| `pi-review` v1.2.1 (deployed upstream) | P0/P1/P2/P3 priority tier semantics | No code or content reuse |
| `pi-agents` v0.16.1 (deployed upstream) | Subagent-style dispatch primitive (referenced for v0.7.0 design only) | Not adopted in v0.6.0; caduceus has no subagent in v0.6.0 |

**Enforcement**: `scripts/verify-package.mjs` Checks 15/16/17
(forbid external pi packages) remain authoritative in v0.6.0.

---

> **End of proposal.** Awaiting lyssom review. Once accepted,
> proceed to `sdd-design` and produce `design.md`.
