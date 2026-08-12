# @lyssom/pi-caduceus

> **Persona Contract package for [pi](https://pi.dev).**
> Injects a deterministic, testable, line-citable persona prompt segment
> before the first token of a pi session, given `(mode, locale)`.

**caduceus** is the smaller sibling of
[`gentle-pi`](https://github.com/Gentleman-Programming/gentle-pi). Where
gentle-pi is a full development harness (review tooling, SDD engine,
subagents, delivery skills), caduceus does one thing: the persona
contract. Users who want only the persona layer — and none of
gentle-pi's other machinery — install caduceus.

- **0 runtime dependencies**
- **0 native binaries** — no postinstall, no Go toolchain, no signed archives
- **2 persona modes** — `gentleman` (Rioplatense Spanish voseo) and `neutral` (no voseo)
- **4 slash commands** — `status`, `mode`, `locale`, `inspect`
- **JSONC-tolerant** project-level `.caduceusrc` override

> *"Persona is a contract, not a costume."*

## Install

```bash
pi install npm:@lyssom/pi-caduceus
```

The package registers one extension (`extensions/caduceus.ts`), one
theme (`themes/caduceus.json`), and no prompt files (caduceus
generates the persona prompt at runtime from its embedded templates).

## Quick Start

Once installed, start a pi session:

```bash
pi
```

Run `/caduceus:status` to see the effective configuration:

```text
caduceus status:
  mode: gentleman
  locale: auto
  showStatusBar: false
  allowProjectOverride: true
  source: built-in defaults
```

Run `/caduceus:inspect` to see the persona prompt that will be
injected on the next LLM call:

```text
## caduceus inspect
mode: gentleman
locale: auto

## el Gentleman Identity and Harness
Current persona mode: gentleman
...
```

Write a prompt in Spanish — the model responds in Rioplatense Spanish
with voseo. Switch to `/caduceus:mode neutral` and the same prompt
gets a neutral Spanish response without voseo.

## Slash Commands

| Command | Description |
|---|---|
| `/caduceus:status` | Show the effective configuration. |
| `/caduceus:mode <gentleman\|neutral\|auto>` | Switch persona mode. |
| `/caduceus:locale <auto\|es-AR\|es-ES\|en\|zh>` | Set the locale preference. |
| `/caduceus:inspect` | Print the rendered persona prompt. |

## Configuration

Configuration is read at session start from two locations:

1. **Global:** `~/.pi/agent/caduceus.json` (strict JSON)
2. **Project:** `.caduceusrc` in the current directory (JSONC, comments
   allowed)

The project override is honored only if `allowProjectOverride: true` in
the global config (the default).

Default configuration:

```json
{
  "mode": "gentleman",
  "locale": "auto",
  "showStatusBar": false,
  "allowProjectOverride": true
}
```

`.caduceusrc` example (JSONC with comments):

```jsonc
// Override for this project only
{
  "mode": "neutral"
}
```

## Why "caduceus"?

Hermes's staff. In Greek myth, the caduceus is the **staff of the
messenger god** — a symbol of commerce, contracts, and negotiated
agreement. Caduceus is one layer above the messenger (`pi-hermes-memory`
is the memory layer; caduceus is the contract layer above the
messenger). Clean brand fit, no collision.

See [INIT.md](./INIT.md) for the full naming rationale and design DNA.

## Architecture

```
extensions/caduceus.ts        # SHELL — the only file that imports from pi
lib/
├── persona-contract.ts        # Pure: (mode, locale) → persona prompt
├── language-clause.ts         # Pure: (locale, mode) → language boundary
├── locale-detect.ts           # Pure: (text, env, config) → locale
├── config-store.ts            # The only file that touches the FS for config
├── slash-commands.ts          # /caduceus:* command registry
├── version.ts                 # CADUCEUS_VERSION = "0.1.0"
└── errors.ts                  # CaduceusError, CaduceusConfigError
prompts/
├── gentleman.md               # Persona body (verbatim from gentle-pi)
└── neutral.md                 # Persona body (verbatim from gentle-pi)
themes/
└── caduceus.json              # Sea-blue starter theme
tests/
└── *.test.ts                  # 6 test files, 68 tests, strict TDD
scripts/
└── verify-package.mjs         # Pre-publish integrity check
```

The split follows `INIT.md §4` DNA-1: the extension entry is the
**shell** (talks to pi), the libraries are the **meat** (pure,
testable, independent of pi's runtime). The two prompt files are
verbatim copies of `gentle-pi/extensions/gentle-ai.ts` lines 258–266
and 268–277, enforced byte-for-byte by
`tests/persona-contract.test.ts`.

## Development

```bash
# Run the full test suite (68 tests)
node --experimental-strip-types --test tests/*.test.ts
# or
pnpm test

# Verify the package before publishing
node scripts/verify-package.mjs
```

## License

MIT — see [LICENSE](./LICENSE).
