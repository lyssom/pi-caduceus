# caduceus v0.2.0 — Implementation Tasks

> **Status:** Tasks complete. Awaiting `apply` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.2.0`
> **Source contracts:** [`proposal.md`](./proposal.md), [`design.md`](./design.md)
> **Strict TDD:** enabled
> **Review budget:** 400 changed lines
> **Estimated total:** ~500 lines (over budget; size-exception justified)

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 500 (range 420–580) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes (per rule) |
| Suggested split | PR1 (T-1..T-4: personas + lint fixtures, ~300 lines), PR2 (T-5..T-8: wizard + diff + publish, ~250 lines) |
| Chain strategy | size-exception (greenfield v0.2.0, single PR acceptable if user confirms) |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High
```

**Rationale for size-exception (or chained PR):** v0.2.0 is
purely additive. 6 new personas are small files (~50 lines
each). The wizard and diff are both contained in their own
modules. A single PR keeps the change atomic and is the
simplest path to a coherent v0.2.0 release. If the user
prefers, the work splits naturally into two PRs at the T-4
boundary (after personas are committed, before wizard/diff
work begins).

The user will pick: A (single PR, size-exception) or B (two
chained PRs) before `sdd-apply` starts.

## Task ordering and dependencies

```text
T-1 (6 new personas — RED, lint test)
   │
   ▼
T-2 (write 6 new persona files)
   │
   ▼
T-3 (wizard — RED test for generatePersonaContent)
   │
   ▼
T-4 (wizard core — generatePersonaContent, validateStep, personaFilePath)
   │
   ▼
T-5 (wizard — writeAndLint + slash command wiring)
   │
   ▼
T-6 (diff — RED test for personaDiff)
   │
   ▼
T-7 (diff core + slash command wiring)
   │
   ▼
T-8 (full verify + version bump + CHANGELOG + publish)
```

## Implementation tasks

### T-1 — 6 new persona files (RED: lint test for each)

- [ ] Add 6 lint tests to `tests/lint.test.ts` (one per new
  persona): each new built-in persona must pass the same
  R-LINT-1x checks as the existing 4. Use
  `readBuiltInPrompt("teacher")`, `readBuiltInPrompt("security")`,
  etc. Run and confirm all 6 fail (the files don't exist yet).
  <!-- sdd-owner: implementation -->

**Files:** `tests/lint.test.ts` (extended, +50 lines)

**Verification:** `node --experimental-strip-types --test tests/lint.test.ts`
reports 6 new "not ok" results with module-not-found or
file-not-found errors.

**Rollback:** `git restore tests/lint.test.ts`.

### T-2 — write 6 new persona files

- [ ] Create `prompts/teacher.md` per design §4.1. Must be
  lint-clean (4 structural blocks, no voseo/do-not-voseo, has
  `${mode}` placeholder, no timestamps, no UUIDs).
  <!-- sdd-owner: implementation -->
- [ ] Create `prompts/security.md` analogously.
  <!-- sdd-owner: implementation -->
- [ ] Create `prompts/debugger.md` analogously.
  <!-- sdd-owner: implementation -->
- [ ] Create `prompts/socratic.md` analogously.
  <!-- sdd-owner: implementation -->
- [ ] Create `prompts/architect.md` analogously.
  <!-- sdd-owner: implementation -->
- [ ] Create `prompts/pirate.md` analogously.
  <!-- sdd-owner: implementation -->
- [ ] Update `lib/persona-loader.ts` BUILT_IN_PERSONAS set
  to include the 6 new names. Run T-1 lint test, confirm
  all 6 pass.
  <!-- sdd-owner: implementation -->

**Files:**
- `prompts/{teacher,security,debugger,socratic,architect,pirate}.md` (6 new, ~50 lines each)
- `lib/persona-loader.ts` (modified, +6 lines)
- `tests/lint.test.ts` (no further change; tests now pass)

**Spec refs:** design §4.

**Verification:** all 10 built-in personas pass lint; full
suite 116/116 (or higher, since no test count changes here).

**Rollback:** `git restore prompts/ lib/persona-loader.ts`.

### T-3 — wizard test (RED)

- [ ] Write `tests/wizard.test.ts` with cases for:
  - `generatePersonaContent({ name, description, style })`
    produces a string with the 4 required blocks (Identity,
    Persona with the user's description, Harness principles,
    mode placeholder)
  - Each style hint produces the expected additional guidance
    in the Persona block
  - `validateStep` accepts/rejects valid/invalid inputs for
    each step type
  - `personaFilePath` returns the right path for global vs
    project scope
  - All these imports from `../lib/wizard.ts` (which doesn't
    exist yet). Run and confirm all fail.
  <!-- sdd-owner: implementation -->

**Files:** `tests/wizard.test.ts` (new, ~150 lines)

**Verification:** test runner reports module-not-found for
`lib/wizard.ts`.

**Rollback:** `git restore tests/wizard.test.ts`.

### T-4 — wizard core (GREEN)

- [ ] Create `lib/wizard.ts` with:
  - `generatePersonaContent(input)` — pure, returns the 4-block
    markdown with `${mode}` placeholder
  - `validateStep(step, userInput)` — pure, returns
    `{ ok, value?, error? }`
  - `personaFilePath(name, scope, cwd, home?)` — pure, returns
    the absolute path
  - `WIZARD_STEPS` const array enumerating the 4 steps
  - `WizardStep`, `WizardInput`, `WizardOutput` types
  - Run T-3 test, confirm all pass.
  <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** add 4 more test cases for edge
  conditions:
  - Description that's just whitespace → lint will fail
    (lints, returns lint issues)
  - Style is invalid → `validateStep` rejects
  - Name contains path separator → `personaFilePath` rejects
  - Name already exists (built-in or user) → wizard reports
    conflict
  <!-- sdd-owner: implementation -->

**Files:**
- `lib/wizard.ts` (new, ~120 lines)
- `tests/wizard.test.ts` (extended, +30 lines)

**Verification:** all wizard tests pass.

**Rollback:** `git restore lib/wizard.ts tests/wizard.test.ts`.

### T-5 — wizard slash command + writeAndLint

- [ ] Add `writeAndLint(path, content)` to `lib/wizard.ts`.
  Side-effecting: writes the file, runs `lintPersonaContent`
  on the content, returns `{ ok, issues }`. Run a 4-step
  integration test (all in one test file) that simulates
  the full wizard flow.
  <!-- sdd-owner: implementation -->
- [ ] Add `/caduceus:create <step> <input>` slash command to
  `lib/slash-commands.ts`. The handler:
  - Parses the step (name | description | style | scope |
    confirm)
  - Validates the input via `validateStep`
  - For "confirm" step with value "yes", calls
    `switchPersona(name)` (re-uses the existing dep)
  - For non-confirm steps, prompts the next step via
    `ctx.ui.notify`
  - After the final step (scope), generates the file via
    `generatePersonaContent`, calls `writeAndLint`, and
    shows the lint result
  <!-- sdd-owner: implementation -->
- [ ] Add tests to `tests/slash-commands.test.ts` for the new
  command: invalid step, invalid input, full flow (4 steps
  + confirm).
  <!-- sdd-owner: implementation -->

**Files:**
- `lib/wizard.ts` (extended, +30 lines)
- `lib/slash-commands.ts` (modified, +50 lines)
- `tests/slash-commands.test.ts` (modified, +50 lines)

**Verification:** all slash-commands tests pass; the full
wizard flow produces a valid file at the expected path.

**Rollback:** `git restore lib/wizard.ts lib/slash-commands.ts tests/slash-commands.test.ts`.

### T-6 — diff test (RED)

- [ ] Write `tests/diff.test.ts` with cases for:
  - `personaDiff` with same persona name returns empty diff
  - `personaDiff` with two different personas returns a
    unified diff with the expected file headers
  - `personaDiff` output is byte-stable across two
    invocations with the same inputs
  - `personaDiff` with a missing persona throws
    `CaduceusPersonaNotFoundError`
  - All these imports from `../lib/diff.ts` (which doesn't
    exist yet). Run and confirm all fail.
  <!-- sdd-owner: implementation -->

**Files:** `tests/diff.test.ts` (new, ~80 lines)

**Verification:** test runner reports module-not-found for
`lib/diff.ts`.

**Rollback:** `git restore tests/diff.test.ts`.

### T-7 — diff core + slash command

- [ ] Create `lib/diff.ts` with:
  - `personaDiff(input)` — pure, returns `{ ok, diff,
    leftName, rightName }`
  - `computeUnifiedDiff(left, right, leftName, rightName)` —
    pure, returns the unified diff string. Hand-rolled
    Myers diff (~50 lines)
  - `DiffInput`, `DiffOutput` types
  - Run T-6 test, confirm all pass.
  <!-- sdd-owner: implementation -->
- [ ] Add `/caduceus:diff [a [b]]` slash command to
  `lib/slash-commands.ts`. The handler:
  - Parses 0/1/2 args
  - 0 args: diff active persona vs `gentleman`
  - 1 arg: diff `<arg>` vs active persona
  - 2 args: diff `<a>` vs `<b>`
  - Calls `personaDiff`, notifies the result
  - Catches `CaduceusPersonaNotFoundError` and shows a
    friendly message
  - Add `personaDiff` to `CommandDeps` (and a default impl
    in the extension entry that closes over `cwd`)
  <!-- sdd-owner: implementation -->
- [ ] Add tests to `tests/slash-commands.test.ts` for the
  new command: 0/1/2 args, missing persona.
  <!-- sdd-owner: implementation -->
- [ ] Update `tests/extension-entry.test.ts` to expect 9
  commands (was 7). Add 1 case verifying that
  `/caduceus:diff` invokes `personaDiff` correctly.
  <!-- sdd-owner: implementation -->

**Files:**
- `lib/diff.ts` (new, ~80 lines)
- `lib/slash-commands.ts` (modified, +40 lines)
- `extensions/caduceus.ts` (modified, +20 lines)
- `tests/diff.test.ts` (extended, +20 lines)
- `tests/slash-commands.test.ts` (modified, +30 lines)
- `tests/extension-entry.test.ts` (modified, +10 lines)

**Verification:** all tests pass; manual smoke test confirms
the diff command produces useful output.

**Rollback:** `git restore lib/diff.ts lib/slash-commands.ts extensions/caduceus.ts tests/`.

### T-8 — full verify + version + CHANGELOG + publish

- [ ] Run `node --experimental-strip-types --test
  tests/*.test.ts`; confirm ≥150 tests pass with 0
  failures.
  <!-- sdd-owner: implementation -->
- [ ] Update `scripts/verify-package.mjs` to expect 11 test
  files (was 9). Run it; confirm 14/14 checks pass.
  <!-- sdd-owner: implementation -->
- [ ] Run `npm pack --dry-run`; confirm tarball is <40 kB
  and has 0 native binaries.
  <!-- sdd-owner: implementation -->
- [ ] Bump `package.json` version from `0.1.1` to `0.2.0`.
  <!-- sdd-owner: implementation -->
- [ ] Update `CHANGELOG.md` with the v0.2.0 entry (6 new
  personas, /caduceus:create, /caduceus:diff).
  <!-- sdd-owner: implementation -->
- [ ] Update `README.md` to mention the 6 new personas and
  the 2 new commands.
  <!-- sdd-owner: implementation -->
- [ ] Commit all v0.2.0 changes.
  <!-- sdd-owner: implementation -->

**Files:** `package.json`, `CHANGELOG.md`, `README.md`,
`scripts/verify-package.mjs`.

**Verification:** all green.

**Rollback:** N/A (verify only).

## Deferred parent actions (out of band)

- [ ] D-1: User (or parent orchestrator with proxy) runs
  `git push origin main` to push v0.2.0 to GitHub.
  <!-- sdd-owner: parent -->
- [ ] D-2: User (or parent orchestrator with bypass-2FA
  token) runs `npm publish --access=public` to publish
  v0.2.0 to npm.
  <!-- sdd-owner: parent -->
- [ ] D-3: User updates the forum post (D-1 in
  v0.1.1's marketing plan) to mention v0.2.0.
  <!-- sdd-owner: parent -->

## Next phase

`sdd-apply` — execute T-1 through T-8 in dependency order.

Before `sdd-apply` starts, the parent orchestrator must
resolve the **delivery strategy decision** above (single PR
vs two chained PRs) with the user.
