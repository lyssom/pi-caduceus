# caduceus v0.5.0 — Lifecycle Foundation (MAJOR)

> **Status:** Proposal draft. Awaiting `design` phase.
> **Date:** 2026-08
> **Change:** `caduceus-v0.5.0-lifecycle-foundation`
> **Source contracts:** [`STATUS.md §3 DNA-3` (to be amended)](../../../STATUS.md),
> [`openspec/AGENTS.md` non-negotiable invariants](../../AGENTS.md),
> prior post-v0.4.0 strategic analysis (this conversation)
> **Upstream:** v0.4.0 is live on npm + GitHub
> **Authority:** lyssom (project owner per `openspec/config.yaml`)

## 1. Intent

Ship **caduceus v0.5.0** — the first release of the **persona-aware
general-purpose lifecycle harness** evolution. v0.5.0 is Phase A of a
four-phase plan that takes caduceus from "persona contract package" to
"persona-aware lifecycle harness for the pi coding agent". It is the
minimum viable foundation on which Phases B/C/D build.

Six additions:

1. **SDD command layer** — five new slash commands under
   `/caduceus:sdd:*` (`init`, `explore`, `propose`, `apply`, `archive`)
   that drive the OpenSpec change lifecycle for a caduceus-managed project.
2. **Artifact extensions** — `requirements.md` (RFC 2119 / EARS-style)
   and `constitution.md` (MUST / SHOULD / MAY constraint document)
   join the existing `proposal.md` / `design.md` / `tasks.md` set.
3. **Review state machine skeleton** — five-state machine
   (`inspect` → `start` → `advance` → `finalize` → `validate`)
   implemented in pure TypeScript. No native binaries, no crypto
   signing. The skeleton is runnable end-to-end but ships with
   zero lens implementations; lens slots are reserved for Phase B.
4. **Persona-aware lens framework** — five lens slots
   (`risk`, `correctness`, `security`, `readability`, `spec-compliance`)
   wired into the persona system. Persona switching routes the review
   to the relevant lens subset. Phase B ships actual lens implementations;
   Phase A ships the wiring.
5. **Constitution lint** — five new lint checks validate the
   `constitution.md` format (RFC 2119 keyword presence, MUST-count
   sanity, CWE/MITRE mapping format, etc.).
6. **Slash command grouping** — mixed strategy: existing 14 commands
   remain flat for backward compatibility; new commands are grouped
   under `/caduceus:{sdd,review}:*` namespaces.

`v0.5.0` does **not** depend on, bridge to, or import from any
external pi package (`pi-review`, `pi-agents`, `dracond`,
`pi-muselinn-harness`, etc.). See `§10 Design References` for the
explicit reference-and-do-not-import policy.

## 2. Why now

Three converging forces make v0.5.0 the right next release.

| Pressure | Source | v0.5.0 response |
|---|---|---|
| Owner (`lyssom`) needs a personal lifecycle harness without `gentle-pi` | Self-maintained use, two concrete pain points: (a) `gentle-pi` injects Spanish persona content into the agent, (b) lifecycle management feels incomplete | caduceus becomes the persona-aware harness; gentle-pi eventually uninstalled |
| Industry consensus: SDD is the dominant AI-assisted engineering practice | OpenSpec (Fission-AI), GitHub Spec Kit (88k stars), BMAD, Kiro (AWS), ThoughtWorks Technology Radar Vol 33 (2025) | caduceus ships OpenSpec-compatible MD artifacts and a `constitution.md` aligned with the Marri 2026 Constitutional SDD pattern |
| pi ecosystem is mature enough to validate the demand space | `pi-review` 1.2.1 (review gate), `pi-agents` 0.16.1 (workflow orchestration), `dracond` 0.50.1 (mission control), `pi-muselinn-harness` 4.6k/mo (harness with budget) | caduceus enters the space, but **independently and brand-isolated** — no bridges, no shared code, no shared prompts |

The combination is decisive: there is a real owner-side demand,
the methodology is industry-validated, and the pi ecosystem has proven
the demand space exists. caduceus must differentiate by being
**persona-aware throughout** — every phase of the lifecycle carries
the active persona's voice, lens selection, and review posture.
This is the unique value proposition no other pi package offers.

## 3. Scope (locked)

### 3.1 In scope for v0.5.0

- **SDD commands** (5 new slash commands in `/caduceus:sdd:*`):
  - `/caduceus:sdd-init <name>` — initialize `openspec/changes/<name>/`
    directory with `proposal.md`, `design.md`, `tasks.md`,
    `requirements.md`, `constitution.md` templates
  - `/caduceus:sdd-explore <topic>` — interactive exploration session
    that produces the `requirements.md` skeleton
  - `/caduceus:sdd-propose <change-name>` — produce `proposal.md`
    from the active exploration context
  - `/caduceus:sdd-apply` — implement tasks from `tasks.md` against
    the `proposal.md` anchor (delegates to the existing pi tool loop;
    caduceus only provides the artifact-management scaffolding)
  - `/caduceus:sdd-archive` — move completed change into
    `openspec/changes/archive/<date>-<name>/`, update
    `STATUS.md` §8 Decision Records with the new change
- **Artifact extensions** (2 new files per change directory):
  - `requirements.md` — RFC 2119 / EARS-style requirement list.
    Each requirement carries a `MUST` / `SHOULD` / `MAY` keyword
    (RFC 2119 enforcement levels).
  - `constitution.md` — non-negotiable constraints. Each principle
    maps to a CWE / MITRE Top 25 reference (Marri 2026 pattern).
    Enforced by the new constitution lint.
- **Review state machine skeleton** (5-state, pure TS):
  - `inspect` — return current state of an in-progress change
  - `start <change>` — initialize a review session against a change
  - `advance <transition>` — apply a REVIEW_TRANSITION (start,
    consent, complete, abandon, etc.)
  - `finalize` — produce the receipt (content-bound JSON, no crypto)
  - `validate` — re-validate an existing receipt
  - Storage: `openspec/changes/<name>/.review/state.json` +
    `openspec/changes/<name>/.review/receipt.json`
  - Receipt schema: `{ changeId, contentHash, lensRuns, findings,
    finalVerificationPassed, timestamp }` (no signature)
- **Persona-aware lens framework** (5 slots, 0 implementations):
  - `lib/review-lens-framework.ts` exports a `Lens` interface
    and 5 named slot constants
  - Persona-to-lens mapping table (e.g., `security` persona →
    `security` lens required, `reviewer` persona → `readability`
    lens required)
  - Lens registry starts empty; Phase B populates it
- **Constitution lint** (5 new checks added to `lib/lint.ts`):
  - `CONSTITUTION_EXISTS` — change dir has `constitution.md`
  - `CONSTITUTION_RFC2119` — every line starts with one of
    `MUST` / `SHOULD` / `MAY` / `SHALL` / `SHALL NOT`
  - `CONSTITUTION_CWE_MAPPING` — every MUST principle maps to
    a CWE-XXX or MITRE reference
  - `CONSTITUTION_COUNT` — between 1 and 20 principles (sanity)
  - `CONSTITUTION_NO_DUPLICATE_IDS` — every principle has unique ID
- **Slash command grouping** (mixed strategy):
  - Existing 14 commands remain flat at the top level
    (`/caduceus:status`, `/caduceus:mode`, `/caduceus:persona`, etc.)
  - New commands grouped:
    - `/caduceus:sdd:init`, `/caduceus:sdd:explore`,
      `/caduceus:sdd:propose`, `/caduceus:sdd:apply`,
      `/caduceus:sdd:archive` (5 commands)
    - `/caduceus:review:inspect`, `/caduceus:review:start`,
      `/caduceus:review:advance`, `/caduceus:review:finalize`,
      `/caduceus:review:validate` (5 commands)
  - Total: 14 + 10 = 24 slash commands
- **Verification extension** (`scripts/verify-package.mjs`):
  - Add 3 new checks to the existing 14:
    - Check 15: no `import` from `pi-review` / `pi-agents` /
      `dracond` / `pi-muselinn-harness` in source
    - Check 16: no `peerDependencies` / `dependencies` referencing
      any external pi package (besides `@earendil-works/pi-coding-agent`
      peer)
    - Check 17: no `extensions/` / `skills/` content overlap with
      known external pi packages (fingerprint check)
  - Total: 17 pre-publish checks
- **Tests** (strict TDD, RED → GREEN → TRIANGULATE → REFACTOR):
  - Estimated +30 tests across 5 new test files
  - Total: 186 + 30 = ≥ 216 tests
- **Documentation updates**:
  - `README.md` — new "Lifecycle Foundation" section, updated
    slash command table
  - `CHANGELOG.md` — v0.5.0 entry
  - `openspec/AGENTS.md` — updated invariants list (DNA-3 revised)
  - `STATUS.md` — multiple amendments (see §9)

### 3.2 Explicitly out of scope (deferred to v0.6.0+)

- ❌ Full lens collection (5 concrete lens implementations) — **v0.6.0**
- ❌ Subagent orchestration (parallel / sequential / reduce) — **v0.7.0**
- ❌ Goal loop + budget (token / turn / wallClock) + queue (FIFO + priority) — **v0.8.0**
- ❌ Crypto signing of receipts — **probably never**
  (rationale: owner is sole user; no supply-chain threat model)
- ❌ Bridge to any external pi package — **never**
  (rationale: brand independence, see §10)
- ❌ LLM-generated content (persona / spec / constitution) — **probably never**
  (rationale: violates 0-runtime-deps invariant; would need a
  separate `caduceus-gen` optional package)
- ❌ Community gallery (`npx caduceus add <name>`) — **deferred**
  (rationale: premature at current adoption)
- ❌ Persona effectiveness measurement — **deferred**
  (rationale: needs >100 downloads/month to be meaningful)

### 3.3 Backward compatibility

v0.5.0 is **purely additive**:

- Default config and the 10 built-in personas work unchanged.
- All 186 v0.4.0 tests pass unchanged.
- The 14 existing slash commands keep their current behavior.
- Existing `openspec/changes/<name>/` directories without
  `requirements.md` / `constitution.md` continue to work; the new
  constitution lint only fires on changes that opt in.
- Existing 5 archived changes (v0.1.0 through v0.4.0) are not
  retroactively required to have `requirements.md` / `constitution.md`.

## 4. Success criteria (all must be true at archive)

1. `npm test` exits 0; full suite ≥ 216 tests, 0 failures
   (was 186 in v0.4.0).
2. `node scripts/verify-package.mjs` exits 0; 17/17 pre-publish
   checks pass (was 14/14 in v0.4.0).
3. **SDD commands**:
   - `/caduceus:sdd-init <name>` creates
     `openspec/changes/<name>/{proposal,design,tasks,requirements,constitution}.md`
     from templates
   - `/caduceus:sdd-explore <topic>` produces a non-empty
     `requirements.md` skeleton in the active change dir
   - `/caduceus:sdd-propose <name>` produces a non-empty
     `proposal.md` from the requirements
   - `/caduceus:sdd-apply` updates `tasks.md` checkboxes as
     tasks complete (read-only verification; the actual
     implementation is delegated to the pi tool loop)
   - `/caduceus:sdd-archive` moves the change into
     `openspec/changes/archive/<date>-<name>/` and appends a
     row to `STATUS.md` §8 Decision Records
4. **Review state machine**:
   - `inspect / start / advance / finalize / validate` form
     a complete cycle (any invalid transition is rejected
     with a falsifiable error message)
   - Receipt content-hash matches the change's
     `proposal.md + design.md + tasks.md` SHA-256 (content-bound,
     no signature)
   - Re-running `validate` on an existing receipt is idempotent
5. **Persona-aware lens**:
   - 5 lens slots exist in the registry (all empty in v0.5.0)
   - Switching to `security` persona tags the next review as
     requiring the `security` lens (assertion via test)
   - Switching to `reviewer` persona tags the next review as
     requiring the `readability` lens (assertion via test)
   - Lens-selection assertions are part of the test suite
6. **Constitution lint**:
   - 5 new lint checks pass on the canonical constitution
     template shipped with v0.5.0
   - Constitution with no `MUST` principles fails
     `CONSTITUTION_COUNT`
   - Constitution with unparseable CWE mapping fails
     `CONSTITUTION_CWE_MAPPING`
7. **Verification**:
   - Adding an `import` of `pi-review` to any source file
     causes `verify-package.mjs` to exit 1
   - Adding `pi-agents` to `dependencies` causes
     `verify-package.mjs` to exit 1
   - The 17-check suite is run on every `prepack`
8. v0.5.0 is published to npm and listed on the
   [pi.dev gallery](https://pi.dev/packages) with the updated
   description reflecting the lifecycle harness positioning.

## 5. Open questions for the user (none blocking)

- Q1: Should `/caduceus:sdd-init` reject names that collide with
  existing change directories, or auto-suffix with `-2`, `-3`, etc.?
  — **My recommendation:** reject with usage hint. Less surprise,
  matches `git switch` behavior.
- Q2: Should the receipt include the active persona name, or just
  the content hash and lens runs?
  — **My recommendation:** include persona. Persona is part of
  the receipt's reproducibility contract; switching personas
  invalidates the receipt and forces a re-review.
- Q3: Should `constitution.md` be **required** for new changes
  (lint enforces existence), or **optional** with a warning?
  — **My recommendation:** required for new changes, optional
  for changes that already exist at v0.5.0 install time.
  Migration is documented but not enforced.

## 6. Marketing plan (non-SDD, separate workstream)

- **Forum post (D-1)**: short note on v0.5.0 release
  ("caduceus v0.5.0: from persona contract to persona-aware
  lifecycle harness"). Frame as the natural evolution of
  v0.3.0 brand-independence + v0.4.0 profile-and-macro
  contextualization.
- **Strategy blog post (D+0 or D+1)**: longer narrative
  comparable in scale to the v0.3.0 brand-independence story.
  Cover: (a) why persona-aware lifecycle is the natural next
  step, (b) reference-and-not-bridge policy vs the pi
  ecosystem, (c) phased roadmap v0.5.0 → v0.8.0, (d)
  Constitutional SDD adoption.
- **No breaking changes announcement**: v0.5.0 is additive;
  existing users see no behavioral change unless they opt in.

## 7. Rollback

v0.5.0 is purely additive. Rolling back to v0.4.0:

1. `pi remove npm:pi-caduceus`
2. `pi install npm:pi-caduceus@0.4.0`
3. Any new slash commands are no longer recognized
   (pi falls back to "unknown command" error).
4. Any `openspec/changes/<name>/{requirements,constitution}.md`
   files added under v0.5.0 are ignored by v0.4.0 (no data loss).
5. Any `openspec/changes/<name>/.review/state.json` files are
   ignored by v0.4.0 (no data loss).

## 8. Next phase

`sdd-design` — write
`openspec/changes/caduceus-v0.5.0-lifecycle-foundation/design.md`
covering:

- SDD command implementations (templates, file I/O, error paths)
- Review state machine state-transition diagram
- Receipt schema in full (JSON shape, hashing algorithm)
- Lens framework interface (`Lens` type, `LensRegistry`,
  `LensSelectionRule`)
- Persona-aware routing rules (persona → lens subset)
- File change list (which files to add, which to modify)
- Test file mapping (which test files cover which feature)
- Constitution lint implementation details
- Slash command registration updates

Then `sdd-tasks` — 12-15 implementation tasks. Estimated
~3,000 LOC, within v0.4.0's 400-budget frame.

## 9. Amendment to STATUS.md

Multiple amendments are required. The full amendment texts are
recorded here for direct copy into `STATUS.md` after proposal
acceptance.

### 9.1 §1 (What caduceus is) — replace

**Current:** "caduceus is a Persona Contract package for the [pi]
coding agent."

**Proposed:** "caduceus is a **persona-aware general-purpose
lifecycle harness** for the [pi](https://pi.dev) coding agent. It
injects a deterministic, testable, byte-citable persona prompt
segment before the first token of a pi session, and drives a
full Spec-Driven Development lifecycle (explore → propose →
apply → archive) plus an optional review state machine, with
the active persona carrying through every phase. caduceus
references but does not bridge to other pi packages
(`pi-review`, `pi-agents`, `dracond`,
`pi-muselinn-harness`); it ships a complete, independent
implementation."

### 9.2 §3 (DNA-3) — revise

**Current:** "DNA-3: Light by default, compose later."

**Proposed:** "DNA-3-revised: **Light at the core, evolve into
persona-aware harness, compose internally only.** The persona
engine remains 0-deps / 0-native / 0-postinstall. The lifecycle
harness layer (SDD commands, review state machine, advisory
lint) is added incrementally across v0.5.0–v0.8.0. caduceus
**does not bridge to external pi packages** — composition
is internal (persona + SDD + review) only."

### 9.3 §5.4 (Decision matrix) — replace

**Current:** matrix that recommends `gentle-pi` for full SDD
cycle.

**Proposed:** matrix that reflects caduceus covering the full
lifecycle itself, with `gentle-pi` listed only for the niche
use cases caduceus explicitly does not cover (legacy users,
crypto-signed receipts).

### 9.4 §7 (Roadmap) — replace

**Current:** roadmap listing P0 candidates (`per-model variants`,
`LLM-generated persona`) for v0.5.0.

**Proposed:** roadmap reflecting the v0.5.0 → v0.8.0 four-phase
lifecycle evolution:
- v0.5.0 (this proposal) — Lifecycle Foundation (Phase A)
- v0.6.0 (next minor) — Full lens collection (Phase B)
- v0.7.0 (next minor) — Subagent orchestration (Phase C)
- v0.8.0 (next minor) — Goal loop + budget (Phase D)
- Beyond v0.8.0 — community gallery, persona effectiveness
  measurement, conditional on adoption growth

### 9.5 §8 (Decision records) — append

Add a new entry:

```
| 2026-08 (v0.5.0) | caduceus evolves from persona contract to persona-aware lifecycle harness | Self-use demand + industry SDD consensus + pi ecosystem maturity |
| 2026-08 (v0.5.0) | Reference-but-not-bridge policy for external pi packages | Brand independence (extends v0.3.0 decision) |
| 2026-08 (v0.5.0) | Constitution pattern adopted for change-level constraints | Marri 2026 Constitutional SDD pattern, lighter than state machine enforcement |
| 2026-08 (v0.5.0) | Slash command grouping: flat for existing, grouped for new | Backward compat + progressive enhancement |
```

## 10. Design References

The following external projects informed the v0.5.0 design
without contributing any code, prompts, or text. caduceus
**does not import, bridge to, or depend on** any of them.

| Project | Reference taken | Reference NOT taken |
|---|---|---|
| `pi-review` (v1.2.1) | P0/P1/P2/P3 finding priority structure; branch-based review; thinking-level configuration | All code, all prompt text, the `/review` slash command |
| `pi-agents` (v0.16.1) | Parallel/sequential workflow abstraction with `reduce`; zero-config defaults | All code, the `/workflow` slash command, the static flow graph validator |
| `dracond` (v0.50.1) | Git-worktree isolation per review; mission-control concept; forever-loop pattern | All code, the auditor process design, the cost accounting |
| `pi-muselinn-harness` (4.6k/mo) | Five-piece harness abstraction (Swarm / Goal / Plan / Task / Permission); triple budget (token + turn + wallClock); FIFO + priority queue | All code, the braille TUI, the persistence scheme |
| `OpenSpec` (Fission-AI) | MD artifact directory convention; `changes/<name>/{proposal,design,tasks}.md` | All other code; caduceus uses its own command set |
| `Constitutional SDD` (Marri, arXiv 2026) | MUST / SHOULD / MAY enforcement levels; CWE / MITRE Top 25 mapping | All other content; caduceus implements its own constitution lint |
| `gentle-ai` | (no reference taken) | (brand-independence commitment from v0.3.0 extends) |

**Enforcement**: `scripts/verify-package.mjs` Check 15 (no import
of these packages) and Check 16 (no dependency on these packages)
mechanically prevent future commits from re-introducing any
external dependency on these projects.

---

> **End of proposal.** Awaiting lyssom review. Once accepted,
> proceed to `sdd-design` and produce `design.md`.
