# Change: caduceus-v0.1.0

> **Status:** Init complete. Awaiting `explore` phase.
> **Date:** 2026-01
> **Owner:** `lyssom` (GitHub user account; no separate org — revised post-apply)
> **Source contract:** [`INIT.md`](../../../INIT.md)
> **Project context:** [`openspec/AGENTS.md`](../../AGENTS.md)
> **SDD config:** [`openspec/config.yaml`](../../config.yaml)

## 1. Intent

Ship **caduceus v0.1.0** — a Persona Contract package for pi that injects a
deterministic, testable, line-citable persona prompt segment before the
first token of a pi session, given `(mode, locale)`. This is the greenfield
realization of the locked decisions in `INIT.md §1`.

## 2. Why now

- `gentle-pi` already provides the persona contract in
  `extensions/gentle-ai.ts`, but it is coupled to the full review/SDD
  harness. A growing number of pi users want **only the persona
  contract**, not the rest of gentle-pi.
- The pi ecosystem has no dedicated "persona-as-contract" package.
  `pi-hermes-memory` is the only sibling named after Greek myth
  (Hermes = messenger); caduceus is the messenger's staff (contract
  layer above the messenger). Clean brand fit, no collision.
- `INIT.md` is the seed contract. Every locked decision and rationale is
  already recorded. This change just turns the seed into shipped code.

## 3. Scope (first slice = MVP-A from `INIT.md §3.1`)

In:

- `persona-contract.ts` — pure function `(mode, locale) → prompt string`.
- `language-clause.ts` — locale → clause selection.
- `locale-detect.ts` — detect from input / env / config.
- `config-store.ts` — read/write `~/.pi/agent/caduceus.json` + project
  override `.caduceusrc`.
- `slash-commands.ts` — `/caduceus:status`, `/caduceus:mode`,
  `/caduceus:locale`, `/caduceus:inspect`.
- `status-bar.ts` — TUI footer (gated by `showStatusBar`).
- `themes/caduceus.json` — sea-blue `#1B4D7A` starter theme.
- `prompts/gentleman.md`, `prompts/neutral.md` — full persona segments.
- Five test files enforcing invariants 1–6 from `AGENTS.md`.
- `extensions/caduceus.ts` — single entry that wires the above into pi.
- `package.json` with `pi` manifest, `keywords: ["pi-package"]`, zero
  runtime deps, MIT license.
- `README.md`, `LICENSE`, `.gitignore` (already present).

Explicitly **out** of scope (deferred to v0.2+):

- ❌ Native review tooling (rejected — `gentle-pi`'s job)
- ❌ SDD/OpenSpec flow inside the package (rejected — `gentle-pi`'s job)
- ❌ Subagent chains / phase agents (rejected)
- ❌ Delivery skills (branch-pr, chained-pr, comment-writer — `gentle-pi`)
- ❌ Postinstall hooks or native binary download
- ❌ Third-party runtime dependencies (target: 0)
- ❌ Multilingual UI strings (English-only UI in v0.1.0)

## 4. Success criteria

1. `pnpm test` exits 0 on a clean checkout.
2. `npm view pi-caduceus` resolves to this package after publish.
3. `pi install npm:pi-caduceus` registers the extension, theme,
   and prompts from this package.
4. The persona invariants in `AGENTS.md §"Non-negotiable invariants"` are
   all asserted by the test suite.
5. `caduceus inspect` returns byte-stable output for the same inputs.
6. The package has zero runtime dependencies, zero `postinstall` script,
   and zero native binaries.

## 5. Linked artifacts (to be created by subsequent phases)

| Phase | Artifact | Path |
|---|---|---|
| explore | `exploration.md` | `openspec/changes/caduceus-v0.1.0/exploration.md` |
| proposal | `proposal.md` | `openspec/changes/caduceus-v0.1.0/proposal.md` |
| spec | `spec.md` (+ delta specs) | `openspec/changes/caduceus-v0.1.0/spec.md` |
| design | `design.md` | `openspec/changes/caduceus-v0.1.0/design.md` |
| tasks | `tasks.md` | `openspec/changes/caduceus-v0.1.0/tasks.md` |
| apply | `apply-progress.md` | `openspec/changes/caduceus-v0.1.0/apply-progress.md` |
| verify | `verify-report.md` | `openspec/changes/caduceus-v0.1.0/verify-report.md` |
| sync | `sync-report.md` | `openspec/changes/caduceus-v0.1.0/sync-report.md` |
| archive | `archive-report.md` | `openspec/changes/caduceus-v0.1.0/archive-report.md` |

## 6. Open questions (from `INIT.md §8`)

| # | Question | Status | Resolution path |
|---|---|---|---|
| 1 | npm name | **RESOLVED** | `pi-caduceus` (B1) |
| 2 | owner / org | **RESOLVED** | `lyssom` (B2, **GitHub user account, no separate org** — revised after apply phase) |
| 3 | GitHub repo name | **RESOLVED** | `lyssom/pi-caduceus` (B3, follows B1) |
| 4 | LICENSE | **RESOLVED** | MIT (B4) |
| 5 | Logo / banner assets | OPEN | Defer to v0.1.1 unless required for publish |
| 6 | English-only UI | OPEN | Defer to explore phase for explicit confirmation |
| 7 | Status bar default | OPEN | Defer to explore phase for explicit confirmation |

## 7. Risks tracked at init

- **R-1 (high):** the `pi-coding-agent` extension API surface is not yet
  snapshotted in our context. The apply phase must read
  `node_modules/@earendil-works/pi-coding-agent/README.md` and the actual
  `extensions/extension-types.d.ts` before wiring `caduceus.ts`.
- **R-2 (medium):** `pi-tui` peer for the status bar may not be
  re-exported as a peer; verify before adding the `status-bar.ts` task.
- **R-3 (RESOLVED post-apply):** Originally flagged the missing `lyssom` GitHub org and `admin:org` scope. **Revised after apply phase**: caduceus is published unscoped (`pi-caduceus`), no org needed. The repo lives under the existing `lyssom` GitHub user account, not a separate org. Out-of-band action simplified to `gh repo create lyssom/pi-caduceus --public` (no scope refresh required).
- **R-4 (low):** `pnpm@11.1.1` may not be installed on the apply host;
  fall back to `npm` if `pnpm` is missing — but document the divergence.

## 8. Pre-flight captured

```text
executionMode: interactive
artifactStore: openspec
chainedPrStrategy: single-pr-default
reviewBudget: 400
```

In interactive mode, after each phase the parent will stop, present the
artifact, and ask before continuing. Approval to start SDD is not
approval of any individual phase's output.

## 9. Next phase

`sdd-explore` — produce `openspec/changes/caduceus-v0.1.0/exploration.md`
covering: scope refinement, dependency surface, prior art in
`gentle-pi`, test posture, theme constraints, and any decision that
should be raised before `sdd-proposal`.
