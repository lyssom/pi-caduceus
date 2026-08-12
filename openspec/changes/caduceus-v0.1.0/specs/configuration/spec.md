# Configuration Specification

> **Status:** New domain spec (greenfield).
> **Date:** 2026-01
> **Owns:** `lib/config-store.ts`, `lib/slash-commands.ts`, the
> slash-command registration segment of `extensions/caduceus.ts`.

## Purpose

Define how caduceus reads, writes, and inspects its
configuration. The configuration is the user's primary surface
for changing persona mode, locale preference, status bar
visibility, and the project-override gate. The slash commands
(`/caduceus:*`) are the interactive layer on top of the
configuration store.

## Requirements

### R-CONFIG-001: Default configuration

When no configuration file exists (neither global nor project),
the effective configuration MUST be:

```json
{
  "mode": "gentleman",
  "locale": "auto",
  "showStatusBar": false,
  "allowProjectOverride": true
}
```

#### Scenario: S-CONFIG-001-1

- **GIVEN** `~/.pi/agent/caduceus.json` does not exist
- **AND** `.caduceusrc` does not exist in `cwd`
- **WHEN** the config is resolved at `session_start`
- **THEN** the effective config equals the defaults above
- **AND** the source label reported by `/caduceus:status` is
  `"built-in defaults"`

### R-CONFIG-002: Global config read

The system MUST read `~/.pi/agent/caduceus.json` at session start.
The file format is **strict JSON** (no comments). Missing or
unreadable file → fall back to defaults.

#### Scenario: S-CONFIG-002-1

- **GIVEN** `~/.pi/agent/caduceus.json` exists with valid JSON
- **AND** its content is `{"mode": "neutral", "locale": "es-AR"}`
- **WHEN** the config is resolved
- **THEN** the effective `mode === "neutral"`
- **AND** the effective `locale === "es-AR"`
- **AND** the unset fields fall back to their defaults
  (`showStatusBar: false`, `allowProjectOverride: true`)

#### Scenario: S-CONFIG-002-2 — Malformed global file

- **GIVEN** `~/.pi/agent/caduceus.json` exists but contains
  malformed JSON (e.g. trailing comma)
- **WHEN** the config is resolved
- **THEN** the system throws a typed `CaduceusConfigError`
- **AND** the original file on disk is NOT modified
- **AND** `session_start` completes using the built-in defaults

### R-CONFIG-003: Project override

The system MUST read `.caduceusrc` from the current working
directory IF AND ONLY IF the effective global config has
`allowProjectOverride: true`.

#### Scenario: S-CONFIG-003-1

- **GIVEN** global `allowProjectOverride === true`
- **AND** `.caduceusrc` exists in `cwd`
- **WHEN** the config is resolved
- **THEN** per-field merge: `.caduceusrc` values override global
  values, but unset fields in `.caduceusrc` fall through to
  the global config

#### Scenario: S-CONFIG-003-2 — Project override disabled

- **GIVEN** global `allowProjectOverride === false`
- **AND** `.caduceusrc` exists in `cwd`
- **WHEN** the config is resolved
- **THEN** `.caduceusrc` is ignored entirely
- **AND** the global config is the effective config

### R-CONFIG-004: JSONC tolerant parsing for `.caduceusrc`

`.caduceusrc` MUST support `//` line comments and `/* */` block
comments. The parser MUST strip comments BEFORE JSON.parse.

#### Scenario: S-CONFIG-004-1

- **GIVEN** `.caduceusrc` content is
  ```text
  // I'm a comment
  { "mode": "neutral" }
  ```
- **WHEN** the project override is parsed
- **THEN** the parsed object is `{ mode: "neutral" }`
- **AND** no parse error is raised

#### Scenario: S-CONFIG-004-2

- **GIVEN** `.caduceusrc` content is
  ```text
  /* block comment */
  { /* inline */ "locale": "es-AR" }
  ```
- **WHEN** the project override is parsed
- **THEN** the parsed object is `{ locale: "es-AR" }`

### R-CONFIG-005: Atomic write

Writing the global config MUST use the temp-file + rename
pattern. The system MUST NOT leave a partial file on disk if
the write is interrupted.

#### Scenario: S-CONFIG-005-1

- **GIVEN** an in-memory config update via `/caduceus:mode`
- **WHEN** the write is committed
- **THEN** the on-disk `caduceus.json` is the complete new
  content (no half-written state)
- **AND** no `caduceus.json.tmp` file is left in `~/.pi/agent/`
  after the rename succeeds

#### Scenario: S-CONFIG-005-2 — Failed write does not corrupt

- **GIVEN** the disk is full or permissions are revoked
- **WHEN** the write is attempted
- **THEN** the existing `caduceus.json` is unchanged
- **AND** the user sees an error message in the TUI
- **AND** the in-memory config is rolled back

### R-CONFIG-006: Slash command — status

`/caduceus:status` MUST print the current effective configuration
as a human-readable summary, including:

- `mode` (effective value)
- `locale` (effective value)
- `showStatusBar` (effective value)
- `allowProjectOverride` (effective value)
- Source label: `"built-in defaults"`, `"global"`, `"global+project"`,
  or `"project"`

#### Scenario: S-CONFIG-006-1

- **GIVEN** the config has `mode: "gentleman"`, `locale: "auto"`,
  `showStatusBar: false`, source: `"built-in defaults"`
- **WHEN** the user runs `/caduceus:status`
- **THEN** the TUI shows each field with its value
- **AND** the source label is `"built-in defaults"`

### R-CONFIG-007: Slash command — mode

`/caduceus:mode <gentleman|neutral|auto>` MUST update the
in-memory mode for the current session and persist the change
to the global config file.

#### Scenario: S-CONFIG-007-1 — Valid argument

- **GIVEN** the current effective `mode === "gentleman"`
- **WHEN** the user runs `/caduceus:mode neutral`
- **THEN** the in-memory mode becomes `"neutral"`
- **AND** the global config file is updated
- **AND** subsequent `before_agent_start` events use
  `buildPersonaPrompt("neutral", locale)`

#### Scenario: S-CONFIG-007-2 — Invalid argument

- **GIVEN** the current effective `mode === "gentleman"`
- **WHEN** the user runs `/caduceus:mode pirate`
- **THEN** the in-memory mode is unchanged
- **AND** the TUI shows a usage hint via `ctx.ui.notify()`:
  `"usage: /caduceus:mode <gentleman|neutral|auto>"`
- **AND** no exception is thrown

### R-CONFIG-008: Slash command — locale

`/caduceus:locale <auto|es-AR|es-ES|en|zh>` MUST update the
in-memory locale preference and persist to the global config.

#### Scenario: S-CONFIG-008-1

- **GIVEN** the current effective `locale === "auto"`
- **WHEN** the user runs `/caduceus:locale es-AR`
- **THEN** the in-memory locale becomes `"es-AR"`
- **AND** the global config file is updated
- **AND** subsequent `before_agent_start` events resolve to
  `"es-AR"` regardless of the user text content (per
  R-LOCALE-002 precedence)

#### Scenario: S-CONFIG-008-2 — Invalid argument

- **WHEN** the user runs `/caduceus:locale pirate`
- **THEN** the in-memory locale is unchanged
- **AND** the TUI shows a usage hint

### R-CONFIG-009: Slash command — inspect

`/caduceus:inspect` MUST print the rendered persona prompt for
the current effective `(mode, locale)`, with each line annotated
by its source location (file + line number). Output MUST be
byte-stable across consecutive invocations with no config change.

#### Scenario: S-CONFIG-009-1

- **GIVEN** a session with `mode === "gentleman"`,
  `locale === "es-AR"`
- **WHEN** the user runs `/caduceus:inspect`
- **THEN** the output shows the rendered persona prompt
- **AND** each non-trivial line is annotated with
  `prompts/gentleman.md:L<n>` or `language-clause.ts:L<n>`

#### Scenario: S-CONFIG-009-2 — Byte-stability

- **GIVEN** no config change between two `/caduceus:inspect`
  invocations
- **WHEN** the user runs the command twice
- **THEN** the two outputs are byte-identical

### R-CONFIG-010: Status bar visibility

When `showStatusBar === true`, the `session_start` handler MUST
call `ctx.ui.setStatus("caduceus", "<line>")` with a one-line
status string. When `showStatusBar === false`, the handler MUST
NOT call `setStatus` (or MUST call it with `undefined` to clear).

#### Scenario: S-CONFIG-010-1 — Off by default

- **GIVEN** the effective `showStatusBar === false` (default)
- **WHEN** `session_start` fires
- **THEN** the caduceus status bar is NOT shown in the TUI
  footer

#### Scenario: S-CONFIG-010-2 — On after toggle

- **GIVEN** the user sets `showStatusBar: true` in `.caduceusrc`
  and restarts the session
- **WHEN** `session_start` fires
- **THEN** the TUI footer shows the caduceus status line
- **AND** the line format is
  `"caduceus · <mode> · <locale>"` (e.g.
  `"caduceus · gentleman · es-AR"`)

### R-CONFIG-011: pi manifest declaration

`package.json` MUST declare the pi manifest per
`pi.dev/docs/latest/packages`:

- `pi.extensions` MUST be `["./extensions"]` (or a glob/array
  referencing the entry file).
- `pi.themes` MUST include `["./themes"]`.
- `pi.prompts` MUST include `["./prompts"]`.
- `keywords` MUST include `"pi-package"`.

#### Scenario: S-CONFIG-011-1

- **GIVEN** the published `package.json`
- **WHEN** `pi install npm:@lyssom/pi-caduceus` runs
- **THEN** the extension, theme, and prompts are registered
- **AND** the package is discoverable on `https://pi.dev/packages`

### R-CONFIG-012: Zero runtime dependencies

`package.json` MUST have zero entries in the `dependencies`
field and zero `postinstall` script. The test runner
(`node --experimental-strip-types --test tests/*.test.ts`) MUST
not require any third-party npm package.

#### Scenario: S-CONFIG-012-1

- **GIVEN** the published package tarball
- **WHEN** `npm install --omit=dev` is performed
- **THEN** zero packages are installed
- **AND** the extension loads successfully

#### Scenario: S-CONFIG-012-2 — Test command runs in isolation

- **GIVEN** a clean checkout with no `node_modules`
- **WHEN** `node --experimental-strip-types --test tests/*.test.ts`
  is run
- **THEN** all tests pass
- **AND** no `npm install` is required first

### R-CONFIG-013: Peer dependency declaration

`package.json` MUST declare `@earendil-works/pi-coding-agent` in
`peerDependencies` with a `"*"` range, and the same package in
`peerDependenciesMeta.<name>.optional: true`.

#### Scenario: S-CONFIG-013-1

- **GIVEN** the published `package.json`
- **WHEN** `npm view @lyssom/pi-caduceus peerDependencies` is
  inspected
- **THEN** `@earendil-works/pi-coding-agent` is listed with
  range `"*"`
- **AND** `peerDependenciesMeta."@earendil-works/pi-coding-agent".optional`
  is `true`

### R-CONFIG-014: No native binaries, no postinstall

The published tarball MUST NOT contain any native binaries
(`.node` files, executable binaries) and MUST NOT define a
`scripts.postinstall` field.

#### Scenario: S-CONFIG-014-1

- **GIVEN** the published tarball (e.g. `npm pack` output)
- **WHEN** the tarball contents are listed
- **THEN** no `.node` files appear
- **AND** no executable files outside `bin/` (which caduceus
  does not declare) appear
- **AND** `package.json` `scripts.postinstall` is `undefined`

### R-CONFIG-015: Pre-publish integrity check

`scripts/verify-package.mjs` MUST verify, before publish, that:

- `package.json` exists and parses
- `extensions/caduceus.ts` exists
- `themes/caduceus.json` exists
- `prompts/gentleman.md` and `prompts/neutral.md` exist
- All 5 test files exist
- `dependencies` and `devDependencies` are empty objects
- `postinstall` is absent

#### Scenario: S-CONFIG-015-1

- **WHEN** `node scripts/verify-package.mjs` is run
- **THEN** the script exits 0 if all checks pass
- **AND** exits non-zero with a clear error message on any
  failure
- **AND** the script is wired into `prepack` in `package.json`
