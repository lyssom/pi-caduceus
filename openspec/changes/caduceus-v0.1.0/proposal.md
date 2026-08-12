# Proposal: caduceus v0.1.0 — Persona Contract package

> **Status:** Proposal complete. Awaiting `spec` phase.
> **Date:** 2026-01
> **Change:** `caduceus-v0.1.0`
> **Author:** el Gentleman (Pi orchestrator)
> **Source contracts:** [`INIT.md`](../../../INIT.md), [`AGENTS.md`](../../AGENTS.md), [`exploration.md`](./exploration.md)
> **Upstream artifact:** [`init.md`](./init.md)

## 1. Intent

Ship **caduceus v0.1.0** — a Persona Contract package for the
[pi](https://pi.dev) coding agent that injects a deterministic,
testable, line-citable persona prompt segment before the first token
of a pi session, given `(mode, locale)`.

This is the greenfield realization of the locked decisions in
`INIT.md §1`. The package does one thing and one thing only: it
replaces the per-prompt persona-injection responsibility that
`gentle-pi` currently owns as a side-effect of being a much larger
package. Users who want only the persona contract — and none of
gentle-pi's review tooling, SDD engine, or subagent machinery — get
a focused, small, fast-installable package.

## 2. Why now

- `gentle-pi` v2.1.2 already provides the persona contract in
  `extensions/gentle-ai.ts` (lines 258–308, 6129–6151), but the
  persona is coupled to SDD preflight, native review tooling, and
  ~71K lines of surrounding code. A growing number of pi users
  want **only the persona contract**, not the rest.
- The pi ecosystem has no dedicated "persona-as-contract" package.
  `pi-hermes-memory` is the closest neighbor (Hermes = messenger);
  caduceus is the messenger's staff (contract layer above the
  messenger). Clean brand fit, no collision.
- `INIT.md` is a fully-formed seed. Every locked decision and
  rationale is already recorded. This proposal just turns the
  seed into a published package.
- `@earendil-works/pi-coding-agent` v0.84.1 (the version we have
  installed) exposes a clean, type-safe extension API that makes
  persona injection a 3-event-handler job.

## 3. Scope (locked)

### 3.1 In scope for v0.1.0

| Capability | Owner module(s) |
|---|---|
| Persona prompt assembly `(mode, locale) → string` | `lib/persona-contract.ts` (pure function) |
| Language clause selection `(locale, mode) → string` | `lib/language-clause.ts` (pure function) |
| Locale detection `(text, cwd, config) → locale` | `lib/locale-detect.ts` (pure function) |
| Config read/write at `~/.pi/agent/caduceus.json` + `.caduceusrc` | `lib/config-store.ts` (only file with FS I/O) |
| Slash command wiring | `lib/slash-commands.ts` |
| Persona prompt text sources (markdown) | `prompts/gentleman.md`, `prompts/neutral.md` |
| Pi extension entry — wires the above into `pi` | `extensions/caduceus.ts` (the only file that registers pi hooks) |
| Sea-blue starter theme | `themes/caduceus.json` |
| Test suite (5 files, strict TDD) | `tests/*.test.ts` |
| `package.json` with `pi` manifest, 0 runtime deps | (root) |
| README, LICENSE, pre-publish file integrity check | `README.md`, `LICENSE`, `scripts/verify-package.mjs` |

### 3.2 Explicitly out of scope (deferred to v0.2+)

Hard-locked per `INIT.md §3.2` and `INIT.md §10`:

- ❌ Native review tooling (rejected — `gentle-pi`'s job)
- ❌ SDD/OpenSpec flow inside the package (rejected)
- ❌ Subagent chains / phase agents (rejected)
- ❌ Delivery skills (branch-pr, chained-pr, comment-writer)
- ❌ Postinstall hooks or native binary download
- ❌ Third-party runtime dependencies (target: 0)
- ❌ Multilingual UI strings in v0.1.0 (English only; **see §9 Q2**)
- ❌ Logo / banner in v0.1.0 (text-only gallery card; **see §9 Q3**)

## 4. Architecture

The module boundary in `INIT.md §5.1` is accepted with **one
micro-adjustment**: `lib/status-bar.ts` collapses into
`extensions/caduceus.ts` because the status bar is a one-line
`ctx.ui.setStatus()` call inside the `session_start` handler. A
dedicated file is over-engineering at this size.

### 4.1 Final module layout

```text
caduceus/
├── package.json              # pi manifest, 0 runtime deps
├── README.md                 # positioning + install + Quick Start
├── LICENSE                   # MIT
├── .gitignore                # local Pi state, node_modules, dist
│
├── extensions/
│   └── caduceus.ts           # ONLY file that registers pi hooks
│                             #   - session_start → status bar (or no-op)
│                             #   - before_agent_start → persona injection
│                             #   - 4× registerCommand → slash commands
│                             #   - absorbs the merged status-bar logic
│
├── lib/
│   ├── persona-contract.ts   # CORE: pure (mode, locale) → prompt string
│   ├── language-clause.ts    # locale → language clause (pure)
│   ├── locale-detect.ts      # (text, cwd, config) → locale (pure)
│   ├── config-store.ts       # ONLY file with FS I/O for config
│   ├── slash-commands.ts     # /caduceus:* command registry
│   └── version.ts            # exported const CADUCEUS_VERSION = "0.1.0"
│
├── prompts/
│   ├── gentleman.md          # persona body (verbatim from gentle-pi lines 258–266)
│   └── neutral.md            # persona body (verbatim from gentle-pi lines 268–277)
│
├── themes/
│   └── caduceus.json         # sea-blue (#1B4D7A) starter theme
│
├── tests/
│   ├── persona-contract.test.ts   # invariants 1, 2, 3 from AGENTS.md
│   ├── language-clause.test.ts    # locale → clause matrix
│   ├── locale-detect.test.ts      # detection order: text → env → config
│   ├── config-store.test.ts       # read/write/override/atomicity
│   └── slash-commands.test.ts     # 4 commands wiring
│
└── scripts/
    └── verify-package.mjs    # pre-publish file integrity check
```

### 4.2 Module contracts (locked, mirroring `INIT.md §5.1`)

| Module | Pure? | Responsibility |
|---|---|---|
| `persona-contract.ts` | **Yes** | `(mode: PersonaMode, locale: Locale) → string`. Reads `prompts/*.md` from disk at module load, caches in memory. Zero side effects. |
| `language-clause.ts` | **Yes** | `(locale: Locale, mode: PersonaMode) → string`. Returns the appropriate language boundary line. No I/O. |
| `locale-detect.ts` | **Yes** | `(text: string, env: NodeJS.ProcessEnv, configLocale: Locale) → ResolvedLocale`. No I/O. |
| `config-store.ts` | **No (I/O)** | The only file that reads/writes `~/.pi/agent/caduceus.json` and the project-level `.caduceusrc`. JSONC tolerant on read. Atomic write via `tmp + rename`. |
| `slash-commands.ts` | No (factory) | Exports a single `registerSlashCommands(pi, deps)` function. No top-level side effects. |
| `extensions/caduceus.ts` | No (entry) | Default export `function(pi: ExtensionAPI)`. Wires all of the above. The ONLY file that touches `pi`. |

### 4.3 Data flow on every LLM call

```text
user input
   │
   ▼
pi runtime
   │
   ▼
emit before_agent_start
   │
   ▼
caduceus.ts:
   readConfig()  ──► config-store.ts
   detectLocale(text, env, config)  ──► locale-detect.ts
   buildPersonaPrompt(mode, locale)
      ├─► persona-contract.ts  (loads prompts/*.md at module load)
      └─► language-clause.ts
   return { systemPrompt: `${event.systemPrompt}\n\n${persona}` }
   │
   ▼
pi runtime uses updated systemPrompt for the LLM call
```

## 5. Affected areas

This is a **greenfield package** — no existing files in the caduceus
repo are modified because there are none beyond `INIT.md` and
`openspec/`. The "affected areas" are entirely the new files in
`§4.1`.

External touchpoints:

- `npm` registry (new package `pi-caduceus`)
- `pi.dev` gallery (auto-indexed on first publish, per
  `pi.dev/docs/latest/packages`)
- GitHub `lyssom/pi-caduceus` repository (under the existing `lyssom`
  GitHub user account — no separate org needed; see R-3)

## 6. Persona contract — DNA-2 in practice

The persona is **a deterministic prompt transformation function**
with documented inputs and outputs. Every line of the rendered
prompt must be traceable to a source:

| Rendered line | Source |
|---|---|
| `## el Gentleman Identity and Harness` | `prompts/gentleman.md` §1 (or `prompts/neutral.md` §1) |
| `Current persona mode: ...` | `persona-contract.ts` — assembled at runtime |
| `## Persona` block | `prompts/gentleman.md` §2 (verbatim from gentle-pi lines 258–266) |
| `## Identity contract` block | `prompts/gentleman.md` §3 (verbatim from gentle-pi lines 282–294) |
| `## Language boundary` line | `language-clause.ts` — function of `(locale, mode)` |
| `## Harness principles` block | `prompts/gentleman.md` §4 (verbatim from gentle-pi lines 300–308) |

`/caduceus:inspect` prints the rendered prompt with source line
provenance (`prompts/gentleman.md:L4` etc.) so every assertion in
the test suite is traceable. This is DNA-2 in
`INIT.md §4` made testable.

## 7. Configuration model

### 7.1 `~/.pi/agent/caduceus.json` (machine-managed)

```jsonc
{
  "mode": "gentleman",                    // "gentleman" | "neutral" | "auto"
  "locale": "auto",                       // "auto" | "es-AR" | "es-ES" | "en" | "zh" | string
  "showStatusBar": false,                 // see §9 Q1
  "allowProjectOverride": true            // .caduceusrc may override
}
```

### 7.2 `.caduceusrc` (human-managed, JSONC)

Project-level override. **Only** read if `allowProjectOverride: true`
in the global config. Supports `//` and `/* */` comments. Read
order: project `.caduceusrc` → global `~/.pi/agent/caduceus.json`
→ built-in defaults. First source wins per field.

### 7.3 Built-in defaults

```jsonc
{
  "mode": "gentleman",
  "locale": "auto",
  "showStatusBar": false,
  "allowProjectOverride": true
}
```

## 8. Risk register (carried from `init.md §7` + exploration)

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | pi-coding-agent API mismatch | — | — | **RESOLVED** — API verified at v0.84.1 |
| R-2 | pi-tui peer requirement | — | — | **RESOLVED** — not needed in v0.1.0 |
| R-3 | `lyssom` GitHub org does not exist | medium | medium | **RESOLVED post-apply** — package now unscoped `pi-caduceus`; repo goes under the existing `lyssom` GitHub user account. Out-of-band: `gh repo create lyssom/pi-caduceus --public --source=. --remote=origin --push`. |
| R-4 | pnpm@11.1.1 may be missing | low | low | Test command uses system Node, not pnpm. `packageManager` field is **omitted** from `package.json` to avoid locking non-pnpm users. README recommends pnpm but does not require it. |
| R-5 | Gallery `image` field requires HTTPS URL we don't have | low | low | `pi.image` is **omitted** for v0.1.0. Card is text-only. v0.1.1 adds the banner when designed. |
| R-6 | `packageManager` field would lock non-pnpm users | low | low | **Omit** the field. README recommends pnpm only. |

No new risks introduced by this proposal.

## 9. Open decisions (locked by proposal question round, 2026-01)

The proposal question round surfaced three product decisions. All
three were answered with the recommended default:

### Q1 — Status bar default

**Decision: OFF (opt-in).**

The `session_start` event handler still registers a status-bar
hook, but when `showStatusBar: false` (the default) it does not
call `ctx.ui.setStatus()`. The footer looks identical to a
non-caduceus session. To turn it on, the user edits `.caduceusrc`
or runs `/caduceus:status` and follows the hint.

Why: caduceus is the persona contract, not a visible brand
surface. Users who want the status indicator will find it; users
who don't will not be annoyed by a permanent footer line.

### Q2 — v0.1.0 UI strings

**Decision: ENGLISH ONLY.**

All `/caduceus:*` slash command descriptions, output messages,
status line text, and the inspect report are in English. The
**persona prompt** itself remains bilingual-aware (the voseo
clause fires when the user writes Spanish) — that is a different
layer (the model's response language), not the UI.

Why: matches `INIT.md §3.2`'s explicit "Multilingual UI strings
out of scope for v0.1.0". Reduces test surface and doc surface.
Roadmap: v0.1.1 introduces `i18n/en.json` + `i18n/es.json` (and
optionally `zh.json`).

### Q3 — Logo / banner in v0.1.0

**Decision: NO LOGO, NO BANNER.**

`package.json` `pi` manifest does NOT include `image` or
`video`. The pi.dev gallery card shows just the package name
(`pi-caduceus`), description, and keywords. Card looks
bare next to gentle-pi's logo-bearing card, but this is the
intentional brand-positioning move per `INIT.md §6`: the absence
of decoration is the decoration.

Why: zero-blocker; keeps v0.1.0 shippable today. Banner design
moves to v0.1.1 as a deliberate brand pass.

## 10. Proposal question round — record

Per `sdd-proposal.md`'s interactive-mode rule, the following
3 questions were asked before finalizing this proposal:

```text
Q1. 状态条默认开/关？  → A (关，opt-in)
Q2. v0.1.0 UI 英文 only 行吗？  → A (英文 only)
Q3. logo / banner 资产？  → A (v0.1.0 不上)
```

The user confirmed "无" (no second round, no corrections). These
answers are captured above in §9 as locked decisions for the
spec, design, tasks, apply, verify, sync, and archive phases.

## 11. Rollback

Caduceus is purely **additive** to a pi install. Removing the
package (`pi remove npm:pi-caduceus`) reverts the
session to the un-injected system prompt. No data is written
outside `~/.pi/agent/caduceus.json` and optional project
`.caduceusrc`. Removing those two files is a full uninstall —
no leftover state.

If a published v0.1.0 turns out to have a serious bug, the
recovery path is:

1. `pi remove npm:pi-caduceus`
2. `npm unpublish pi-caduceus@0.1.0` (within npm's 72h
   window — fail-closed after that)
3. Publish `0.1.1` with the fix and a `CHANGELOG.md` entry
4. Document the incident in a `docs/incidents/2026-01-caduceus-0.1.0.md`

For pre-publish rollback (i.e. before `npm publish`): `git reset
--hard <last-good-commit>` and resume. No external state to
clean up.

## 12. Success criteria (mirrors `init.md §4`)

1. `pnpm test` (or `node --experimental-strip-types --test
   tests/*.test.ts`) exits 0 on a clean checkout.
2. `npm view pi-caduceus` resolves to this package after
   publish.
3. `pi install npm:pi-caduceus` registers the extension,
   theme, and prompts from this package; `/caduceus:status`
   appears in the slash command list.
4. All 6 non-negotiable invariants in `AGENTS.md §"Non-negotiable
   invariants"` are asserted by the test suite and pass.
5. `/caduceus:inspect` returns byte-stable output for the same
   inputs (verified by `slash-commands.test.ts`).
6. `package.json` has 0 entries in `dependencies`, 0 entries in
   `devDependencies` (test runner is system Node), 0 `postinstall`
   script, and 0 native binaries in the tarball.
7. The persona text in `prompts/gentleman.md` and
   `prompts/neutral.md` is byte-for-byte identical to the
   citations from gentle-pi lines 258–266 and 268–277 — verified
   by `persona-contract.test.ts` reading both files and asserting
   the voseo / no-voseo invariant clauses appear.

## 13. Out-of-band actions (required before publish, not in this change)

These are explicitly the user's responsibility, not the
`apply` or `verify` phase:

1. **Create the `pi-caduceus` repo under the `lyssom` GitHub user
   account** — `gh repo create lyssom/pi-caduceus --public
   --source=. --remote=origin --push` (no org creation or
   `admin:org` scope refresh needed; `lyssom` is an existing
   GitHub user).
2. **One-time `npm login`** (no `--scope` needed; package is unscoped
   `pi-caduceus`).
3. **`npm publish --access=public`** from the caduceus repo root.
   `npm publish` from a local machine).

These do not block SDD completion. They block the
`sdd-archive` → real-world-npm-publish handoff.

## 14. Next phase

`sdd-spec` — write delta specs capturing the requirements that
this proposal implies. Will produce:
- `openspec/changes/caduceus-v0.1.0/spec.md` (delta spec)
- `openspec/changes/caduceus-v0.1.0/specs/persona/spec.md`
  (new canonical capability for "persona contract")
- `openspec/changes/caduceus-v0.1.0/specs/locale-detection/spec.md`
  (new capability)
- `openspec/changes/caduceus-v0.1.0/specs/configuration/spec.md`
  (new capability)

Specs will use RFC 2119 requirement language (MUST, SHOULD, MAY)
and Given/When/Then scenarios for the 6 invariants.
