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
one theme (`themes/caduceus.json`), and contributes to pi's
slash-command list.

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
