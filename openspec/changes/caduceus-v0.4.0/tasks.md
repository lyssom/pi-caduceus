# caduceus v0.4.0 — Implementation Tasks

> **Status:** Tasks complete. Awaiting `apply` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.4.0`
> **Source contracts:** [`proposal.md`](./proposal.md), [`design.md`](./design.md)
> **Strict TDD:** enabled
> **Review budget:** 400 changed lines
> **Estimated total:** 500 lines (over budget; size-exception proposed)

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 500 (range 420–580) |
| 400-line budget risk | High |
| Chained PRs recommended | No (single PR, size-exception) |
| Suggested split | Single PR (additive features, single commit) |
| Chain strategy | size-exception |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High
```

## Task ordering and dependencies

```text
T-1 (macros: RED test)
   │
   ▼
T-2 (macros: GREEN + lint update)
   │
   ▼
T-3 (profile-store: RED test)
   │
   ▼
T-4 (profile-store: GREEN)
   │
   ▼
T-5 (slash commands: profile + macro integration)
   │
   ▼
T-6 (extension entry wiring)
   │
   ▼
T-7 (full verify + docs)
   │
   ▼
T-8 (version bump + publish)
```

## Implementation tasks

### T-1 — macros test (RED)

- [ ] Write `tests/macros.test.ts` with:
  - `resolveMacros` replaces each macro with the value
  - `resolveMacros` leaves non-macro text unchanged
  - `buildMacroContext` extracts user / projectName / cwd from process
  - `SUPPORTED_MACROS` contains the expected keys
  - Multi-line content with macros works
  - Run and confirm all fail with module-not-found.
  <!-- sdd-owner: implementation -->

**Files:** `tests/macros.test.ts` (new, ~80 lines)

**Verification:** test runner reports module-not-found for `lib/macros.ts`.

**Rollback:** `git restore tests/macros.test.ts`.

### T-2 — macros implementation (GREEN) + lint update

- [ ] Create `lib/macros.ts` with `buildMacroContext`, `resolveMacros`,
  and `SUPPORTED_MACROS`. Run T-1 test, confirm all pass.
  <!-- sdd-owner: implementation -->
- [ ] Update `lib/lint.ts`:
  - Rename `hasModePlaceholder` to `checkPlaceholders`
  - Rename the check ID from `MODE_PLACEHOLDER` to `PLACEHOLDER`
  - Add unknown-macro warning (severity: warning)
  - Update the `LintCheckId` type
  - Update `ALL_CHECKS`
  <!-- sdd-owner: implementation -->
- [ ] Update `tests/lint.test.ts`: rename `MODE_PLACEHOLDER` test to
  `PLACEHOLDER`. Add 1 test for unknown macro warning.
  <!-- sdd-owner: implementation -->
- [ ] Add 1 macro reference to `prompts/default.md` for demonstration:
  change one bullet to include `${projectName}`.
  <!-- sdd-owner: implementation -->

**Files:** `lib/macros.ts` (new), `lib/lint.ts` (modified),
`tests/lint.test.ts` (modified), `prompts/default.md` (modified).

**Verification:** all lint tests pass; macros tests pass.

**Rollback:** `git restore lib/macros.ts lib/lint.ts tests/lint.test.ts prompts/default.md`.

### T-3 — profile-store test (RED)

- [ ] Write `tests/profile-store.test.ts` with:
  - `listProfiles` returns global + project names, project shadows global
  - `loadProfile` returns the profile contents
  - `loadProfile` throws `CaduceusProfileNotFoundError` for missing
  - `saveProfile` writes the file (with mkdir -p)
  - `deleteProfile` removes the file
  - `profileFilePath` returns the correct path
  - Run and confirm all fail with module-not-found.
  <!-- sdd-owner: implementation -->

**Files:** `tests/profile-store.test.ts` (new, ~120 lines)

**Verification:** test runner reports module-not-found for `lib/profile-store.ts`.

**Rollback:** `git restore tests/profile-store.test.ts`.

### T-4 — profile-store implementation (GREEN)

- [ ] Create `lib/profile-store.ts` with `listProfiles`, `loadProfile`,
  `saveProfile`, `deleteProfile`, `profileFilePath`, types, and
  `DEFAULT_PROFILE`. Run T-3 test, confirm all pass.
  <!-- sdd-owner: implementation -->
- [ ] Add `CaduceusProfileNotFoundError` and `CaduceusProfileError`
  to `lib/errors.ts`.
  <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** add 2 more test cases for malformed profile
  JSON (invalid JSON throws `CaduceusProfileError` with a parse
  message; missing required field throws with a clear error).
  <!-- sdd-owner: implementation -->

**Files:** `lib/profile-store.ts` (new), `lib/errors.ts` (modified),
`tests/profile-store.test.ts` (extended).

**Verification:** all profile-store tests pass.

**Rollback:** `git restore lib/profile-store.ts lib/errors.ts tests/profile-store.test.ts`.

### T-5 — slash commands (profile + macro integration)

- [ ] Add `/caduceus:profile list|save|load|delete|show` to
  `lib/slash-commands.ts`. The handler parses the first argument
  as the subcommand and the rest as the name (if any).
  <!-- sdd-owner: implementation -->
- [ ] Add 4 new deps to `CommandDeps`:
  `listProfiles`, `loadProfile`, `saveProfile`, `deleteProfile`.
  <!-- sdd-owner: implementation -->
- [ ] Update the `renderInspectOutput` flow to resolve macros
  before display. The mock for `renderInspectOutput` in tests
  should reflect this.
  <!-- sdd-owner: implementation -->
- [ ] Add 5 tests to `tests/slash-commands.test.ts`:
  - `/caduceus:profile list` shows available profiles
  - `/caduceus:profile save work` calls saveProfile
  - `/caduceus:profile load work` calls loadProfile + writes config
  - `/caduceus:profile delete work` calls deleteProfile
  - `/caduceus:profile show <name>` shows the profile contents
  <!-- sdd-owner: implementation -->
- [ ] Add 1 test for the `/caduceus:inspect` macro resolution
  (the rendered prompt should contain the resolved userName,
  not the literal `${userName}`).
  <!-- sdd-owner: implementation -->

**Files:** `lib/slash-commands.ts` (modified), `tests/slash-commands.test.ts` (modified).

**Verification:** all slash-commands tests pass.

**Rollback:** `git restore lib/slash-commands.ts tests/slash-commands.test.ts`.

### T-6 — extension entry wiring

- [ ] Update `extensions/caduceus.ts`:
  - Add macro resolution in `before_agent_start` (use `resolveMacros`)
  - Wire the 4 new profile deps in `registerSlashCommands` deps
  - Add 1 new closure variable `currentProfile` for tracking
  <!-- sdd-owner: implementation -->
- [ ] Update `tests/extension-entry.test.ts`:
  - Add 1 test verifying `before_agent_start` resolves macros
  - Add 1 test verifying the 14 commands are registered
  - Update the command count assertion (was 9, now 14)
  <!-- sdd-owner: implementation -->

**Files:** `extensions/caduceus.ts` (modified), `tests/extension-entry.test.ts` (modified).

**Verification:** all extension-entry tests pass.

**Rollback:** `git restore extensions/caduceus.ts tests/extension-entry.test.ts`.

### T-7 — full verify + docs

- [ ] Run `node --experimental-strip-types --test tests/*.test.ts`;
  confirm ≥180 tests pass.
  <!-- sdd-owner: implementation -->
- [ ] Update `scripts/verify-package.mjs` to expect 13 test files.
  Confirm 14/14 pre-publish checks pass.
  <!-- sdd-owner: implementation -->
- [ ] Update `README.md`:
  - Add a "Profiles" section explaining save / load / list / delete
  - Add a "Persona macros" section listing the 5 supported macros
  - Update the "Slash Commands" table with the 5 new /caduceus:profile commands
  - Update the "Built-in Personas" table (no changes; just confirm count)
  <!-- sdd-owner: implementation -->
- [ ] Update `CHANGELOG.md` with the v0.4.0 entry documenting
  profiles + macros + 1 macro added to default persona.
  <!-- sdd-owner: implementation -->
- [ ] Run `npm pack --dry-run`; confirm tarball is <50 kB.
  <!-- sdd-owner: implementation -->

**Files:** `README.md`, `CHANGELOG.md`, `scripts/verify-package.mjs`.

**Verification:** all green.

**Rollback:** `git restore README.md CHANGELOG.md scripts/verify-package.mjs`.

### T-8 — version bump + publish

- [ ] Bump `package.json` from `0.3.1` to `0.4.0`.
  <!-- sdd-owner: implementation -->
- [ ] Commit all v0.4.0 changes.
  <!-- sdd-owner: implementation -->
- [ ] Push to GitHub (deferred parent action).
  <!-- sdd-owner: parent -->
- [ ] Publish to npm (deferred parent action).
  <!-- sdd-owner: parent -->

**Files:** `package.json`, the commit log.

**Verification:** v0.4.0 is live on npm + GitHub + pi.dev gallery.

## Deferred parent actions (out of band)

- [ ] D-1: Push to GitHub (`git push -u origin main`).
  <!-- sdd-owner: parent -->
- [ ] D-2: Publish to npm (`npm publish --access=public`).
  <!-- sdd-owner: parent -->
- [ ] D-3: Optional short note on the v0.3.1 forum post about v0.4.0.
  <!-- sdd-owner: parent -->

## Next phase

`sdd-apply` — execute T-1 through T-8 in dependency order.
