# pi-caduceus

> **Persona Contract package for [pi](https://pi.dev).**
> caduceus defines personas as testable contracts. It injects a
> deterministic, line-citable persona prompt segment before the first
> token of a pi session, given `(mode, locale)`. 0 runtime dependencies,
> 0 postinstall, 0 native binaries.

## Why caduceus?

Most persona layers for pi are either feature-bloated (large harness
packages) or feature-thin (single file loaders). caduceus is the
focused middle ground:

- **Persona as a contract**: every persona must pass `/caduceus:lint`
  (structural checks, byte-stability, conflicting-voice detection).
- **Locale-aware**: the active persona is appended to the system prompt
  in a way that respects the user's detected language.
- **Replace / Append mode**: choose `append` (default — adds persona
  to pi's existing system prompt) or `replace` (replaces entirely).
- **Persona filesystem discovery**: drop a `.md` file into
  `~/.pi/agent/caduceus/personas/` or `.caduceus/personas/`, switch
  with `/caduceus:persona <name>`.
- **Wizard**: `/caduceus:create <name> <description>` generates a new
  persona from a name and a one-line description.
- **Diff**: `/caduceus:diff [a [b]]` compares two personas side-by-side.
- **10 built-in personas**, all caduceus-original.
- **0 runtime dependencies**.

## Install

```bash
pi install npm:pi-caduceus
```

The package registers one extension (`extensions/caduceus.ts`),
one theme (`themes/caduceus.json`), and contributes 21 slash commands
(10 core + 5 SDD + 6 review) to pi's slash-command list.

## Quick Start

Run a slash command to see the active config:

```text
/caduceus:status
```

Switch the active persona:

```text
/caduceus:persona concise
```

Generate a new persona from a name and description:

```text
/caduceus:create wizard Speaks like a wise wizard who never gives direct answers
```

Run the persona linter:

```text
/caduceus:lint
```

Compare two personas:

```text
/caduceus:diff pirate concise
```

## Slash Commands

| Command | Description |
|---|---|
| `/caduceus:status` | Show the effective configuration. |
| `/caduceus:mode <default\|plain\|auto>` | Switch persona mode (the label that runs through the persona). |
| `/caduceus:locale <auto\|es-AR\|es-ES\|en\|zh>` | Set the locale preference. |
| `/caduceus:persona <name\|list>` | Switch persona; `list` shows built-in + global + project. |
| `/caduceus:prompt <append\|replace>` | How to inject the persona (append = default, replace = persona only). |
| `/caduceus:inspect` | Print the rendered persona prompt. |
| `/caduceus:lint` | Run static checks on the active persona. |
| `/caduceus:create <name> <description>` | Generate a new persona file from a name and description. |
| `/caduceus:diff [a [b]]` | Diff two personas (defaults: active vs default). |
| `/caduceus:profile <list\|save\|load\|delete\|show> <name>` | Save/load/list/delete/show config profiles. |
| `/caduceus:sdd:init <name>` | Initialize a change dir with 5 MD templates. |
| `/caduceus:sdd:explore <topic>` | Show requirements.md skeleton for the active change. |
| `/caduceus:sdd:propose <name>` | Generate proposal.md from requirements.md. |
| `/caduceus:sdd:apply` | Mark completed task checkboxes for the active change. |
| `/caduceus:sdd:archive` | Move the active change to `openspec/changes/archive/`. |
| `/caduceus:review:inspect <change>` | Show current review state snapshot. |
| `/caduceus:review:start <change> [<persona>]` | Start a review; persona defaults to active. |
| `/caduceus:review:advance <change> [advance\|abandon]` | Advance the review state. |
| `/caduceus:review:finalize <change>` | Finalize and write content-bound receipt. |
| `/caduceus:review:validate <change>` | Re-validate receipt against current artifacts. |
| `/caduceus:review:reset <change>` | Recover from corrupted state.json. |

## Lifecycle Foundation (v0.5.0)

caduceus v0.5.0 ships a **persona-aware general-purpose lifecycle
harness** for the pi coding agent. The 11 new slash commands
(5 SDD + 6 review) drive a full OpenSpec-style change lifecycle
with content-bound JSON receipts — no native binaries, no crypto
signing.

### SDD commands

```bash
/caduceus:sdd:init my-feature
# Creates openspec/changes/my-feature/ with 5 MD templates:
#   proposal.md, design.md, tasks.md, requirements.md, constitution.md

/caduceus:sdd:explore <topic>
# Returns the requirements.md skeleton for the active change

/caduceus:sdd:propose my-feature
# Renders proposal.md from the requirements context

/caduceus:sdd:apply
# Marks completed task checkboxes (idempotent)

/caduceus:sdd:archive
# Moves the change to openspec/changes/archive/<ISO-timestamp>-<name>/
# Requires a finalized receipt (finalVerificationPassed: true)
```

### Review commands (6-state machine)

```bash
/caduceus:review:inspect my-feature
# Show current review state snapshot

/caduceus:review:start my-feature security
# Transition idle → started; capture persona

/caduceus:review:advance my-feature advance   # or 'abandon'
# Transition started → in-review (or any → abandoned)

/caduceus:review:finalize my-feature
# Transition in-review → finalized; write content-bound receipt

/caduceus:review:validate my-feature
# Re-validate receipt against current artifacts; reports receiptValid

/caduceus:review:reset my-feature
# Recover from corrupted state.json (per design.md §12 R3)
```

The receipt is a JSON document with the content hash of the 5 MD
artifacts, the active persona snapshot, and a verification
boolean.
Reing
Read it back with `/caduceus:review:validate`; modifying any of
the 5 files invalidates the receipt.

### Persona-aware lens framework

5 lens slots are wired (`risk`, `correctness`, `security`,
`readability`, `spec-compliance`). 4 of the 10 built-in personas
trigger lens requirements when they review:

| Persona | Required lenses |
|---|---|
| `security` | security, risk |
| `reviewer` | readability, spec-compliance |
| `architect` | spec-compliance, risk |
| `debugger` | correctness |

See design.md §6.3 for the full routing table.

### Constitutional constraints (RFC 2119)

`constitution.md` carries MUST/SHOULD/MAY-level principles. The
built-in linter enforces:

- `CONSTITUTION_EXISTS` — file is non-empty
- `CONSTITUTION_RFC2119` — `Level` is a valid RFC 2119 keyword
- `CONSTITUTION_CWE_MAPPING` — MUST-level principles must have a
  CWE reference (or explicit `CWE: N/A`)
- `CONSTITUTION_COUNT` — 0 principles → error; only MAY → warning
- `CONSTITUTION_NO_DUPLICATE_IDS` — `CON-NNN` IDs must be unique

## Built-in Personas

| Persona | Category | Use case |
|---|---|---|
| `default` | domain (default) | Senior developer / architect voice. Direct, technical, names tradeoffs. |
| `plain` | domain | Minimal voice. Just answers the question. |
| `concise` | style | 1-3 sentence answers, no preamble. |
| `reviewer` | style | Code review with BLOCKER/SHOULD/NIT severity. |
| `teacher` | style | Patient teacher. Explains concepts step by step. |
| `security` | domain | Paranoid security engineer. Flags vulns by severity. |
| `debugger` | domain | Methodical debugger. Traces through code paths. |
| `socratic` | style | Socratic teacher. Answers questions with questions. |
| `architect` | domain | Systems architect. Names tradeoffs, prefers boring tech. |
| `pirate` | style (easter egg) | Speaks like a pirate, technically accurate underneath. |

Add your own by dropping a markdown file at
`~/.pi/agent/caduceus/personas/<name>.md` (global) or
`.caduceus/personas/<name>.md` (project), then run
`/caduceus:persona <name>`. Or use the wizard:

```bash
/caduceus:create wizard Speaks like a wise wizard who never gives direct answers
# Lints the result, writes to ./.caduceus/personas/wizard.md
# Switch with: /caduceus:persona wizard
```

## Profiles

Save and load whole config sets as named profiles. Profiles
live in `~/.pi/agent/caduceus/profiles/<name>.json` (global) or
`.caduceus/profiles/<name>.json` (project).

```bash
/caduceus:profile save work
# Saves the current effective config as "work"

/caduceus:profile load learning
# Loads "learning" — updates mode, locale, systemPromptMode, persona
# atomically. v0.2.0 names in the loaded profile are auto-migrated
# to v0.3.x names.

/caduceus:profile list
# Shows all available profiles (project shadows global)

/caduceus:profile show work
# Displays the contents of the "work" profile

/caduceus:profile delete work
# Removes the "work" profile
```

## Persona macros

Persona files can reference context-aware placeholders that
are resolved at render time. Supported macros:

| Macro | Value |
|---|---|
| `${userName}` | OS user (`$USER` or `$USERNAME`, falls back to `"user"`) |
| `${projectName}` | basename of current working directory |
| `${cwd}` | full current working directory path |
| `${date}` | today, ISO format (`YYYY-MM-DD`) |
| `${os}` | `process.platform` (`linux`, `darwin`, etc.) |
| `${mode}` | current persona mode (e.g., `default`, `plain`, `auto`) |

The `default` persona uses `${projectName}` to greet the user with
the project name. The lint warns on unknown macros but does not
fail.


## What caduceus is NOT

- **Not a fork of any other persona layer.** caduceus is an independent
  product. The persona contract, the lint, the wizard, and the diff are
  caduceus-original designs.
- **Not a full harness.** No review tools, no subagent machinery, no SDD
  pipeline. Those exist in other packages (e.g. `gentle-pi`).
- **Not carrying other people's voice.** Each built-in persona is
  caduceus-original. You don't inherit another project's tone by
  installing caduceus.

## Architecture

```
extensions/caduceus.ts        # SHELL — the only file that imports from pi
lib/
├── persona-contract.ts       # MEAT (pure): (mode, locale) → prompt string
├── persona-loader.ts          # MEAT: loadPersona(name, cwd, home?)
├── locale-detect.ts          # MEAT (pure): (text, env, cfg) → locale
├── lint.ts                   # MEAT (pure): static persona checks
├── prompt-mode.ts            # MEAT (pure): composeSystemPrompt(base, persona, mode)
├── config-store.ts           # MEAT: readConfig + writeGlobalConfig + migrations
├── slash-commands.ts         # MEAT: registerSlashCommands(pi, deps)
├── wizard.ts                 # MEAT (pure): generatePersonaContent, validateStep
├── diff.ts                   # MEAT (pure): personaDiff (hand-rolled Myers)
├── errors.ts                 # CaduceusError, CaduceusConfigError, CaduceusPersonaNotFoundError, CaduceusLintError
└── version.ts                # CADUCEUS_VERSION = "0.3.0"
prompts/                      # 10 markdown files (one per built-in persona)
themes/caduceus.json          # sea-blue starter theme
tests/                        # 10 test files, 152 tests
scripts/verify-package.mjs    # pre-publish integrity check
```

The split follows DSV DNA: the extension entry is the **shell** (talks
to pi), the `lib/` modules are the **meat** (pure, testable, independent
of pi's runtime).

## Development

```bash
# Run the full test suite (152 tests)
node --experimental-strip-types --test tests/*.test.ts
# or
pnpm test

# Verify the package before publishing (13 pre-publish checks)
node scripts/verify-package.mjs
```

## License

MIT — see [LICENSE](./LICENSE).
