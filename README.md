# pi-caduceus

[![npm version](https://img.shields.io/npm/v/pi-caduceus.svg?style=flat-square)](https://www.npmjs.com/package/pi-caduceus)
[![npm downloads](https://img.shields.io/npm/dm/pi-caduceus.svg?style=flat-square)](https://www.npmjs.com/package/pi-caduceus)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![0 deps](https://img.shields.io/badge/dependencies-0-green.svg?style=flat-square)](package.json)
[![Tests: 387](https://img.shields.io/badge/tests-387%20pass-brightgreen.svg?style=flat-square)](https://github.com/lyssom/pi-caduceus)
[![pi.dev](https://img.shields.io/badge/pi.dev-catalog-purple.svg?style=flat-square)](https://pi.dev/packages)

> **Persona-aware Spec-Driven Development lifecycle harness for [pi](https://pi.dev).**
> 10 built-in caduceus-original personas, a 5-MD-file SDD change
> lifecycle (explore → propose → apply → archive), a 6-state review
> machine with content-bound receipts, and 5 static-analysis lenses
> (risk/correctness/security/readability/spec-compliance) with P0–P3
> severity. 0 runtime dependencies · 0 native binaries · 0 postinstall.

## TL;DR

```bash
pi install npm:pi-caduceus

# In any pi session:
/caduceus:sdd:init my-feature            # create openspec/changes/my-feature/
/caduceus:sdd:explore <topic>          # requirements.md skeleton
/caduceus:sdd:propose my-feature        # render proposal.md
/caduceus:sdd:apply                     # mark completed tasks
/caduceus:review:start my-feature security   # persona-required lenses track
/caduceus:review:finalize my-feature    # writes content-bound receipt
/caduceus:sdd:archive                   # move to openspec/changes/archive/
```

## Why pi-caduceus?

| Feature | pi-caduceus | gentle-pi | dracond |
|---|---|---|---|
| **Persona layer** | ✅ 10 built-in, byte-stable, lint-tested | ✅ 1 persona, brand-locked | ❌ |
| **SDD lifecycle** | ✅ 5-MD-file (proposal/design/tasks/requirements/constitution) | ✅ 5-MD-file | ✅ goal-queue |
| **Review state machine** | ✅ 6-state + content-bound receipt | ✅ Minisign-signed receipt | ✅ detached auditor |
| **Static-analysis lenses** | ✅ 5 lenses, P0–P3 severity | ❌ | ❌ |
| **Subagent orchestration** | ⏳ v0.7.0 | ❌ | ❌ (delegated to pi-subagents) |
| **Goal loop + budget** | ⏳ v0.8.0 | ✅ native | ✅ mission-control |
| **Runtime deps** | **0** | 0 | 0 |
| **Native binaries** | **0** | yes (runtime/) | 0 |
| **Postinstall** | **0** | yes | 0 |
| **Tarball** | ~116 kB | ~7.6 MB | ~545 kB |
| **LOC** | ~7,300 | ~56,000 | ~28,000 |
| **License** | MIT | MIT | AGPL-3.0 |

**Positioning**: caduceus is the **focused middle ground** between
feature-bloated (gentle-pi, dracond) and feature-thin (one-file loaders).
It does the persona+SDD+review+lens core well in ~7 kLOC of pure TS,
leaves room to grow into subagent/goal layers in v0.7.0/v0.8.0,
and bridges to nothing — every referenced pattern is re-implemented
from scratch under MIT to preserve brand independence.

## Install

```bash
pi install npm:pi-caduceus
# or
npm install -g pi-caduceus
```

That's it. No native binaries download, no postinstall script runs.
`pi` loads the extension and registers 21 slash commands on session
start (`/caduceus:status`, `/caduceus:persona <name>`, `/caduceus:sdd:*`,
`/caduceus:review:*`).

## What's in the box

### 10 built-in personas (`prompts/`)

`default`, `plain`, `concise`, `reviewer`, `teacher`, `security`,
`debugger`, `socratic`, `architect`, `pirate`. Drop your own at
`~/.pi/agent/caduceus/personas/<name>.md` (global) or
`.caduceus/personas/<name>.md` (project). `/caduceus:lint` enforces
8 structural checks (ID block, persona block, principles block,
no-timestamp, `${mode}` placeholder, conflicting-voice markers, …).

### Spec-Driven Development (`lib/sdd-templates.ts`)

5-MD-file change artifact: `proposal.md`, `design.md`, `tasks.md`,
`requirements.md`, `constitution.md`. The `tasks.md` template
(v0.6.0+) includes an optional `**Done when:**` contract per task;
the `correctness` lens fires on v0.6.0+-marker changes to enforce it.
The `constitution.md` carries RFC 2119 levels (MUST/SHOULD/MAY) + CWE
mappings; 5-check `constitution-lint` guards conformance.

### Review state machine (`lib/review-state-machine.ts`)

6-state machine: `idle → started → in-review → finalized → validated`,
plus terminal `abandoned` and synthetic `corrupted`. Receipt is
content-bound SHA-256 over the 5 MD files (no crypto signing; design
choice documented in `docs/RESEARCH.md §2`). v0.6.0+ receipts carry
per-lens findings in `lensRuns: LensRunDetail[]`.

### 5 static-analysis lenses (`lib/lens/`)

| Lens | Severity | Detects |
|---|---|---|
| `risk` | P1/P2/P3 | `BREAKING`/`DEPRECAT` keyword (P1); ≥3 `TODO`/`FIXME` markers (P2); >10 files in change dir (P3) |
| `correctness` | P1/P2 | `design.md` references `REQ-NNN` not in `requirements.md` (P1); `CON-NNN` not in `constitution.md` (P2); `**Done when:**` missing on v0.6+ tasks (P2) |
| `security` | P0/P1 | MUST/SHALL-level `CON-NNN` lacking `CWE` field (P0); secret keywords `password`/`api_key`/`token`/`secret` (P1); `curl\|sh`/`wget\|sh`/`sudo` (P1) |
| `readability` | P2/P3 | MD file >200 lines (P2); `proposal.md` missing required sections (P2); depth-5+ headings (P3) |
| `spec-compliance` | P1/P2 | `REQ-NNN` declared but uncovered (P1); `proposal.md` §3 omits `changeName` (P2); `CON-NNN` declared but unreferenced (P2) |

Findings are capped at 20 per lens with `truncated: true`. Persona-aware
routing: `security → [security, risk]`, `reviewer → [readability,
spec-compliance]`, `architect → [spec-compliance, risk]`,
`debugger → [correctness]`.

### Profile system

Save/load whole config sets as named profiles (mode + locale +
systemPromptMode + persona). Storage:
`~/.pi/agent/caduceus/profiles/<name>.json` (global) and
`.caduceus/profiles/<name>.json` (project, shadows global).

### Brand independence

`scripts/verify-package.mjs` enforces 17 pre-publish invariants,
including a grep for `el Gentleman`/`Rioplatense` (gentle-pi
content) and an import-block on `pi-review`/`pi-agents`/`dracond`/
`pi-muselinn-harness`. caduceus references their patterns at the
design level (in `docs/RESEARCH.md §2` + `STATUS.md §8`) and
re-implements in pure TS from scratch.

## What's NOT in v0.6.0 (deliberately)

| Feature | Status | Reason |
|---|---|---|
| Subagent orchestration | v0.7.0 | Plan: persona-aware subagent routing |
| Goal loop + budget | v0.8.0 | Triple budget (token + turn + wallClock) |
| LLM-based lens | never | Would break 0-deps invariant |
| Network calls in lens | never | Static analysis only |
| Detached auditor process | v0.8.0+ evaluation | Trigger: lens false-negative > 20%; AGPL-3.0 isolation |

## Architecture (DNA-3)

```
+---------------------+
|       pi (host)     |
+---------------------+
   |
   v
+---------------------+
|  extensions/caduceus.ts  |  <- SHELL (the only file that imports from pi)
+---------------------+
   |
   v
+---------------------+
|  lib/  (~24 pure-TS modules) |  <- MEAT (testable in plain node)
|  - persona-contract    |
|  - persona-lens-router |
|  - review-state-machine|
|  - review-receipt     |
|  - sdd-templates       |
|  - sdd-flow           |
|  - constitution-lint  |
|  - lens/{risk,correctness,security,readability,spec-compliance}  |
+---------------------+
```

The `lib/` modules are pure functions over their inputs. The shell
in `extensions/caduceus.ts` is a thin binding that wires the slash
commands and `before_agent_start` hook. This separation means **all
387 tests run with plain `node --test`**, no jest, no vitest, no
native test runner.

## Testing & verification

```bash
npm test           # 387 tests, 0 failures
node scripts/verify-package.mjs   # 17 pre-publish checks
```

Both run on plain Node 22+ with `--experimental-strip-types`. No
build step, no TypeScript compile, no native deps.

## License

MIT. See [LICENSE](LICENSE).

## Acknowledgments

Patterns referenced (re-implemented in pure TS, never imported):

- **gentle-pi** (`Gentleman-Programming/gentle-ai`) — persona layer,
  5-MD-file SDD, review state machine
- **dracond** (`DraconDev/pi-goal-list-loop-audit`) — detached
  auditor worker process, regression shield, mission-control goal
  loop (referenced for v0.8.0+ evaluation; AGPL-3.0 isolated)
- **pi-muselinn-harness** — triple-budget goal loop (referenced for
  v0.8.0)
- **pi-review** — P0/P1/P2/P3 priority tier convention

See `docs/RESEARCH.md` and `STATUS.md §8` for full attribution.
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

## Lens Framework (v0.6.0)

caduceus v0.6.0 populates the v0.5.0 lens framework with 5 real
static-analysis implementations. When `/caduceus:review:finalize`
is called, the persona-required lenses run against the change
directory; findings are captured in the receipt's `lensRuns` field
and surfaced in `/caduceus:review:inspect` output.

| Lens | Severity | What it detects |
|---|---|---|
| `risk` | P1/P2/P3 | BREAKING/DEPRECAT keyword (P1); ≥3 TODO/FIXME markers (P2); >10 files in change dir (P3). |
| `correctness` | P1/P2 | design.md references REQ-NNN not in requirements.md (P1); CON-NNN not in constitution.md (P2); tasks.md missing `**Done when:**` (P2, gated by v0.6.0 marker); task with zero checkboxes (P2). |
| `security` | P0/P1 | MUST/SHALL-level CON-NNN lacking CWE field (P0); secret keywords in tasks/design (P1); risky shell patterns curl\|sh / wget\|sh / sudo (P1). |
| `readability` | P2/P3 | MD file >200 lines (P2); proposal.md missing required sections (P2); depth-5+ headings (P3). |
| `spec-compliance` | P1/P2 | REQ-NNN in requirements.md not covered by any task (P1); proposal.md §3 Scope omits changeName (P2); CON-NNN not referenced in proposal/design (P2). |

### Severity tiers

| Tier | Caduceus meaning |
|---|---|
| `P0` | Critical — must-fix. (caduceus reports only; does NOT auto-block in v0.6.0.) |
| `P1` | Warning — review and decide. |
| `P2` | Info — readability / consistency issue. |
| `P3` | Style / minor — consider fixing. |

### Persona → lens routing

| Persona | Required lenses |
|---|---|
| `security` | `security`, `risk` |
| `reviewer` | `readability`, `spec-compliance` |
| `architect` | `spec-compliance`, `risk` |
| `debugger` | `correctness` |
| (others) | (none — non-binding) |

The `default` and `plain` personas allocate no lenses; v0.5.0
receipts (with `lensRuns: []`) still validate via
`/caduceus:review:validate`.

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
