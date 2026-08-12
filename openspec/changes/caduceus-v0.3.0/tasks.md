# caduceus v0.3.0 — Implementation Tasks

> **Status:** Tasks complete. Awaiting `apply` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.3.0`
> **Source contracts:** [`proposal.md`](./proposal.md), [`design.md`](./design.md)
> **Strict TDD:** enabled
> **Review budget:** 400 changed lines
> **Estimated total:** 700 lines (over budget; size-exception required)

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 700 (range 600–850) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes (per rule) |
| Suggested split | PR1 (T-1..T-5: prompts + lint + config, ~400 lines), PR2 (T-6..T-10: slash commands + wizard + diff + verify + publish, ~300 lines) |
| Chain strategy | size-exception (single PR acceptable if user confirms) |

```text
Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High
```

**Rationale:** v0.3.0 is a breaking rebrand; the change is
cohesive and reviewable as one unit. Two chained PRs would
require the user to test a half-rebrand state which is
worse UX. A single PR with `size-exception` is the
recommended path. If the user prefers chained, T-5 is the
natural break (after prompts and lint are in).

The user picks: A (single PR) or B (two chained PRs) before
`sdd-apply` starts.

## Task ordering and dependencies

```text
T-1 (config-store mode rename + migration map)
   │
   ▼
T-2 (lint: drop cross-mode, add conflicting-voice)
   │
   ▼
T-3 (delete language-clause.ts; remove from extension entry)
   │
   ▼
T-4 (create default.md, plain.md; rewrite 8 personas' identity block)
   │
   ▼
T-5 (delete gentleman.md, neutral.md; update persona-loader built-in set)
   │
   ▼
T-6 (slash-commands: new mode names + deprecation warnings)
   │
   ▼
T-7 (wizard: new identity contract in template)
   │
   ▼
T-8 (full verify + grep check for old strings)
   │
   ▼
T-9 (docs: README, CHANGELOG, INIT)
   │
   ▼
T-10 (version bump + CHANGELOG entry + publish)
```

## Implementation tasks

### T-1 — config-store mode rename + migration map

- [ ] Update `lib/config-store.ts`:
  - Change `PersonaMode = "gentleman" | "neutral" | "auto"` → `"default" | "plain" | "auto"`
  - Change `DEFAULT_CONFIG.mode` to `"default"`, `DEFAULT_CONFIG.persona` to `"default"`
  - Add `MODE_MIGRATION` and `PERSONA_MIGRATION` const maps
  - Update `readConfig` to apply migrations with `console.warn`
  <!-- sdd-owner: implementation -->
- [ ] Update `tests/config-store.test.ts`:
  - Add migration test (v0.2.0 config → v0.3.0 config)
  - Update existing tests that construct `CaduceusConfig` with old mode names
  <!-- sdd-owner: implementation -->

**Files:** `lib/config-store.ts`, `tests/config-store.test.ts`

**Verification:** all 17 config-store tests pass.

**Rollback:** `git restore lib/config-store.ts tests/config-store.test.ts`.

### T-2 — lint: drop cross-mode, add conflicting-voice

- [ ] Update `lib/lint.ts`:
  - Remove `checkCrossModeLeakGentleman` and `checkCrossModeLeakNeutral`
  - Add `checkConflictingVoiceMarkers` (WARNING severity)
  - Update `LintCheckId` type
  - Update `ALL_CHECKS` array
  <!-- sdd-owner: implementation -->
- [ ] Update `tests/lint.test.ts`:
  - Drop the 2 cross-mode tests
  - Add 1 test for conflicting-voice (passing case)
  - Add 1 test for conflicting-voice (warning case)
  - All 10 built-in personas must still pass lint
  <!-- sdd-owner: implementation -->

**Files:** `lib/lint.ts`, `tests/lint.test.ts`

**Verification:** all lint tests pass.

**Rollback:** `git restore lib/lint.ts tests/lint.test.ts`.

### T-3 — delete language-clause.ts; remove from extension entry

- [ ] Delete `lib/language-clause.ts`
  <!-- sdd-owner: implementation -->
- [ ] Delete `tests/language-clause.test.ts`
  <!-- sdd-owner: implementation -->
- [ ] Update `extensions/caduceus.ts`:
  - Remove `languageClauseFor` function
  - Remove the import of `languageClause`
  - Update `before_agent_start` to NOT append a language clause
  - Persona = `${renderedContent}` (no language clause suffix)
  <!-- sdd-owner: implementation -->
- [ ] Update `tests/extension-entry.test.ts`:
  - Remove any test that asserts the language clause is in the system prompt
  - Add a test that the new system prompt does NOT contain "voseo" or "Rioplatense"
  <!-- sdd-owner: implementation -->

**Files:** `lib/language-clause.ts` (deleted), `tests/language-clause.test.ts` (deleted), `extensions/caduceus.ts`, `tests/extension-entry.test.ts`

**Verification:** no test imports from `lib/language-clause.ts`; full suite passes.

**Rollback:** `git restore lib/language-clause.ts tests/language-clause.test.ts extensions/caduceus.ts tests/extension-entry.test.ts`.

### T-4 — create default.md, plain.md; rewrite 8 personas' identity block

- [ ] Create `prompts/default.md` per design §3.1
  <!-- sdd-owner: implementation -->
- [ ] Create `prompts/plain.md` per design §3.2
  <!-- sdd-owner: implementation -->
- [ ] Rewrite identity contract block in:
  - `prompts/concise.md`
  - `prompts/reviewer.md`
  - `prompts/teacher.md`
  - `prompts/security.md`
  - `prompts/debugger.md`
  - `prompts/socratic.md`
  - `prompts/architect.md`
  - `prompts/pirate.md`
  (replace the existing block with the new caduceus-original block from design §2)
  <!-- sdd-owner: implementation -->
- [ ] Add a lint test verifying all 10 personas contain the new "caduceus Identity Contract" header
  <!-- sdd-owner: implementation -->

**Files:** 2 new prompt files, 8 modified prompt files, 1 test file

**Verification:** all 10 personas pass the updated lint; all 10 contain the new identity contract.

**Rollback:** `git restore prompts/ tests/`.

### T-5 — delete gentleman.md, neutral.md; update persona-loader built-in set

- [ ] Delete `prompts/gentleman.md`
  <!-- sdd-owner: implementation -->
- [ ] Delete `prompts/neutral.md`
  <!-- sdd-owner: implementation -->
- [ ] Update `lib/persona-loader.ts`:
  - `BUILT_IN_PERSONAS` set: replace "gentleman" and "neutral" with "default" and "plain"
  <!-- sdd-owner: implementation -->
- [ ] Update `tests/persona-loader.test.ts`:
  - Update built-in references
  - Add a test that "gentleman" and "neutral" are NOT in BUILT_IN_PERSONAS
  - Add a test that "default" and "plain" ARE in BUILT_IN_PERSONAS
  <!-- sdd-owner: implementation -->

**Files:** 2 deleted prompt files, `lib/persona-loader.ts`, `tests/persona-loader.test.ts`

**Verification:** all 14 persona-loader tests pass.

**Rollback:** `git restore prompts/ lib/persona-loader.ts tests/persona-loader.test.ts`.

### T-6 — slash-commands: new mode names + deprecation warnings

- [ ] Update `lib/slash-commands.ts`:
  - `/caduceus:status` shows new mode name (no migration warning at the UI level; the warn is at readConfig)
  - `/caduceus:mode` accepts `default | plain | auto`. Old names `gentleman | neutral` are accepted with a deprecation warning (via `ctx.ui.notify`)
  - `/caduceus:persona` accepts all 10 built-in names. Old names `gentleman | neutral` are accepted with a deprecation warning
  <!-- sdd-owner: implementation -->
- [ ] Update `tests/slash-commands.test.ts`:
  - Update all mode/persona test cases to use the new names
  - Add 1 test for old name → deprecation warning → maps to new
  <!-- sdd-owner: implementation -->

**Files:** `lib/slash-commands.ts`, `tests/slash-commands.test.ts`

**Verification:** all 21+ slash-commands tests pass.

**Rollback:** `git restore lib/slash-commands.ts tests/slash-commands.test.ts`.

### T-7 — wizard: new identity contract in template

- [ ] Update `lib/wizard.ts`:
  - The `IDENTITY_BLOCK` const in `generatePersonaContent` is the new caduceus-original block (design §2)
  - The `HARNESS_BLOCK` is the new caduceus-original block (design §3.1)
  <!-- sdd-owner: implementation -->
- [ ] Update `tests/wizard.test.ts`:
  - Update the "R-WIZARD-2: generated content has the 4 required blocks" test to expect the new identity contract marker
  - Add a test that generated content does NOT contain "el Gentleman" or "voseo"
  <!-- sdd-owner: implementation -->

**Files:** `lib/wizard.ts`, `tests/wizard.test.ts`

**Verification:** all 23 wizard tests pass.

**Rollback:** `git restore lib/wizard.ts tests/wizard.test.ts`.

### T-8 — full verify + grep check for old strings

- [ ] Update `scripts/verify-package.mjs`:
  - Add a new check: `noLegacyBranding` — greps all source files for the strings "el Gentleman", "voseo", "Rioplatense" (case-insensitive). Fails if found in:
    - `lib/`
    - `extensions/`
    - `prompts/` (except `CHANGELOG.md` and `openspec/changes/caduceus-v0.3.0/` which are historical)
    - `README.md`
    - `package.json` (description)
  - The check excludes `CHANGELOG.md` (historical record) and `openspec/changes/caduceus-v0.3.0/` (the migration map and design history)
  - Also update the test count expectation (11 test files → still 11 since we deleted 1 but added 1, but we may have actually deleted the language-clause test file, so it might be 10)
  <!-- sdd-owner: implementation -->
- [ ] Run `node scripts/verify-package.mjs`; confirm 14/14 checks pass
  <!-- sdd-owner: implementation -->

**Files:** `scripts/verify-package.mjs`

**Verification:** grep check finds no "el Gentleman" / "voseo" / "Rioplatense" in current source.

**Rollback:** `git restore scripts/verify-package.mjs`.

### T-9 — docs: README, CHANGELOG, INIT

- [ ] Update `README.md`:
  - Remove all "el Gentleman", "voseo", "Rioplatense" references
  - Update the "Built-in Personas" table to use the new 10 names (replace gentleman, neutral with default, plain)
  - Update Quick Start commands to use `/caduceus:mode default` instead of `/caduceus:mode gentleman`
  - Update the intro paragraph
  <!-- sdd-owner: implementation -->
- [ ] Update `CHANGELOG.md`:
  - Add v0.3.0 entry with "Migration" subsection explaining old → new name mapping
  <!-- sdd-owner: implementation -->
- [ ] Update `INIT.md`:
  - Rewrite §2 (Naming Rationale) — remove "el Gentleman" metaphor references in the shell/meat table
  - Rewrite §4 (DNA-2 — Persona is a Contract) — remove "el Gentleman" example
  - Other sections may keep historical references (they were written before this rebrand decision)
  <!-- sdd-owner: implementation -->

**Files:** `README.md`, `CHANGELOG.md`, `INIT.md`

**Verification:** grep check from T-8 also covers these files.

**Rollback:** `git restore README.md CHANGELOG.md INIT.md`.

### T-10 — version bump + CHANGELOG entry + publish

- [ ] Bump `package.json` from `0.2.0` to `0.3.0`
  <!-- sdd-owner: implementation -->
- [ ] Run the full test suite; confirm ≥170 tests pass
  <!-- sdd-owner: implementation -->
- [ ] Run `npm pack --dry-run`; confirm tarball is <50 kB
  <!-- sdd-owner: implementation -->
- [ ] Commit all v0.3.0 changes as a single feature commit (or two chained commits per user choice)
  <!-- sdd-owner: implementation -->
- [ ] Push to GitHub and publish to npm (deferred parent actions, automated by parent orchestrator)
  <!-- sdd-owner: parent -->

**Files:** `package.json`, the commit log

**Verification:** all green.

## Deferred parent actions (out of band)

- [ ] D-1: Push to GitHub (`git push -u origin main`)
  <!-- sdd-owner: parent -->
- [ ] D-2: Publish to npm (`npm publish --access=public`)
  <!-- sdd-owner: parent -->
- [ ] D-3: Update the forum post (rewrite the v0.1.1 post to drop gentleman references and link to v0.3.0)
  <!-- sdd-owner: parent -->

## Next phase

`sdd-apply` — execute T-1 through T-10 in dependency order.

Before `sdd-apply` starts, the parent orchestrator must
resolve the **delivery strategy decision** above (single PR
vs two chained PRs) with the user.
