# Changelog

All notable changes to **caduceus** are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/), and this
project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-08-12

### Added

- **`/caduceus:prompt <append|replace>`** — new slash command to
  switch between "append" (default, preserves pi's base system
  prompt and appends the persona segment) and "replace" (the persona
  segment becomes the entire system prompt). Reaches feature parity
  with `@isr4el-silv4/persona` and `pi-custom-system-prompt`.
- **`/caduceus:persona <name|list>`** — new slash command to switch
  the active persona. `list` shows all available (built-in + global +
  project). User personas are now discovered at
  `~/.pi/agent/caduceus/personas/<name>.md` (global) and
  `.caduceus/personas/<name>.md` (project) — no forking required.
  Precedence: project > global > built-in.
- **`/caduceus:lint`** — new slash command that runs static checks
  on the active persona file: cross-mode voseo leakage, structural
  blocks (identity / persona / principles), `${mode}` placeholder
  presence, byte-stability (no ISO dates or UUIDs in persona body).
  Errors fail the lint, warnings pass with notes. This is caduceus's
  unique differentiator: **persona as a contract, verifiable**.
- **Two new built-in personas**: `concise` (1-3 sentence answers, no
  preamble) and `reviewer` (code review mode with BLOCKER/SHOULD/NIT
  severity). Total built-ins: 4 (was 2).
- **Two new config fields** with backward-compatible defaults:
  `systemPromptMode` (default `"append"`) and `persona` (default
  `"gentleman"`). Old `caduceus.json` files without these fields
  continue to work.

### Changed

- `/caduceus:status` now shows `persona` and `systemPromptMode` in
  addition to the original 4 fields.
- The extension entry now closes over `cwd`, `loadedPersona`, and
  `systemPromptMode` state, so persona switches via
  `/caduceus:persona` take effect on the next LLM call without
  requiring a session restart.

### Internal

- `lib/prompt-mode.ts` — new pure-function module
  `composeSystemPrompt(base, persona, mode)`.
- `lib/persona-loader.ts` — new module
  `loadPersona(name, cwd, home?)` and `listPersonas(cwd, home?)`.
- `lib/lint.ts` — new pure-function module
  `lintPersonaContent(content, name)`.
- `lib/persona-contract.ts` — refactored to expose
  `buildPersonaPromptFromContent(content, mode, locale)` while
  keeping the original `buildPersonaPrompt(mode, locale)` as a
  thin wrapper (no breaking change).
- `lib/config-store.ts` — `CaduceusConfig` adds two optional
  fields; `DEFAULT_CONFIG` is the only required update.
- `lib/slash-commands.ts` — registers 3 new commands.
- `lib/errors.ts` — adds `CaduceusPersonaNotFoundError` and
  `CaduceusLintError`.
- `extensions/caduceus.ts` — wires 2 new closure variables and
  updates `before_agent_start` to use `composeSystemPrompt`.

### Test count

- v0.1.0: 68 tests across 6 files
- v0.1.1: 116 tests across 9 files (+48 tests)

## [0.1.0] - 2026-08-12

### Initial release

- Persona contract package: 2 built-in personas (gentleman,
  neutral) with byte-stable content from `gentle-pi`.
- 4 slash commands: `/caduceus:status`, `/caduceus:mode`,
  `/caduceus:locale`, `/caduceus:inspect`.
- JSONC-tolerant `.caduceusrc` project override.
- Atomic config writes via tmp+rename.
- Locale detection with voseo disambiguation.
- 0 runtime dependencies. 0 postinstall. 0 native binaries.
- 68 tests, 13 verify checks, all green.
- Published to npm: `pi-caduceus@0.1.0`.
