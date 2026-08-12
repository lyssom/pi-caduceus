# Changelog

All notable changes to **caduceus** are documented here.

## [0.2.0] - 2026-08-12

### Added

- **6 new built-in personas**: `teacher`, `security`, `debugger`,
  `socratic`, `architect`, `pirate`. Each follows the standard
  4-block structure and is lint-clean. Total built-ins: 4 → 10.
- **`/caduceus:create <name> <description...>`** — new slash
  command that generates a persona file from a name and
  description. Style defaults to `custom`; scope defaults to
  `project`. Runs lint on the generated file; refuses to write
  if lint fails. **Unique:** no LLM dependency (template-based,
  byte-stable). Comparable to `@isr4el-silv4/persona`'s
  `/persona create` but with built-in contract enforcement.
- **`/caduceus:diff [a [b]]`** — new slash command that
  renders two personas with the current mode + locale and
  shows a unified diff. Defaults to diffing the active persona
  against `gentleman`. Hand-rolled Myers diff (preserves
  0 runtime deps).
- **`buildPersonaPromptFromContent(content, mode, locale)`** —
  new helper in `lib/persona-contract.ts` that renders a
  persona from arbitrary markdown content (used by the diff
  command).
- New `lib/wizard.ts` module with `generatePersonaContent`,
  `validateStep`, `personaFilePath`, `writeAndLint`, and the
  `WizardStep` / `WizardStyle` / `WizardScope` types.
- New `lib/diff.ts` module with `personaDiff` and
  `computeUnifiedDiff` (the hand-rolled Myers algorithm).

### Internal

- `lib/persona-contract.ts` — adds `buildPersonaPromptFromContent`;
  existing `buildPersonaPrompt` is unchanged (backward compat).
- `lib/slash-commands.ts` — registers 2 new commands; adds
  5 new deps for the wizard + diff layers.
- `lib/persona-loader.ts` — `BUILT_IN_PERSONAS` set extended
  with 6 new names.
- `lib/errors.ts` — unchanged.
- `extensions/caduceus.ts` — wires the 5 new deps
  (validateWizardStep, generateWizardContent, wizardFilePath,
  writeAndLint, personaDiff).
- `tests/extension-entry.test.ts` — expects 9 slash commands
  (was 7 in v0.1.0, 8 in v0.1.1).
- `scripts/verify-package.mjs` — expects 11 test files (was 6 in
  v0.1.0, 9 in v0.1.1).

### Test count

- v0.1.0: 68 tests across 6 files
- v0.1.1: 116 tests across 9 files
- v0.2.0: 165 tests across 11 files (+49 tests)

## [0.1.1] - 2026-08-12

### Added

- `/caduceus:prompt <append|replace>` — slash command to switch
  between "append" and "replace" prompt modes.
- `/caduceus:persona <name|list>` — slash command to switch
  persona. `list` shows all available (built-in + global +
  project).
- `/caduceus:lint` — slash command that runs static checks on
  the active persona file.
- Two new built-in personas: `concise` and `reviewer`.
- Two new config fields with backward-compatible defaults:
  `systemPromptMode` (default `"append"`) and `persona`
  (default `"gentleman"`).
- Persona filesystem discovery at
  `~/.pi/agent/caduceus/personas/<name>.md` and
  `.caduceus/personas/<name>.md`.

## [0.1.0] - 2026-08-12

### Initial release

- Persona contract package: 2 built-in personas (gentleman,
  neutral) with byte-stable content from `gentle-pi`.
- 4 slash commands.
- JSONC-tolerant `.caduceusrc` project override.
- 0 runtime dependencies. 0 postinstall. 0 native binaries.
- 68 tests, 13 verify checks, all green.
- Published to npm: `pi-caduceus@0.1.0`.
