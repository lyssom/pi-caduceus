# caduceus v0.1.1 — Implementation Tasks

> **Status:** Tasks complete. Awaiting `apply` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.1.1`
> **Source contracts:** [`proposal.md`](./proposal.md), [`design.md`](./design.md)
> **Strict TDD:** enabled (test runner:
> `node --experimental-strip-types --test tests/*.test.ts`)
> **Review budget:** 400 changed lines
> **Estimated total:** ~400 lines (fits single PR per delivery-strategy)

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 400 (range 350–480) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No (greenfield minor release, single PR) |
| Suggested split | Single PR (delivery strategy: single-pr-default) |
| Chain strategy | size-exception (justify by additivity) |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium
```

**Rationale for size-exception:** v0.1.1 is purely additive. No
existing behavior changes. All new code is in new files
(persona-loader.ts, lint.ts, prompt-mode.ts, prompts/concise.md,
prompts/reviewer.md, 2 new test files) plus small additions to
existing files (config-store, slash-commands, extension entry).
A single PR keeps the change atomic and reviewable as one
coherent feature set.

## Task ownership convention

Per the sdd-status-contract, each checkbox is marked with one
terminal owner marker:

- `<!-- sdd-owner: implementation -->` — the apply agent
  implements this.
- `<!-- sdd-owner: parent -->` — the parent orchestrator or
  user performs this; out-of-band action.

Implementation tasks (T-1 through T-10) are marked
`<!-- sdd-owner: implementation -->`. D-1 (npm publish) is marked
`<!-- sdd-owner: parent -->`.

## Task ordering and dependencies

```text
T-1 (RED persona-loader test)
   │
   ▼
T-2 (persona-loader + persona-contract refactor)  ◄── T-8 (new prompt files)
   │                                                  │
   ▼                                                  │
T-3 (RED lint test)                                   │
   │                                                  │
   ▼                                                  │
T-4 (lint impl)                                       │
   │                                                  │
   ▼                                                  │
T-5 (config-store additions) ─────────────────────► T-9 (full verify)
   │                                                  │
   ▼                                                  │
T-6 (slash-commands 3 new commands)                  │
   │                                                  │
   ▼                                                  │
T-7 (extension entry wiring) ──────────────────────► T-10 (publish)
                                                          │
                                                          ▼
                                                     D-1 (npm publish — user)
```

T-3..T-4 (lint) and T-5 (config-store) are independent after T-2.
T-6 (slash-commands) and T-8 (new prompt files) are
independent. The apply phase can run T-3+T-4 in parallel with
T-8.

## Implementation tasks

### T-1 — RED persona-loader test

- [ ] Write `tests/persona-loader.test.ts` with cases for
  `loadPersona` (built-in, global, project, missing) and
  `listPersonas` (built-in + global + project, dedup with
  project shadowing global). Each test imports from
  `../lib/persona-loader.ts` (which does not exist yet).
  Run and confirm all fail with `ERR_MODULE_NOT_FOUND`.
  <!-- sdd-owner: implementation -->

**Files:** `tests/persona-loader.test.ts` (new, ~100 lines)

**Spec refs:** new behavior, not yet in the v0.1.0 spec
(formal specs will be added in a follow-up change file)

**Verification:** test runner reports module-not-found for
`persona-loader.ts`.

**Rollback:** `git restore tests/persona-loader.test.ts`.

### T-2 — persona-loader + persona-contract refactor (GREEN)

- [ ] Create `lib/persona-loader.ts` with `loadPersona(name, cwd, home?)`
  and `listPersonas(cwd, home?)` per `design.md §4.2`. Built-in
  personas are read from `<module-dir>/../../prompts/<name>.md`.
  Use `import.meta.url` to resolve the built-in path (same
  pattern as `lib/persona-contract.ts`).
  <!-- sdd-owner: implementation -->
- [ ] Refactor `lib/persona-contract.ts`:
  - Extract the actual rendering into a new exported function
    `buildPersonaPromptFromContent(content, mode, locale)`.
  - Keep the existing `buildPersonaPrompt(mode, locale)` as a
    thin wrapper that loads the built-in file and delegates.
  - This is a non-breaking refactor; the persona-contract test
    still passes unchanged.
  <!-- sdd-owner: implementation -->
- [ ] Run T-1 test and confirm all pass.
  <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** add 3 more cases to T-1 for: custom
  persona with same name as built-in (project shadows built-in),
  global persona with same name as built-in (global shadows
  built-in), and a malformed project file (read errors should
  not break the resolution chain — fall through).
  <!-- sdd-owner: implementation -->

**Files:**
- `lib/persona-loader.ts` (new, ~70 lines)
- `lib/persona-contract.ts` (refactored, +20 lines)
- `tests/persona-loader.test.ts` (extended, +40 lines)

**Spec refs:** T-1 spec refs.

**Verification:** all persona-loader tests pass; all v0.1.0
persona-contract tests still pass (refactor is non-breaking).

**Rollback:** `git restore lib/persona-loader.ts lib/persona-contract.ts tests/persona-loader.test.ts`.

### T-3 — RED lint test

- [ ] Write `tests/lint.test.ts` with 9 cases: each lint check
  (CROSS_MODE_LEAK_GENTLEMAN, CROSS_MODE_LEAK_NEUTRAL,
  VOSE_CONDITIONAL, IDENTITY_BLOCK, PERSONA_BLOCK,
  PRINCIPLES_BLOCK, NO_TIMESTAMP, MODE_PLACEHOLDER), plus
  1 happy-path (`prompts/gentleman.md` content) and 1
  unhappy-path (synthetic bad persona with cross-mode voseo
  leak). Run and confirm all fail with module-not-found for
  `lib/lint.ts`. <!-- sdd-owner: implementation -->

**Files:** `tests/lint.test.ts` (new, ~100 lines)

**Verification:** test runner reports module-not-found for
`lib/lint.ts`.

**Rollback:** `git restore tests/lint.test.ts`.

### T-4 — lint implementation (GREEN + TRIANGULATE)

- [ ] Create `lib/lint.ts` with `lintPersonaContent(content, name)`
  per `design.md §4.3`. Each check is a small pure function.
  `VOSE_CONDITIONAL` is a warning (heuristic), all others are
  errors. Run T-3 test, confirm all pass.
  <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** add 2 more test cases for edge conditions:
  a persona with no `${mode}` placeholder (catch R-1), and a
  persona with a timestamp in the future year 2099 (catch
  R-NO_TIMESTAMP for unexpected content).
  <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** extract the 8 check functions into a
  named array `LINT_CHECKS: Array<(content, name) => LintIssue[]>`
  so adding a new check is one line.
  <!-- sdd-owner: implementation -->

**Files:**
- `lib/lint.ts` (new, ~120 lines)
- `tests/lint.test.ts` (extended, +30 lines)

**Spec refs:** T-3 spec refs.

**Verification:** all lint tests pass; all previous tests still
pass.

**Rollback:** `git restore lib/lint.ts tests/lint.test.ts`.

### T-5 — config-store additions (backward-compatible)

- [ ] Add `systemPromptMode: SystemPromptMode` and
  `persona: PersonaName` fields to `CaduceusConfig` type and
  `DEFAULT_CONFIG`. Update existing tests that construct
  configs to include the new fields.
  <!-- sdd-owner: implementation -->
- [ ] Add 4 new test cases to `tests/config-store.test.ts`:
  defaults for the new fields, project override of new fields,
  backward-compat (a `caduceus.json` without the new fields
  still resolves to defaults), and round-trip write+read
  preserves the new fields.
  <!-- sdd-owner: implementation -->

**Files:**
- `lib/config-store.ts` (modified, +15 lines)
- `tests/config-store.test.ts` (modified, +40 lines)

**Spec refs:** §3.1 of design.

**Verification:** all config-store tests pass; all v0.1.0 tests
still pass.

**Rollback:** `git restore lib/config-store.ts tests/config-store.test.ts`.

### T-6 — slash-commands additions (3 new commands)

- [ ] Add to `CommandDeps`: `systemPromptMode`,
  `listPersonas`, `switchPersona`, `setSystemPromptMode`,
  `lintActivePersona`. Register 3 new commands in
  `registerSlashCommands`.
  <!-- sdd-owner: implementation -->
- [ ] Add tests to `tests/slash-commands.test.ts`:
  - `/caduceus:prompt replace` — calls
    `setSystemPromptMode("replace")`, notifies confirmation
  - `/caduceus:prompt invalid` — shows usage hint, no write
  - `/caduceus:persona list` — calls `listPersonas`, shows
    names (mocked)
  - `/caduceus:persona concise` — calls `switchPersona("concise")`,
    notifies confirmation
  - `/caduceus:persona nonexistent` — calls `switchPersona("xxx")`,
    shows error from `CaduceusPersonaNotFoundError`
  - `/caduceus:lint` (pass) — calls `lintActivePersona`, notifies
    "persona OK"
  - `/caduceus:lint` (fail) — calls `lintActivePersona` returning
    a failed result, notifies with issue list
  <!-- sdd-owner: implementation -->

**Files:**
- `lib/slash-commands.ts` (modified, +100 lines)
- `tests/slash-commands.test.ts` (modified, +80 lines)

**Spec refs:** §4.5 of design.

**Verification:** all slash-commands tests pass.

**Rollback:** `git restore lib/slash-commands.ts tests/slash-commands.test.ts`.

### T-7 — extension entry wiring

- [ ] Add closure variables `cwd: string | null`, `loadedPersona:
  LoadedPersona | null`, `systemPromptMode: SystemPromptMode =
  "append"` to `extensions/caduceus.ts`. Set `cwd` and
  `loadedPersona` in the `session_start` handler. Update
  `before_agent_start` to use `composeSystemPrompt` with the
  configured mode. Update `registerSlashCommands` deps with
  the 5 new functions.
  <!-- sdd-owner: implementation -->
- [ ] Add 1 case to `tests/extension-entry.test.ts`:
  `before_agent_start` with `systemPromptMode: "replace"` returns
  `systemPrompt` equal to the persona only (no `event.systemPrompt`
  prefix).
  <!-- sdd-owner: implementation -->

**Files:**
- `extensions/caduceus.ts` (modified, +40 lines)
- `tests/extension-entry.test.ts` (modified, +25 lines)

**Spec refs:** §4.6 of design.

**Verification:** all extension-entry tests pass; all previous
tests pass; manual smoke test: `pi -e ./extensions/caduceus.ts`
runs all 7 slash commands successfully.

**Rollback:** `git restore extensions/caduceus.ts tests/extension-entry.test.ts`.

### T-8 — new prompt files (concise + reviewer)

- [ ] Create `prompts/concise.md` per `design.md §4.7`. Include
  the 4 structural blocks (identity, persona, language clause
  placeholder, harness principles), with the concise persona
  text. Must be lint-clean (no voseo, has `${mode}` placeholder,
  has identity/persona/principles blocks, no timestamps).
  <!-- sdd-owner: implementation -->
- [ ] Create `prompts/reviewer.md` analogously, with the
  reviewer persona text.
  <!-- sdd-owner: implementation -->
- [ ] Run `node --experimental-strip-types --test tests/lint.test.ts`
  with the new prompts as fixtures; both should pass.
  <!-- sdd-owner: implementation -->

**Files:**
- `prompts/concise.md` (new, ~50 lines)
- `prompts/reviewer.md` (new, ~60 lines)

**Spec refs:** §4.7 of design.

**Verification:** lint tests pass for both new files.

**Rollback:** `git restore prompts/concise.md prompts/reviewer.md`.

### T-9 — full verify (test + integrity + smoke)

- [ ] Run `node --experimental-strip-types --test tests/*.test.ts`;
  confirm ≥80 tests pass with 0 failures.
  <!-- sdd-owner: implementation -->
- [ ] Run `node scripts/verify-package.mjs`; confirm 13/13
  pre-publish checks pass.
  <!-- sdd-owner: implementation -->
- [ ] Run `npm pack --dry-run`; confirm tarball is <30 kB
  compressed and has 0 native binaries.
  <!-- sdd-owner: implementation -->
- [ ] Manual smoke test in a fresh terminal: `pi -e
  ./extensions/caduceus.ts`. Run each of the 7 slash commands
  in sequence (`/caduceus:status`, `/caduceus:mode gentleman`,
  `/caduceus:locale es-AR`, `/caduceus:prompt replace`,
  `/caduceus:persona list`, `/caduceus:persona concise`,
  `/caduceus:lint`, `/caduceus:inspect`). Each should succeed
  with no errors.
  <!-- sdd-owner: implementation -->

**Verification:** all checks green.

**Rollback:** N/A (verify only).

### T-10 — version bump and CHANGELOG

- [ ] Bump `package.json` version from `0.1.0` to `0.1.1`.
  <!-- sdd-owner: implementation -->
- [ ] Create `CHANGELOG.md` with the v0.1.1 entry (replace /
  append mode, persona filesystem discovery, /caduceus:lint,
  2 new personas). <!-- sdd-owner: implementation -->
- [ ] Update `README.md` Quick Start to mention the new
  commands and the new personas. Add a "v0.1.1" section if
  not already present. <!-- sdd-owner: implementation -->
- [ ] Commit all v0.1.1 changes as a single feature commit.
  <!-- sdd-owner: implementation -->

**Files:** `package.json` (modified), `CHANGELOG.md` (new),
`README.md` (modified).

**Verification:** commit log shows one v0.1.1 commit with all
files.

## Deferred parent actions (out of band)

- [ ] D-1: User runs `npm publish --access=public` (or I do it
  with proxy + bypass-2FA token, per the v0.1.0 publish
  flow). <!-- sdd-owner: parent -->
- [ ] D-2: User posts a "Show and tell" on
  `https://github.com/earendil-works/pi/discussions`.
  <!-- sdd-owner: parent -->
- [ ] D-3: User writes a blog post on Medium / dev.to
  ("Persona is a contract, not a costume"). <!-- sdd-owner: parent -->

## Next phase

`sdd-apply` — execute T-1 through T-10 in dependency order. The
apply agent records evidence in `apply-progress.md` after each
task (diffs, test output, lint output, smoke test results).

Before `sdd-apply` starts, the parent orchestrator confirms:
- The `single-pr-default` delivery strategy is acceptable
  (no user action needed — design already justified).
- The T-7 smoke test (4 manual commands in a TUI) is acceptable
  as a non-automated step.
