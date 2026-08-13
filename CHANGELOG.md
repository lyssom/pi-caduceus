# Changelog

All notable changes to **caduceus** are documented here.

## [0.3.1] - 2026-08-12

### Fixed

- **`/caduceus:mode` and `/caduceus:persona` accept old names** with a
  one-time deprecation warning. Previously, typing
  `/caduceus:mode gentleman` was rejected with a usage hint. Now it
  emits `caduceus: mode "gentleman" is deprecated; using "default"
  instead.` and proceeds with the new name. Same for `neutral` →
  `plain` (mode) and `gentleman` → `default` / `neutral` → `plain`
  (persona).
- **Stale docstring** in `lib/persona-contract.ts`: removed the
  `// auto maps to "gentleman"` reference (v0.3.0 maps auto to
  `default`).

### Test count

- v0.3.0: 152 tests
- v0.3.1: 156 tests (+4 deprecation tests)

## [0.3.0] - 2026-08-12 — Brand Independence (BREAKING)

### Migration

If you have a v0.2.0 `~/.pi/agent/caduceus.json` with the old mode
or persona names, **no action is required**. The names are
auto-migrated on read with a one-time `console.warn`:

| v0.2.0 name | v0.3.0 name | Notes |
|---|---|---|
| `mode: "gentleman"` | `mode: "default"` | `console.warn` on first read |
| `mode: "neutral"` | `mode: "plain"` | `console.warn` on first read |
| `persona: "gentleman"` | `persona: "default"` | `console.warn` on first read |
| `persona: "neutral"` | `persona: "plain"` | `console.warn` on first read |

After you save the config once (e.g. by running `/caduceus:mode
plain`), the file is v0.3.0-clean.

The slash commands `/caduceus:mode` and `/caduceus:persona` also
accept the old names as input (with a UI deprecation warning) for
one release. After v0.4.0, only the new names are accepted.

### Changed

- **Mode names renamed**: `gentleman` → `default`, `neutral` →
  `plain`. `auto` unchanged. Affects slash command args,
  config fields, and the `PersonaMode` type.
- **Persona names renamed**: `gentleman` → `default`, `neutral`
  → `plain`. Affects slash command args, config fields, and
  built-in persona files.
- **Built-in persona files** rewritten: `prompts/default.md`
  (replaces `gentleman.md`) and `prompts/plain.md` (replaces
  `neutral.md`). All 10 prompt files have a new identity
  contract block: `## caduceus Identity Contract` (replaces
  `## el Gentleman Identity and Harness`).
- **All 8 other personas** (concise, reviewer, teacher, security,
  debugger, socratic, architect, pirate) had their identity
  contract block and harness principles rewritten as
  caduceus-original content. No more "el Gentleman" /
  "voseo" / "Rioplatense" references.
- **No language clause** appended to persona prompts. The
  model is expected to detect the user's input language
  naturally. `lib/locale-detect.ts` is kept (still useful for
  `/caduceus:status` and the wizard).
- **Lint redesigned**: removed the `CROSS_MODE_LEAK_GENTLEMAN`
  and `CROSS_MODE_LEAK_NEUTRAL` checks (they were voseo-based).
  Added a new `CONFLICTING_VOICE_MARKERS` warning (detect
  personas that try to be both "concise" and "verbose" in the
  same block).
- **Config defaults**: `mode: "default"`, `persona: "default"`.
- **`/caduceus:status`**: shows the new mode and persona names.
- **`/caduceus:mode`**: accepts `default | plain | auto`. Old
  names accepted with deprecation warning.
- **`/caduceus:persona`**: lists 10 caduceus-original personas.
  Old names accepted with deprecation warning.
- **`/caduceus:diff`**: defaults to `active vs default` (was
  `active vs gentleman`).
- **`/caduceus:create`**: wizard template uses the new
  caduceus-original identity contract and harness principles.
- **`extensions/caduceus.ts`**: no longer appends a language
  clause in `before_agent_start`. Reads config, applies
  migrations, and resolves the persona.

### Removed

- **`lib/language-clause.ts`** — the voseo / Rioplatense Spanish
  clause function. v0.3.0 has no language clause; the model
  detects the user's language naturally.
- **`tests/language-clause.test.ts`** — corresponding test file.
- **`prompts/gentleman.md`** and **`prompts/neutral.md`** — the
  two built-in personas that shadowed gentle-pi. Replaced with
  `default.md` and `plain.md`.
- **`persona-contract.test.ts` R-PERSONA-007 / R-PERSONA-008** —
  the byte-stable-against-gentle-pi checks. caduceus is no
  longer content-locked to gentle-pi.

### Internal

- `lib/config-store.ts` — new `MODE_MIGRATION` and
  `PERSONA_MIGRATION` maps. `applyMigrations()` helper called
  inside `readConfig`.
- `lib/persona-loader.ts` — `BUILT_IN_PERSONAS` updated to
  `{default, plain, concise, reviewer, teacher, security,
  debugger, socratic, architect, pirate}`.
- `lib/lint.ts` — removed `checkCrossModeLeakGentleman` and
  `checkCrossModeLeakNeutral`. Added
  `checkConflictingVoiceMarkers`.
- `lib/wizard.ts` — `IDENTITY_BLOCK` and `HARNESS_BLOCK` are
  the new caduceus-original text.
- `extensions/caduceus.ts` — variables `cwd`, `loadedPersona`,
  `systemPromptMode` in the closure. Mode resolution uses
  `default` and `plain` (previously `gentleman` and `neutral`).
- `scripts/verify-package.mjs` — added a new grep check that
  fails on any `el Gentleman` or `Rioplatense` in the source
  (excluding `lib/locale-detect.ts` which legitimately uses
  `voseo` as a detection marker).

### Test count

- v0.2.0: 165 tests across 11 files
- v0.3.0: 152 tests across 10 files (−13 tests from removed
  cross-mode checks and language-clause tests)

## [0.2.0] - 2026-08-12

### Added

- 6 new built-in personas: `teacher`, `security`, `debugger`,
  `socratic`, `architect`, `pirate`.
- `/caduceus:create <name> <description>` slash command.
- `/caduceus:diff [a [b]]` slash command.
- `lib/wizard.ts` and `lib/diff.ts` modules.

## [0.1.1] - 2026-08-12

### Added

- `/caduceus:prompt`, `/caduceus:persona`, `/caduceus:lint`.
- 2 new built-in personas: `concise` and `reviewer`.
- Persona filesystem discovery at `~/.pi/agent/caduceus/personas/`.

## [0.1.0] - 2026-08-12

### Initial release

- Persona contract package: 2 built-in personas (gentleman,
  neutral) with byte-stable content from `gentle-pi`.
- 4 slash commands.
- JSONC-tolerant `.caduceusrc` project override.
- 0 runtime dependencies.
