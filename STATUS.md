# caduceus — current state and design rationale

> **This is the canonical reference for the caduceus project.**
> For the original v0.1.0 seed (which included the gentle-pi byte-mirror
> design DNA), see `INIT.md`. That design was substantially revised in
> v0.3.0; this document reflects the current state.

## 1. What caduceus is

**caduceus is a persona-aware general-purpose lifecycle harness for
the [pi](https://pi.dev) coding agent.** It injects a deterministic,
testable, byte-citable persona prompt segment before the first token
of a pi session, given `(mode, locale)`, AND drives a full
Spec-Driven Development lifecycle (explore → propose → apply →
archive) plus an optional review state machine, with the active
persona carrying through every phase.

**caduceus references but does not bridge to other pi packages**
(`pi-review`, `pi-agents`, `dracond`, `pi-muselinn-harness`); it
ships a complete, independent implementation.

**caduceus is NOT a fork of gentle-pi.** It was originally inspired
by gentle-pi's persona layer, but as of v0.3.0, caduceus has shed
all "el Gentleman" / "voseo" / "Rioplatense" content. The two products
are **independent and benchmark each other**, not derivatives.

```
+---------------------+
|       pi (host)     |
+---------------------+
   /              \
  /                \
+--------+    +-----------+
| gentle |    | caduceus  |
|   -pi  |    |   v0.4.0  |
+--------+    +-----------+
| SDD    |    | persona   |
| review |    | contract  |
| skills |    | + macros  |
| agents |    | + profile |
+--------+    +-----------+
  "full          "focused
   senior        persona
   dev           contract
   harness"      layer"
```

## 2. v0.5.0 snapshot (current shipped release)

| Dimension | Value |
|---|---|
| npm | `pi-caduceus@0.4.0` |
| Source files (non-test) | 32 |
| Lines of source (TS/MJS) | ~5,814 |
| Tarball size | 52.9 kB |
| 0 runtime deps | ✓ |
| 0 native binaries | ✓ |
| 0 postinstall | ✓ |
| Tests | 186 across 13 files |
| Pre-publish verify checks | 14 (incl. brand-independence grep) |
| Built-in personas | 10 |
| Slash commands | 14 |

### 2.1 What ships in v0.5.0

**Personas (10 built-in, all caduceus-original):**
- `default` — senior developer / architect voice
- `plain` — minimal voice
- `concise` — 1-3 sentence answers
- `reviewer` — code review with BLOCKER/SHOULD/NIT severity
- `teacher` — patient teacher
- `security` — paranoid security engineer
- `debugger` — methodical debugger
- `socratic` — Socratic teacher
- `architect` — systems architect
- `pirate` — easter egg (playful voice, technically accurate)

**Modes (3):** `default` / `plain` / `auto`

**Slash commands (14):**
- `/caduceus:status` — show effective config
- `/caduceus:mode <default|plain|auto>` — switch persona mode
- `/caduceus:locale <auto|es-AR|es-ES|en|zh>` — set locale
- `/caduceus:persona <name|list>` — switch persona; old names accepted with deprecation warning
- `/caduceus:prompt <append|replace>` — how to inject the persona
- `/caduceus:inspect` — show rendered persona prompt
- `/caduceus:lint` — run static checks on the active persona
- `/caduceus:create <name> <description>` — generate a new persona
- `/caduceus:diff [a [b]]` — diff two personas
- `/caduceus:profile <list|save|load|delete|show> <name>` — manage config profiles

**Persona macros (5):** `${userName}`, `${projectName}`, `${cwd}`, `${date}`, `${os}` (plus the existing `${mode}`)

**Persona filesystem discovery:**
- `~/.pi/agent/caduceus/personas/<name>.md` (global)
- `<cwd>/.caduceus/personas/<name>.md` (project)
- Precedence: project > global > built-in

**Profile system:** save/load/list/delete/show whole config sets; stored at `~/.pi/agent/caduceus/profiles/<name>.json` (global) and `<cwd>/.caduceus/profiles/<name>.md` (project)

**Lint (persona: 8 + constitution: 5 = 13 checks):**
    - Persona: IDENTITY_BLOCK, PERSONA_BLOCK, PRINCIPLES_BLOCK, NO_TIMESTAMP, PLACEHOLDER (required `${mode}`), CONFLICTING_VOICE_MARKERS, plus 2 more (linter helpers)
    - Constitution: CONSTITUTION_EXISTS, CONSTITUTION_RFC2119 (MUST / SHOULD / MAY), CONSTITUTION_CWE_MAPPING (MUST-level must have CWE), CONSTITUTION_COUNT (0 → error, only-MAY → warning), CONSTITUTION_NO_DUPLICATE_IDS

**Review state machine (6 states):** idle → started → in-review → finalized → validated; plus `abandoned` (terminal). Transitions enforced server-side; receipt is content-bound SHA-256 over 5 MD artifacts (no crypto signing).

**Persona-aware lens framework (5 slots):** risk / correctness / security / readability / spec-compliance. 4 binding personas trigger lens requirements (security → [security, risk]; reviewer → [readability, spec-compliance]; architect → [spec-compliance, risk]; debugger → [correctness]).

**SDD templates (5):** proposal / design / tasks / requirements / constitution — byte-stable renderers in lib/sdd-templates.ts; each carries `<!-- caduceus:<id>-template-version 0.5.0 -->` marker.

**Lens registry version:** LENS_REGISTRY_VERSION = 1; receipts carry this number so version drift is detectable (design.md §12 R2).

**Backward compat:** v0.2.0 → v0.3.0 name migration (`gentleman` → `default`, `neutral` → `plain`) with `console.warn`

## 3. Design philosophy (DNA)

From `INIT.md` §4, refined by v0.3.0's brand-independence decision:

### DNA-1: Shell vs Meat (refined)

Originally: the extension entry is the **shell** (talks to pi); the
`lib/` modules are the **meat** (pure, testable).

v0.4.0 refinement: the **meat** is now substantial. The shell is a thin
binding in `extensions/caduceus.ts`; the meat (`lib/persona-contract`,
`lib/language-clause` removed in v0.3.0, `lib/locale-detect`,
`lib/macros`, `lib/lint`, `lib/wizard`, `lib/diff`, `lib/profile-store`,
etc.) does all the work and is testable in isolation.

### DNA-2: Persona is a contract, not a costume

Originally: a persona is a deterministic prompt transformation function
with documented inputs and outputs.

v0.3.0+ refinement: the function is a *testable contract*, not a copy
of another package's persona. Every persona must pass `/caduceus:lint`
(structural, byte-stability, conflicting-voice, unknown-macro checks).
The persona is "correct" only if the contract is satisfied.

### DNA-3: Light at the core, evolve into persona-aware harness (v0.5.0 revision)

**DNA-3-revised**: Light at the core, evolve into persona-aware
harness, compose internally only.

- **Persona engine** remains 0-deps / 0-native / 0-postinstall.
- **Lifecycle harness layer** (SDD commands, review state machine,
  advisory lint, constitutional constraints) is added incrementally
  across v0.5.0 → v0.8.0. Each phase ships pure-TS implementations;
  no native binaries, no crypto dependencies (content-bound JSON
  receipts use SHA-256 via node:crypto).
- **caduceus does NOT bridge to external pi packages** — composition
  is internal (persona + SDD + review) only. Mechanical enforcement
  in `scripts/verify-package.mjs` (Checks 15/16/17).

v0.5.0: ~60 KB tarball, 309 tests, 0 source dependencies on
gentle-pi / pi-review / pi-agents / dracond / pi-muselinn-harness.

## 4. The v0.3.0 brand-independence decision

**Before v0.3.0:** caduceus shipped 2 personas (`gentleman`, `neutral`)
that were byte-for-byte copies of `gentle-pi/extensions/gentle-ai.ts`
lines 258-308. The identity contract block in every prompt file
referenced "el Gentleman". v0.1.0 and v0.1.1 personas were locked
to gentle-pi content.

**The v0.3.0 decision (user explicit, 2026-08):** caduceus is an
independent product. We benchmark against gentle-pi but do not
depend on it. Therefore:
- All "el Gentleman" content removed
- All "voseo" / "Rioplatense" content removed
- Persona names renamed (`gentleman` → `default`, `neutral` → `plain`)
- v0.2.0 names accepted as deprecated input with auto-migration
- 10 brand-new personas replace the 2 gentle-pi-mirror ones
- `verify-package.mjs` automatically greps for forbidden strings and
  fails the build if any are found in the source

**Why this matters for future work:** do not re-introduce any
gentle-pi-derived content (persona text, language clause, naming).
The `verify-package.mjs` grep is the enforcement.

## 5. Comparison with gentle-pi v2.1.2

gentle-pi is the closest comparable product: senior-architect development
harness for pi (v2.1.2, 55,973 lines of TS/MJS, ~600 npm downloads/mo).
caduceus positions itself as the **focused persona layer** to
gentle-pi's **full senior-dev harness**.

### 5.1 By the numbers

| Dimension | gentle-pi v2.1.2 | caduceus v0.4.0 | Ratio |
|---|---|---|---|
| Lines of source (TS/MJS) | 55,973 | 5,814 | **9.6× lighter** |
| Source files (non-test) | 242 | 32 | **7.6× fewer** |
| extensions | 7 | 1 | 7× |
| lib modules | 18 | 13 | 1.4× |
| prompts | 5 | 10 | caduceus 2× |
| skills | 13 | 0 | — |
| slash commands | 13 | 14 | comparable |
| tests | ~hundreds | 186 | — |
| tarball size | unknown | 52.9 kB | — |
| runtime deps | 0 | 0 | tie |
| native binaries | yes (`runtime/`) | 0 | — |
| 0 postinstall | no (build scripts) | yes | — |
| built-in personas | 1 (el Gentleman) | 10 | caduceus 10× |

### 5.2 By feature area

| Feature | gentle-pi | caduceus |
|---|---|---|
| **SDD/OpenSpec workflow** | ✓ full | ✗ (intentionally out of scope) |
| **Subagents / phase agents** | ✓ full | ✗ (intentionally out of scope) |
| **Review tooling** | ✓ native review CLI | ✗ (intentionally out of scope) |
| **PR / commit workflow** | ✓ 13 skills | ✗ (intentionally out of scope) |
| **Built-in personas** | 1 | 10 |
| **Persona filesystem discovery** | ✗ | ✓ global + project paths |
| **Persona macros** (runtime) | ✗ | ✓ 5 macros |
| **Persona lint** | ✗ | ✓ 8 static checks |
| **Persona diff** | ✗ | ✓ self-implemented Myers |
| **Persona wizard** | ✗ | ✓ template-based (no LLM dep) |
| **Profile system** | ✗ | ✓ save/load/list/delete |
| **Persona contract verification** | ✗ | ✓ `/caduceus:lint` |
| **Source-code brand check** | ✗ | ✓ `verify-package.mjs` grep |
| **Brand independence** | ✗ (is "el Gentleman") | ✓ (v0.3.0+) |
| **Backward-compat migration** | ✗ (no prior version) | ✓ v0.2.0→v0.3.0 name map |

### 5.3 The non-overlap principle

**Zero slash command overlap.** caduceus's 14 commands are all
persona-related (`mode`, `persona`, `lint`, `create`, `diff`,
`profile`, etc.). gentle-pi's 13 commands are all workflow-related
(`sdd-init`, `sdd-continue`, `gentle:review-mode`,
`gentle:commit-status`, etc.). The two products do not duplicate
each other.

**Why this matters:** the two products can be **installed together
without conflict**. caduceus does not depend on gentle-pi; gentle-pi
does not depend on caduceus.

### 5.4 Decision matrix: which to use

| Your need | Use | Why |
|---|---|---|
| Full SDD cycle + review gate + subagents + goal loop | caduceus | complete lifecycle in one package |
| Persona injection, no extra ceremony | caduceus | focused, light persona layer |
| Multiple work contexts (work / learning) | caduceus | profiles are caduceus-only |
| Personas that auto-reference user / project / cwd | caduceus | macros are caduceus-only |
| Persona-free model (no voseo, no Rioplatense) | caduceus | language-neutral |
| Concerned about native binaries / postinstall | caduceus | 0 native, 0 postinstall |
| Persona-aware review gate (Constitutional constraints) | caduceus | MUST/SHOULD/MAY + CWE |
| Crypto-signed receipts | gentle-pi | Minisign; not in caduceus Phase A |
| Migrating from gentle-pi | caduceus | drop-in for the persona layer; review/sdd equivalents available |

## 6. Architecture

```
caduceus/
├── extensions/caduceus.ts        # SHELL — only file that imports from pi
├── lib/
│   ├── persona-contract.ts       # (mode, locale) → rendered prompt
│   ├── persona-loader.ts         # filesystem discovery
│   ├── locale-detect.ts          # text → locale
│   ├── lint.ts                   # static persona checks
│   ├── prompt-mode.ts            # append/replace composition
│   ├── slash-commands.ts         # 9 slash commands (with v0.3.0 deprecation + v0.4.0 profile)
│   ├── wizard.ts                 # template-based persona generation
│   ├── diff.ts                   # hand-rolled Myers diff
│   ├── macros.ts                 # ${userName} etc. runtime substitution
│   ├── profile-store.ts          # save/load/list/delete profiles
│   ├── config-store.ts           # read/write caduceus.json + migrations
│   ├── errors.ts                 # CaduceusError + subclasses
│   └── version.ts                # CADUCEUS_VERSION = "0.4.0"
├── prompts/                      # 10 persona files
├── themes/caduceus.json          # sea-blue (#1B4D7A) starter theme
├── tests/                        # 13 test files
├── scripts/verify-package.mjs    # 14 pre-publish checks (incl. brand grep)
├── openspec/                     # SDD artifacts (the planning history)
├── STATUS.md                     # this file
├── INIT.md                       # v0.1.0 seed (historical; superseded by STATUS.md)
├── CHANGELOG.md                  # version history
├── README.md                     # user-facing docs
├── LICENSE                       # MIT
└── package.json
```

## 7. Roadmap (v0.6.0 → v0.8.0)

### v0.6.0 (Phase B — full lens collection)

- Implement the 5 lens slots with real `run` functions:
  - `risk` — surface high-impact changes
  - `correctness` — invariant + regression scan
  - `security` — CWE/MITRE-aware security review
  - `readability` — naming, structure, comment coverage
  - `spec-compliance` — task ↔ spec alignment check
- Promote `resetReview` from no-op stub to full archive + clear
  logic (currently a stub wired in extensions/caduceus.ts).

### v0.7.0 (Phase C — subagent orchestration)

- Persona-aware subagent routing: dispatch to sub-agents that
  inherit the active persona's voice and lens requirements.
- Parallel/sequential/reduce workflow primitives (mirroring
  pi-agents concepts, not depending on them).

### v0.8.0 (Phase D — goal loop + budget)

- Goal loop with triple budget (token + turn + wallClock),
  FIFO + priority queue.
- Persistent session state across goal executions.

### Deferred (was v0.5.0 P0 in v0.4.0 roadmap)

- Per-model variants: deferred; no user demand yet.
- LLM-generated persona (`/caduceus:generate`): deferred; the
  v0.5.0 lifecycle harness doesn't require it.
- Community gallery: premature at current adoption (~6 downloads/month).
- Persona effectiveness measurement: needs >100 downloads/month.

## 8. Decision records

Selected decisions that materially affected the project. New
decisions are appended to this list.

| Date | Decision | Rationale |
|---|---|---|
| 2026-01 (v0.1.0) | `pi-caduceus` as name, unscoped npm package | The name was already chosen (INIT.md §2) as the staff of Hermes, an independent mythological anchor. Unscoped because no npm scope was needed at v0.1.0. |
| 2026-01 (v0.1.0) | Mode names: `gentleman`, `neutral`, `auto` | The two non-`auto` names came from gentle-pi's `el Gentleman` design; caduceus was a "lighter subset" at v0.1.0. |
| 2026-01 (v0.1.0) | Built-in personas `gentleman` and `neutral` were byte-stable copies of `gentle-pi/extensions/gentle-ai.ts` lines 258-308 | Ensured the "byte-stable against gentle-pi" invariant in v0.1.0 tests. |
| 2026-08 (v0.3.0) | **All "el Gentleman" / "voseo" / "Rioplatense" content removed** | User explicit: "we are an independent product that benchmarks gentleman, not a derivative." Brand independence. |
| 2026-08 (v0.3.0) | Mode names renamed: `gentleman`→`default`, `neutral`→`plain` | The old names were gentleman-specific; new names are persona-agnostic. |
| 2026-08 (v0.3.0) | `lib/language-clause.ts` deleted | The voseo/Rioplatense Spanish clause was gentleman-specific. caduceus models are language-neutral. |
| 2026-08 (v0.3.0) | New personas added (8 caduceus-original) | Cover common dev scenarios without depending on gentle-pi. |
| 2026-08 (v0.3.0) | `verify-package.mjs` auto-grep for "el Gentleman" / "Rioplatense" in source | Mechanical enforcement of brand independence. |
| 2026-08 (v0.3.1) | `/caduceus:mode` and `/caduceus:persona` accept old names with deprecation warning | Backward compat for v0.2.0 users; auto-migration in `readConfig` for the config. |
| 2026-08 (v0.4.0) | Profile system added | The "I want different caduceus for different work contexts" use case is real. Files in `~/.pi/agent/caduceus/profiles/`. |
| 2026-08 (v0.4.0) | Persona macros (`${userName}` etc.) added | Personas need to reference runtime context (user, project, cwd) without being re-rendered for each session. |
| 2026-08 (v0.5.0) | caduceus evolves from persona contract to persona-aware lifecycle harness | Self-use demand + industry SD consensus + pi ecosystem maturity |
 | 2026-08 (v0.5.0) | Reference-but-not-bridge policy for external pi packages | Brand independence (extends v0.3.0 decision) |
 | 2026-08 (v0.5.0) | Constitution pattern adopted for change-level constraints | Marri 2026 Constitutional SDD pattern, lighter than state machine enforcement |
 | 2026-08 (v0.5.0) | Slash command grouping: flat for existing, grouped for new | Backward compat + progressive enhancement |
 
## 9. What this document is NOT

- **Not a marketing page.** That's the README.
- **Not a design doc.** That's `INIT.md` (for the v0.1.0 design) and
  `openspec/changes/caduceus-v0.X.Y/proposal.md` (for the per-version
  design).
- **Not a CHANGELOG.** That's `CHANGELOG.md`.
- **Not a TODO list.** Open issues / TODOs go in the issue tracker,
  not here.

This document is the **state-of-the-project reference**: what
caduceus is, what it does, what it doesn't, and why. If you're
new to the project, read this first. Then read `CHANGELOG.md`
for the version history and `INIT.md` for the original design
DNA (with the v0.3.0 caveat in mind).
