# AGENTS — Project context for caduceus

> This file is the project-level companion to the SDD change artifacts under
> `openspec/changes/{change}/`. Read it before doing any work in this repo.
>
> **For the canonical current state of the project** (what caduceus is, what
> it does, what it doesn't, and why), see **[`STATUS.md`](../STATUS.md)** at
> the repo root. This `AGENTS.md` covers the project conventions
> (invariants, TDD posture, test runner, layout). The v0.1.0 seed design
> in [`INIT.md`](../INIT.md) was substantially revised by the v0.3.0 brand-
> independence decision; for the current design rationale, read STATUS.md.

## What this project is

**caduceus is a Persona Contract package for the [pi](https://pi.dev) coding
agent.** It does one thing and one thing only: **injects a deterministic,
testable, line-citable persona prompt segment before the first token of a pi
session, given `(mode, locale)`**.

- Ten built-in caduceus-original personas (since v0.3.0): `default`, `plain`,
  `concise`, `reviewer`, `teacher`, `security`, `debugger`, `socratic`,
  `architect`, `pirate`. See [STATUS.md §2.1](../STATUS.md).
- Three persona modes: `default`, `plain`, `auto`. (The legacy names
  `gentleman` and `neutral` are still accepted as deprecated input but
  internally mapped to `default` and `plain`.)
- Zero runtime dependencies. Zero native binaries. Zero postinstall.
- Composition model: a shell (persona contract) and meat (project skills,
  AGENTS.md, custom prompts) — see `INIT.md §4` DNA-1.

## Brand independence (v0.3.0+)

caduceus is **not a fork of gentle-pi**. It benchmarks against gentle-pi
but does not depend on it. Since v0.3.0:

- The 2 v0.1.0/v0.1.1 personas that were byte-for-byte copies of
  gentle-pi (`gentleman.md`, `neutral.md`) have been **deleted**. They
  are replaced by 10 caduceus-original personas.
- The "el Gentleman" / "voseo" / "Rioplatense" content is **gone** from all
  source files except `lib/locale-detect.ts` (which legitimately uses
  voseo as a Spanish-detection signal).
- `lib/language-clause.ts` is **deleted** (no more language-clause
  appended to persona prompts).
- `verify-package.mjs` greps for `"el Gentleman"` and `"Rioplatense"` in
  the source and fails the build if any are found. This is the
  mechanical enforcement.

**Do not re-introduce any gentle-pi-derived content** (persona text,
language clause, naming). The grep check is the guard.

## Stack

- **Language:** TypeScript (ESM, `module: "type"`)
- **Runtime:** Node 20+ with `--experimental-strip-types`
- **Test runner:** `node --experimental-strip-types --test tests/*.test.ts`
- **Peer:** `@earendil-works/pi-coding-agent` (declared in
  `peerDependencies` per `pi.dev/docs/latest/packages`)
- **Brand:** sea blue `#1B4D7A` — deliberately distinct from gentle-pi rose

## Non-negotiable invariants (v0.5.0)

These are the falsifiable statements the test suite must defend. Any change
to one of these requires an explicit proposal amendment.

1. The 10 built-in personas pass `lintPersonaContent` (all 8 lint checks).
2. `${mode}` placeholder is present in every persona file.
3. No persona content contains "el Gentleman" / "Rioplatense" / "voseo"-
   specific phrases (mechanical check via `verify-package.mjs`).
4. `caduceus inspect` and `caduceus diff` outputs are byte-stable given
   the same inputs (no timestamps, no random IDs).
5. The `pi` manifest in `package.json` declares `extensions`, `themes`, and
   `prompts` paths; `keywords` includes `"pi-package"`.
6. v0.2.0 mode/persona names in user config are auto-migrated to v0.3.0+
   names with a `console.warn` (backward compat).
7. `npm view pi-caduceus` resolves to the same package before and after
   any apply phase (no accidentally bumped scope).

8. **v0.5.0 (added)**: The 5 constitution lint checks pass on the
   canonical constitution template shipped with v0.5.0.
9. **v0.5.0 (added)**: No source file imports from
   `pi-review`, `pi-agents`, `dracond`, or `pi-muselinn-harness`.
   Mechanical check via `scripts/verify-package.mjs` (Checks 15/16/17).
10. **v0.5.0 (added)**: The 21 slash commands (10 core + 5 SDD + 6 review)
    are registered when `registerAllSlashCommands` is called (verified by
    `tests/extension-entry.test.ts`).

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

## Workspace layout (current: v0.4.0)

```text
caduceus/
├── package.json              # pi manifest, 0 runtime deps
├── README.md                 # positioning + install + Quick Start
├── STATUS.md                 # canonical current-state reference
├── CHANGELOG.md              # version history
├── INIT.md                   # v0.1.0 seed design (superseded; see STATUS.md)
├── LICENSE                   # MIT
├── extensions/
│   └── caduceus.ts           # entry: registers hook + slash commands
├── lib/                       # 13 modules (pure, testable)
│   ├── persona-contract.ts   # core: pure function (mode, locale) → prompt
│   ├── persona-loader.ts     # filesystem discovery
│   ├── locale-detect.ts      # text → locale
│   ├── lint.ts               # static persona checks (8 checks)
│   ├── prompt-mode.ts        # append/replace composition
│   ├── slash-commands.ts     # 9 slash commands
│   ├── wizard.ts             # template-based persona generation
│   ├── diff.ts               # hand-rolled Myers diff
│   ├── macros.ts             # ${userName} etc. runtime substitution
│   ├── profile-store.ts      # save/load/list/delete profiles
│   ├── config-store.ts       # read/write config + migrations
│   ├── errors.ts             # CaduceusError + subclasses
│   └── version.ts            # CADUCEUS_VERSION
├── prompts/                   # 10 caduceus-original persona files
├── themes/
│   └── caduceus.json         # sea-blue starter theme
├── tests/                     # 13 test files, 186 tests
└── scripts/
    └── verify-package.mjs    # 14 pre-publish checks (incl. brand grep)
```

## Reference: gentle-pi baseline (for context, not for content reuse)

gentle-pi v2.1.2 at `/root/.pi/agent/npm/node_modules/gentle-pi` is a
useful reference for **architecture patterns** (the persona extension
file structure, slash command registration style, the pi manifest
shape, the strict TDD posture). It is **not** a source of content for
caduceus (see "Brand independence" above). For a feature-by-feature
comparison, see [STATUS.md §5](../STATUS.md).

## Locked decisions

See `INIT.md §1` for the v0.1.0 locked decisions. For the v0.3.0+ brand-
independence decision and the v0.4.0 profile/macro additions, see
[STATUS.md §8](../STATUS.md). Any amendment to a locked decision must be
recorded in a new `## Amendment` section, not by in-place edit.
