# AGENTS — Project context for caduceus

> This file is the project-level companion to the SDD change artifacts under
> `openspec/changes/{change}/`. Read it before doing any work in this repo.

## What this project is

**caduceus** is a Persona Contract package for the [pi](https://pi.dev) coding
agent. It does one thing and one thing only: **injects a deterministic,
testable, line-citable persona prompt segment before the first token of a pi
session, given `(mode, locale)`**.

- Two persona modes in v0.1.0: `gentleman` (senior architect, Rioplatense
  Spanish voseo) and `neutral` (professional Spanish, voseo forbidden).
- Zero runtime dependencies. Zero native binaries. Zero postinstall.
- Composition model: a shell (persona contract) and meat (project skills,
  AGENTS.md, custom prompts) — see `INIT.md §4` DNA-1.

## Stack

- **Language:** TypeScript (ESM, `module: "type"`)
- **Runtime:** Node 20+ with `--experimental-strip-types` (mirrors
  gentle-pi)
- **Package manager:** pnpm 11.1.1 (gentle-pi family convention)
- **Test runner:** `node --experimental-strip-types --test tests/*.test.ts`
- **Peer:** `@earendil-works/pi-coding-agent` (declared in
  `peerDependencies` per `pi.dev/docs/latest/packages`)
- **Brand:** sea blue `#1B4D7A` — deliberately distinct from gentle-pi rose

## Non-negotiable invariants

These are the falsifiable statements the test suite must defend. Any change to
one of these requires an explicit proposal amendment.

1. `gentleman` mode prompt contains the literal clause
   `natural Rioplatense Spanish with voseo` (case-insensitive).
2. `neutral` mode prompt contains the literal clause `Do NOT use voseo`
   (case-insensitive).
3. Cross-mode leakage is forbidden: `gentleman` prompt must not contain
   `Do NOT use voseo`; `neutral` prompt must not contain
   `natural Rioplatense Spanish with voseo`.
4. `caduceus inspect` output is byte-stable given the same inputs (no
   timestamps, no random IDs in the prompt segment).
5. The `pi` manifest in `package.json` declares `extensions`, `themes`, and
   `prompts` paths; `keywords` includes `"pi-package"`.
6. `npm view pi-caduceus` resolves to the same package before and
   after the apply phase (no accidentally bumped scope).

## Strict TDD posture

This project runs in **strict TDD mode** (see `openspec/config.yaml`). The
test runner is committed in `config.yaml` and is forwarded into every
`sdd-apply` and `sdd-verify` prompt. Every implementation task is expected
to follow:

```text
RED          → write the failing test
GREEN        → write the minimum code to make it pass
TRIANGULATE  → add a second test that forces a more general implementation
REFACTOR     → clean up, keep all tests green
```

The first test committed in `tests/` MUST be a failing
`persona-contract.test.ts` (RED), per `INIT.md §9.4`.

## Workspace layout (target for v0.1.0)

```text
caduceus/
├── package.json              # pi manifest, 0 runtime deps
├── README.md                 # positioning + install + screenshot
├── LICENSE                   # MIT
├── extensions/
│   └── caduceus.ts           # entry: registers hook + slash commands
├── lib/
│   ├── persona-contract.ts   # core: pure function (mode, locale) → prompt
│   ├── language-clause.ts    # language clause selection
│   ├── locale-detect.ts      # detect from input / env / config
│   ├── config-store.ts       # read/write ~/.pi/agent/caduceus.json + .caduceusrc
│   ├── slash-commands.ts     # /caduceus:* command registry
│   ├── status-bar.ts         # TUI footer (uses pi-tui peer)
│   └── version.ts            # exported const CADUCEUS_VERSION
├── prompts/
│   ├── gentleman.md          # full persona segment (gentleman mode)
│   └── neutral.md            # full persona segment (neutral mode)
├── themes/
│   └── caduceus.json         # sea-blue starter theme
├── tests/
│   ├── persona-contract.test.ts
│   ├── language-clause.test.ts
│   ├── locale-detect.test.ts
│   ├── config-store.test.ts
│   └── slash-commands.test.ts
└── scripts/
    └── verify-package.mjs    # pre-publish file integrity check
```

## Reference: gentle-pi baseline

The sibling package at `/root/.pi/agent/npm/node_modules/gentle-pi`
(v2.1.2) is the closest reference implementation. Study its:

- `extensions/gentle-ai.ts` for the persona contract pattern
  (specifically the `gentleman` and `neutral` clauses at lines 262 / 272).
- `tests/persona-single-channel.test.ts`,
  `tests/persona-neutral-voseo.test.ts`,
  `tests/artifact-language.test.ts` for the test posture.
- `package.json` `pi` manifest shape and the `keywords: ["pi-package", ...]`
  requirement.

**Caduceus must NOT duplicate gentle-pi's heavy machinery** (no SDD engine
inside the package, no review tooling, no subagent chains, no delivery
skills). Caduceus is a focused, smaller sibling.

## Locked decisions

See `INIT.md §1`. Any amendment to a locked decision must be recorded in a
new `## Amendment` section, not by in-place edit.
