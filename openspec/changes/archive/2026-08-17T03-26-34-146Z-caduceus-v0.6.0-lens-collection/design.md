<!-- caduceus:design-template-version 0.6.0 -->

# caduceus v0.6.0 — Design

> **Status:** Design (awaiting tasks phase).
> **Date:** 2026-08-14
> **Change:** `caduceus-v0.6.0-lens-collection`

## 1. Purpose

Translate the v0.6.0 proposal into a concrete technical design:
populate the v0.5.0 lens framework with 5 real static-analysis
implementations, integrate them into the review state machine, capture
findings into the receipt, promote `resetReview` from a stub to a real
archive-and-clear operation, and bump the task template to gate a new
"Done when" contract convention.

## 2. Design philosophy

### 2.1 DNA-3 (unchanged from v0.5.0)

Light at the core, evolve into persona-aware harness, compose
internally only. 0 runtime deps / 0 native binaries / 0 postinstall /
0 network calls.

### 2.2 Static analysis vs dynamic verification trade-off

The caduceus lens framework is **static analysis** — every `run`
function reads the 5 MD artifacts and produces findings without
executing the change or invoking any model. This is a deliberate
boundary.

`pi-goal-list-loop-audit` (dracond, v0.34.22+) implements completion
auditing via a detached, extension-less `pi --mode rpc` worker process
that can re-execute the change in a sandboxed read-only mode. That
approach gives dynamic verification but requires process spawning,
file-based RPC protocol, and generation-bound result validation.

caduceus v0.6.0 does **not** adopt that pattern: it preserves the
0-runtime-deps / 0-native / 0-postinstall invariants (DNA-3) and
reports findings the user must act on, rather than re-running the
change behind the user's back. See §3.3 for the deferred-evaluation
clause.

## 3. Scope

### 3.1 In scope for v0.6.0

See `proposal.md` §3.1 for the locked scope. Summary:

- 5 lens implementations in `lib/lens/`
- State machine integration in `finalizeReview` via `runLensSet`
- Receipt schema extension (`LensRunDetail[]`)
- `resetReview` real implementation (archive + clear)
- `inspectIsCorrupted` real implementation
- `formatSnapshot` lens runs output
- `lib/sdd-templates.ts` `TEMPLATE_VERSION` bump + tasks.md "Done when" section
- ~50 new tests (ceiling 80)
- README + CHANGELOG + STATUS + AGENTS updates

### 3.2 Explicitly out of scope

- LLM-based lens (any `run` that calls a model API)
- Network calls of any kind
- P0 auto-block on findings (v0.6.0 only reports; blocking lands in v0.8.0)
- User-configurable per-lens thresholds
- Cross-file / cross-change lens
- Network / process invocation for verification (e.g., running `tsc`)

### 3.3 Deferred to v0.8.0+

A detached auditor worker process pattern (à la dracond v0.34.22+) MAY
be evaluated as a separate `caduceus-auditor` companion package.
Triggering condition: false-negative rate of the v0.6.0 static lens
framework exceeds 20% when benchmarked against the v0.6.0 archive. If
pursued, it MUST ship as a separate package (separate license
conversation required given dracond's AGPL-3.0-only license) and MUST
NOT be merged into the `pi-caduceus` core.

## 4. Module map

```text
lib/lens/                                # NEW
  index.ts                               #   defaultLensRegistry() factory
  risk.ts                                #   risk lens
  correctness.ts                         #   correctness lens
  security.ts                            #   security lens
  readability.ts                         #   readability lens
  spec-compliance.ts                     #   spec-compliance lens

lib/sdd-templates.ts                     # MODIFIED
                                         #   TEMPLATE_VERSION "0.5.0"→"0.6.0"
                                         #   renderTasks: "Done when:" section
                                         #   update all 5 template markers

lib/review-types.ts                      # MODIFIED
                                         #   LensFinding: line?: number
                                         #   LensFindings: truncated?: boolean
                                         #   new LensRunDetail type

lib/review-state-machine.ts              # MODIFIED
                                         #   new runLensSet(registry, persona, cd)
                                         #   finalizeReview calls runLensSet
                                         #   new resetReview real impl
                                         #   new inspectIsCorrupted real impl

lib/review-receipt.ts                    # MODIFIED
                                         #   writeReceipt 4th param lensRuns
                                         #   ReviewReceipt.lensRuns→LensRunDetail[]
                                         #   validateReceipt: v0.5+v0.6 compat

lib/slash-commands-review.ts             # MODIFIED
                                         #   formatSnapshot: lens runs block
                                         #   resetReview return type widened

extensions/caduceus.ts                   # MODIFIED
                                         #   replace resetReview stub (line 252)

tests/lens/risk.test.ts                  # NEW (~6)
tests/lens/correctness.test.ts           # NEW (~8)
tests/lens/security.test.ts              # NEW (~6)
tests/lens/readability.test.ts           # NEW (~5)
tests/lens/spec-compliance.test.ts       # NEW (~7)
tests/lens/index.test.ts                 # NEW (~2)

tests/review-state-machine.test.ts       # MODIFIED (+6)
tests/review-receipt.test.ts             # MODIFIED (+4)
tests/slash-commands-review.test.ts      # MODIFIED (+3)
```

## 5. Types

```ts
// lib/review-types.ts (additions / modifications)

export type LensFinding = {
  severity: "P0" | "P1" | "P2" | "P3";
  summary: string;
  location: string;       // e.g., "tasks.md §Task 2" or "design.md:47"
  recommendation: string;
  line?: number;          // NEW: source line for keyword/grep findings
};

export type LensFindings = {
  lensId: LensId;
  findings: ReadonlyArray<LensFinding>;
  durationMs: number;
  truncated?: boolean;    // NEW: true when findings array was capped at 20
};

export type LensRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export type LensRunDetail = {
  lensId: LensId;
  status: LensRunStatus;
  personaRequired: boolean;
  findingsCount: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number;
  findings: ReadonlyArray<LensFinding>;  // NEW: per-lens findings
  truncated?: boolean;                  // NEW
};

// ReviewReceipt.lensRuns becomes ReadonlyArray<LensRunDetail>
```

## 6. Per-lens implementation

### 6.1 `lib/lens/risk.ts`

**Algorithm** (pure, ~80 LOC):

1. Read `proposal.md`; emit `P1` finding per occurrence of regex
   `/\bbreaking\b|\bdeprecat\b/gi` with `line` field set. The `i`
   flag handles case-insensitivity; the two `\b`-anchored alternatives
   provide the same semantics as `(?i)\b(breaking|deprecat)\b` while
   remaining parseable under Node 22's regex engine (which doesn't
   accept inline `(?i)` modifiers in regex literals).
2. Read all 5 MD files; count occurrences of `TODO|FIXME|XXX|HACK`;
   if total ≥ 3, emit single `P2` finding with location
   `<artifact>:lines`.
3. Count files in `changeDir`; if > 10, emit single `P3` finding
   "change directory contains >10 files" (REQ-026).

**Severity thresholds**: P1 keyword match / P2 ≥3 markers / P3 >10
files.

**Canonical tests**:
- `dirty-keyword`: a `proposal.md` containing "BREAKING CHANGE" → 1+
  P1 finding.
- `dirty-todo`: 3+ TODO/FIXME across artifacts → 1+ P2 finding.
- `dirty-files`: >10 files in change dir → 1+ P3 finding.
- `clean`: empty canonical change → 0 findings.
- `truncation`: >20 keyword matches → capped at 20, truncated=true.

### 6.2 `lib/lens/correctness.ts`

**Algorithm** (~150 LOC):

1. Parse `requirements.md`; extract set `R = { REQ-NNN }`.
2. Read `design.md`; extract set `D_req = { REQ-NNN }` referenced in
   `design.md` body. Emit `P1` for each `d ∈ D_req \ R`
   ("REQ-NNN referenced in design.md but not in requirements.md").
3. Parse `constitution.md`; extract set `C = { CON-NNN }`.
4. Read `design.md`; extract set `D_con = { CON-NNN }`. Emit `P2` for
   each `d ∈ D_con \ C`.
5. If `tasks.md` carries the v0.6.0 template version marker
   (`<!-- caduceus:tasks-template-version 0.6.0 -->`):
   - For each `## Task N:` block, check that the block contains a
     `**Done when:**` line. Emit `P2` per task missing it.
   - If v0.5.0 marker present, skip this check entirely.
6. Read `tasks.md`; emit `P2` for each task with zero checkboxes.

**Canonical tests**:
- `dirty-design-req`: `design.md` mentions REQ-999 not in
  `requirements.md` → 1+ P1 finding.
- `dirty-con`: `design.md` mentions CON-999 not in `constitution.md`
  → 1+ P2 finding.
- `dirty-done-when`: v0.6.0-marker `tasks.md` missing "Done when:"
  → 1+ P2 finding.
- `clean-v0.5`: v0.5.0-marker canonical change → 0 findings
  (template marker exempt).
- `dirty-no-checkboxes`: task with no `[ ]` → 1+ P2 finding.

### 6.3 `lib/lens/security.ts`

**Algorithm** (~120 LOC):

1. Parse `constitution.md`; for each `### CON-NNN:` block, check
   `**CWE**:` field. If `Level` is `MUST` or `SHALL` and the field is
   absent, emit `P0` finding (defensive — production data should never
   reach this state given the constitution lint).
2. Read `tasks.md` and `design.md`; emit `P1` per occurrence of regex
   `/(?i)\b(password|api[_-]?key|token|secret)\b/` (with `line`).
3. Read `tasks.md`; emit `P1` per occurrence of
   `curl\s*\|\s*sh|wget\s*\|\s*sh|sudo\s` (with `line`).

**Canonical tests**:
- `dirty-cwe`: constitution with MUST-level CON-NNN lacking CWE → 1+
  P0 finding.
- `dirty-secret`: tasks.md containing "password" → 1+ P1 finding.
- `dirty-curl-sh`: tasks.md containing `curl | sh` → 1+ P1 finding.
- `clean`: canonical constitution with CWE mappings → 0 findings.

### 6.4 `lib/lens/readability.ts`

**Algorithm** (~100 LOC):

1. Read all 5 MD files; emit `P2` for any file whose line count > 200.
2. Read `proposal.md`; check for required sections: `## 1. Intent`,
   `## 3. Scope`, `## 4. Success criteria`. Emit `P2` per missing
   section.
3. Read all 5 MD files; compute max heading depth (`#`/`##`/`###`/
   `####`/`#####`); if > 4 levels (i.e., depth-5 heading found),
   emit `P3`.

**Canonical tests**:
- `dirty-large`: 250-line `proposal.md` → 1+ P2 finding.
- `dirty-sections`: `proposal.md` missing "## 4. Success criteria" →
  1+ P2 finding.
- `dirty-depth`: 5-level deep heading → 1+ P3 finding.
- `clean`: canonical `proposal.md` → 0 findings.

### 6.5 `lib/lens/spec-compliance.ts`

**Algorithm** (~140 LOC):

1. Parse `requirements.md`; extract set `R = { REQ-NNN }`.
2. Read `tasks.md`; extract set `T = { REQ-NNN }` referenced in task
   bodies. Emit `P1` for each `r ∈ R \ T` ("REQ-NNN declared in
   requirements.md but not covered by any task").
3. Read `proposal.md`; check that `## 3. Scope` section mentions the
   `changeName` (from `state.json` `activeChange` or directory name
   basename). Emit `P2` if missing.
4. Parse `constitution.md`; extract set `C = { CON-NNN }`.
5. Read `proposal.md` and `design.md`; extract set `PD = { CON-NNN }`
   referenced. Emit `P2` for each `c ∈ C \ PD` ("CON-NNN declared in
   constitution.md but not referenced in proposal/design").

**Canonical tests**:
- `dirty-orphan-req`: `requirements.md` with REQ-007 not covered by
  any task → 1+ P1 finding.
- `dirty-changename`: §3 missing the change name → 1+ P2 finding.
- `dirty-orphan-con`: constitution CON-005 not referenced anywhere →
  1+ P2 finding.
- `clean`: canonical change → 0 findings.

## 7. State machine integration

### 7.1 `runLensSet` helper (in `lib/review-state-machine.ts`)

```ts
async function runLensSet(
  registry: LensRegistry,
  personaSnapshot: PersonaSnapshot,
  changeDir: string,
): Promise<ReadonlyArray<LensRunDetail>> {
  const required = requiredLensesForPersona(
    personaSnapshot.activePersona,
  );
  if (required.length === 0) return [];

  const results: LensRunDetail[] = [];
  for (const lensId of required) {
    const lens = registry.get(lensId);
    const startedAt = new Date().toISOString();
    const t0 = Date.now();
    if (!lens || !lens.run) {
      results.push({
        lensId,
        status: "skipped",
        personaRequired: true,
        findingsCount: 0,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        findings: [],
      });
      continue;
    }
    try {
      const out = await lens.run(changeDir);
      results.push({
        lensId,
        status: "completed",
        personaRequired: true,
        findingsCount: out.findings.length,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: out.durationMs || (Date.now() - t0),
        findings: out.findings,
        truncated: out.truncated,
      });
    } catch {
      results.push({
        lensId,
        status: "failed",
        personaRequired: true,
        findingsCount: 0,
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - t0,
        findings: [],
      });
    }
  }
  return Object.freeze(results);
}
```

### 7.2 `finalizeReview` flow (MODIFIED)

```ts
export async function finalizeReview(
  changeName: string,
  cwd: string,
  finalVerificationPassed: boolean,
): Promise<FinalizeResult> {
  const cd = changeDir(changeName, cwd);
  const current = requireState(cd, changeName);
  if (current.state !== "in-review") {
    throw new CaduceusReviewError(
      "not-in-review",
      `Cannot finalize from state '${current.state}'; must be 'in-review'.`,
    );
  }

  // NEW: run persona-required lenses against the change dir
  const registry = createLensRegistry();
  registerDefaultLenses(registry);   // populates from lib/lens/index.ts
  const lensRuns = await runLensSet(
    registry,
    current.personaSnapshot,
    cd,
  );

  // write receipt with lensRuns (4th param)
  writeReceipt(
    cd,
    current.personaSnapshot,
    finalVerificationPassed,
    lensRuns,
  );

  // mirror lensRuns into state
  const receipt = readReceipt(cd);
  const next: ReviewSnapshot = {
    ...current,
    state: "finalized",
    lensRuns: receipt.lensRuns,
    lastTransitionAt: new Date().toISOString(),
    transitionHistory: [
      ...current.transitionHistory,
      { from: current.state, to: "finalized", at: new Date().toISOString() },
    ],
  };
  atomicWriteJSON(statePath(cd), next);

  return { ...next, finalVerificationPassed };
}
```

**Backward-compat note**: `finalizeReview` becomes `async`. All call
sites must `await` — there are 2 known callers: `slash-commands-review.ts`
(`/caduceus:review:finalize` handler) and the integration test. Both
already use `async` contexts.

## 8. Receipt schema extension

### 8.1 `ReviewReceipt.lensRuns` schema change

```jsonc
// v0.5.0 (existing, still valid)
{
  "schemaVersion": 1,
  "lensRuns": [],          // empty array
  ...
}

// v0.6.0 (new)
{
  "schemaVersion": 1,
  "lensRuns": [
    {
      "lensId": "security",
      "status": "completed",
      "personaRequired": true,
      "findingsCount": 2,
      "startedAt": "2026-08-14T12:34:56.789Z",
      "completedAt": "2026-08-14T12:34:56.801Z",
      "durationMs": 12,
      "findings": [
        {
          "severity": "P1",
          "summary": "secret-like keyword 'password' in tasks.md",
          "location": "tasks.md",
          "line": 17,
          "recommendation": "Avoid embedding secrets in MD; use a secrets manager."
        }
      ],
      "truncated": false
    }
  ],
  ...
}
```

### 8.2 `contentHash` scope unchanged

The `contentHash` MUST continue to cover only the 5 MD artifacts
(proposal/design/tasks/requirements/constitution). The `lensRuns` field
is excluded — same `contentHash` is computable regardless of lens
execution results.

### 8.3 `validateReceipt` backward compat

```ts
// Same signature. Internal logic:
// 1. Recompute contentHash → unchanged behavior.
// 2. Check receipt.lensRuns is an array (Array.isArray).
//    Both [] and [...] are valid; no per-element validation.
// 3. No additional checks on lensRuns contents — the receipt's persona
//    + contentHash are sufficient.
```

## 9. `resetReview` algorithm

```ts
export function resetReview(
  changeName: string,
  cwd: string,
):
  | { ok: true; archivedPath: string }
  | { ok: false; reason: string } {
  const cd = changeDir(changeName, cwd);
  const reviewDirPath = path.join(cd, ".review");
  const sPath = path.join(reviewDirPath, "state.json");
  if (!existsSync(sPath)) {
    return { ok: false, reason: "no-state" };
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const archivePath = path.join(
    reviewDirPath,
    `state.json.corrupt-${ts}`,
  );
  // atomic rename (same partition, no copy)
  renameSync(sPath, archivePath);

  // best-effort: archive receipt.json if present (do not delete it
  // out from under the user without trace)
  const receiptPath = path.join(reviewDirPath, "receipt.json");
  if (existsSync(receiptPath)) {
    const ts2 = new Date().toISOString().replace(/[:.]/g, "-");
    renameSync(
      receiptPath,
      path.join(reviewDirPath, `receipt.json.corrupt-${ts2}`),
    );
  }
  // activeChange clearing is delegated to the existing
  // sdd-state-clearing helper (unchanged behavior).
  return { ok: true, archivedPath: archivePath };
}
```

**Atomicity guarantee (CON-004 / REQ-015)**: `renameSync` is atomic on
the same filesystem; if the rename fails the original `state.json`
remains intact. The receipt archive is best-effort: if it fails after
the state archive succeeded, the operation still returns `ok: true`
(the primary archive completed).

**Error paths**:
- No `.review/` directory or no `state.json` → `{ ok: false, reason: "no-state" }`
- `renameSync` throws (cross-device, permissions) → throw propagates; original state preserved
- State JSON is corrupt (parse failure) → caller must invoke `inspectIsCorrupted` first to gate this command

## 10. `formatSnapshot` enhancement

```text
review state: finalized
changeId: caduceus-v0.6.0-lens-collection
persona: default
lens runs: 2                       # NEW
  - security: completed (3 findings, 12ms)
  - risk: completed (1 finding, 5ms)
transitions: 4
lastTransitionAt: 2026-08-14T12:34:56.801Z
```

The `lens runs:` block is rendered only when `lensRuns.length > 0`;
absent for personas with no required lenses (e.g., `plain`).

## 11. Test plan

| Test file | New tests | Coverage |
|---|---|---|
| `tests/lens/risk.test.ts` | 6 | dirty-keyword / dirty-todo / dirty-files / clean / truncation / canonical-marker |
| `tests/lens/correctness.test.ts` | 8 | dirty-design-req / dirty-con / dirty-done-when (v0.6 marker) / clean (v0.5 marker exempt) / dirty-no-checkboxes / cross-file / dirty-mixed / canonical |
| `tests/lens/security.test.ts` | 6 | dirty-cwe / dirty-secret / dirty-curl-sh / clean / dirty-multi / canonical |
| `tests/lens/readability.test.ts` | 5 | dirty-large / dirty-sections / dirty-depth / clean / multi-file |
| `tests/lens/spec-compliance.test.ts` | 7 | dirty-orphan-req / dirty-changename / dirty-orphan-con / clean / orphan-req-multi / state-fallback / canonical |
| `tests/lens/index.test.ts` | 2 | defaultLensRegistry registers all 5 / createLensRegistry() empty preserved |
| `tests/review-state-machine.test.ts` | +6 | finalizeReview runs lenses (security persona) / finalizeReview 0 lenses (plain persona) / resetReview archives / resetReview no-state / resetReview atomic on rename fail (mocked) / inspectIsCorrupted corrupt JSON |
| `tests/review-receipt.test.ts` | +4 | writeReceipt 4-arg default [] / writeReceipt populated / validateReceipt v0.5 compat / contentHash unchanged by lensRuns |
| `tests/slash-commands-review.test.ts` | +3 | formatSnapshot lens block / resetReview wiring in extensions / no-lens persona omits block |
| **Total** | **~47** | target ≥50; ceiling 80. **Stretch**: 1-3 additional triangulation tests in T03/T08 close the gap. |

**Backward compat tests** (added to existing test files):
- All 21 existing v0.5.0 review-state-machine + receipt + slash tests MUST pass unchanged
- 5 snapshot tests in `tests/review-receipt.test.ts` MUST accept both v0.5.0 and v0.6.0 receipt formats

## 12. References consulted (no code reuse)

| Reference | What was taken | What was NOT taken |
|---|---|---|
| `pi-goal-list-loop-audit` (dracond) v0.34.22 | The regression-shield pattern (orchestrator-side verification contract enforcement) | All code; dracond is AGPL-3.0-only, incompatible with caduceus MIT |
| `pi-goal-list-loop-audit` v0.34.22 (DESIGN.md §Addendum) | The "anti-bamboozle" insight: agent ≠ verifier | The detached process pattern (deferred to v0.8.0+, §3.3) |
| `pi-goal-list-loop-audit` reviewer.ts v0.26.0 | The P0/P1/P2/P3 severity tier convention (see §13 alignment matrix) | The 4-mode (off/on/auto/aggressive) reviewer cascade (out of scope) |
| `lib/constitution-lint.ts` (v0.5.0) | The pure-function static-analysis pattern with severity + location | All five checks (constitution lint is a different concern) |
| Marri 2026 "Constitutional SDD" | RFC 2119 + CWE mapping convention | Auto-blocking on P0 (caduceus only reports) |
| `pi-review` 1.2.1 | P0/P1/P2/P3 priority tier semantics | Minisign signing, branch isolation |
| `pi-agents` 0.16.1 | None for v0.6.0; v0.7.0 reference only | All code |
| `pi-muselinn-harness` 0.9.22 | None for v0.6.0; v0.8.0 reference (triple budget) | All code |

Mechanical enforcement: `scripts/verify-package.mjs` checks 15/16/17
remain authoritative; design patterns only.

## 13. Alignment matrix — severity tier sources

The P0/P1/P2/P3 severity convention used in `LensFinding.severity` is
sourced from the broader ecosystem (a community consensus, not a
single-source convention):

| Source | Contribution |
|---|---|
| Marri 2026, "Constitutional SDD" | Constitutional constraints with RFC 2119 levels (MUST/SHOULD/MAY) — informs the MUST-level → P0 mapping for the security lens |
| `pi-review` 1.2.1 | The P0/P1/P2/P3 priority tier semantics adopted in caduceus lens findings |
| `pi-goal-list-loop-audit` (dracond) reviewer.ts v0.26.0 | A fourth validation that the 4-tier convention is the community default (caduceus v0.5.0 cited 3 sources; dracond is added as a 4th) |
| caduceus v0.5.0 (own choice) | The P0=report / P1=warn / P2/P3=info mapping (NOT auto-block; v0.6.0 reports only — blocking is deferred to v0.8.0+) |

## 14. File changes summary

See §4 module map and `tasks.md` for the implementation sequence.