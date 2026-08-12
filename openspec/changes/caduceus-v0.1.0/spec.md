# caduceus v0.1.0 — Delta Spec

> **Status:** Spec complete. Awaiting `design` phase.
> **Date:** 2026-01
> **Change:** `caduceus-v0.1.0`
> **Source contracts:** [`INIT.md`](../../../INIT.md), [`proposal.md`](./proposal.md), [`exploration.md`](./exploration.md), [`AGENTS.md`](../../AGENTS.md)

## Purpose

This is the **change-level delta spec** for the caduceus v0.1.0
greenfield. It documents which canonical capability domains are
being **added** (no existing canonical specs to modify or remove),
and indexes the per-domain specs.

The proposal (`proposal.md`) does not have an explicit
`## Capabilities` section. Per the sdd-spec agent rule, domains
are inferred from the affected areas in `proposal.md §3.1` /
`§4.1`:

| Inferred domain | Source modules | Spec path |
|---|---|---|
| **persona** | `lib/persona-contract.ts`, `lib/language-clause.ts`, `prompts/*.md`, persona-prompt segment of `extensions/caduceus.ts` | [`specs/persona/spec.md`](./specs/persona/spec.md) |
| **locale-detection** | `lib/locale-detect.ts` | [`specs/locale-detection/spec.md`](./specs/locale-detection/spec.md) |
| **configuration** | `lib/config-store.ts`, slash-command wiring in `extensions/caduceus.ts`, `lib/slash-commands.ts` | [`specs/configuration/spec.md`](./specs/configuration/spec.md) |

**Risk recorded:** the proposal did not enumerate capabilities
explicitly. The inference above is the parent orchestrator's best
read. If a reader disagrees with the split, the change is still
in draft (not yet applied) and the spec set can be re-bucketed
before `sdd-archive`.

## Change scope

### ADDED Domains

The change adds three new canonical capability domains. None of
them exist in `openspec/specs/` today (the directory is empty
since this is a greenfield package). At archive time, the
following files will be created in `openspec/specs/`:

```text
openspec/specs/persona/spec.md
openspec/specs/locale-detection/spec.md
openspec/specs/configuration/spec.md
```

### MODIFIED Domains

None. (Greenfield — no existing canonical specs to modify.)

### REMOVED Domains

None.

## Test coverage matrix

Every non-negotiable invariant from `AGENTS.md §"Non-negotiable
invariants"` MUST be expressed as a scenario in at least one
per-domain spec. The matrix below is the parent orchestrator's
falsifiability check.

| Invariant | Domain | Requirement | Scenario ID |
|---|---|---|---|
| #1 gentleman prompt has voseo clause | persona | R-PERSONA-002 | S-PERSONA-002-1 |
| #2 neutral prompt has no-voseo clause | persona | R-PERSONA-003 | S-PERSONA-003-1 |
| #3 no cross-mode leakage | persona | R-PERSONA-004 | S-PERSONA-004-1, S-PERSONA-004-2 |
| #4 byte-stable output | persona | R-PERSONA-005 | S-PERSONA-005-1 |
| #5 pi manifest declares extensions/themes/prompts/keywords | configuration | R-CONFIG-008 | S-CONFIG-008-1 |
| #6 npm scope unchanged | configuration | R-CONFIG-009 | S-CONFIG-009-1 |

The persona prompt source-text invariants (verifiable byte-for-byte
match against `gentle-pi/extensions/gentle-ai.ts` lines 258–266
and 268–277) are expressed as R-PERSONA-007 / R-PERSONA-008
inside the persona spec.

## Convention compliance

All per-domain specs in this change follow:

- RFC 2119 requirement keywords: `MUST`, `SHALL`, `SHOULD`,
  `MAY`, `MUST NOT`, `SHOULD NOT`, with the meanings from
  [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).
- Given/When/Then scenario bullets.
- At least one scenario per requirement.
- Requirement IDs prefixed by domain code (`R-PERSONA-`,
  `R-LOCALE-`, `R-CONFIG-`) and scenarios by
  `S-<DOMAIN>-<REQ>-<n>` for stable cross-referencing.

## Next phase

`sdd-design` — write `openspec/changes/caduceus-v0.1.0/design.md`
translating the three per-domain specs into a single coherent
technical design covering:

- File-by-file module interface contracts (function signatures,
  type exports).
- The single `before_agent_start` handler composition strategy.
- The `~/.pi/agent/caduceus.json` + `.caduceusrc` resolution order
  with the exact JSONC preprocessing algorithm.
- The strict-TDD forward declaration (test runner is
  `node --experimental-strip-types --test tests/*.test.ts`,
  RED-GREEN-TRIANGULATE-REFACTOR sequence).

Design will not invent new requirements; if a design decision
implies a new requirement, the spec is updated first and the
parent is informed.
