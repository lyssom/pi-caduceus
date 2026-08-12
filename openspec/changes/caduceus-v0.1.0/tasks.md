# caduceus v0.1.0 — Implementation Tasks

> **Status:** Tasks complete. Awaiting `apply` phase.
> **Date:** 2026-01
> **Change:** `caduceus-v0.1.0`
> **Source contracts:** [`proposal.md`](./proposal.md), [`spec.md`](./spec.md), [`design.md`](./design.md)
> **Strict TDD:** enabled (test runner:
> `node --experimental-strip-types --test tests/*.test.ts`)
> **Review budget:** 400 changed lines (per
> [`openspec/config.yaml`](../../config.yaml))

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | **700** (range 650–780) |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** (per sdd-tasks rule) |
| Suggested split | See "Delivery strategy decision" below |
| Delivery strategy | **exception-ok** (greenfield heuristic — see below) |
| Chain strategy | **size-exception** (greenfield, single PR acceptable if user confirms) |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High
```

### Delivery strategy decision (parent action required)

The sdd-tasks rule says: "If risk is High or likely >400 lines,
recommend chained PRs and split tasks into autonomous work
units." Risk is High (~700 lines). The rule fires.

**However, caduceus is a greenfield package** — there is no
prior version of this package to chain against. The chained-PR
heuristic exists to protect reviewers from oversized changes
in mature repos where PR1 can be reviewed and merged before
PR2 starts. For a greenfield v0.1.0, the natural unit is the
whole package, and a chained strategy would mean "PR1 is the
whole thing minus a small slice" — which is **worse** for
reviewer focus, not better.

Three options:

| Option | What it means | Reviewer experience |
|---|---|---|
| **A. Single PR** (design's recommendation) | One PR with all 8 tasks | One large but coherent review. The package is a single artifact; splitting it forces reviewers to context-switch between PRs. |
| **B. Two chained PRs** | PR1 = T-1..T-4 (persona + locale), PR2 = T-5..T-8 (config + integration + publish) | Two focused reviews. PR1 proves the persona contract works; PR2 layers the config + integration. |
| **C. Defer to v0.1.1** | Ship a smaller v0.1.0 with just T-1..T-4 (no slash commands, no project override), add the rest in v0.1.1 | Smallest possible PR. But user loses `/caduceus:*` commands in v0.1.0 — a regression of `INIT.md §3.1` scope. **Not recommended.** |

**My recommendation: option A (single PR).** The greenfield
exception applies. The parent orchestrator should confirm
this with the user before `sdd-apply` begins.

If the user prefers option B, the task split is:

```text
PR 1: Persona contract
  - T-1: tests/persona-contract.test.ts (RED)
  - T-2: lib/persona-contract.ts + prompts/*.md
  - T-3: lib/language-clause.ts + tests/language-clause.test.ts
  - T-4: lib/locale-detect.ts + tests/locale-detect.test.ts
  Estimated: ~400 lines

PR 2: Configuration + integration + ship
  - T-5: lib/config-store.ts + tests/config-store.test.ts
  - T-6: lib/slash-commands.ts + tests/slash-commands.test.ts
  - T-7: extensions/caduceus.ts
  - T-8: themes/, package.json, README, LICENSE, scripts/verify-package.mjs
  Estimated: ~300 lines
```

PR 1 must merge before PR 2 starts (PR 2 imports types from
PR 1). Both PRs target `main` (this is a single-developer
greenfield, no `dev` branch yet).

## Task ownership convention

Per the sdd-status-contract, each task checkbox is marked
with one terminal owner marker:

- `<!-- sdd-owner: implementation -->` — the apply agent
  implements this.
- `<!-- sdd-owner: parent -->` — the parent orchestrator or
  user performs this; it is a deferred lifecycle or
  out-of-band action.

Implementation tasks (T-1 through T-8) are marked
`<!-- sdd-owner: implementation -->`. The publish-related
deferred actions (D-1, D-2, D-3) are marked
`<!-- sdd-owner: parent -->`.

## Task ordering and dependencies

```text
T-1 (RED persona test) ──► T-2 (GREEN persona impl)
                                  │
                                  ▼
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
T-3 (language clause)                  T-4 (locale-detect)
              │                                       │
              └───────────────────┬───────────────────┘
                                  ▼
                          T-5 (config-store)
                                  │
                                  ▼
                          T-6 (slash-commands)
                                  │
                                  ▼
                          T-7 (extension entry)
                                  │
                                  ▼
                          T-8 (package meta)
                                  │
                                  ▼
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
        D-1 (publish)                          D-2 (GitHub org)
                                                  D-3 (push to GitHub)
```

## Implementation tasks

### T-1 — Failing persona contract test (RED)

- [ ] Write `tests/persona-contract.test.ts` with 9 failing
  assertions covering R-PERSONA-001 through R-PERSONA-009
  (excluding R-PERSONA-007/008 which require the prompt files
  to exist). Each assertion imports
  `buildPersonaPrompt` from `../lib/persona-contract.ts`
  (which does not exist yet). The file imports nothing else
  from caduceus. Run `node --experimental-strip-types --test
  tests/persona-contract.test.ts` and confirm **all assertions
  fail with module-not-found**. The "first committed test must
  be a failing persona-contract test" requirement from
  `INIT.md §9.4` is satisfied. <!-- sdd-owner: implementation -->

**Files:** `tests/persona-contract.test.ts` (new, ~80 lines)

**Spec refs:** R-PERSONA-001, 002, 003, 004, 005, 006, 009

**Verification:** `node --experimental-strip-types --test
tests/persona-contract.test.ts` exits non-zero with
`ERR_MODULE_NOT_FOUND` for `persona-contract.ts`.

**Rollback:** `git restore tests/persona-contract.test.ts`.
No state to undo.

### T-2 — Persona contract implementation (GREEN → TRIANGULATE → REFACTOR)

- [ ] Create `prompts/gentleman.md` by reading
  `gentle-pi/extensions/gentle-ai.ts` lines 258–266 (persona
  block), lines 282–294 (identity contract), and lines
  300–308 (harness principles). Assemble into a 4-section
  markdown file with the structure described in
  `design.md §5.5`. <!-- sdd-owner: implementation -->
- [ ] Create `prompts/neutral.md` analogously, using lines
  268–277 for the persona block. <!-- sdd-owner: implementation -->
- [ ] Create `lib/persona-contract.ts` with the minimum
  implementation: load both prompt files at module load,
  cache them, export `buildPersonaPrompt(mode, locale)` that
  assembles identity + persona + `languageClause(locale, mode)`
  + harness principles. Run T-1's test and confirm **all 9
  assertions pass**. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** add 2 more assertions to
  `tests/persona-contract.test.ts` enforcing R-PERSONA-007 and
  R-PERSONA-008 (byte-for-byte match against gentle-pi lines).
  These read the gentle-pi source file from
  `/root/.pi/agent/npm/node_modules/gentle-pi/extensions/gentle-ai.ts`
  and compare the `prompts/<mode>.md` § Persona block to the
  corresponding lines. Confirm tests still pass.
  <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** clean up `lib/persona-contract.ts` —
  split into `renderIdentity` / `renderPersona` /
  `renderHarnessPrinciples` internal functions. Run all
  tests, confirm still green. <!-- sdd-owner: implementation -->

**Files:**
- `prompts/gentleman.md` (new, ~60 lines)
- `prompts/neutral.md` (new, ~60 lines)
- `lib/persona-contract.ts` (new, ~80 lines)
- `tests/persona-contract.test.ts` (extended to ~120 lines)

**Spec refs:** R-PERSONA-001, 002, 003, 004, 005, 006, 007,
008, 009

**Verification:** `node --experimental-strip-types --test
tests/persona-contract.test.ts` exits 0 with all 11
assertions passing.

**Rollback:** `git restore lib/persona-contract.ts prompts/ tests/`.
No external state.

### T-3 — Language clause + test

- [ ] Write `tests/language-clause.test.ts` with the full
  3×8 = 24-cell selection table from `design.md §5.4` as
  individual `it()` cases. Each case imports
  `languageClause` from `../lib/language-clause.ts` (which
  does not exist yet). Run and confirm **all fail with
  module-not-found**. <!-- sdd-owner: implementation -->
- [ ] Create `lib/language-clause.ts` with the selection
  table from `design.md §5.4` as a `switch` on
  `${locale}|${mode}`. Run tests, confirm **all pass**.
  <!-- sdd-owner: implementation -->
- [ ] Add 2 more cases to `tests/language-clause.test.ts`
  asserting the voseo / no-voseo clause for the
  cross-product of `(es-AR, es-ES) × (gentleman, neutral)`.
  Run, confirm pass. <!-- sdd-owner: implementation -->

**Files:**
- `lib/language-clause.ts` (new, ~40 lines)
- `tests/language-clause.test.ts` (new, ~80 lines)

**Spec refs:** R-PERSONA-010

**Verification:** all `languageClause` test cases pass.

**Rollback:** `git restore lib/language-clause.ts tests/`.

### T-4 — Locale detection + test

- [ ] Write `tests/locale-detect.test.ts` with cases for
  R-LOCALE-001..008. Each case imports `detectLocale` and
  `normalizeEnvLocale` from `../lib/locale-detect.ts`
  (which does not exist yet). Run and confirm **all fail
  with module-not-found**. <!-- sdd-owner: implementation -->
- [ ] Create `lib/locale-detect.ts` with the algorithm
  from `design.md §5.3` (priority chain + helper functions).
  Include the top-100-English-words frozen `Set`. Run
  tests, confirm **all pass**. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** add edge cases — empty text, only
  punctuation, only numbers, mixed CJK + Spanish diacritics
  (must be classified as Spanish because diacritics win).
  Run, confirm pass. <!-- sdd-owner: implementation -->

**Files:**
- `lib/locale-detect.ts` (new, ~120 lines)
- `tests/locale-detect.test.ts` (new, ~150 lines)

**Spec refs:** R-LOCALE-001, 002, 003, 004, 005, 006, 007, 008

**Verification:** all locale detection tests pass.

**Rollback:** `git restore lib/locale-detect.ts tests/`.

### T-5 — Config store + test

- [ ] Write `tests/config-store.test.ts` with cases for
  R-CONFIG-001..005. The tests use `node:fs/promises` mocks
  to simulate `~/.pi/agent/caduceus.json` and `.caduceusrc`
  presence/absence/malformed. Run and confirm **all fail
  with module-not-found**. <!-- sdd-owner: implementation -->
- [ ] Create `lib/config-store.ts` with the API from
  `design.md §5.6`: types, defaults, `readConfig`,
  `writeGlobalConfig`, `updateGlobalConfigField`, plus the
  `parseJsonc` and `atomicWriteJson` internal helpers. Run
  tests, confirm **all pass**. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** add 3 more cases for R-CONFIG-011,
  R-CONFIG-013, R-CONFIG-014 — read `package.json` from
  disk (after T-8 creates it; if T-8 not done, skip these
  and add them at T-8). <!-- sdd-owner: implementation -->
- [ ] Also create `lib/errors.ts` with `CaduceusError` and
  `CaduceusConfigError`. Update `lib/config-store.ts` to
  throw the typed error. <!-- sdd-owner: implementation -->
- [ ] Also create `lib/version.ts` with
  `export const CADUCEUS_VERSION = "0.1.0" as const;`.
  <!-- sdd-owner: implementation -->

**Files:**
- `lib/config-store.ts` (new, ~150 lines)
- `lib/errors.ts` (new, ~20 lines)
- `lib/version.ts` (new, ~3 lines)
- `tests/config-store.test.ts` (new, ~150 lines)

**Spec refs:** R-CONFIG-001, 002, 003, 004, 005 (and parts of
011/013/014)

**Verification:** all config-store tests pass.

**Rollback:** `git restore lib/config-store.ts lib/errors.ts lib/version.ts tests/`.

### T-6 — Slash commands + test

- [ ] Write `tests/slash-commands.test.ts` with cases for
  R-CONFIG-006, 007, 008, 009, 010 and R-PERSONA-011.
  Each test constructs a mock `ExtensionCommandContext`
  (with `ctx.ui.notify`, `ctx.ui.setStatus` as spies) and
  calls `registerSlashCommands(mockPi, deps)`, then invokes
  the registered command handler directly. Run and confirm
  **all fail with module-not-found**. <!-- sdd-owner: implementation -->
- [ ] Create `lib/slash-commands.ts` with the API from
  `design.md §5.7`: `CommandDeps` type, `registerSlashCommands`
  factory, the 4 command handlers. Run tests, confirm
  **all pass**. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** add byte-stability test for
  R-PERSONA-011 / R-CONFIG-009-2: invoke `/caduceus:inspect`
  twice with no config change, assert output strings
  `===`. Run, confirm pass. <!-- sdd-owner: implementation -->

**Files:**
- `lib/slash-commands.ts` (new, ~120 lines)
- `tests/slash-commands.test.ts` (new, ~150 lines)

**Spec refs:** R-CONFIG-006, 007, 008, 009, 010, R-PERSONA-011

**Verification:** all slash-command tests pass.

**Rollback:** `git restore lib/slash-commands.ts tests/`.

### T-7 — Extension entry (integration)

- [ ] Create `extensions/caduceus.ts` as the default-exported
  factory function from `design.md §5.8`. This is the only
  file that imports `@earendil-works/pi-coding-agent` types.
  <!-- sdd-owner: implementation -->
- [ ] **Smoke test (NOT a unit test, integration only):**
  run `pi -e ./extensions/caduceus.ts` from the caduceus
  repo root in a separate terminal. Confirm the TUI starts
  without error. Type `/` and confirm `/caduceus:status`
  appears in the command list. Quit pi. <!-- sdd-owner: implementation -->
- [ ] **Smoke test 2:** with the same `pi -e` invocation,
  type `/caduceus:status` and confirm the status line shows
  the default `mode: gentleman, locale: auto, showStatusBar:
  false, source: built-in defaults`. <!-- sdd-owner: implementation -->
- [ ] **Smoke test 3:** type `/caduceus:mode neutral`, then
  `/caduceus:status` again, confirm `mode: neutral`. Then
  type a Spanish prompt and confirm the response is in
  neutral Spanish (no voseo). Quit pi. <!-- sdd-owner: implementation -->
- [ ] **Smoke test 4:** type `/caduceus:inspect`, confirm
  the rendered persona prompt appears with source line
  annotations. Run it twice, confirm byte-stable output.
  <!-- sdd-owner: implementation -->

**Files:** `extensions/caduceus.ts` (new, ~80 lines)

**Spec refs:** (composes T-2..T-6; satisfies R-PERSONA-009
and the integration requirements R-CONFIG-006..010)

**Verification:** all 4 smoke tests pass manually.

**Rollback:** `git restore extensions/caduceus.ts`. Also
delete `~/.pi/agent/caduceus.json` (if T-6 wrote a test
config during the smoke test) — actually leave the file
since it's harmless.

### T-8 — Package meta + theme + verify script

- [ ] Create `themes/caduceus.json` with the exact content
  from `exploration.md §6.2`. <!-- sdd-owner: implementation -->
- [ ] Create `package.json` with the manifest from
  `design.md §11`. Include the
  `scripts.test: "node --experimental-strip-types --test tests/*.test.ts"`
  and
  `scripts.prepack: "node scripts/verify-package.mjs"`.
  <!-- sdd-owner: implementation -->
- [ ] Create `LICENSE` with the MIT license text (standard
  short form, year 2026, copyright "el Gentleman / lyssom").
  <!-- sdd-owner: implementation -->
- [ ] Create `README.md` with: positioning paragraph, install
  command (`pi install npm:@lyssom/pi-caduceus`), Quick Start
  section showing `/caduceus:status` and `/caduceus:inspect`
  output (text-rendered), configuration section explaining
  the JSONC `.caduceusrc`, link to `INIT.md` for rationale.
  <!-- sdd-owner: implementation -->
- [ ] Create `scripts/verify-package.mjs` with the 7
  pre-publish integrity checks from R-CONFIG-015. Make it
  exit 0 on pass, non-zero on any failure with a clear
  error message. <!-- sdd-owner: implementation -->
- [ ] Run `node scripts/verify-package.mjs` and confirm
  exit 0. <!-- sdd-owner: implementation -->
- [ ] Run `node --experimental-strip-types --test tests/*.test.ts`
  (all 5 test files together) and confirm exit 0 with all
  tests passing. <!-- sdd-owner: implementation -->
- [ ] Run `pnpm pack` (or `npm pack` if pnpm missing) and
  inspect the tarball: `tar -tzf *.tgz | grep -E '\.node$|bin/'`
  must return empty. <!-- sdd-owner: implementation -->

**Files:**
- `themes/caduceus.json` (new, ~80 lines)
- `package.json` (new, ~50 lines)
- `LICENSE` (new, ~20 lines)
- `README.md` (new, ~80 lines)
- `scripts/verify-package.mjs` (new, ~50 lines)

**Spec refs:** R-CONFIG-011, 012, 013, 014, 015

**Verification:** verify-package.mjs exits 0; full test
suite passes; tarball contains no native binaries.

**Rollback:** `git restore themes/ package.json LICENSE
README.md scripts/`. No external state.

## Deferred parent actions (out of band)

These are NOT implementation tasks. They are out-of-band
actions the user performs. The apply phase does NOT execute
these; the sdd-archive phase records them as
`deferredParentActions` and the parent orchestrator reminds
the user about them at archive time.

- [ ] D-1: User runs `npm login --scope=lyssom` (one-time
  per machine) to enable publishing to the `lyssom` scope.
  <!-- sdd-owner: parent -->
- [ ] D-2: User creates the `lyssom` GitHub org
  (out-of-band, requires `gh auth refresh -h github.com
  -s admin:org` first) and the `lyssom/pi-caduceus` repo.
  <!-- sdd-owner: parent -->
- [ ] D-3: User runs `npm publish --access=public` from
  the caduceus repo root after D-1 and D-2 are done.
  <!-- sdd-owner: parent -->
- [ ] D-4: User pushes the local git repo to
  `git@github.com:lyssom/pi-caduceus.git` and verifies the
  package appears on `https://pi.dev/packages` within
  ~10 minutes (gallery auto-indexing). <!-- sdd-owner: parent -->

## Cross-task dependencies

```text
T-2 depends on T-1 (test must exist before impl)
T-3 depends on T-2 (persona-contract exports PersonaMode type)
T-4 depends on T-2 (persona-contract exports ResolvedLocale)
T-5 depends on T-2 (PersonaMode type from config-store is mirrored)
T-6 depends on T-2, T-3, T-5 (slash commands compose all three)
T-7 depends on T-2..T-6 (extension entry wires everything)
T-8 depends on T-7 (extension must exist before package is valid)
```

The 8 tasks form a linear chain with one parallel branch
(T-3 and T-4 can run in parallel after T-2). The apply phase
executes them in this order.

## Apply execution mode

Per the preflight, execution mode is `interactive`. The
parent orchestrator will:

1. Run T-1, T-2, T-3, T-4 in order (or T-3 and T-4 in
   parallel — flagged as a single-thread vs parallel-write
   question for the user before apply).
2. Pause after each task to show the diff and confirm.
3. Run T-5, T-6, T-7 in order.
4. Run T-8 as the final task.
5. Confirm all 5 test files pass with the full test runner.
6. Hand off to the user for D-1..D-4.

## Next phase

`sdd-apply` — execute T-1 through T-8 in dependency order.
Per `design.md §12.2`, the first task (T-1) is the
RED-first test for `persona-contract.ts`. The apply agent
records evidence in `apply-progress.md` after each task
(diffs, test output, smoke test results).

Before `sdd-apply` starts, the parent orchestrator must
resolve the **delivery strategy decision** above
(single PR vs two chained PRs) with the user.
